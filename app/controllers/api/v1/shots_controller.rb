module Api
  module V1
    class ShotsController < BaseController
      MAX_PER_PAGE = 200

      before_action -> { authenticate_actor!(scope: "telemetry:read") }

      def index
        shots = Shot.for_user(current_user).includes(:club).chronological
        shots = shots.where(training_session_id: params[:session_id]) if params[:session_id].present?
        shots = shots.where(club_id: params[:club_id]) if params[:club_id].present?

        per_page = [ params.fetch(:per_page, 100).to_i, MAX_PER_PAGE ].min
        page = [ params.fetch(:page, 1).to_i, 1 ].max
        total = shots.count
        with_trajectory = params[:include].to_s.split(",").include?("trajectory")

        render json: {
          shots: shots.offset((page - 1) * per_page).limit(per_page).map { |s| serialize(s, with_trajectory:) },
          page: page,
          per_page: per_page,
          total: total
        }
      end

      private

      def serialize(shot, with_trajectory: false)
        columns = %i[id external_id training_session_id struck_at reduced_accuracy] + Shot::TELEMETRY.map(&:to_sym)
        columns << :ball_trajectory if with_trajectory
        shot.as_json(only: columns)
            .merge(club: shot.club && { id: shot.club.id, label: shot.club.label })
      end
    end
  end
end
