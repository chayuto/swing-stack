require "rails_helper"

RSpec.describe "Docs", type: :request do
  describe "GET /api/v1/openapi.json" do
    it "serves the OpenAPI description without auth" do
      get "/api/v1/openapi.json"

      expect(response).to have_http_status(:ok)
      spec = response.parsed_body
      expect(spec["openapi"]).to start_with("3.1")
      expect(spec["paths"]).to include("/shots", "/stats/clubs", "/imports")
    end

    it "documents every public route" do
      get "/api/v1/openapi.json"
      documented = response.parsed_body["paths"].keys.map { |p| p.gsub(/\{\w+\}/, ":id") }

      actual = Rails.application.routes.routes.filter_map do |r|
        path = r.path.spec.to_s.sub("(.:format)", "")
        next unless path.start_with?("/api/v1/")
        path.sub("/api/v1", "")
      end.uniq

      expect(documented).to match_array(actual)
    end
  end
end
