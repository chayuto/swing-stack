namespace :trackman do
  desc "Ingest new report exports from data/*.json (files tracked by checksum)"
  task ingest: :environment do
    email = ENV.fetch("INGEST_EMAIL", "demo@swing-stack.dev")
    user = User.find_by(email: email)
    abort "No user #{email}. Run bin/rails db:seed first." unless user

    results = Trackman::FileIngest.new(user: user, dir: Rails.root.join("data")).call
    results.each { |r| puts r.to_line }
    puts "No data/*.json exports found" if results.empty?

    user.clubs.where("label LIKE '%°'").order(:static_loft_deg).each do |club|
      puts "Unlabeled club: #{club.static_loft_deg}°. Map it to a bag club in db/seeds.rb and re-run bin/rails db:seed."
    end
  end

  desc "Re-run the importer over completed batches (re-resolves clubs from stored payloads)"
  task reclassify: :environment do
    email = ENV.fetch("INGEST_EMAIL", "demo@swing-stack.dev")
    user = User.find_by(email: email)
    abort "No user #{email}. Run bin/rails db:seed first." unless user

    batches = user.import_batches.where(status: :completed).order(:created_at).to_a
    puts "No completed import batches." if batches.empty?

    batches.each do |batch|
      result = PaperTrail.request(whodunnit: "import_batch:#{batch.id}") do
        Trackman::Importer.new(user: user, payload: batch.raw_payload).call
      end
      puts "#{batch.filename || batch.id}: #{result.shots_count} shot(s) revisited"
    end
  end

  desc "Show recent audit trail entries (LIMIT=50)"
  task audit: :environment do
    limit = ENV.fetch("LIMIT", "50").to_i
    versions = PaperTrail::Version.order(created_at: :desc).limit(limit).to_a
    puts "No audit entries." if versions.empty?

    versions.reverse_each do |v|
      line = "#{v.created_at.strftime('%Y-%m-%d %H:%M:%S')}  #{v.event.ljust(7)}  " \
             "#{v.item_type}##{v.item_id.to_s[0, 8]}  by #{v.whodunnit || 'unknown'}"
      diff = (v.object_changes || {}).except("updated_at").map do |attr, (from, to)|
        "#{attr}: #{from.inspect.truncate(40)} -> #{to.inspect.truncate(40)}"
      end
      line += "  [#{v.object&.dig('label') || v.object&.dig('external_id')}]" if v.event == "destroy"
      puts line
      diff.each { |d| puts "    #{d}" }
    end
  end
end
