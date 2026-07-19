# Idempotent demo seed: a demo user, telemetry ingested from data/*.json
# (real TrackMan multiGroupReport exports, gitignored), and human labels
# for the club fingerprints. Ingest is checksum-tracked, so re-running
# only parses exports that are new since the last run.
user = User.find_or_create_by!(email: "demo@swing-stack.dev") do |u|
  u.password = ENV.fetch("DEMO_PASSWORD", "demo-password-123")
  u.name = "Demo Player"
end

# Audit attribution for seed-time edits. The import job overrides this
# with "import_batch:<id>" while it runs.
PaperTrail.request.whodunnit = "seeds"

results = Trackman::FileIngest.new(user: user, dir: Rails.root.join("data")).call
results.each { |r| puts r.to_line }
puts "No data/*.json exports found — skipping telemetry seed" if results.empty?

# Attach human labels to the loft fingerprints (only while still unlabelled).
{ 10.5 => "Driver", 31.0 => "7 Iron", 35.5 => "8 Iron", 39.0 => "9 Iron", 54.0 => "Sand Wedge" }.each do |loft, label|
  club = user.clubs.find_by(static_loft_deg: loft)
  club.update!(label: label) if club && club.label.end_with?("°")
end

# One stroke in the 2026-06-22 session carries a 27.0° club config, a
# bay misconfiguration on TrackMan's side. We own no such club. Drop the
# phantom club; dependent: :nullify leaves the stroke as unclassified.
user.clubs.find_by(static_loft_deg: 27.0)&.destroy!

puts "Seeded. Login: demo@swing-stack.dev / #{ENV.fetch('DEMO_PASSWORD', 'demo-password-123')}"
