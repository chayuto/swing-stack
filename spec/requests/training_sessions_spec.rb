require "rails_helper"

RSpec.describe "Training sessions", type: :request do
  let(:user) { create(:user) }
  let(:session) { user.training_sessions.sole }

  before { Trackman::Importer.new(user: user, payload: trackman_payload).call }

  describe "GET /api/v1/sessions" do
    it "serializes the calibration offset" do
      session.update!(calibration_offset_deg: 2.8)
      get "/api/v1/sessions", headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response).to have_http_status(:ok)
      row = response.parsed_body.sole
      expect(row["calibration_offset_deg"]).to eq(2.8)
    end
  end

  describe "PATCH /api/v1/sessions/:id" do
    it "sets the offset for the owner and audits the edit" do
      patch "/api/v1/sessions/#{session.id}", params: { calibration_offset_deg: 2.8 },
                                              headers: jwt_headers(user)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["calibration_offset_deg"]).to eq(2.8)
      expect(session.reload.calibration_offset_deg).to eq(2.8)

      version = session.versions.last
      expect(version.event).to eq("update")
      expect(version.whodunnit).to eq("user:#{user.id}")
    end

    it "clears the offset with null" do
      session.update!(calibration_offset_deg: 2.8)
      patch "/api/v1/sessions/#{session.id}",
            params: { calibration_offset_deg: nil }.to_json,
            headers: jwt_headers(user).merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:ok)
      expect(session.reload.calibration_offset_deg).to be_nil
    end

    it "rejects an implausible offset" do
      patch "/api/v1/sessions/#{session.id}", params: { calibration_offset_deg: 45 },
                                              headers: jwt_headers(user)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.calibration_offset_deg).to be_nil
    end

    it "rejects a read-only agent key" do
      patch "/api/v1/sessions/#{session.id}", params: { calibration_offset_deg: 2.8 },
                                              headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["required_scope"]).to eq("telemetry:write")
    end

    it "cannot touch another user's session" do
      stranger = create(:user)
      patch "/api/v1/sessions/#{session.id}", params: { calibration_offset_deg: 2.8 },
                                              headers: jwt_headers(stranger)

      expect(response).to have_http_status(:not_found)
    end

    it "ignores attempts to rewrite telemetry facts" do
      original_bay = session.bay
      patch "/api/v1/sessions/#{session.id}",
            params: { calibration_offset_deg: 1.0, bay: "Forged Bay", facility: "Elsewhere" },
            headers: jwt_headers(user)

      expect(response).to have_http_status(:ok)
      expect(session.reload.bay).to eq(original_bay)
    end
  end
end
