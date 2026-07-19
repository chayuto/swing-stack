require "rails_helper"
require "rake"

# The snapshot tasks shell out to pg_dump and pg_restore, so these specs
# exercise the real binaries against the test database. Dump-and-restore
# examples skip when the installed client is older than the server
# (pg_dump refuses to dump a newer major version).
RSpec.describe "snapshot rake tasks" do
  before(:context) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("snapshot:create")
  end

  around do |example|
    Dir.mktmpdir("snapshots") do |tmp|
      @dir = Pathname.new(tmp)
      ENV["SNAPSHOT_DIR"] = tmp
      example.run
    ensure
      ENV.delete("SNAPSHOT_DIR")
    end
  end

  def invoke(name, *args)
    task = Rake::Task[name]
    task.reenable
    task.invoke(*args)
  end

  def pg_client_supported?
    client = `pg_dump --version 2>/dev/null`[/\d+/].to_i
    server = ActiveRecord::Base.connection.select_value("SHOW server_version_num").to_i / 10_000
    client >= server
  rescue Errno::ENOENT
    false
  end

  describe "snapshot:create" do
    it "writes a timestamped compressed dump" do
      skip "pg_dump is missing or older than the server" unless pg_client_supported?

      expect { invoke("snapshot:create", "spec") }.to output(/Wrote/).to_stdout

      files = @dir.glob("*.dump")
      expect(files.size).to eq(1)
      expect(files.first.basename.to_s).to match(/\A\d{8}_\d{6}_swing_stack_test_spec\.dump\z/)
      expect(files.first.binread(5)).to eq("PGDMP")
    end

    it "rejects labels with unsafe characters" do
      expect { invoke("snapshot:create", "bad label!") }
        .to raise_error(SystemExit).and output(/letters, digits/).to_stderr
    end
  end

  describe "snapshot:restore guards" do
    it "aborts when there is no snapshot" do
      expect { invoke("snapshot:restore") }
        .to raise_error(SystemExit).and output(/No snapshots/).to_stderr
    end

    it "aborts without CONFIRM=1" do
      @dir.join("20260101_000000_swing_stack_test.dump").write("PGDMP")
      expect { invoke("snapshot:restore") }
        .to raise_error(SystemExit).and output(/CONFIRM=1/).to_stderr
    end

    it "aborts when the dump name does not match the database" do
      @dir.join("20260101_000000_swing_stack_development.dump").write("PGDMP")
      ENV["CONFIRM"] = "1"
      expect { invoke("snapshot:restore") }
        .to raise_error(SystemExit).and output(/FORCE=1/).to_stderr
    ensure
      ENV.delete("CONFIRM")
    end
  end

  describe "snapshot:restore round trip" do
    # pg_restore drops tables, which would deadlock against the open
    # test transaction, so this group commits for real and cleans up.
    self.use_transactional_tests = false

    it "brings back rows deleted after the snapshot" do
      skip "pg_dump is missing or older than the server" unless pg_client_supported?

      user = create(:user)
      begin
        expect { invoke("snapshot:create", "roundtrip") }.to output.to_stdout
        user.destroy!
        expect(User.exists?(user.id)).to be(false)

        ENV["CONFIRM"] = "1"
        expect { invoke("snapshot:restore") }.to output(/Done/).to_stdout
        expect(User.exists?(user.id)).to be(true)
      ensure
        ENV.delete("CONFIRM")
        User.where(id: user.id).delete_all
      end
    end
  end

  describe "snapshot:prune" do
    it "keeps the newest N and deletes the rest" do
      oldest = @dir.join("20260101_000000_swing_stack_test.dump")
      middle = @dir.join("20260201_000000_swing_stack_test.dump")
      newest = @dir.join("20260301_000000_swing_stack_test.dump")
      [ oldest, middle, newest ].each { |f| f.write("PGDMP") }
      FileUtils.touch(oldest, mtime: (Time.zone.now - 300).to_time)
      FileUtils.touch(middle, mtime: (Time.zone.now - 200).to_time)
      FileUtils.touch(newest, mtime: (Time.zone.now - 100).to_time)

      expect { invoke("snapshot:prune", "2") }.to output(/Deleted 20260101/).to_stdout

      names = @dir.glob("*.dump").map { |f| f.basename.to_s }
      expect(names).to contain_exactly(middle.basename.to_s, newest.basename.to_s)
    end

    it "deletes nothing when there are fewer snapshots than keep" do
      @dir.join("20260101_000000_swing_stack_test.dump").write("PGDMP")
      expect { invoke("snapshot:prune") }.to output(/Nothing to prune/).to_stdout
      expect(@dir.glob("*.dump").size).to eq(1)
    end
  end

  describe "snapshot:list" do
    it "prints each snapshot with its size" do
      @dir.join("20260101_000000_swing_stack_test.dump").write("PGDMP")
      expect { invoke("snapshot:list") }
        .to output(/20260101_000000_swing_stack_test\.dump/).to_stdout
    end
  end
end
