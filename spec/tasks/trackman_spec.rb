require "rails_helper"
require "rake"

RSpec.describe "trackman rake tasks" do
  before(:context) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("trackman:ingest")
  end

  def invoke(name)
    task = Rake::Task[name]
    task.reenable
    task.invoke
  end

  describe "trackman:ingest" do
    it "aborts when the ingest user does not exist" do
      expect { invoke("trackman:ingest") }.to raise_error(SystemExit).and output(/db:seed first/).to_stderr
    end

    it "ingests for the user named by INGEST_EMAIL and flags unlabeled clubs" do
      user = create(:user)
      ENV["INGEST_EMAIL"] = user.email
      ingest = instance_double(Trackman::FileIngest, call: [])
      allow(Trackman::FileIngest).to receive(:new).with(user: user, dir: Rails.root.join("data")).and_return(ingest)
      user.clubs.create!(static_loft_deg: 27.0, label: "27.0°")

      expect { invoke("trackman:ingest") }.to output(/No data.*\n.*Unlabeled club: 27\.0°/).to_stdout
    ensure
      ENV.delete("INGEST_EMAIL")
    end
  end

  describe "trackman:reclassify" do
    it "re-resolves clubs from stored payloads through the current mappings" do
      user = create(:user)
      ENV["INGEST_EMAIL"] = user.email
      batch = user.import_batches.create!(source: "trackman", status: :pending,
                                          raw_payload: trackman_payload, filename: "sample.json")
      TrackmanImportJob.perform_now(batch.id)

      seven = user.clubs.find_by!(static_loft_deg: 31.0)
      user.club_lofts.where(loft_deg: [ 39.0, 54.0 ]).find_each { |m| m.update!(club: seven) }

      expect { invoke("trackman:reclassify") }
        .to output(/sample\.json: 52 shot\(s\) revisited/).to_stdout
      expect(seven.reload.shots.count).to eq(51)
    ensure
      ENV.delete("INGEST_EMAIL")
    end
  end

  describe "trackman:audit" do
    it "prints nothing but a notice when there are no entries" do
      expect { invoke("trackman:audit") }.to output(/No audit entries\./).to_stdout
    end

    it "prints each change with its actor and diff" do
      user = create(:user)
      PaperTrail.request(whodunnit: "seeds") do
        club = user.clubs.create!(static_loft_deg: 31.0, label: "31.0°")
        club.update!(label: "7 Iron")
      end

      expect { invoke("trackman:audit") }
        .to output(/update\s+Club#\w{8}\s+by seeds\n\s+label: "31\.0°" -> "7 Iron"/).to_stdout
    end
  end
end
