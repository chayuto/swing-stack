module AuthHelpers
  def jwt_headers(user)
    { "Authorization" => "Bearer #{JsonWebToken.encode(user)}" }
  end

  def api_key_headers(user, scopes:)
    _, plaintext = ApiToken.issue!(user, name: "spec agent", scopes: scopes)
    { "X-Api-Key" => plaintext }
  end

  def trackman_payload
    @trackman_payload ||= JSON.parse(file_fixture("trackman_report.json").read)
  end
end

RSpec.configure do |config|
  config.include AuthHelpers
end
