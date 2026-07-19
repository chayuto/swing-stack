namespace :trackman do
  desc "Ingest new report exports from data/*.json (files tracked by checksum)"
  task ingest: :environment do
    email = ENV.fetch("INGEST_EMAIL", "demo@swing-stack.dev")
    user = User.find_by(email: email)
    abort "No user #{email}. Run bin/rails db:seed first." unless user

    results = Trackman::FileIngest.new(user: user, dir: Rails.root.join("data")).call
    results.each { |r| puts r.to_line }
    puts "No data/*.json exports found" if results.empty?

    user.clubs.where("label LIKE '%°'").order(:static_loft_deg).each do |club|
      puts "Unlabeled club: #{club.static_loft_deg}°. Add a label to db/seeds.rb and re-run bin/rails db:seed."
    end
  end
end
