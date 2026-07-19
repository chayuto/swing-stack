# All primary keys are UUIDs: exposed IDs must never be sequentially
# iterable (see README: securing the CRUD layer against IDOR).
Rails.application.config.generators do |g|
  g.orm :active_record, primary_key_type: :uuid
end
