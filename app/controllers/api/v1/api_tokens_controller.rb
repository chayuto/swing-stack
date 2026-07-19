module Api
  module V1
    # Provisioning of scoped machine credentials. Human-JWT only: an
    # agent key can never mint or revoke credentials.
    class ApiTokensController < BaseController
      before_action :authenticate_user!

      def index
        render json: current_user.api_tokens.order(created_at: :desc).map { |t| serialize(t) }
      end

      def create
        ttl = params[:ttl_seconds].present? ? Integer(params[:ttl_seconds]).seconds : ApiToken::DEFAULT_TTL
        token, plaintext = ApiToken.issue!(
          current_user,
          name: params.require(:name),
          scopes: Array(params[:scopes]),
          ttl: ttl
        )
        # Plaintext is returned exactly once, at provisioning time.
        render json: serialize(token).merge(token: plaintext), status: :created
      end

      def destroy
        current_user.api_tokens.find(params[:id]).revoke!
        head :no_content
      end

      private

      def serialize(token)
        token.as_json(only: %i[id name scopes expires_at last_used_at revoked_at created_at])
      end
    end
  end
end
