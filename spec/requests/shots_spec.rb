require "rails_helper"

RSpec.describe "Shots", type: :request do
  let(:user) { create(:user) }

  before { Trackman::Importer.new(user: user, payload: trackman_payload).call }

  describe "GET /api/v1/shots" do
    it "pages telemetry for a read-scoped agent" do
      get "/api/v1/shots", params: { per_page: 10, page: 2 },
                           headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["total"]).to eq(52)
      expect(body["page"]).to eq(2)
      expect(body["shots"].length).to eq(10)
      expect(body["shots"].first).to include("carry", "carry_side", "club")
      expect(body["shots"].first).not_to have_key("ball_trajectory")
    end

    it "includes ball trajectories only on request" do
      get "/api/v1/shots", params: { include: "trajectory", per_page: 1 },
                           headers: api_key_headers(user, scopes: %w[telemetry:read])

      shot = response.parsed_body["shots"].first
      expect(shot["ball_trajectory"]).to be_present
      expect(shot["ball_trajectory"].first.length).to eq(3)
    end

    it "filters by club" do
      club = user.clubs.find_by!(static_loft_deg: 54.0)
      get "/api/v1/shots", params: { club_id: club.id },
                           headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response.parsed_body["total"]).to eq(8)
    end
  end
end
