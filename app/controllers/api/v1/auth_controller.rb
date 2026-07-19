module Api
  module V1
    # Human authentication: short-lived access JWT + rotating refresh
    # token. Machine clients authenticate via ApiTokensController keys.
    class AuthController < BaseController
      before_action :authenticate_user!, only: :logout

      def register
        user = User.create!(params.permit(:email, :password, :name))
        render json: token_response(user), status: :created
      end

      def login
        user = User.find_by(email: params[:email].to_s.downcase.strip)
        return render_unauthorized unless user&.authenticate(params[:password].to_s)

        render json: token_response(user)
      end

      # Refresh-token rotation: the presented token is revoked and a new
      # pair is issued, so a replayed refresh token is dead on arrival.
      def refresh
        token = RefreshToken.find_active(params[:refresh_token].to_s)
        return render_unauthorized unless token

        token.revoke!
        render json: token_response(token.user)
      end

      def logout
        RefreshToken.find_active(params[:refresh_token].to_s)&.revoke!
        head :no_content
      end

      private

      def token_response(user)
        _, refresh_plaintext = RefreshToken.issue!(user)
        {
          access_token: JsonWebToken.encode(user),
          token_type: "Bearer",
          expires_in: JsonWebToken::ACCESS_TTL.to_i,
          refresh_token: refresh_plaintext,
          user: { id: user.id, email: user.email, name: user.name }
        }
      end
    end
  end
end
