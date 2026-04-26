/**
 * Google OAuth callback page.
 *
 * Exchanges the Google authorization code with the backend using the
 * cookie-backed auth flow, then hydrates the in-memory access token
 * through AuthContext.
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { exchangeGoogleAuthCode } from "@/lib/authApi";

const GoogleAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const errorParam = searchParams.get("error");

        if (errorParam) {
          const errorDescription =
            searchParams.get("error_description") ||
            "Google authentication was cancelled or failed.";
          throw new Error(errorDescription);
        }

        if (!code || !state) {
          throw new Error("Missing authorization code or state parameter.");
        }

        const codeVerifier =
          sessionStorage.getItem("google_oauth_code_verifier") || undefined;

        const authResponse = await exchangeGoogleAuthCode(
          code,
          state,
          codeVerifier,
        );

        sessionStorage.removeItem("google_oauth_code_verifier");
        const nextPath = sessionStorage.getItem("google_oauth_next_path") || "/";
        sessionStorage.removeItem("google_oauth_next_path");
        sessionStorage.removeItem("google_oauth_intent");

        await loginWithToken(authResponse.access_token, authResponse.user);

        if (authResponse.flow === "link" && authResponse.detail) {
          sessionStorage.setItem("google_oauth_flash", authResponse.detail);
        }

        navigate(nextPath, { replace: true });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Authentication failed. Please try again.";

        setError(message);

        window.setTimeout(() => {
          navigate("/", { replace: true });
        }, 2500);
      }
    };

    void processCallback();
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-tertiary/5 px-6">
      <div className="max-w-md w-full mx-auto text-center">
        {!error ? (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-container">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Signing You In</h1>
            <p className="text-muted-foreground">
              Please wait while we complete your Google sign-in...
            </p>
          </>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-destructive">
              Authentication Failed
            </h1>
            <p className="text-muted-foreground text-sm">{error}</p>
            <p className="text-xs text-muted-foreground/60">
              Redirecting you back to the home page...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
