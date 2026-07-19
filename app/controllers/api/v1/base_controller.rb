module Api
  module V1
    class BaseController < ApplicationController
      include Authenticable

      rescue_from ActiveRecord::RecordNotFound do
        render json: { error: "not_found" }, status: :not_found
      end

      rescue_from ActiveRecord::RecordInvalid do |e|
        render json: { error: "validation_failed", details: e.record.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end
end
