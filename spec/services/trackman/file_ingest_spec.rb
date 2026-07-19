require "rails_helper"

RSpec.describe Trackman::FileIngest do
  let(:user) { create(:user) }

  around do |example|
    Dir.mktmpdir("ingest") do |tmp|
      @dir = Pathname.new(tmp)
      example.run
    end
  end

  def stage(name, content = file_fixture("trackman_report.json").read)
    @dir.join(name).write(content)
  end

  def ingest
    described_class.new(user: user, dir: @dir).call
  end

  it "imports a new file and records a completed batch with its checksum" do
    stage("2026-07-19.json")

    results = ingest

    expect(results.map(&:status)).to eq([ :completed ])
    batch = user.import_batches.sole
    expect(batch).to have_attributes(
      status: "completed", filename: "2026-07-19.json", sessions_count: 1, shots_count: 52
    )
    expect(batch.file_checksum).to eq(Digest::SHA256.file(@dir.join("2026-07-19.json")).hexdigest)
    expect(user.shots.count).to eq(52)
  end

  it "skips files it has already completed" do
    stage("report.json")
    ingest

    results = ingest

    expect(results.map(&:status)).to eq([ :skipped ])
    expect(user.import_batches.count).to eq(1)
  end

  it "re-imports a changed file without duplicating shots" do
    stage("report.json")
    ingest
    changed = JSON.parse(file_fixture("trackman_report.json").read).merge("ReExportedAt" => "2026-07-20")
    stage("report.json", JSON.generate(changed))

    results = ingest

    expect(results.map(&:status)).to eq([ :completed ])
    expect(user.import_batches.count).to eq(2)
    expect(user.shots.count).to eq(52)
  end

  it "reports invalid JSON as failed without a batch and still ingests the rest" do
    stage("bad.json", "{ nope")
    stage("good.json")

    results = ingest

    expect(results.map { |r| [ r.filename, r.status ] })
      .to eq([ [ "bad.json", :failed ], [ "good.json", :completed ] ])
    expect(user.import_batches.count).to eq(1)
  end

  it "marks unparseable reports failed and retries them on a later run" do
    stage("empty.json", JSON.generate({ "foo" => "bar" }))

    first = ingest
    expect(first.map(&:status)).to eq([ :failed ])
    batch = user.import_batches.sole
    expect(batch.status).to eq("failed")
    expect(batch.error_message).to match(/no StrokeGroups/)

    second = ingest
    expect(second.map(&:status)).to eq([ :failed ])
    expect(user.import_batches.count).to eq(1)
  end
end
