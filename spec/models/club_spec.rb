require "rails_helper"

RSpec.describe Club do
  let(:user) { create(:user) }

  it "claims its nominal loft on creation" do
    club = user.clubs.create!(label: "Driver", static_loft_deg: 10.5)

    expect(user.club_lofts.sole).to have_attributes(loft_deg: 10.5, club: club)
  end

  describe ".for_name!" do
    it "canonicalizes the exported name into a label" do
      club = described_class.for_name!(user, "PitchingWedge")

      expect(club.label).to eq("Pitching Wedge")
      expect(club.static_loft_deg).to be_nil
    end

    it "reuses the club already carrying the label" do
      seven = user.clubs.create!(label: "7 Iron", static_loft_deg: 31.0)

      expect(described_class.for_name!(user, "7Iron")).to eq(seven)
    end
  end

  describe ".for_loft!" do
    it "creates a placeholder club for an unmapped loft" do
      club = described_class.for_loft!(user, 48.0)

      expect(club.label).to eq("48.0°")
      expect(club.club_lofts.sole.loft_deg).to eq(48.0)
    end

    it "resolves a mapped loft to its club without creating anything" do
      seven = user.clubs.create!(label: "7 Iron", static_loft_deg: 31.0)
      user.club_lofts.create!(club: seven, loft_deg: 54.0)

      expect { expect(described_class.for_loft!(user, 54.0)).to eq(seven) }
        .not_to change { user.clubs.count }
    end
  end
end
