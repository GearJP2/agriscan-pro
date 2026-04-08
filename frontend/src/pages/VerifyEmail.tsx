import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { userAPI } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Invalid or missing verification token.');
        return;
      }

      try {
        const res = await userAPI.confirmEmailChange(token);
        setStatus('success');
        setMessage(res.detail || 'Email verified successfully!');
        await refreshUser();
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.detail || 'Verification failed. The link may be expired.');
      }
    };

    verify();
  }, [token, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background/50 p-6">
      <Card className="max-w-md w-full glass-card border-primary/10 shadow-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
          <CardDescription>Finalizing your email change request</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8 space-y-6 text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-medium">Verifying your new email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="bg-green-500/10 p-4 rounded-full border border-green-500/20">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-foreground font-semibold text-lg">{message}</p>
              <Button onClick={() => navigate('/profile')} className="gradient-primary text-white w-full">
                Go to Profile
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="bg-destructive/10 p-4 rounded-full border border-destructive/20">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <p className="text-foreground font-semibold text-lg">{message}</p>
              <Button onClick={() => navigate('/profile')} variant="outline" className="w-full">
                Back to Profile
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
