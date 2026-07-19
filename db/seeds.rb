# Idempotent demo seed: a demo user, the real bag with its bay loft
# mappings, and telemetry ingested from data/*.json (real TrackMan
# multiGroupReport exports, gitignored). Ingest is checksum-tracked, so
# re-running only parses exports that are new since the last run.
user = User.find_or_create_by!(email: "demo@swing-stack.dev") do |u|
  u.password = ENV.fetch("DEMO_PASSWORD", "demo-password-123")
  u.name = "Demo Player"
end

# Audit attribution for seed-time edits. The import job overrides this
# with "import_batch:<id>" while it runs.
PaperTrail.request.whodunnit = "seeds"

# The bag actually in play: a driver and a 7 iron, nothing else. The
# bay's club metadata is unreliable (name and loft config alike), so
# every loft config the radar has ever attached is claimed by the club
# it really belongs to. When trackman:ingest flags a new unlabeled
# config, add its loft to bay_lofts here and re-run db:seed.
BAG = [
  { label: "Driver", loft: 10.5, bay_lofts: [ 10.5 ] },
  { label: "7 Iron", loft: 31.0, bay_lofts: [ 31.0, 27.0, 35.5, 39.0, 54.0 ] }
].freeze

Clubs::ApplyBag.new(user: user, bag: BAG).call.each { |line| puts line }

results = Trackman::FileIngest.new(user: user, dir: Rails.root.join("data")).call
results.each { |r| puts r.to_line }
puts "No data/*.json exports found — skipping telemetry seed" if results.empty?

puts "Seeded. Login: demo@swing-stack.dev / #{ENV.fetch('DEMO_PASSWORD', 'demo-password-123')}"
