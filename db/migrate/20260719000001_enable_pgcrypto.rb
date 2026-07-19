class EnablePgcrypto < ActiveRecord::Migration[8.1]
  def change
    enable_extension "pgcrypto" # gen_random_uuid() for UUID primary keys
  end
end
