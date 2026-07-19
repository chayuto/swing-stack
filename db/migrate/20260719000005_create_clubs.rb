class CreateClubs < ActiveRecord::Migration[8.1]
  def change
    create_table :clubs, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      # Launch monitor exports don't name the club; the club-head static
      # loft (degrees) is a stable fingerprint used to group shots.
      t.decimal :static_loft_deg, precision: 4, scale: 1, null: false
      t.string :label, null: false

      t.timestamps
    end
    add_index :clubs, %i[user_id static_loft_deg], unique: true
  end
end
