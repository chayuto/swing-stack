# Scoped personal access token for machine clients (AI agents, scripts).
# Plaintext is shown exactly once at provisioning; only a SHA-256 digest
# is persisted. Scopes enforce strict read/write boundaries and agent
# tokens default to a short TTL to bound autonomous loops.
class ApiToken < ApplicationRecord
  PREFIX = "ssk_".freeze
  SCOPES = %w[telemetry:read telemetry:write].freeze
  DEFAULT_TTL = 30.days

  belongs_to :user

  validates :name, presence: true
  validates :token_digest, presence: true, uniqueness: true
  validate :scopes_are_known

  scope :active, -> { where(revoked_at: nil).where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def self.digest(plaintext)
    Digest::SHA256.hexdigest(plaintext)
  end

  # Returns [record, plaintext].
  def self.issue!(user, name:, scopes:, ttl: DEFAULT_TTL)
    plaintext = "#{PREFIX}#{SecureRandom.urlsafe_base64(32)}"
    record = user.api_tokens.create!(
      name: name,
      scopes: Array(scopes),
      token_digest: digest(plaintext),
      expires_at: ttl&.from_now
    )
    [ record, plaintext ]
  end

  def self.authenticate(plaintext)
    return nil if plaintext.blank?

    active.find_by(token_digest: digest(plaintext))&.tap do |token|
      token.update_column(:last_used_at, Time.current)
    end
  end

  def allows?(scope)
    scopes.include?(scope)
  end

  def revoke!
    update!(revoked_at: Time.current)
  end

  private

  def scopes_are_known
    unknown = scopes - SCOPES
    errors.add(:scopes, "contains unknown scopes: #{unknown.join(', ')}") if unknown.any?
  end
end
