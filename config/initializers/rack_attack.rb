# Abuse protection. Agent (machine) traffic is throttled aggressively to
# contain runaway autonomous loops; auth endpoints are throttled to slow
# credential stuffing.
#
# NOTE: MemoryStore is per-process — sufficient for development and demos.
# In a multi-process production deployment, point this at a shared store
# (Solid Cache / Redis) so limits are enforced cluster-wide.
Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

class Rack::Attack
  AGENT_LIMIT = Integer(ENV.fetch("AGENT_RATE_LIMIT", 60))
  USER_LIMIT  = Integer(ENV.fetch("USER_RATE_LIMIT", 300))

  # Machine clients: keyed by API key digest, tight window.
  throttle("agents/api-key", limit: AGENT_LIMIT, period: 1.minute) do |req|
    key = req.get_header("HTTP_X_API_KEY")
    Digest::SHA256.hexdigest(key) if key.present? && req.path.start_with?("/api/")
  end

  # Human/browser clients: keyed by IP, generous window.
  throttle("api/ip", limit: USER_LIMIT, period: 1.minute) do |req|
    req.ip if req.path.start_with?("/api/") && req.get_header("HTTP_X_API_KEY").blank?
  end

  # Credential endpoints: slow brute force by IP.
  throttle("auth/ip", limit: 10, period: 1.minute) do |req|
    req.ip if req.path.start_with?("/api/v1/auth") && req.post?
  end

  self.throttled_responder = lambda do |request|
    match_data = request.env["rack.attack.match_data"]
    retry_after = match_data[:period] - (Time.now.to_i % match_data[:period])
    [
      429,
      { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
      [ { error: "rate_limited", retry_after: retry_after }.to_json ]
    ]
  end
end

Rails.application.config.middleware.use Rack::Attack unless Rails.env.test?
