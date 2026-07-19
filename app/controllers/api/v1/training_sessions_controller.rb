module Api
  module V1
    class TrainingSessionsController < BaseController
      before_action -> { authenticate_actor!(scope: "telemetry:read") }

      def index
        sessions = current_user.training_sessions
                               .left_joins(:shots)
                               .select("training_sessions.*, COUNT(shots.id) AS shots_count")
                               .group("training_sessions.id")
                               .order(played_on: :desc)
        render json: sessions.map { |s| serialize(s).merge(shots_count: s[:shots_count]) }
      end

      def show
        session = current_user.training_sessions.find(params[:id])
        render json: serialize(session).merge(
          shots_count: session.shots.count,
          clubs: session.shots.joins(:club).group("clubs.label").count
        )
      end

      private

      def serialize(session)
        session.as_json(only: %i[id external_id source played_on facility bay ball_type temperature created_at])
      end
    end
  end
end
