require "rails_helper"

RSpec.describe "Auth", type: :request do
  describe "POST /api/v1/auth/register" do
    it "creates a user and returns a token pair" do
      post "/api/v1/auth/register", params: { email: "new@example.com", password: "sup3r-secret", name: "New" }

      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["access_token"]).to be_present
      expect(body["refresh_token"]).to be_present
      expect(body.dig("user", "email")).to eq("new@example.com")
    end
  end

  describe "POST /api/v1/auth/login" do
    let!(:user) { create(:user) }

    it "returns tokens for valid credentials" do
      post "/api/v1/auth/login", params: { email: user.email, password: "correct-horse-battery" }

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["access_token"]).to be_present
    end

    it "rejects bad credentials" do
      post "/api/v1/auth/login", params: { email: user.email, password: "wrong" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/auth/refresh" do
    let!(:user) { create(:user) }

    it "rotates the refresh token — the old one is single-use" do
      post "/api/v1/auth/login", params: { email: user.email, password: "correct-horse-battery" }
      original = response.parsed_body["refresh_token"]

      post "/api/v1/auth/refresh", params: { refresh_token: original }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["refresh_token"]).not_to eq(original)

      post "/api/v1/auth/refresh", params: { refresh_token: original }
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
