module Trackman
  # Persists a parsed TrackMan report for a user. Idempotent: sessions
  # and shots are upserted by their external (device-issued) ids, so
  # overlapping report exports never duplicate data.
  class Importer
    Result = Data.define(:sessions_count, :shots_count)

    # update_only replays a stored payload over sessions that already exist.
    # Reclassify uses it so a session the owner deleted stays deleted.
    def initialize(user:, payload:, update_only: false)
      @user = user
      @payload = payload
      @update_only = update_only
    end

    def call
      parsed = ReportParser.new(@payload).sessions
      shots_count = 0
      touched = {}

      ActiveRecord::Base.transaction do
        parsed.each do |entry|
          session = upsert_session(entry[:session])
          next if session.nil?

          touched[session.id] = session
          entry[:shots].each do |shot_attrs|
            upsert_shot(session, shot_attrs)
            shots_count += 1
          end
        end

        touched.each_value { |session| align_played_on(session) }
      end

      # Sessions persisted, not stroke groups parsed. One session split across
      # UTC midnight arrives as two groups but is one session.
      Result.new(sessions_count: touched.size, shots_count: shots_count)
    end

    private

    # A session that runs past UTC midnight is exported as two stroke groups
    # sharing one id, each carrying its own UTC date. Merging them leaves the
    # later date on the record, so date the session by its first stroke in
    # the player's zone.
    def align_played_on(session)
      first = session.shots.minimum(:struck_at)
      return if first.nil?

      played_on = first.in_time_zone.to_date
      session.update!(played_on: played_on) unless session.played_on == played_on
    end

    def upsert_session(attrs)
      session = @user.training_sessions.find_by(external_id: attrs[:external_id])
      return nil if session.nil? && @update_only

      session ||= @user.training_sessions.new(external_id: attrs[:external_id])
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
