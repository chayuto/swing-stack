class TrainingSession < ApplicationRecord
  # Creation is documented by the import batch; audit edits only.
  has_paper_trail on: %i[update destroy]

  belongs_to :user
  has_many :shots, dependent: :destroy

  validates :external_id, presence: true, uniqueness: { scope: :user_id }
  validates :source, presence: true
end
