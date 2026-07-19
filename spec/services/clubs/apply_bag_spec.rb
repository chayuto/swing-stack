require "rails_helper"

RSpec.describe Clubs::ApplyBag do
  let(:user) { create(:user) }
  let(:bag) do
    [
      { label: "Driver", loft: 10.5, bay_lofts: [ 10.5 ] },
      { label: "7 Iron", loft: 31.0, bay_lofts: [ 31.0, 39.0, 54.0 ] }
    ]
  end

  def apply
    described_class.new(user: user, bag: bag).call
  end

  context "before anything is imported" do
    it "creates the bag clubs with their loft mappings" do
      expect(apply).to eq([ "Driver: created", "7 Iron: created" ])

      seven = user.clubs.find_by!(label: "7 Iron")
      expect(user.clubs.order(:static_loft_deg).pluck(:label)).to eq([ "Driver", "7 Iron" ])
      expect(seven.club_lofts.pluck(:loft_deg).map(&:to_f)).to contain_exactly(31.0, 39.0, 54.0)
    end

    it "lets a later import classify shots on arrival" do
      apply
      Trackman::Importer.new(user: user, payload: trackman_payload).call

      expect(user.clubs.count).to eq(2) # no placeholder clubs created
      expect(user.clubs.find_by!(label: "7 Iron").shots.count).to eq(51)
    end
  end

  context "after an import created placeholder clubs" do
    before { Trackman::Importer.new(user: user, payload: trackman_payload).call }

    it "absorbs the placeholders into the real club and destroys them" do
      lines = apply

      expect(lines.last).to eq("7 Iron: absorbed 39.0° (27 shots), 54.0° (8 shots)")
      expect(user.clubs.pluck(:label)).to contain_exactly("Driver", "7 Iron")
      expect(user.clubs.find_by!(label: "7 Iron").shots.count).to eq(51)
    end

    it "records every move in the audit trail" do
      PaperTrail.request(whodunnit: "seeds") { apply }

      moves = PaperTrail::Version.where(item_type: "Shot", event: "update")
      expect(moves.count).to eq(35) # 27 + 8 shots changed club
      expect(moves.first.whodunnit).to eq("seeds")
      expect(moves.first.object_changes).to have_key("club_id")
      expect(PaperTrail::Version.where(item_type: "Club", event: "destroy").count).to eq(2)
    end

    it "is idempotent" do
      apply

      expect { expect(apply).to eq([ "Driver: up to date", "7 Iron: up to date" ]) }
        .not_to change { PaperTrail::Version.count }
    end
  end

  it "leaves hand-typed labels alone" do
    club = Club.for_loft!(user, 31.0)
    club.update!(label: "Seven")

    apply

    expect(club.reload.label).to eq("Seven")
  end
end
