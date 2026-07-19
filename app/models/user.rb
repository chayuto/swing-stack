class User < ApplicationRecord
  has_secure_password

  has_many :refresh_tokens, dependent: :destroy
  has_many :api_tokens, dependent: :destroy
  has_many :clubs, dependent: :destroy
  has_many :club_lofts, dependent: :destroy
  has_many :training_sessions, dependent: :destroy
  has_many :import_batches, dependent: :destroy
  has_many :shots, through: :training_sessions

  before_validation { self.email = email.to_s.downcase.strip }

  validates :email, presence: true,
                    uniqueness: { case_sensitive: false },
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :password, length: { minimum: 8 }, allow_nil: true
end
