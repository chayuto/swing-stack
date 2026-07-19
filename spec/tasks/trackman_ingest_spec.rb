require "rails_helper"
require "rake"

RSpec.describe "trackman:ingest" do
  before(:context) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("trackman:ingest")
  end

  def invoke
    task = Rake::Task["trackman:ingest"]
    task.reenable
    task.invoke
  end

  it "aborts when the ingest user does not exist" do
    expect { invoke }.to raise_error(SystemExit).and output(/db:seed first/).to_stderr
  end

  it "ingests for the user named by INGEST_EMAIL and flags unlabeled clubs" do
    user = create(:user)
    ENV["INGEST_EMAIL"] = user.email
    ingest = instance_double(Trackman::FileIngest, call: [])
    allow(Trackman::FileIngest).to receive(:new).with(user: user, dir: Rails.root.join("data")).and_return(ingest)
    user.clubs.create!(static_loft_deg: 27.0, label: "27.0°")

    expect { invoke }.to output(/No data.*\n.*Unlabeled club: 27\.0°/).to_stdout
  ensure
    ENV.delete("INGEST_EMAIL")
  end
end
