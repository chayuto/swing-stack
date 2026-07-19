# Long-lived, single-use refresh credential for human clients. Only a
# SHA-256 digest is stored; tokens are rotated on every refresh and the
# previous token is revoked (refresh-token rotation).
class RefreshToken < ApplicationRecord
  TTL = 30.days

  belongs_to :user

  validates :token_digest, presence: true, uniqueness: true

  scope :active, -> { where(revoked_at: nil).where(expires_at: Time.current..) }

  def self.digest(plaintext)
    Digest::SHA256.hexdigest(plaintext)
  end

  # Returns [record, plaintext]. Plaintext is only available here.
  def self.issue!(user)
    plaintext = SecureRandom.urlsafe_base64(48)
    record = user.refresh_tokens.create!(
      token_digest: digest(plaintext),
      expires_at: TTL.from_now
    )
    [ record, plaintext ]
  end

  def self.find_active(plaintext)
    active.find_by(token_digest: digest(plaintext))
  end

  def revoke!
    update!(revoked_at: Time.current)
  end
end
