# Idempotent demo seed: a demo user plus every launch monitor export
# found in data/*.json (real TrackMan multiGroupReport exports,
# gitignored), with human labels attached to the club fingerprints.
user = User.find_or_create_by!(email: "demo@swing-stack.dev") do |u|
  u.password = ENV.fetch("DEMO_PASSWORD", "demo-password-123")
  u.name = "Demo Player"
end

exports = Rails.root.glob("data/*.json").sort
if exports.any?
  exports.each do |path|
    result = Trackman::Importer.new(user: user, payload: JSON.parse(path.read)).call
    puts "#{path.basename}: #{result.sessions_count} session(s), #{result.shots_count} shot(s)"
  end
else
  puts "No data/*.json exports found — skipping telemetry seed"
end

# Attach human labels to the loft fingerprints (only while still unlabelled).
{ 31.0 => "7 Iron", 35.5 => "8 Iron", 39.0 => "9 Iron", 54.0 => "Sand Wedge" }.each do |loft, label|
  club = user.clubs.find_by(static_loft_deg: loft)
  club.update!(label: label) if club && club.label.end_with?("°")
end

puts "Seeded. Login: demo@swing-stack.dev / #{ENV.fetch('DEMO_PASSWORD', 'demo-password-123')}"
