# Local database snapshots. There is no hosted deployment, so the
# database on this machine is the only copy. These tasks wrap pg_dump
# and pg_restore. Dumps are compressed custom-format archives in
# data/snapshots/, which is gitignored (dumps hold the same personal
# data as the raw exports).
module Snapshots
  module_function

  def dir
    Pathname.new(ENV["SNAPSHOT_DIR"] || Rails.root.join("data/snapshots"))
  end

  def files
    dir.glob("*.dump").sort_by(&:mtime)
  end

  def config
    ActiveRecord::Base.connection_db_config.configuration_hash
  end

  def database
    config[:database]
  end

  def pg_env
    {
      "PGHOST" => config[:host],
      "PGPORT" => config[:port]&.to_s,
      "PGUSER" => config[:username],
      "PGPASSWORD" => config[:password]
    }.compact
  end

  # Multi-argument system call, so no shell and no injection surface.
  def run!(*cmd)
    system(pg_env, *cmd, exception: true)
  end

  def mb(bytes)
    format("%.2f MB", bytes / 1024.0 / 1024.0)
  end
end

namespace :snapshot do
  desc "Dump the database to data/snapshots/ as a timestamped compressed archive. Optional label: snapshot:create[pre_import]"
  task :create, [ :label ] => :environment do |_t, args|
    label = args[:label]
    abort "Label may only use letters, digits, - and _" if label && !label.match?(/\A[\w-]+\z/)

    Snapshots.dir.mkpath
    stamp = Time.now.strftime("%Y%m%d_%H%M%S")
    name = [ stamp, Snapshots.database, label ].compact.join("_")
    path = Snapshots.dir.join("#{name}.dump")

    Snapshots.run!("pg_dump", "--format=custom", "--file=#{path}", Snapshots.database)
    puts "Wrote #{path} (#{Snapshots.mb(path.size)})"
  end

  desc "Restore a snapshot into the database (newest by default). Destructive, needs CONFIRM=1"
  task :restore, [ :file ] => :environment do |_t, args|
    path = args[:file] ? Snapshots.dir.join(File.basename(args[:file])) : Snapshots.files.last
    abort "No snapshots in #{Snapshots.dir}" if path.nil?
    abort "#{path} does not exist" unless path.exist?

    db = Snapshots.database
    unless path.basename.to_s.include?(db) || ENV["FORCE"] == "1"
      abort "#{path.basename} does not look like a dump of #{db}. Re-run with FORCE=1 to restore it anyway."
    end
    unless ENV["CONFIRM"] == "1"
      abort <<~MSG
        This wipes #{db} and replaces it with #{path.basename}.
        Re-run with CONFIRM=1 to proceed:
          CONFIRM=1 bin/rails "snapshot:restore[#{path.basename}]"
      MSG
    end

    puts "Restoring #{path.basename} into #{db} (if this hangs, stop the Rails server first)"
    ActiveRecord::Base.connection_pool.disconnect!
    Snapshots.run!("pg_restore", "--clean", "--if-exists", "--no-owner", "--no-acl",
                   "--single-transaction", "--dbname=#{db}", path.to_s)
    puts "Done. #{User.count} user(s), #{TrainingSession.count} session(s), #{Shot.count} shot(s)."
    puts "If migrations were added after this dump, run bin/rails db:migrate."
  end

  desc "List snapshots, oldest first"
  task list: :environment do
    files = Snapshots.files
    if files.empty?
      puts "No snapshots in #{Snapshots.dir}"
    else
      files.each do |f|
        puts format("%s  %10s  %s", f.mtime.strftime("%Y-%m-%d %H:%M"), Snapshots.mb(f.size), f.basename)
      end
    end
  end

  desc "Delete all but the newest N snapshots (default 10): snapshot:prune[10]"
  task :prune, [ :keep ] => :environment do |_t, args|
    keep = (args[:keep] || "10").to_i
    abort "keep must be at least 1" if keep < 1

    doomed = Snapshots.files[0...-keep] || []
    if doomed.empty?
      puts "Nothing to prune (#{Snapshots.files.size} snapshot(s), keeping up to #{keep})"
    else
      doomed.each do |f|
        f.delete
        puts "Deleted #{f.basename}"
      end
    end
  end
end
