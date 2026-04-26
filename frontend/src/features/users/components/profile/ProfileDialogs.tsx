import { Loader2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ProfileDialogsProps {
  showPasswordConfirm: boolean;
  setShowPasswordConfirm: (val: boolean) => void;
  currentPassword: string;
  setCurrentPassword: (val: string) => void;
  handleConfirmEmailChange: () => void;
  isSubmitting: boolean;
  userEmail: string | undefined;
  showPasswordReset: boolean;
  setShowPasswordReset: (val: boolean) => void;
  resetStep: number;
  setResetStep: (val: number) => void;
  otpCode: string;
  setOtpCode: (val: string) => void;
  newPassword: string;
  setNewPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  handleRequestOTP: () => void;
  handleResetPassword: () => void;
}

export const ProfileDialogs = ({
  showPasswordConfirm,
  setShowPasswordConfirm,
  currentPassword,
  setCurrentPassword,
  handleConfirmEmailChange,
  isSubmitting,
  userEmail,
  showPasswordReset,
  setShowPasswordReset,
  resetStep,
  setResetStep,
  otpCode,
  setOtpCode,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  handleRequestOTP,
  handleResetPassword,
}: ProfileDialogsProps) => {
  return (
    <>
      {/* ══ PASSWORD CONFIRM DIALOG ═══════════════════════ */}
      <Dialog
        open={showPasswordConfirm}
        onOpenChange={(open) => {
          setShowPasswordConfirm(open);
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
                {userEmail}
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
                  <InputOTPSlot
                    index={0}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border"
                  />
                  <InputOTPSlot
                    index={1}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border"
                  />
                  <InputOTPSlot
                    index={2}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border"
                  />
                  <InputOTPSlot
                    index={3}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border"
                  />
                  <InputOTPSlot
                    index={4}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border"
                  />
                  <InputOTPSlot
                    index={5}
                    className="w-10 h-10 sm:w-12 sm:h-12 text-lg rounded-md border"
                  />
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
                <label className="text-sm font-medium">Confirm Password</label>
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
              }}
            >
              Cancel
            </Button>
            {resetStep === 1 && (
              <Button onClick={handleRequestOTP} disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Send Code
              </Button>
            )}
            {resetStep === 2 && (
              <Button
                onClick={() => setResetStep(3)}
                disabled={otpCode.length < 6}
              >
                Continue
              </Button>
            )}
            {resetStep === 3 && (
              <Button
                onClick={handleResetPassword}
                disabled={
                  isSubmitting ||
                  !newPassword ||
                  newPassword !== confirmPassword
                }
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Password
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
