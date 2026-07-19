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

  it "fingerprints clubs by static loft and groups shots onto them" do
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

  it "rejects payloads that are not TrackMan reports" do
    expect { described_class.new(user: user, payload: { "foo" => "bar" }).call }
      .to raise_error(Trackman::ReportParser::Error, /no StrokeGroups/)
  end

  # RSpec's compound negative matcher needs an alias.
  RSpec::Matchers.define_negated_matcher :not_change, :change
end
