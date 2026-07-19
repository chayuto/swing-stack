class CreateShots < ActiveRecord::Migration[8.1]
  def change
    create_table :shots, id: :uuid do |t|
      t.references :training_session, null: false, foreign_key: true, type: :uuid
      t.references :club, foreign_key: true, type: :uuid
      t.string :external_id, null: false # launch monitor stroke id
      t.datetime :struck_at

      # --- Club data (SI units: m/s, degrees, metres) ---
      t.float :club_speed
      t.float :attack_angle
      t.float :club_path
      t.float :dynamic_loft
      t.float :face_angle
      t.float :spin_loft
      t.float :face_to_path
      t.float :swing_plane
      t.float :swing_direction
      t.float :swing_radius
      t.float :low_point_distance
      t.float :impact_offset
      t.float :impact_height
      t.float :dynamic_lie

      # --- Ball data ---
      t.float :ball_speed
      t.float :smash_factor
      t.float :launch_angle
      t.float :launch_direction
      t.float :spin_rate
      t.float :spin_axis
      t.float :curve
      t.float :max_height
      t.float :carry
      t.float :total_distance
      t.float :carry_side
      t.float :total_side
      t.float :landing_angle
      t.float :hang_time

      # --- Normalized (weather/altitude-adjusted) figures ---
      t.float :norm_carry
      t.float :norm_total_distance
      t.float :norm_total_side

      t.string :reduced_accuracy, array: true, null: false, default: []
      t.jsonb :ball_trajectory # compacted [x, y, z] flight points

      t.timestamps
    end
    add_index :shots, %i[training_session_id external_id], unique: true
    add_index :shots, :struck_at
  end
end
