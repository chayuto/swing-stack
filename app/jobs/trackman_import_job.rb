# Parsing a dense report export (hundreds of strokes, full ball
# trajectories) is a blocking operation — it runs on the worker tier,
# never in the request cycle.
class TrackmanImportJob < ApplicationJob
  queue_as :default

  def perform(import_batch_id)
    batch = ImportBatch.find(import_batch_id)
    return unless batch.pending?

    batch.processing!
    result = PaperTrail.request(whodunnit: "import_batch:#{batch.id}") do
      Trackman::Importer.new(user: batch.user, payload: batch.raw_payload).call
    end
    batch.mark_completed!(sessions_count: result.sessions_count, shots_count: result.shots_count)
  rescue StandardError => e
    batch&.mark_failed!(e)
    raise
  end
end
