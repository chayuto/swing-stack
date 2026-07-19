# Launch monitor club metadata turned out to be unreliable: the bay
# attaches whatever club config it has selected, so one physical club
# arrives under many static lofts. Clubs therefore stop being keyed by
# a single observed loft. Every observed loft config maps to a club
# through this table, clubs.static_loft_deg becomes the club's nominal
# spec, and clubs created from an exported name alone have no spec yet.
class CreateClubLofts < ActiveRecord::Migration[8.1]
  def up
    create_table :club_lofts, id: :uuid do |t|
      t.references :user, type: :uuid, null: false, foreign_key: true, index: false
      t.references :club, type: :uuid, null: false, foreign_key: true
      t.decimal :loft_deg, precision: 4, scale: 1, null: false
      t.timestamps
    end
    add_index :club_lofts, %i[user_id loft_deg], unique: true

    change_column_null :clubs, :static_loft_deg, true

    # Every existing club was created from exactly one observed loft.
    execute <<~SQL
      INSERT INTO club_lofts (id, user_id, club_id, loft_deg, created_at, updated_at)
      SELECT gen_random_uuid(), user_id, id, static_loft_deg, NOW(), NOW() FROM clubs
    SQL
  end

  def down
    change_column_null :clubs, :static_loft_deg, false
    drop_table :club_lofts
  end
end
