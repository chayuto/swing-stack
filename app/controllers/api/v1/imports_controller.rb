module Api
  module V1
    # Telemetry ingestion. The request cycle only validates and stores
    # the raw payload; parsing happens on the worker tier
    # (TrackmanImportJob), so a dense export never blocks a web thread.
    class ImportsController < BaseController
      before_action -> { authenticate_actor!(scope: "telemetry:write") }, only: :create
      before_action -> { authenticate_actor!(scope: "telemetry:read") }, only: %i[index show]

      def create
        payload = parse_body
        return render json: { error: "invalid_payload", details: "expected a TrackMan report JSON object" }, status: :unprocessable_entity unless payload.is_a?(Hash)

        batch = current_user.import_batches.create!(raw_payload: payload, source: "trackman")
        TrackmanImportJob.perform_later(batch.id)
        render json: serialize(batch), status: :accepted
      end

      def index
        render json: current_user.import_batches.order(created_at: :desc).limit(50).map { |b| serialize(b) }
      end

      def show
        render json: serialize(current_user.import_batches.find(params[:id]))
      end

      private

      def parse_body
        JSON.parse(request.raw_post)
      rescue JSON::ParserError
        nil
      end

      def serialize(batch)
        batch.as_json(only: %i[id status source filename sessions_count shots_count error_message processed_at created_at])
      end
    end
  end
end
