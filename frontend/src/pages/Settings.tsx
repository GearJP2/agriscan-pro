import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Moon,
  Settings as SettingsIcon,
  Sun,
  Unlink2,
} from "lucide-react";
import { useTheme } from "next-themes";

import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  beginGoogleOAuthConnect,
  disconnectGoogleProvider,
  fetchAuthProviderSummary,
  setAccountPassword,
  type AuthProviderSummary,
} from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const Settings = () => {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [providerSummary, setProviderSummary] = useState<AuthProviderSummary | null>(
    null,
  );
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const googleProvider = useMemo(
    () => providerSummary?.providers.find((provider) => provider.provider === "google"),
    [providerSummary],
  );

  const loadProviderSummary = useCallback(async () => {
    try {
      setIsLoadingProviders(true);
      const summary = await fetchAuthProviderSummary();
      setProviderSummary(summary);
    } catch (error) {
      toast({
        title: "Unable to load account security",
        description:
          error instanceof Error
            ? error.message
            : "Could not load authentication providers.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingProviders(false);
    }
  }, []);

  useEffect(() => {
    void loadProviderSummary();
    const oauthFlashMessage = sessionStorage.getItem("google_oauth_flash");
    if (oauthFlashMessage) {
      toast({
        title: "Account linked",
        description: oauthFlashMessage,
      });
      sessionStorage.removeItem("google_oauth_flash");
    }
  }, [loadProviderSummary]);

  const handleConnectGoogle = async () => {
    try {
      setIsConnectingGoogle(true);
      sessionStorage.setItem("google_oauth_next_path", "/settings");
      sessionStorage.setItem("google_oauth_intent", "link");
      const { auth_url } = await beginGoogleOAuthConnect();
      window.location.href = auth_url;
    } catch (error) {
      toast({
        title: "Google connect failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to connect Google account.",
        variant: "destructive",
      });
      setIsConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    try {
      setIsDisconnectingGoogle(true);
      await disconnectGoogleProvider();
      await loadProviderSummary();
      toast({
        title: "Google disconnected",
        description: "Google sign-in has been removed from your account.",
      });
    } catch (error) {
      toast({
        title: "Unable to disconnect Google",
        description:
          error instanceof Error
            ? error.message
            : "Unable to disconnect Google provider.",
        variant: "destructive",
      });
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Missing password fields",
        description: "Please provide and confirm your new password.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmittingPassword(true);
      await setAccountPassword({
        current_password: providerSummary?.has_password ? currentPassword : undefined,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      await loadProviderSummary();
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Password updated",
        description: "Your password has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Unable to save password",
        description:
          error instanceof Error
            ? error.message
            : "Could not update password.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container py-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <SettingsIcon className="h-6 w-6 text-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>

        <Card className="glass-card mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-foreground">
                Account email: <span className="font-medium">{user?.email || "-"}</span>
              </p>
              {isLoadingProviders ? (
                <p className="text-sm text-muted-foreground">Loading provider status...</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sign-in methods available:{" "}
                  {providerSummary?.has_password ? "Password" : "No password set"}
                  {googleProvider ? ", Google" : ""}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Google</p>
                  <p className="text-xs text-muted-foreground">
                    {googleProvider
                      ? `Connected as ${googleProvider.email}`
                      : "Not connected"}
                  </p>
                </div>
                {googleProvider ? (
                  <Button
                    variant="outline"
                    onClick={handleDisconnectGoogle}
                    disabled={isDisconnectingGoogle}
                    className="gap-2"
                  >
                    {isDisconnectingGoogle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink2 className="h-4 w-4" />
                    )}
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    onClick={handleConnectGoogle}
                    disabled={isConnectingGoogle || isLoadingProviders}
                    className="gap-2"
                  >
                    {isConnectingGoogle ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="h-4 w-4" />
                    )}
                    Connect
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 p-4 space-y-4">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  {providerSummary?.has_password ? "Change Password" : "Set Password"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {providerSummary?.has_password
                    ? "Use your current password to set a new one."
                    : "Set a password so you can log in without Google."}
                </p>
              </div>

              {providerSummary?.has_password && (
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <Button
                onClick={handleSavePassword}
                disabled={isSubmittingPassword || isLoadingProviders}
                className="gap-2"
              >
                {isSubmittingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Password
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex items-center gap-3">
                {theme === "dark" ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <Label className="text-sm text-foreground">Theme</Label>
              </div>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-32">
                <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border/50">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-muted-foreground" />
                <Label className="text-sm text-foreground">Language</Label>
              </div>
              <Select defaultValue="en">
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="th">ไทย</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <Label className="text-sm text-foreground">Notifications</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="notifications" defaultChecked />
                <Label
                  htmlFor="notifications"
                  className="text-sm text-muted-foreground"
                >
                  Allow
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card mt-6">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              More settings options coming soon.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
