module Api
  module V1
    # Serves the OpenAPI description so agents can discover the API
    # surface without reading the source. Intentionally unauthenticated.
    class DocsController < BaseController
      SPEC_PATH = Rails.root.join("docs/api/openapi.json")

      def openapi
        send_file SPEC_PATH, type: "application/json", disposition: "inline"
      end
    end
  end
end
