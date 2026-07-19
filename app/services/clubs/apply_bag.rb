module Clubs
  # Reconciles the user's clubs with the bag they actually play.
  #
  # Each bag entry is { label:, loft:, bay_lofts: }: the club's name, its
  # nominal loft, and every bay loft config the launch monitor has
  # attached to it. For each entry this claims the listed lofts: shots
  # and loft mappings move from placeholder clubs onto the real club,
  # emptied placeholders are destroyed, and unseen lofts are mapped
  # ahead of time so future imports classify on arrival. Idempotent, and
  # every move is audited (shots, mappings, and clubs all carry
  # paper_trail).
  class ApplyBag
    def initialize(user:, bag:)
      @user = user
      @bag = bag
    end

    def call
      @bag.map { |spec| apply(spec) }
    end

    private

    def apply(spec)
      mappings = @user.club_lofts.where(loft_deg: spec[:bay_lofts]).order(:loft_deg).includes(:club).to_a
      club = target_club(spec, mappings)
      created = club.previously_new_record?
      absorbed = []

      ActiveRecord::Base.transaction do
        mappings.each do |mapping|
          donor = mapping.club
          next if donor == club

          absorbed << "#{donor.label} (#{donor.shots.count} shots)"
          donor.shots.find_each { |shot| shot.update!(club: club) }
          mapping.update!(club: club)
          donor.reload
          donor.destroy! if donor.shots.none? && donor.club_lofts.none?
        end

        spec[:bay_lofts].each do |loft|
          @user.club_lofts.find_or_create_by!(loft_deg: loft) { |m| m.club = club }
        end

        # Placeholder labels ("54.0°") give way to the bag name; a label
        # someone typed by hand is left alone.
        club.update!(label: spec[:label]) if club.label.end_with?("°")
        club.update!(static_loft_deg: spec[:loft]) unless club.static_loft_deg == spec[:loft]
      end

      status =
        if absorbed.any?
          "absorbed #{absorbed.join(', ')}"
        elsif created
          "created"
        else
          "up to date"
        end
      "#{spec[:label]}: #{status}"
    end

    # Prefer the club already carrying the bag label, then the club
    # observed at the nominal loft, then any club holding one of the bay
    # lofts. A club nothing has been imported for yet is created empty.
    def target_club(spec, mappings)
      @user.clubs.find_by(label: spec[:label]) ||
        mappings.detect { |m| m.loft_deg == spec[:loft] }&.club ||
        mappings.first&.club ||
        @user.clubs.create!(label: spec[:label], static_loft_deg: spec[:loft])
    end
  end
end
