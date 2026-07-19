# Cross-origin access for the decoupled frontend tier (React web / Expo).
# Origins are environment-driven; defaults cover local development.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("CORS_ORIGINS", "http://localhost:3001,http://localhost:5173,http://localhost:8081").split(",")

    resource "/api/*",
      headers: :any,
      methods: %i[get post put patch delete options head],
      expose: %w[X-Request-Id]
  end
end
