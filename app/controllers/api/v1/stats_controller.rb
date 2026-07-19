module Api
  module V1
    # Aggregated club efficiency metrics, computed in-database. This is
    # the analytical surface agents typically consume (telemetry:read).
    class StatsController < BaseController
      before_action -> { authenticate_actor!(scope: "telemetry:read") }

      AGGREGATES = <<~SQL.squish.freeze
        clubs.id   AS club_id,
        clubs.label AS club_label,
        clubs.static_loft_deg,
        COUNT(shots.id)               AS shots_count,
        AVG(shots.club_speed)         AS avg_club_speed,
        AVG(shots.ball_speed)         AS avg_ball_speed,
        AVG(shots.smash_factor)       AS avg_smash_factor,
        AVG(shots.launch_angle)       AS avg_launch_angle,
        AVG(shots.spin_rate)          AS avg_spin_rate,
        AVG(shots.max_height)         AS avg_max_height,
        AVG(shots.carry)              AS avg_carry,
        STDDEV_SAMP(shots.carry)      AS sd_carry,
        MIN(shots.carry)              AS min_carry,
        MAX(shots.carry)              AS max_carry,
        AVG(shots.total_distance)     AS avg_total_distance,
        STDDEV_SAMP(shots.carry_side) AS sd_carry_side,
        AVG(shots.attack_angle)       AS avg_attack_angle,
        AVG(shots.club_path)          AS avg_club_path,
        AVG(shots.face_to_path)       AS avg_face_to_path
      SQL

      def clubs
        rows = Shot.for_user(current_user)
                   .joins(:club)
                   .group("clubs.id", "clubs.label", "clubs.static_loft_deg")
                   .order("clubs.static_loft_deg")
                   .select(AGGREGATES)

        render json: rows.map { |row| serialize(row) }
      end

      private

      def serialize(row)
        {
          club: { id: row[:club_id], label: row[:club_label], static_loft_deg: row[:static_loft_deg] },
          shots_count: row[:shots_count],
          averages: {
            club_speed: round(row[:avg_club_speed]),
            ball_speed: round(row[:avg_ball_speed]),
            smash_factor: round(row[:avg_smash_factor], 3),
            launch_angle: round(row[:avg_launch_angle]),
            spin_rate: round(row[:avg_spin_rate], 0),
            max_height: round(row[:avg_max_height]),
            carry: round(row[:avg_carry]),
            total_distance: round(row[:avg_total_distance]),
            attack_angle: round(row[:avg_attack_angle]),
            club_path: round(row[:avg_club_path]),
            face_to_path: round(row[:avg_face_to_path])
          },
          dispersion: {
            carry_sd: round(row[:sd_carry]),
            carry_min: round(row[:min_carry]),
            carry_max: round(row[:max_carry]),
            side_sd: round(row[:sd_carry_side])
          }
        }
      end

      def round(value, digits = 1)
        value&.to_f&.round(digits)
      end
    end
  end
end
