# Two isolated authentication lanes:
#
#   * Humans (web / mobile): short-lived JWT in `Authorization: Bearer`.
#   * Machines (AI agents):  scoped API key in `X-Api-Key`.
#
# Machine credentials can never mint or manage other credentials, and
# every data endpoint declares the scope an agent needs to reach it.
module Authenticable
  extend ActiveSupport::Concern

  included do
    attr_reader :current_user, :current_api_token
  end

  # Human-only endpoints (credential management, auth flows).
  def authenticate_user!
    claims = JsonWebToken.decode(bearer_token)
    @current_user = claims && User.find_by(id: claims["sub"])
    render_unauthorized unless @current_user
  end

  # Data endpoints: a human JWT passes outright; an agent key passes
  # only when it carries the required scope.
  def authenticate_actor!(scope:)
    api_key = request.headers["X-Api-Key"]
    return authenticate_user! if api_key.blank?

    @current_api_token = ApiToken.authenticate(api_key)
    return render_unauthorized unless @current_api_token
    return render_forbidden(scope) unless @current_api_token.allows?(scope)

    @current_user = @current_api_token.user
  end

  private

  def bearer_token
    request.headers["Authorization"].to_s[/\ABearer (.+)\z/, 1]
  end

  def render_unauthorized
    render json: { error: "unauthorized" }, status: :unauthorized
  end

  def render_forbidden(scope)
    render json: { error: "forbidden", required_scope: scope }, status: :forbidden
  end
end
