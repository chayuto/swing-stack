class CreateTrainingSessions < ActiveRecord::Migration[8.1]
  def change
    create_table :training_sessions, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :external_id, null: false # launch monitor stroke-group id
      t.string :source, null: false, default: "trackman"
      t.date :played_on
      t.string :facility
      t.string :bay
      t.string :ball_type
      t.string :client_name
      t.float :latitude
      t.float :longitude
      t.float :temperature

      t.timestamps
    end
    add_index :training_sessions, %i[user_id external_id], unique: true
    add_index :training_sessions, %i[user_id played_on]
  end
end
