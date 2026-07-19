class Shot < ApplicationRecord
  belongs_to :training_session
  belongs_to :club, optional: true

  has_one :user, through: :training_session

  validates :external_id, presence: true, uniqueness: { scope: :training_session_id }

  scope :for_user, ->(user) { joins(:training_session).where(training_sessions: { user_id: user.id }) }
  scope :chronological, -> { order(:struck_at) }

  # Telemetry columns exposed by the API, in display order.
  TELEMETRY = %w[
    club_speed attack_angle club_path dynamic_loft face_angle spin_loft
    face_to_path swing_plane swing_direction swing_radius low_point_distance
    impact_offset impact_height dynamic_lie
    ball_speed smash_factor launch_angle launch_direction spin_rate spin_axis
    curve max_height carry total_distance carry_side total_side landing_angle
    hang_time norm_carry norm_total_distance norm_total_side
  ].freeze
end
