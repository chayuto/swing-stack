class CreateImportBatches < ActiveRecord::Migration[8.1]
  def change
    create_table :import_batches, id: :uuid do |t|
      t.references :user, null: false, foreign_key: true, type: :uuid
      t.string :status, null: false, default: "pending"
      t.string :source, null: false, default: "trackman"
      t.jsonb :raw_payload, null: false
      t.integer :sessions_count, null: false, default: 0
      t.integer :shots_count, null: false, default: 0
      t.text :error_message
      t.datetime :processed_at

      t.timestamps
    end
    add_index :import_batches, %i[user_id created_at]
  end
end
