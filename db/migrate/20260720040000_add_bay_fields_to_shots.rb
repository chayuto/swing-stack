# The club facts the export carried, kept verbatim per shot: the club
# name (what TrackMan's own UI groups by) and the loft config the bay
# attached. Club assignment (shots.club_id) is our interpretation of
# these values; the observations themselves must survive that
# interpretation being wrong. Backfilled from stored payloads by
# bin/rails trackman:reclassify.
class AddBayFieldsToShots < ActiveRecord::Migration[8.1]
  def change
    add_column :shots, :bay_club, :string
    add_column :shots, :bay_loft_deg, :decimal, precision: 4, scale: 1
  end
end
