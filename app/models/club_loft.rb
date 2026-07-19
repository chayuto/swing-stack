# Maps one observed bay loft config to the club actually in the bag.
# The launch monitor's club metadata is unreliable: the same physical
# club shows up under many static lofts (a 7 iron has arrived as 27.0,
# 35.5, 39.0 and 54.0 degrees). The importer resolves clubs through
# these mappings; db/seeds.rb owns the bag definition.
class ClubLoft < ApplicationRecord
  # Mappings decide how every future shot is classified, so changes to
  # them are audit-worthy.
  has_paper_trail

  belongs_to :user
  belongs_to :club

  validates :loft_deg, presence: true,
                       numericality: { greater_than: 0, less_than: 90 },
                       uniqueness: { scope: :user_id }
end
