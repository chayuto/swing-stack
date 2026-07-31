require "rails_helper"

RSpec.describe Trackman::Importer do
  subject(:import) { described_class.new(user: user, payload: trackman_payload).call }

  let(:user) { create(:user) }

  it "imports every session and stroke from the report" do
    result = import

    expect(result.sessions_count).to eq(1)
    expect(result.shots_count).to eq(52)
    expect(user.training_sessions.count).to eq(1)
    expect(user.shots.count).to eq(52)
  end

  it "captures session metadata" do
    import
    session = user.training_sessions.sole

    expect(session).to have_attributes(
      external_id: "0c1392dc-2483-f111-b7a4-c40f08b2c20c",
      source: "trackman",
      played_on: Date.new(2026, 7, 19),
      facility: "Precision Golf Chatswood",
      bay: "Range Bay 01",
      ball_type: "Premium"
    )
  end

  it "prefers the exported club name over the loft config" do
    payload = trackman_payload.deep_dup
    payload["StrokeGroups"][0]["Strokes"][0]["Club"] = "Driver"

    described_class.new(user: user, payload: payload).call

    driver = user.clubs.find_by!(label: "Driver")
    shot = driver.shots.sole
    expect(shot.bay_club).to eq("Driver")
    expect(shot.bay_loft_deg).to be_present # the config is kept even when the name overrides it
    expect(driver.static_loft_deg).to be_nil # spec unknown until claimed in the bag map
  end

  it "resolves bay lofts through the user's club mappings" do
    seven = user.clubs.create!(label: "7 Iron", static_loft_deg: 31.0)
    [ 39.0, 54.0 ].each { |loft| user.club_lofts.create!(club: seven, loft_deg: loft) }

    import

    expect(user.clubs.sole).to eq(seven)
    expect(seven.shots.count).to eq(51)
  end

  it "creates placeholder clubs for unmapped lofts and groups shots onto them" do
    import

    expect(user.clubs.order(:static_loft_deg).pluck(:static_loft_deg, :label))
      .to eq([ [ 31.0, "31.0°" ], [ 39.0, "39.0°" ], [ 54.0, "54.0°" ] ])
    expect(user.shots.joins(:club).group("clubs.static_loft_deg").count.transform_keys(&:to_f))
      .to eq(31.0 => 16, 39.0 => 27, 54.0 => 8)
    expect(user.shots.where(club_id: nil).count).to eq(1) # stroke with no club classification
  end

  it "maps telemetry onto shot columns in SI units" do
    import
    shot = user.shots.find_by!(external_id: "1e9cd215-7b04-4675-b342-08dfa1721aae")

    expect(shot.bay_loft_deg).to eq(39.0) # observed config kept verbatim
    expect(shot.bay_club).to be_nil # this export carries no club names
    expect(shot.club_speed).to be_within(0.001).of(36.352)
    expect(shot.carry).to be_within(0.01).of(129.65)
    expect(shot.total_distance).to be_within(0.01).of(148.12)
    expect(shot.norm_total_distance).to be_within(0.01).of(151.60)
    expect(shot.spin_rate).to be_within(0.5).of(5010)
    expect(shot.reduced_accuracy).to eq([ "SpinRate" ])
    expect(shot.ball_trajectory).to be_present
    expect(shot.ball_trajectory.first.length).to eq(3)
  end

  it "is idempotent across re-imports of the same export" do
    import
    expect { described_class.new(user: user, payload: trackman_payload).call }
      .to not_change { user.shots.count }
      .and not_change { user.training_sessions.count }
      .and not_change { user.clubs.count }
  end

  it "dates a session by the local day, not the exported UTC day" do
    payload = trackman_payload.deep_dup
    group = payload["StrokeGroups"][0]
    group["Date"] = "2026-07-27" # what TrackMan exports: the UTC day
    group["Strokes"].each_with_index do |stroke, i|
      stroke["Time"] = "2026-07-27T#{format('%02d', 22 + (i / 30))}:#{format('%02d', i % 30)}:00+00:00"
    end

    described_class.new(user: user, payload: payload).call

    # 22:00 UTC on the 27th is 08:00 on the 28th in Sydney.
    expect(user.training_sessions.sole.played_on).to eq(Date.new(2026, 7, 28))
  end

  it "keeps the starting date when a session runs past UTC midnight" do
    payload = trackman_payload.deep_dup
    first = payload["StrokeGroups"][0]
    late = first["Strokes"].pop(2)
    first["Date"] = "2026-07-29"
    first["Strokes"].each_with_index { |s, i| s["Time"] = "2026-07-29T23:#{format('%02d', i % 60)}:00+00:00" }
    # TrackMan splits the group at UTC midnight; both halves share one id.
    late.each_with_index { |s, i| s["Time"] = "2026-07-30T00:0#{i}:00+00:00" }
    payload["StrokeGroups"] << first.merge("Date" => "2026-07-30", "Strokes" => late)

    result = described_class.new(user: user, payload: payload).call

    expect(result.sessions_count).to eq(1) # two exported groups, one session
    session = user.training_sessions.sole # merged onto one record by shared id
    expect(session.shots.count).to eq(52)
    # The whole block is the morning of the 30th in Sydney.
    expect(session.played_on).to eq(Date.new(2026, 7, 30))
  end

  it "leaves a deleted session deleted when replaying a stored payload" do
    import
    user.training_sessions.sole.destroy!

    result = described_class.new(user: user, payload: trackman_payload, update_only: true).call

    expect(result).to have_attributes(sessions_count: 0, shots_count: 0)
    expect(user.training_sessions.count).to eq(0)
    expect(user.shots.count).to eq(0)
  end

  it "still refreshes sessions that exist when replaying a stored payload" do
    import
    session = user.training_sessions.sole
    session.update!(played_on: Date.new(2000, 1, 1))

    result = described_class.new(user: user, payload: trackman_payload, update_only: true).call

    expect(result.shots_count).to eq(52)
    expect(session.reload.played_on).to eq(Date.new(2026, 7, 19))
  end

  it "rejects payloads that are not TrackMan reports" do
    expect { described_class.new(user: user, payload: { "foo" => "bar" }).call }
      .to raise_error(Trackman::ReportParser::Error, /no StrokeGroups/)
  end

  # RSpec's compound negative matcher needs an alias.
  RSpec::Matchers.define_negated_matcher :not_change, :change
end
