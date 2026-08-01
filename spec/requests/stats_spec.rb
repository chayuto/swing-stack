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

    it "reports face and path averages with spreads" do
      get "/api/v1/stats/clubs", headers: api_key_headers(user, scopes: %w[telemetry:read])

      mid_iron = response.parsed_body.find { |r| r.dig("club", "static_loft_deg").to_f == 31.0 }
      expect(mid_iron.dig("averages", "face_angle")).to be_a(Float)
      expect(mid_iron.dig("averages", "club_path")).to be_a(Float)
      expect(mid_iron.dig("dispersion", "face_angle_sd")).to be_positive
      expect(mid_iron.dig("dispersion", "face_to_path_sd")).to be_positive
    end

    it "scopes to a session" do
      session_id = user.training_sessions.sole.id
      get "/api/v1/stats/clubs", params: { session_id: session_id },
                                 headers: api_key_headers(user, scopes: %w[telemetry:read])
      expect(response.parsed_body.length).to eq(3)

      get "/api/v1/stats/clubs", params: { session_id: SecureRandom.uuid },
                                 headers: api_key_headers(user, scopes: %w[telemetry:read])
      expect(response.parsed_body).to be_empty
    end

    it "honours a minimum carry cutoff" do
      get "/api/v1/stats/clubs", params: { min_carry: 500 },
                                 headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response.parsed_body).to be_empty
    end

    it "leaves excluded shots out of aggregates" do
      club = user.clubs.find_by!(static_loft_deg: 54.0)
      Shot.for_user(user).where(club: club).first.update!(excluded: true)

      get "/api/v1/stats/clubs", headers: api_key_headers(user, scopes: %w[telemetry:read])

      wedge = response.parsed_body.find { |r| r.dig("club", "id") == club.id }
      expect(wedge["shots_count"]).to eq(7)
    end

    it "applies the session calibration offset when calibrated=1" do
      user.training_sessions.sole.update!(calibration_offset_deg: 2.8)

      get "/api/v1/stats/clubs", headers: api_key_headers(user, scopes: %w[telemetry:read])
      raw = response.parsed_body.find { |r| r.dig("club", "static_loft_deg").to_f == 31.0 }

      get "/api/v1/stats/clubs", params: { calibrated: "1" },
                                 headers: api_key_headers(user, scopes: %w[telemetry:read])
      calibrated = response.parsed_body.find { |r| r.dig("club", "static_loft_deg").to_f == 31.0 }

      expect(calibrated.dig("averages", "face_angle"))
        .to be_within(0.11).of(raw.dig("averages", "face_angle") + 2.8)
      expect(calibrated.dig("averages", "club_path"))
        .to be_within(0.11).of(raw.dig("averages", "club_path") + 2.8)
      # A difference of two directions: the offset cancels.
      expect(calibrated.dig("averages", "face_to_path")).to eq(raw.dig("averages", "face_to_path"))
      # A constant shift never changes a spread.
      expect(calibrated.dig("dispersion", "face_angle_sd")).to eq(raw.dig("dispersion", "face_angle_sd"))
    end

    it "returns raw aggregates when no offset is stored, calibrated or not" do
      get "/api/v1/stats/clubs", headers: api_key_headers(user, scopes: %w[telemetry:read])
      raw = response.parsed_body

      get "/api/v1/stats/clubs", params: { calibrated: "1" },
                                 headers: api_key_headers(user, scopes: %w[telemetry:read])

      expect(response.parsed_body).to eq(raw)
    end

    it "does not leak other users' telemetry" do
      stranger = create(:user)
      get "/api/v1/stats/clubs", headers: api_key_headers(stranger, scopes: %w[telemetry:read])

      expect(response.parsed_body).to be_empty
    end
  end
end
