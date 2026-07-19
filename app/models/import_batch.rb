class ImportBatch < ApplicationRecord
  belongs_to :user

  enum :status, {
    pending: "pending",
    processing: "processing",
    completed: "completed",
    failed: "failed"
  }, default: :pending

  validates :raw_payload, presence: true
  validates :source, presence: true

  def mark_completed!(sessions_count:, shots_count:)
    update!(
      status: :completed,
      sessions_count: sessions_count,
      shots_count: shots_count,
      processed_at: Time.current,
      error_message: nil
    )
  end

  def mark_failed!(error)
    update!(status: :failed, error_message: error.message.truncate(1_000), processed_at: Time.current)
  end
end
