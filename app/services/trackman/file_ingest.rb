module Trackman
  # Ingests report exports from a directory of *.json files. Each file
  # is tracked by its SHA-256 checksum on import_batches, so a re-run
  # only parses files it has not completed before. Failed files retry
  # on the next run. Shot-level upserts in Importer remain the safety
  # net against overlapping exports.
  class FileIngest
    Result = Data.define(:filename, :status, :sessions_count, :shots_count, :error) do
      def to_line
        case status
        when :skipped then "#{filename}: already ingested"
        when :completed then "#{filename}: #{sessions_count} session(s), #{shots_count} shot(s)"
        else "#{filename}: failed (#{error})"
        end
      end
    end

    def initialize(user:, dir:)
      @user = user
      @dir = Pathname(dir)
    end

    def call
      @dir.glob("*.json").sort.map { |path| ingest(path) }
    end

    private

    def ingest(path)
      checksum = Digest::SHA256.file(path).hexdigest
      batch = @user.import_batches.find_or_initialize_by(file_checksum: checksum)
      if batch.completed?
        return Result.new(filename: path.basename.to_s, status: :skipped,
                          sessions_count: batch.sessions_count, shots_count: batch.shots_count, error: nil)
      end

      payload = JSON.parse(path.read)
      unless payload.is_a?(Hash)
        return failed(path, "expected a TrackMan report JSON object")
      end

      batch.update!(raw_payload: payload, filename: path.basename.to_s, source: "trackman", status: :pending)
      begin
        TrackmanImportJob.perform_now(batch.id)
      rescue StandardError
        # The job records the failure on the batch; the result line reports it.
      end
      batch.reload
      Result.new(filename: path.basename.to_s, status: batch.status.to_sym,
                 sessions_count: batch.sessions_count, shots_count: batch.shots_count, error: batch.error_message)
    rescue JSON::ParserError => e
      failed(path, "invalid JSON: #{e.message.truncate(80)}")
    end

    def failed(path, message)
      Result.new(filename: path.basename.to_s, status: :failed, sessions_count: 0, shots_count: 0, error: message)
    end
  end
end
