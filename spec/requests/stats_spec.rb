require "rails_helper"

RSpec.describe "Stats", type: :request do
  let(:user) { create(:user) }

  before { Trackman::Importer.new(user: user, payload: trackman_payload).call }

  describe "GET /api/v1/stats/clubs" do
    it "returns per-club aggregates for a read-scoped agent" do
      get "/api/v1/stats/clubs", headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response).to have_http_status(:ok)
      rows = response.parsed_body
      expect(rows.length).to eq(3)

      mid_iron = rows.find { |r| r.dig("club", "static_loft_deg").to_f == 31.0 }
      expect(mid_iron["shots_count"]).to eq(16)
      expect(mid_iron.dig("averages", "carry")).to be_between(100, 170)
      expect(mid_iron.dig("averages", "smash_factor")).to be_between(1.0, 1.6)
      expect(mid_iron.dig("dispersion", "carry_sd")).to be_positive
    end

    it "does not leak other users' telemetry" do
      stranger = create(:user)
      get "/api/v1/stats/clubs", headers: api_key_headers(stranger, scopes: %w[telemetry:read])

      expect(response.parsed_body).to be_empty
    end
  end
end
