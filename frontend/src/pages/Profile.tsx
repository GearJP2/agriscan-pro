import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  FlaskConical,
  Edit3,
  Hash,
  BarChart3,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { userAPI, sampleAPI } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

/* ── helpers ──────────────────────────────────────────── */
function DataRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] tracking-widest uppercase text-muted-foreground">
        {label}
      </p>
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
      <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[9px] tracking-widest uppercase text-muted-foreground leading-tight">
        {label}
      </p>
    </div>
  );
}

/* ── constants ────────────────────────────────────────── */
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  researcher: "Researcher",
  research_assistant: "Research Assistant",
  head_researcher: "Head Researcher",
  user: "User",
};

/* ── component ────────────────────────────────────────── */
type ErrorResponseData = {
  detail?: string;
  current_password?: string | string[];
};

type ErrorWithResponse = {
  response?: {
    data?: ErrorResponseData;
  };
};

function getErrorResponseData(error: unknown): ErrorResponseData | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as ErrorWithResponse).response === "object"
  ) {
    return (error as ErrorWithResponse).response?.data;
  }

  return undefined;
}

function getErrorDetail(error: unknown): string | undefined {
  return getErrorResponseData(error)?.detail;
}

function getCurrentPasswordError(error: unknown): string | undefined {
  const currentPasswordError = getErrorResponseData(error)?.current_password;

  if (Array.isArray(currentPasswordError)) {
    return currentPasswordError[0];
  }

  return currentPasswordError;
}

const Profile = () => {
  const { user, refreshUser, role, logout } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const [stats, setStats] = useState<{
    total: number;
    completed: number;
    flagged: number;
    pending: number;
  } | null>(null);

  // Inline email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email || "");

  // Password confirm for email change
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  // OTP password reset
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || "", email: user.email || "" });
      setEmailDraft(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    sampleAPI
      .getStatistics()
      .then(setStats)
      .catch(() => {});
  }, []);

  /* handlers */
  const handleSaveProfile = async () => {
    if (formData.name === user?.name && formData.email === user?.email) {
      setIsEditing(false);
      return;
    }
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (formData.name !== user?.name && formData.email === user?.email) {
      try {
        setIsSubmitting(true);
        await userAPI.updateProfile({ name: formData.name });
        await refreshUser();
        setIsEditing(false);
        toast({ title: "Success", description: "Name updated successfully." });
      } catch (error: unknown) {
        toast({
          title: "Error",
          description: getErrorDetail(error) || "Failed to update name.",
          variant: "destructive",
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
      setEmailDraft(user?.email || "");
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
      setCurrentPassword("");
      toast({
        title: "Verification Sent",
        description: "Please check your new email to verify the change.",
      });
      await refreshUser();
    } catch (error: unknown) {
      toast({
        title: "Verification Failed",
        description:
          getCurrentPasswordError(error) ||
          "Incorrect password or invalid email.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestOTP = async () => {
    try {
      setIsSubmitting(true);
      await userAPI.requestPasswordResetOTP(user?.email || "");
      setResetStep(2);
      toast({
        title: "OTP Sent",
        description: "Please check your email for the 6-digit code.",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to send OTP.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
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
      setOtpCode("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Success",
        description: "Password reset. Please log in again.",
      });
      void logout();
      navigate("/");
    } catch (error: unknown) {
      toast({
        title: "Reset Failed",
        description: getErrorDetail(error) || "Invalid OTP or request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── render ───────────────────────────────────────────── */
  return (
    <div className="min-h-screen pb-16">
      <main className="container pt-6 pb-10 max-w-5xl space-y-8">
        
        {/* ══ HERO COVER BANNER & PROFILE HEAD ════════════════════════════════ */}
        <div className="relative mb-20 sm:mb-16">
          {/* Cover Photo */}
          <div className="h-48 sm:h-56 w-full rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/5 to-background border border-border/50 overflow-hidden relative shadow-sm">
            <div className="absolute top-0 right-0 opacity-10 blur-2xl pointer-events-none">
              <FlaskConical className="w-96 h-96 text-primary translate-x-1/4 -translate-y-1/4" />
            </div>
            
            {/* Optional subtle grid pattern overlay here if desired */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay" />
          </div>

          {/* Overlapping Avatar & Header Info */}
          <div className="px-6 md:px-10 flex flex-col sm:flex-row items-start sm:items-end gap-6 -mt-16 relative z-10">
            <div className="relative shrink-0 group">
              <Avatar className="h-32 w-32 md:h-36 md:w-36 border-4 border-background shadow-2xl ring-1 ring-border/50 bg-card transition-transform duration-500 ease-out group-hover:scale-[1.02]">
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary/10 text-primary text-5xl font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {/* Online Indicator */}
              <div
                className={`absolute bottom-3 right-3 h-6 w-6 rounded-full border-4 border-background shadow-sm transition-colors duration-500 ${
                  user?.is_active ? "bg-emerald-500" : "bg-destructive"
                }`}
                title={user?.is_active ? "Active account" : "Inactive account"}
              />
            </div>

            <div className="flex-1 min-w-0 pt-2 sm:pt-16 pb-2 w-full flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div className="space-y-2">
                {isEditing ? (
                  <div className="space-y-1">
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="h-10 text-2xl font-bold bg-background/50 w-full sm:w-80 border-primary/50 shadow-sm focus-visible:ring-primary/30"
                      placeholder="Full name"
                      autoFocus
                    />
                    {formData.email !== user?.email && (
                      <p className="text-[10px] text-amber-500 flex items-center gap-1.5 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Saving will require password verification
                      </p>
                    )}
                  </div>
                ) : (
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight drop-shadow-sm">
                    {user?.name}
                  </h1>
                )}
                
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1.5 text-foreground/80">
                    <Mail className="h-4 w-4 opacity-70" />
                    {user?.email}
                  </span>
                  <span className="hidden sm:inline-block text-border/60">•</span>
                  <span className="px-2.5 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest shadow-sm">
                    {ROLE_LABELS[role] || "User"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    className="gap-2 rounded-full px-5 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300 shadow-sm"
                  >
                    <Edit3 className="h-4 w-4" /> Edit Profile
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          name: user?.name || "",
                          email: user?.email || "",
                        });
                      }}
                      variant="ghost"
                      className="rounded-full px-5"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSubmitting}
                      className="gradient-primary text-white gap-2 rounded-full px-6 shadow-md hover:shadow-lg transition-all"
                    >
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {"Save Changes"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ══ BENTO GRID ═════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* ── REGISTRY METADATA (Left 8 cols) ─── */}
          <div className="md:col-span-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-card/60">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">Registry Metadata</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your core system identity</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 gap-y-10">
              <DataRow label="Email Address">
                {isEditingEmail ? (
                  <div className="space-y-3 mt-1 relative z-10">
                    <Input
                      type="email"
                      value={emailDraft}
                      onChange={(e) => setEmailDraft(e.target.value)}
                      className="h-9 text-sm font-medium bg-background border-primary/40 shadow-sm focus-visible:ring-primary/20"
                      placeholder="New email address"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleEmailEditSave}
                        className="h-7 text-xs px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingEmail(false);
                          setEmailDraft(user?.email || "");
                        }}
                        className="h-7 text-xs px-3 rounded-md"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 group mt-1">
                    <span className="font-medium text-sm text-foreground break-all">
                      {user?.email}
                    </span>
                    <button
                      onClick={() => setIsEditingEmail(true)}
                      className="shrink-0 p-1.5 rounded-md bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
                      aria-label="Edit email"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </DataRow>

              <DataRow label="System Role">
                 <div className="mt-1 flex items-center gap-2">
                   <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-border/60 shadow-sm bg-background/50">
                     {ROLE_LABELS[role] || "User"}
                   </Badge>
                 </div>
              </DataRow>

              <DataRow label="Account Node ID">
                <span className="font-mono text-xs font-medium text-muted-foreground mt-1 block bg-muted/30 px-2 py-1 rounded w-fit border border-border/40">
                  {String(user?.id ?? "")
                    .toUpperCase() || "—"}
                </span>
              </DataRow>

              <DataRow label="Account Status">
                <div className="mt-1 flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${user?.is_active ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
                  <span className="text-sm font-medium">
                    {user?.is_active ? "Active Platform Node" : "Disabled Node"}
                  </span>
                </div>
              </DataRow>
            </div>
          </div>

          {/* ── SECURITY ZONE (Right 4 cols) ─── */}
          <div className="md:col-span-4 rounded-3xl border border-destructive/20 bg-gradient-to-b from-card/40 to-destructive/5 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md border-t-4 border-t-destructive flex flex-col h-full">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">Security</h2>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-center space-y-6">
              <div className="space-y-1">
                 <p className="text-sm font-medium text-foreground">Authentication</p>
                 <p className="text-xs text-muted-foreground leading-relaxed">
                   Ensure your account remains safe. We recommend updating your passphrase every 90 days.
                 </p>
              </div>
              
              <Button
                onClick={() => setShowPasswordReset(true)}
                variant="outline"
                className="w-full gap-2 justify-center border-destructive/30 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors shadow-sm rounded-xl py-6"
              >
                <KeyRound className="h-4 w-4" /> Change Password
              </Button>
            </div>
          </div>

          {/* ── OUTPUT ANALYTICS (Full Width 12 cols) ─── */}
          <div className="md:col-span-12 rounded-3xl border border-border/50 bg-card/20 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md mt-2">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">Output Analytics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Your lifetime contribution metrics</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <StatBlock
                label="Total Samples"
                value={stats ? stats.total : "—"}
                icon={<FlaskConical className="h-5 w-5 text-indigo-500" />}
              />
              <StatBlock
                label="Completed"
                value={stats ? stats.completed : "—"}
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              />
              <StatBlock
                label="Flagged"
                value={stats ? stats.flagged : "—"}
                icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
              />
              <StatBlock
                label="Pending"
                value={stats ? stats.pending : "—"}
                icon={<Clock className="h-5 w-5 text-muted-foreground" />}
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
            setCurrentPassword("");
            setIsEditingEmail(false);
            setEmailDraft(user?.email || "");
          }
        }}
      >
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>Verify Identity</DialogTitle>
            <DialogDescription>
              To change your email address, please enter your current password
              for security.
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
            <Button
              variant="ghost"
              onClick={() => setShowPasswordConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmEmailChange}
              disabled={!currentPassword || isSubmitting}
              className="gradient-primary text-white"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
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
            setOtpCode("");
            setNewPassword("");
            setConfirmPassword("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md glass-card">
          <DialogHeader>
            <DialogTitle>
              {resetStep === 1
                ? "Password Reset"
                : resetStep === 2
                  ? "Verify OTP"
                  : "Set New Password"}
            </DialogTitle>
            <DialogDescription>
              {resetStep === 1
                ? "We will send a 6-digit confirmation code to verify your identity."
                : resetStep === 2
                  ? "Enter the code sent to your email to continue."
                  : "Enter your new password."}
            </DialogDescription>
          </DialogHeader>

          {resetStep === 1 && (
            <div className="py-4 space-y-2">
              <p className="text-sm font-medium">Email Destination</p>
              <div className="p-3 rounded-md bg-muted/50 border border-border/50 font-mono text-sm">
                {user?.email}
              </div>
            </div>
          )}

          {resetStep === 2 && (
            <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center animate-in fade-in zoom-in-95">
              <div className="bg-primary/5 p-3 rounded-full border border-primary/20 shadow-inner">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  Verification Code
                </p>
                <p className="text-xs text-muted-foreground w-64">
                  Please enter the 6-digit code sent to your email to continue.
                </p>
              </div>
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val);
                  if (val.length === 6) {
                     setResetStep(3);
                  }
                }}
                className="gap-2"
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot index={0} className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border" />
                  <InputOTPSlot index={1} className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border" />
                  <InputOTPSlot index={2} className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border" />
                  <InputOTPSlot index={3} className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border" />
                  <InputOTPSlot index={4} className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border" />
                  <InputOTPSlot index={5} className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border" />
                </InputOTPGroup>
              </InputOTP>
            </div>
          )}

          {resetStep === 3 && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Confirm Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowPasswordReset(false);
                setResetStep(1);
                setOtpCode("");
                setNewPassword("");
                setConfirmPassword("");
              }}
            >
              Cancel
            </Button>
            {resetStep === 1 && (
              <Button onClick={handleRequestOTP} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Code
              </Button>
            )}
            {resetStep === 2 && (
              <Button onClick={() => setResetStep(3)} disabled={otpCode.length < 6}>
                Continue
              </Button>
            )}
            {resetStep === 3 && (
              <Button
                onClick={handleResetPassword}
                disabled={isSubmitting || !newPassword || newPassword !== confirmPassword}
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
