# Short-lived HS256 access tokens for human clients. Refresh flow lives
# in RefreshToken; agents never receive JWTs (see ApiToken).
class JsonWebToken
  ALGORITHM = "HS256".freeze
  ACCESS_TTL = 15.minutes

  class << self
    def encode(user)
      now = Time.current.to_i
      payload = {
        sub: user.id,
        iat: now,
        exp: (Time.current + ACCESS_TTL).to_i,
        jti: SecureRandom.uuid
      }
      JWT.encode(payload, secret, ALGORITHM)
    end

    # => claims hash or nil when invalid/expired
    def decode(token)
      JWT.decode(token, secret, true, algorithm: ALGORITHM).first
    rescue JWT::DecodeError
      nil
    end

    private

    def secret
      ENV.fetch("JWT_SECRET") { Rails.application.secret_key_base }
    end
  end
end
