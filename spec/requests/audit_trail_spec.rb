require "rails_helper"

RSpec.describe "Audit trail attribution", type: :request do
  let(:user) { create(:user) }

  before { Trackman::Importer.new(user: user, payload: trackman_payload).call }

  it "attributes human edits to the user" do
    club = user.clubs.find_by!(static_loft_deg: 54.0)

    patch "/api/v1/clubs/#{club.id}", params: { label: "Sand Wedge" }, headers: jwt_headers(user)

    expect(response).to have_http_status(:ok)
    version = PaperTrail::Version.where(item_type: "Club", event: "update").sole
    expect(version.whodunnit).to eq("user:#{user.id}")
    expect(version.object_changes).to include("label" => [ "54.0°", "Sand Wedge" ])
  end

  it "attributes agent edits to the api token" do
    shot = user.shots.find_by!(external_id: "1e9cd215-7b04-4675-b342-08dfa1721aae")
    headers = api_key_headers(user, scopes: %w[telemetry:write])

    patch "/api/v1/shots/#{shot.id}", params: { excluded: true }, headers: headers

    expect(response).to have_http_status(:ok)
    version = shot.versions.sole
    expect(version.whodunnit).to eq("api_token:#{user.api_tokens.sole.id}")
  end
end
