# A club groups shots for analysis. The export's club name (what
# TrackMan's own UI groups by) is the primary identity; some exports
# omit it and carry only a bay loft config, which is unreliable, so
# observed configs map to clubs through ClubLoft (the bag map in
# db/seeds.rb). Unknown configs get a placeholder club labelled "54.0°"
# until claimed. static_loft_deg is the club's nominal spec — nil when
# the club came from a name alone.
class Club < ApplicationRecord
  # Clubs are born, relabelled, merged, and occasionally removed by
  # hand, so every event is audit-worthy.
  has_paper_trail

  belongs_to :user
  has_many :shots, dependent: :nullify
  has_many :club_lofts, dependent: :destroy

  validates :static_loft_deg, numericality: { greater_than: 0, less_than: 90 },
                              uniqueness: { scope: :user_id },
                              allow_nil: true
  validates :label, presence: true

  # A club with a known spec always claims its own nominal loft.
  after_create { club_lofts.find_or_create_by!(user: user, loft_deg: static_loft_deg) if static_loft_deg }

  def self.for_name!(user, bay_name)
    user.clubs.find_or_create_by!(label: canonical_label(bay_name))
  end

  def self.for_loft!(user, loft_deg)
    user.club_lofts.find_by(loft_deg: loft_deg)&.club ||
      create!(user: user, static_loft_deg: loft_deg, label: "#{loft_deg.to_f.round(1)}°")
  end

  # "7Iron" -> "7 Iron", "PitchingWedge" -> "Pitching Wedge"
  def self.canonical_label(bay_name)
    bay_name.gsub(/(?<=\d)(?=[A-Z])|(?<=[a-z])(?=[A-Z])/, " ")
  end
end
