import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail, User, CheckCircle2, AlertCircle, Loader2, KeyRound,
  FlaskConical, Edit3, Hash, BarChart3, AlertTriangle, Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { userAPI, sampleAPI } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';

/* ── helpers ──────────────────────────────────────────── */
function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] tracking-widest uppercase text-muted-foreground">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/30 p-3 space-y-2">
      <div className="text-muted-foreground">{icon}</div>
      <p className="text-2xl font-bold text-foreground tabular-nums leading-none">{value}</p>
      <p className="text-[9px] tracking-widest uppercase text-muted-foreground leading-tight">
        {label}
      </p>
    </div>
  );
}

/* ── constants ────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  researcher: 'Researcher',
  research_assistant: 'Research Assistant',
  head_researcher: 'Head Researcher',
  user: 'User',
};

/* ── component ────────────────────────────────────────── */
const Profile = () => {
  const { user, refreshUser, role, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    flagged: number;
    pending: number;
  } | null>(null);

  // Inline email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email || '');

  // Password confirm for email change
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');

  // OTP password reset
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || '', email: user.email || '' });
      setEmailDraft(user.email || '');
    }
  }, [user]);

  useEffect(() => {
    sampleAPI.getStatistics().then(setStats).catch(() => {});
  }, []);

  /* handlers */
  const handleSaveProfile = async () => {
    if (formData.name === user?.name && formData.email === user?.email) {
      setIsEditing(false);
      return;
    }
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Name cannot be empty.', variant: 'destructive' });
      return;
    }
    if (formData.name !== user?.name && formData.email === user?.email) {
      try {
        setIsSubmitting(true);
        await userAPI.updateProfile({ name: formData.name });
        await refreshUser();
        setIsEditing(false);
        toast({ title: 'Success', description: 'Name updated successfully.' });
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.response?.data?.detail || 'Failed to update name.',
          variant: 'destructive',
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    if (formData.email !== user?.email) {
      setShowPasswordConfirm(true);
    }
  };

  const handleEmailEditSave = () => {
    const trimmed = emailDraft.trim();
    if (!trimmed || trimmed === user?.email) {
      setIsEditingEmail(false);
      setEmailDraft(user?.email || '');
      return;
    }
    setFormData((prev) => ({ ...prev, email: trimmed }));
    setShowPasswordConfirm(true);
  };

  const handleConfirmEmailChange = async () => {
    try {
      setIsSubmitting(true);
      await userAPI.updateProfile({
        name: formData.name,
        email: formData.email,
        current_password: currentPassword,
      });
      setShowPasswordConfirm(false);
      setIsEditing(false);
      setIsEditingEmail(false);
      setCurrentPassword('');
      toast({ title: 'Verification Sent', description: 'Please check your new email to verify the change.' });
      await refreshUser();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description:
          [error.response?.data?.current_password].flat()[0] ||
          'Incorrect password or invalid email.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestOTP = async () => {
    try {
      setIsSubmitting(true);
      await userAPI.requestPasswordResetOTP(user?.email || '');
      setResetStep(2);
      toast({ title: 'OTP Sent', description: 'Please check your email for the 6-digit code.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to send OTP.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match.', variant: 'destructive' });
      return;
    }
    try {
      setIsSubmitting(true);
      await userAPI.confirmPasswordResetOTP({
        email: user?.email,
        otp_code: otpCode,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setShowPasswordReset(false);
      setResetStep(1);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Success', description: 'Password reset. Please log in again.' });
      logout();
      navigate('/login');
    } catch (error: any) {
      toast({
        title: 'Reset Failed',
        description: error.response?.data?.detail || 'Invalid OTP or request.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── render ───────────────────────────────────────────── */
  return (
    <div className="min-h-screen">
      <main className="container py-10 max-w-6xl space-y-4">

        {/* ══ HERO ══════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-7">
          {/* Decorative watermark */}
          <div className="absolute top-0 right-0 pointer-events-none select-none opacity-[0.04] dark:opacity-[0.08]">
            <FlaskConical className="w-72 h-72 text-primary translate-x-16 -translate-y-16" />
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-[88px] w-[88px] border-2 border-primary/30 shadow-xl shadow-primary/10 ring-4 ring-background">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-8 text-lg font-bold bg-background/50 w-56"
                    placeholder="Full name"
                  />
                ) : (
                  <h1 className="text-2xl font-bold text-foreground tracking-tight">
                    {user?.name}
                  </h1>
                )}
                <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/5">
                  ✓ {ROLE_LABELS[role] || 'User'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Hash className="h-3 w-3 shrink-0" />
                  <span className="font-mono">
                    ID: {String(user?.id ?? '').substring(0, 8).toUpperCase() || '—'}
                  </span>
                </span>
                <span
                  className={`text-[8px] font-bold tracking-widest px-1.5 py-0.5 rounded-sm border ${
                    user?.is_active
                      ? 'bg-green-500/15 text-green-500 border-green-500/30'
                      : 'bg-destructive/15 text-destructive border-destructive/30'
                  }`}
                >
                  {user?.is_active ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              {isEditing && formData.email !== user?.email && (
                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Email change requires password verification and email confirmation
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 shrink-0">
              {!isEditing ? (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData({ name: user?.name || '', email: user?.email || '' });
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isSubmitting}
                    size="sm"
                    className="gradient-primary text-white gap-1.5 text-xs"
                  >
                    {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Changes
                  </Button>
                </>
              )}
              <Button
                onClick={() => setShowPasswordReset(true)}
                size="sm"
                className="gap-1.5 text-xs border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 dark:bg-primary/15 dark:hover:bg-primary/25"
              >
                <KeyRound className="h-3.5 w-3.5" /> Change Password
              </Button>
            </div>
          </div>
        </div>

        {/* ══ MAIN GRID ═════════════════════════════════════ */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* ── REGISTRY METADATA ─── */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 space-y-5">
            <h2 className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" /> Registry Metadata
            </h2>
            <div className="space-y-4 divide-y divide-border/40">
              <DataRow label="Digital Correspondence">
                {isEditingEmail ? (
                  <div className="space-y-2 mt-0.5">
                    <Input
                      type="email"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      className="h-7 text-xs font-mono bg-background/50"
                      placeholder="New email address"
                      autoFocus
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleEmailEditSave}
                        className="text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setIsEditingEmail(false); setEmailDraft(user?.email || ''); }}
                        className="text-[10px] font-medium px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-foreground break-all">{user?.email}</span>
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="shrink-0"
                      aria-label="Edit email"
                    >
                      <Edit3 className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  </div>
                )}
              </DataRow>
              <div className="pt-4">
                <DataRow label="System Role">
                  <span className="text-xs font-semibold text-primary">
                    {ROLE_LABELS[role] || 'User'}
                  </span>
                </DataRow>
              </div>
              <div className="pt-4">
                <DataRow label="Account Node">
                  <span className="font-mono text-xs text-foreground">
                    {String(user?.id ?? '').substring(0, 8).toUpperCase() || '—'}
                  </span>
                </DataRow>
              </div>
            </div>
          </div>

          {/* ── OUTPUT ANALYTICS ─── */}
          <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-6 space-y-5">
            <h2 className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5" /> Output Analytics
            </h2>
            <div className="grid grid-cols-2 gap-2.5">
              <StatBlock
                label="Total Samples"
                value={stats ? stats.total : '—'}
                icon={<FlaskConical className="h-4 w-4" />}
              />
              <StatBlock
                label="Completed"
                value={stats ? stats.completed : '—'}
                icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
              />
              <StatBlock
                label="Flagged"
                value={stats ? stats.flagged : '—'}
                icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              />
              <StatBlock
                label="Pending"
                value={stats ? stats.pending : '—'}
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </div>

        </div>
      </main>

      {/* ══ PASSWORD CONFIRM DIALOG ═══════════════════════ */}
      <Dialog
        open={showPasswordConfirm}
        onOpenChange={(open) => {
          setShowPasswordConfirm(open);
          if (!open) {
            setCurrentPassword('');
            setIsEditingEmail(false);
            setEmailDraft(user?.email || '');
          }
        }}
      >
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Verify Identity</DialogTitle>
            <DialogDescription>
              To change your email address, please enter your current password for security.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter your current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="bg-background/50"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowPasswordConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmEmailChange}
              disabled={!currentPassword || isSubmitting}
              className="gradient-primary text-white"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ OTP PASSWORD RESET DIALOG ═════════════════════ */}
      <Dialog
        open={showPasswordReset}
        onOpenChange={(open) => {
          setShowPasswordReset(open);
          if (!open) {
            setResetStep(1);
            setOtpCode('');
            setNewPassword('');
            setConfirmPassword('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {resetStep === 1 ? 'Request Password Reset' : 'Verify OTP & Reset'}
            </DialogTitle>
            <DialogDescription>
              {resetStep === 1
                ? 'We will send a 6-digit confirmation code to your registered email address.'
                : 'Enter the 6-digit code we sent to your email and set your new password.'}
            </DialogDescription>
          </DialogHeader>

          {resetStep === 1 ? (
            <div className="py-6 flex flex-col items-center justify-center space-y-4">
              <div className="bg-primary/5 p-4 rounded-full border border-primary/20 shadow-inner">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-center max-w-xs">
                Verification code will be sent to:
                <br />
                <span className="text-primary font-bold">{user?.email}</span>
              </p>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="space-y-2 flex flex-col items-center">
                <label className="text-sm font-medium self-start">Verification Code (OTP)</label>
                <InputOTP maxLength={6} value={otpCode} onChange={(val) => setOtpCode(val)}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-row justify-center gap-2 sm:justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordReset(false);
                setResetStep(1);
                setOtpCode('');
                setNewPassword('');
                setConfirmPassword('');
              }}
            >
              Cancel
            </Button>
            {resetStep === 1 ? (
              <Button
                onClick={handleRequestOTP}
                disabled={isSubmitting}
                className="gradient-primary text-white shadow-lg shadow-primary/20"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Reset Code
              </Button>
            ) : (
              <Button
                onClick={handleResetPassword}
                disabled={isSubmitting || otpCode.length < 6 || !newPassword}
                className="gradient-primary text-white shadow-lg shadow-primary/20"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
