/**
 * Google OAuth Callback Handler
 * Handles the redirect from Google OAuth and exchanges code for tokens
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { handleOAuthCallback } from '@/lib/oauth';
import { Loader2 } from 'lucide-react';

const GoogleAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        // Handle Google errors
        if (errorParam) {
          const errorDescription = searchParams.get('error_description') || 'Unknown error occurred';
          throw new Error(`Google authentication failed: ${errorDescription}`);
        }

        // Validate required parameters
        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        // Process OAuth callback
        const tokens = await handleOAuthCallback(code, state);
        
        if (!tokens) {
          throw new Error('Failed to obtain authentication tokens');
        }

        // Set auth token in context
        await loginWithToken(tokens.access_token, tokens.refresh_token);

        // Redirect to dashboard
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1000);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Authentication failed';
        console.error('OAuth callback error:', errorMsg);
        setError(errorMsg);
        setIsProcessing(false);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 3000);
      }
    };

    processCallback();
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-tertiary/5">
      <div className="max-w-md w-full mx-auto text-center">
        {isProcessing && !error ? (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary-container">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            </div>
            <h1 className="text-2xl font-bold mb-2">Signing You In</h1>
            <p className="text-muted-foreground">
              Please wait while we authenticate your account...
            </p>
          </>
        ) : error ? (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-2xl font-bold text-red-600">Authentication Failed</h1>
            <p className="text-gray-600 text-sm">{error}</p>
            <p className="text-xs text-gray-500">
              Redirecting to home page in a few seconds...
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <span className="text-2xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-green-600">Success!</h1>
            <p className="text-gray-600 text-sm">
              Your authentication was successful. Redirecting to dashboard...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthCallback;
