class AddExcludedToShots < ActiveRecord::Migration[8.1]
  def change
    add_column :shots, :excluded, :boolean, default: false, null: false
  end
end
