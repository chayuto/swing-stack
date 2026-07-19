# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_19_000008) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  create_table "api_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at"
    t.datetime "last_used_at"
    t.string "name", null: false
    t.datetime "revoked_at"
    t.string "scopes", default: [], null: false, array: true
    t.string "token_digest", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["token_digest"], name: "index_api_tokens_on_token_digest", unique: true
    t.index ["user_id"], name: "index_api_tokens_on_user_id"
  end

  create_table "clubs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "label", null: false
    t.decimal "static_loft_deg", precision: 4, scale: 1, null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "static_loft_deg"], name: "index_clubs_on_user_id_and_static_loft_deg", unique: true
    t.index ["user_id"], name: "index_clubs_on_user_id"
  end

  create_table "import_batches", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error_message"
    t.datetime "processed_at"
    t.jsonb "raw_payload", null: false
    t.integer "sessions_count", default: 0, null: false
    t.integer "shots_count", default: 0, null: false
    t.string "source", default: "trackman", null: false
    t.string "status", default: "pending", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "created_at"], name: "index_import_batches_on_user_id_and_created_at"
    t.index ["user_id"], name: "index_import_batches_on_user_id"
  end

  create_table "refresh_tokens", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.datetime "revoked_at"
    t.string "token_digest", null: false
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["token_digest"], name: "index_refresh_tokens_on_token_digest", unique: true
    t.index ["user_id"], name: "index_refresh_tokens_on_user_id"
  end

  create_table "shots", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.float "attack_angle"
    t.float "ball_speed"
    t.jsonb "ball_trajectory"
    t.float "carry"
    t.float "carry_side"
    t.uuid "club_id"
    t.float "club_path"
    t.float "club_speed"
    t.datetime "created_at", null: false
    t.float "curve"
    t.float "dynamic_lie"
    t.float "dynamic_loft"
    t.string "external_id", null: false
    t.float "face_angle"
    t.float "face_to_path"
    t.float "hang_time"
    t.float "impact_height"
    t.float "impact_offset"
    t.float "landing_angle"
    t.float "launch_angle"
    t.float "launch_direction"
    t.float "low_point_distance"
    t.float "max_height"
    t.float "norm_carry"
    t.float "norm_total_distance"
    t.float "norm_total_side"
    t.string "reduced_accuracy", default: [], null: false, array: true
    t.float "smash_factor"
    t.float "spin_axis"
    t.float "spin_loft"
    t.float "spin_rate"
    t.datetime "struck_at"
    t.float "swing_direction"
    t.float "swing_plane"
    t.float "swing_radius"
    t.float "total_distance"
    t.float "total_side"
    t.uuid "training_session_id", null: false
    t.datetime "updated_at", null: false
    t.index ["club_id"], name: "index_shots_on_club_id"
    t.index ["struck_at"], name: "index_shots_on_struck_at"
    t.index ["training_session_id", "external_id"], name: "index_shots_on_training_session_id_and_external_id", unique: true
    t.index ["training_session_id"], name: "index_shots_on_training_session_id"
  end

  create_table "training_sessions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.string "ball_type"
    t.string "bay"
    t.string "client_name"
    t.datetime "created_at", null: false
    t.string "external_id", null: false
    t.string "facility"
    t.float "latitude"
    t.float "longitude"
    t.date "played_on"
    t.string "source", default: "trackman", null: false
    t.float "temperature"
    t.datetime "updated_at", null: false
    t.uuid "user_id", null: false
    t.index ["user_id", "external_id"], name: "index_training_sessions_on_user_id_and_external_id", unique: true
    t.index ["user_id", "played_on"], name: "index_training_sessions_on_user_id_and_played_on"
    t.index ["user_id"], name: "index_training_sessions_on_user_id"
  end

  create_table "users", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "name"
    t.string "password_digest", null: false
    t.datetime "updated_at", null: false
    t.index "lower((email)::text)", name: "index_users_on_lower_email", unique: true
  end

  add_foreign_key "api_tokens", "users"
  add_foreign_key "clubs", "users"
  add_foreign_key "import_batches", "users"
  add_foreign_key "refresh_tokens", "users"
  add_foreign_key "shots", "clubs"
  add_foreign_key "shots", "training_sessions"
  add_foreign_key "training_sessions", "users"
end
