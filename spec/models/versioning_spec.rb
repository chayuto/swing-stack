require "rails_helper"

# What the audit trail records and, as importantly, what it skips.
RSpec.describe "audit versioning" do
  let(:user) { create(:user) }

  before { Trackman::Importer.new(user: user, payload: trackman_payload).call }

  it "does not version shot or session creation (the import batch documents it)" do
    expect(PaperTrail::Version.where(item_type: %w[Shot TrainingSession])).to be_empty
  end

  it "versions shot edits with a before/after diff" do
    shot = user.shots.find_by!(external_id: "1e9cd215-7b04-4675-b342-08dfa1721aae")

    shot.update!(excluded: true)

    version = shot.versions.sole
    expect(version.event).to eq("update")
    expect(version.object_changes).to include("excluded" => [ false, true ])
  end

  it "versions shot destroys with the final state" do
    shot = user.shots.find_by!(external_id: "1e9cd215-7b04-4675-b342-08dfa1721aae")

    shot.destroy!

    version = PaperTrail::Version.where(item_type: "Shot", item_id: shot.id).sole
    expect(version.event).to eq("destroy")
    expect(version.object).to include("external_id" => "1e9cd215-7b04-4675-b342-08dfa1721aae")
  end

  it "versions the full club lifecycle" do
    club = user.clubs.find_by!(static_loft_deg: 54.0)

    club.update!(label: "Sand Wedge")
    club.destroy!

    events = PaperTrail::Version.where(item_type: "Club", item_id: club.id).order(:created_at).pluck(:event)
    expect(events).to eq(%w[create update destroy])
  end

  it "writes no version when an upsert changes nothing" do
    expect { Trackman::Importer.new(user: user, payload: trackman_payload).call }
      .not_to change(PaperTrail::Version, :count)
  end
end
