class TrainingSession < ApplicationRecord
  belongs_to :user
  has_many :shots, dependent: :destroy

  validates :external_id, presence: true, uniqueness: { scope: :user_id }
  validates :source, presence: true
end
