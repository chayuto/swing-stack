module Api
  module V1
    class ClubsController < BaseController
      before_action -> { authenticate_actor!(scope: "telemetry:read") }, only: :index
      before_action :authenticate_user!, only: :update # labelling is a human action

      def index
        clubs = current_user.clubs
                            .left_joins(:shots)
                            .select("clubs.*, COUNT(shots.id) AS shots_count")
                            .group("clubs.id")
                            .order(:static_loft_deg)
        render json: clubs.map { |c| serialize(c).merge(shots_count: c[:shots_count]) }
      end

      def update
        club = current_user.clubs.find(params[:id])
        club.update!(params.permit(:label))
        render json: serialize(club)
      end

      private

      def serialize(club)
        club.as_json(only: %i[id label static_loft_deg created_at])
      end
    end
  end
end
