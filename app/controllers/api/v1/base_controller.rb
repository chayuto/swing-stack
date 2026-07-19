module Api
  module V1
    class BaseController < ApplicationController
      include Authenticable

      # Audit attribution. A lambda because this callback runs before
      # authentication does; paper_trail resolves it when a version is
      # actually written, by which point the actor is known.
      before_action { PaperTrail.request.whodunnit = -> { audit_actor } }

      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: "not_found" }, status: :not_found
      end

      rescue_from ActiveRecord::RecordInvalid do |e|
        render json: { error: "validation_failed", details: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      private

      def audit_actor
        if current_api_token
          "api_token:#{current_api_token.id}"
        elsif current_user
          "user:#{current_user.id}"
        end
      end
    end
  end
end
