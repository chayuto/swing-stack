# Scope Bullet's N+1 detection to each example. Bullet.raise is on in
# the test environment, so a detected N+1 fails the example.
RSpec.configure do |config|
  config.before(:each) do
    Bullet.start_request if Bullet.enable?
  end

  config.after(:each) do
    if Bullet.enable?
      Bullet.perform_out_of_channel_notifications if Bullet.notification?
      Bullet.end_request
    end
  end
end
