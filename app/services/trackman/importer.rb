module Trackman
  # Persists a parsed TrackMan report for a user. Idempotent: sessions
  # and shots are upserted by their external (device-issued) ids, so
  # overlapping report exports never duplicate data.
  class Importer
    Result = Data.define(:sessions_count, :shots_count)

    def initialize(user:, payload:)
      @user = user
      @payload = payload
    end

    def call
      parsed = ReportParser.new(@payload).sessions
      shots_count = 0

      ActiveRecord::Base.transaction do
        parsed.each do |entry|
          session = upsert_session(entry[:session])
          entry[:shots].each do |shot_attrs|
            upsert_shot(session, shot_attrs)
            shots_count += 1
          end
        end
      end

      Result.new(sessions_count: parsed.size, shots_count: shots_count)
    end

    private

    def upsert_session(attrs)
      session = @user.training_sessions.find_or_initialize_by(external_id: attrs[:external_id])
      session.update!(attrs.except(:external_id))
      session
    end

    def upsert_shot(session, attrs)
      # Both club facts from the export are stored verbatim (bay_club,
      # bay_loft_deg); the club assignment is our interpretation. The
      # name is what TrackMan's own UI groups by, so it wins. The loft
      # config is unreliable and only breaks ties for nameless strokes,
      # resolved through the user's bag map.
      name = attrs.delete(:club_name)
      loft = attrs.delete(:static_loft_deg)
      club =
        if name.present?
          Club.for_name!(@user, name)
        elsif loft
          Club.for_loft!(@user, loft)
        end

      shot = session.shots.find_or_initialize_by(external_id: attrs[:external_id])
      shot.update!(attrs.except(:external_id).merge(club: club, bay_club: name, bay_loft_deg: loft))
      shot
    end
  end
end
