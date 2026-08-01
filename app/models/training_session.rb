class TrainingSession < ApplicationRecord
  # Creation is documented by the import batch; audit edits only.
  has_paper_trail on: %i[update destroy]

  belongs_to :user
  has_many :shots, dependent: :destroy

  validates :external_id, presence: true, uniqueness: { scope: :user_id }
  validates :source, presence: true
  # Bay target-line correction, in degrees. Telemetry itself is never
  # rewritten; readers add this to direction metrics on the way out.
  validates :calibration_offset_deg,
            numericality: { greater_than_or_equal_to: -15, less_than_or_equal_to: 15 },
            allow_nil: true
end
