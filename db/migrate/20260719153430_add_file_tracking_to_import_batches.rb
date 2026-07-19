class AddFileTrackingToImportBatches < ActiveRecord::Migration[8.1]
  def change
    add_column :import_batches, :filename, :string
    add_column :import_batches, :file_checksum, :string
    add_index :import_batches, %i[user_id file_checksum],
              unique: true, where: "file_checksum IS NOT NULL",
              name: "index_import_batches_on_user_and_checksum"
  end
end
