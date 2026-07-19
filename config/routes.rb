Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      # Human auth (JWT + rotating refresh tokens)
      post "auth/register", to: "auth#register"
      post "auth/login",    to: "auth#login"
      post "auth/refresh",  to: "auth#refresh"
      delete "auth/logout", to: "auth#logout"

      # Machine credentials (scoped agent keys, human-managed)
      resources :api_tokens, only: %i[index create destroy]

      # Telemetry pipeline
      resources :imports, only: %i[create index show]
      resources :sessions, only: %i[index show], controller: :training_sessions
      resources :shots, only: %i[index update]
      resources :clubs, only: %i[index update]

      # Analytics
      get "stats/clubs", to: "stats#clubs"

      # Machine-readable API description, no auth required
      get "openapi.json", to: "docs#openapi"
    end
  end
end
