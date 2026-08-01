class AddCalibrationOffsetToTrainingSessions < ActiveRecord::Migration[8.1]
  def change
    # Degrees added to bay-reported direction metrics (face angle, club
    # path, launch direction) to express them against the true target
    # line. Positive when the bay read left of true. Stored telemetry
    # stays exactly as TrackMan reported it; the correction is a read
    # layer applied at serialization and display time.
    add_column :training_sessions, :calibration_offset_deg, :float
  end
end
