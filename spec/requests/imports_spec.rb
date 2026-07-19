require "rails_helper"

RSpec.describe "Imports", type: :request do
  let(:user) { create(:user) }
  let(:json_headers) { { "CONTENT_TYPE" => "application/json" } }

  describe "POST /api/v1/imports" do
    it "accepts a report from a human client and processes it on the worker tier" do
      post "/api/v1/imports", params: trackman_payload.to_json,
                              headers: jwt_headers(user).merge(json_headers)

      expect(response).to have_http_status(:accepted)
      batch_id = response.parsed_body["id"]
      expect(TrackmanImportJob).to have_been_enqueued.with(batch_id)

      perform_enqueued_jobs

      get "/api/v1/imports/#{batch_id}", headers: jwt_headers(user)
      expect(response.parsed_body).to include(
        "status" => "completed", "sessions_count" => 1, "shots_count" => 52
      )
    end

    it "accepts a report from an agent holding telemetry:write" do
      post "/api/v1/imports", params: trackman_payload.to_json,
                              headers: api_key_headers(user, scopes: %w[telemetry:write]).merge(json_headers)

      expect(response).to have_http_status(:accepted)
    end

    it "refuses an agent without the write scope" do
      post "/api/v1/imports", params: trackman_payload.to_json,
                              headers: api_key_headers(user, scopes: %w[telemetry:read]).merge(json_headers)

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["required_scope"]).to eq("telemetry:write")
    end

    it "refuses unauthenticated requests" do
      post "/api/v1/imports", params: trackman_payload.to_json, headers: json_headers
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects non-JSON bodies" do
      post "/api/v1/imports", params: "not json", headers: jwt_headers(user).merge(json_headers)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "marks the batch failed when the payload is not a TrackMan report" do
      post "/api/v1/imports", params: { nope: true }.to_json,
                              headers: jwt_headers(user).merge(json_headers)
      batch_id = response.parsed_body["id"]

      expect { perform_enqueued_jobs }.to raise_error(Trackman::ReportParser::Error)
      expect(ImportBatch.find(batch_id)).to be_failed
    end
  end
end
