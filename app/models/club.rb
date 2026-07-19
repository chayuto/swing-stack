# A club is identified by its static loft (degrees) — the stable
# fingerprint present in launch monitor exports, which never name the
# club. Users attach a human label ("7 Iron") after the fact.
class Club < ApplicationRecord
  # Clubs are born, relabelled, and occasionally removed by hand, so
  # every event is audit-worthy (see the phantom 27° club in seeds).
  has_paper_trail

  belongs_to :user
  has_many :shots, dependent: :nullify

  validates :static_loft_deg, presence: true,
                              numericality: { greater_than: 0, less_than: 90 },
                              uniqueness: { scope: :user_id }
  validates :label, presence: true

  def self.for_loft!(user, loft_deg)
    find_or_create_by!(user: user, static_loft_deg: loft_deg) do |club|
      club.label = "#{loft_deg.to_f.round(1)}°"
    end
  end
end
