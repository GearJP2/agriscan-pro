/**
 * AuthDialog - Redesigned Login/Register Modal
 * Features:
 * - Toggle between Sign In and Sign Up modes
 * - Google OAuth 2.0 integration
 * - Accessibility-first design (WCAG 2.1 AA)
 * - Material Design 3 aesthetic with clinical feel
 */

import { useState, FormEvent, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Leaf, AlertCircle, Loader2, Check } from "lucide-react";
import { beginGoogleOAuth, registerAccount } from "@/lib/authApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type AuthMode = "signin" | "signup";

interface AuthFormState {
  username: string;
  email: string;
  password: string;
  verifyPassword: string;
  name: string;
}

interface UIState {
  showPassword: boolean;
  showVerifyPassword: boolean;
  error: string;
  successMessage: string;
  isSubmitting: boolean;
  isGoogleLoading: boolean;
}

const AuthDialog = () => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [isOpen, setIsOpen] = useState(false);

  // Form states
  const [formState, setFormState] = useState<AuthFormState>({
    username: "",
    email: "",
    password: "",
    verifyPassword: "",
    name: "",
  });

  // UI states
  const [uiState, setUIState] = useState<UIState>({
    showPassword: false,
    showVerifyPassword: false,
    error: "",
    successMessage: "",
    isSubmitting: false,
    isGoogleLoading: false,
  });

  const { login } = useAuth();
  const navigate = useNavigate();

  // Listen for external open events
  useEffect(() => {
    const handleOpenAuth = () => setIsOpen(true);
    window.addEventListener("open-auth-dialog", handleOpenAuth);
    return () => window.removeEventListener("open-auth-dialog", handleOpenAuth);
  }, []);

  // Reset form when closing
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setFormState({
        username: "",
        email: "",
        password: "",
        verifyPassword: "",
        name: "",
      });
      setUIState((prev) => ({
        ...prev,
        error: "",
        successMessage: "",
        showPassword: false,
        showVerifyPassword: false,
      }));
    }
  };

  // Handle mode switch
  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setUIState((prev) => ({ ...prev, error: "", successMessage: "" }));
  };

  // Handle input changes
  const handleInputChange = (field: keyof AuthFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (uiState.error) {
      setUIState((prev) => ({ ...prev, error: "" }));
    }
  };

  // Sign In Handler
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setUIState((prev) => ({ ...prev, error: "", isSubmitting: true }));

    try {
      await login(formState.username, formState.password);
      setIsOpen(false);
      navigate("/");
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Sign in failed. Please try again.";
      setUIState((prev) => ({ ...prev, error: errorMsg }));
    } finally {
      setUIState((prev) => ({ ...prev, isSubmitting: false }));
    }
  };

  // Sign Up Handler
  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setUIState((prev) => ({ ...prev, error: "", isSubmitting: true }));

    // Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/;
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;

    if (!usernameRegex.test(formState.username)) {
      setUIState((prev) => ({
        ...prev,
        error:
          "Username must be 3-20 characters (letters, numbers, underscores only)",
        isSubmitting: false,
      }));
      return;
    }

    if (!emailRegex.test(formState.email)) {
      setUIState((prev) => ({
        ...prev,
        error: "Please enter a valid email address",
        isSubmitting: false,
      }));
      return;
    }

    if (!passwordRegex.test(formState.password)) {
      setUIState((prev) => ({
        ...prev,
        error:
          "Password must be at least 8 characters with uppercase, lowercase, and a number",
        isSubmitting: false,
      }));
      return;
    }

    if (formState.password !== formState.verifyPassword) {
      setUIState((prev) => ({
        ...prev,
        error: "Passwords do not match",
        isSubmitting: false,
      }));
      return;
    }

    try {
      await registerAccount({
        name: formState.name,
        username: formState.username,
        email: formState.email,
        password: formState.password,
        verify_password: formState.verifyPassword,
      });

      setUIState((prev) => ({
        ...prev,
        successMessage: "Account created! Switching to sign in...",
        isSubmitting: false,
      }));

      // Switch to signin after 1.5 seconds
      setTimeout(() => {
        switchMode("signin");
        setFormState((prev) => ({
          ...prev,
          username: formState.email,
          password: "",
          verifyPassword: "",
          name: "",
          email: "",
        }));
      }, 1500);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Registration failed";
      setUIState((prev) => ({ ...prev, error: errorMsg, isSubmitting: false }));
    }
  };

  // Google OAuth Handler
  const handleGoogleAuth = async () => {
    setUIState((prev) => ({
      ...prev,
      error: "",
      isGoogleLoading: true,
    }));

    try {
      sessionStorage.setItem("google_oauth_next_path", "/");
      sessionStorage.setItem("google_oauth_intent", "login");
      const { auth_url } = await beginGoogleOAuth();
      window.location.href = auth_url;
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Google authentication failed. Please try again.";
      setUIState((prev) => ({
        ...prev,
        error: errorMsg,
        isGoogleLoading: false,
      }));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="rounded-full px-8 py-2.5 font-semibold text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200"
          style={{
            background: "linear-gradient(135deg, #00615c 0%, #1d7b75 100%)",
          }}
          aria-label="Sign in or create account"
        >
          Sign In
        </Button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-[480px] p-0 gap-0 border-none rounded-3xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: "#f8fafa" }}
        aria-describedby={undefined}
      >
        <div className="w-full flex flex-col p-8 sm:p-10">
          {/* Header: Logo & Branding */}
          <div className="flex items-center gap-3 mb-10 justify-center">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: "linear-gradient(135deg, #00615c 0%, #1d7b75 100%)",
              }}
            >
              <Leaf className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ color: "#191c1d" }}
              >
                AgriScan Pro
              </h1>
              <p className="text-xs font-medium" style={{ color: "#3e4947" }}>
                Precision Food Safety
              </p>
            </div>
          </div>

          {/* Mode Toggle */}
          <div className="mb-8 flex justify-center">
            <div
              className="inline-flex gap-1 p-1 rounded-full shadow-inner"
              style={{ backgroundColor: "#eceeee" }}
            >
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`px-6 py-2 text-sm font-semibold rounded-full transition-all duration-300 ${
                    mode === m
                      ? "text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                  style={
                    mode === m
                      ? {
                          background:
                            "linear-gradient(135deg, #00615c 0%, #1d7b75 100%)",
                        }
                      : {}
                  }
                  aria-pressed={mode === m}
                >
                  {m === "signin" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>
          </div>

          {/* Error Message */}
          {uiState.error && (
            <div
              className="mb-6 flex items-start gap-3 p-4 rounded-2xl border-l-4 animate-in fade-in slide-in-from-top-2"
              style={{
                backgroundColor: "#ffdad6",
                borderLeftColor: "#ba1a1a",
              }}
              role="alert"
            >
              <AlertCircle
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: "#ba1a1a" }}
              />
              <p className="text-sm font-medium" style={{ color: "#5f2c2b" }}>
                {uiState.error}
              </p>
            </div>
          )}

          {/* Success Message */}
          {uiState.successMessage && (
            <div
              className="mb-6 flex items-start gap-3 p-4 rounded-2xl border-l-4 animate-in fade-in slide-in-from-top-2"
              style={{
                backgroundColor: "#d1f7d1",
                borderLeftColor: "#00a82c",
              }}
              role="status"
            >
              <Check
                className="w-5 h-5 mt-0.5 shrink-0"
                style={{ color: "#00a82c" }}
              />
              <p className="text-sm font-medium" style={{ color: "#1b5e20" }}>
                {uiState.successMessage}
              </p>
            </div>
          )}

          {/* Sign In Form */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Username/Email Field */}
              <div className="space-y-2">
                <label
                  htmlFor="signin-email"
                  className="block text-sm font-semibold"
                  style={{ color: "#191c1d" }}
                >
                  Username or Email
                </label>
                <input
                  id="signin-email"
                  type="text"
                  value={formState.username}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                  placeholder="scientist@agriscan.pro"
                  className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                  style={
                    {
                      backgroundColor: "#f2f4f4",
                      color: "#191c1d",
                      "--tw-ring-color": "#00615c40",
                    } as React.CSSProperties
                  }
                  disabled={uiState.isSubmitting}
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="signin-password"
                    className="block text-sm font-semibold"
                    style={{ color: "#191c1d" }}
                  >
                    Password
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-xs font-bold hover:underline"
                    style={{ color: "#7a4b00" }}
                  >
                    Forgot?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="signin-password"
                    type={uiState.showPassword ? "text" : "password"}
                    value={formState.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                    style={
                      {
                        backgroundColor: "#f2f4f4",
                        color: "#191c1d",
                        "--tw-ring-color": "#00615c40",
                      } as React.CSSProperties
                    }
                    disabled={uiState.isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setUIState((prev) => ({
                        ...prev,
                        showPassword: !prev.showPassword,
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={
                      uiState.showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {uiState.showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                className="w-full py-3 rounded-full font-semibold text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                style={{
                  background:
                    "linear-gradient(135deg, #00615c 0%, #1d7b75 100%)",
                }}
                disabled={uiState.isSubmitting}
              >
                {uiState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {uiState.isSubmitting ? "Signing In..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {mode === "signup" && (
            <form
              onSubmit={handleSignUp}
              className="space-y-4 max-h-96 overflow-y-auto pr-2"
            >
              {/* Name Field */}
              <div className="space-y-2">
                <label
                  htmlFor="signup-name"
                  className="block text-sm font-semibold"
                  style={{ color: "#191c1d" }}
                >
                  Full Name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  value={formState.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Dr. Jane Wilson"
                  className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                  style={
                    {
                      backgroundColor: "#f2f4f4",
                      color: "#191c1d",
                      "--tw-ring-color": "#00615c40",
                    } as React.CSSProperties
                  }
                  disabled={uiState.isSubmitting}
                  required
                />
              </div>

              {/* Username Field */}
              <div className="space-y-2">
                <label
                  htmlFor="signup-username"
                  className="block text-sm font-semibold"
                  style={{ color: "#191c1d" }}
                >
                  Username
                </label>
                <input
                  id="signup-username"
                  type="text"
                  value={formState.username}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                  placeholder="jane_wilson"
                  className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                  style={
                    {
                      backgroundColor: "#f2f4f4",
                      color: "#191c1d",
                      "--tw-ring-color": "#00615c40",
                    } as React.CSSProperties
                  }
                  disabled={uiState.isSubmitting}
                  required
                />
              </div>

              {/* Email Field */}
              <div className="space-y-2">
                <label
                  htmlFor="signup-email"
                  className="block text-sm font-semibold"
                  style={{ color: "#191c1d" }}
                >
                  Email Address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={formState.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="jane@agriscan.pro"
                  className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                  style={
                    {
                      backgroundColor: "#f2f4f4",
                      color: "#191c1d",
                      "--tw-ring-color": "#00615c40",
                    } as React.CSSProperties
                  }
                  disabled={uiState.isSubmitting}
                  required
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label
                  htmlFor="signup-password"
                  className="block text-sm font-semibold"
                  style={{ color: "#191c1d" }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={uiState.showPassword ? "text" : "password"}
                    value={formState.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                    style={
                      {
                        backgroundColor: "#f2f4f4",
                        color: "#191c1d",
                        "--tw-ring-color": "#00615c40",
                      } as React.CSSProperties
                    }
                    disabled={uiState.isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setUIState((prev) => ({
                        ...prev,
                        showPassword: !prev.showPassword,
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={
                      uiState.showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {uiState.showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label
                  htmlFor="signup-verify"
                  className="block text-sm font-semibold"
                  style={{ color: "#191c1d" }}
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="signup-verify"
                    type={uiState.showVerifyPassword ? "text" : "password"}
                    value={formState.verifyPassword}
                    onChange={(e) =>
                      handleInputChange("verifyPassword", e.target.value)
                    }
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-2xl border-0 text-sm focus:outline-none focus:ring-2 transition-all duration-200"
                    style={
                      {
                        backgroundColor: "#f2f4f4",
                        color: "#191c1d",
                        "--tw-ring-color": "#00615c40",
                      } as React.CSSProperties
                    }
                    disabled={uiState.isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setUIState((prev) => ({
                        ...prev,
                        showVerifyPassword: !prev.showVerifyPassword,
                      }))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                    aria-label={
                      uiState.showVerifyPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {uiState.showVerifyPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Sign Up Button */}
              <button
                type="submit"
                className="w-full py-3 rounded-full font-semibold text-white shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed mt-6"
                style={{
                  background:
                    "linear-gradient(135deg, #00615c 0%, #1d7b75 100%)",
                }}
                disabled={uiState.isSubmitting}
              >
                {uiState.isSubmitting && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {uiState.isSubmitting
                  ? "Creating Account..."
                  : "Create Account"}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: "#e1e3e3" }}
            />
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#6e7978" }}
            >
              Or continue with
            </span>
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: "#e1e3e3" }}
            />
          </div>

          {/* Google OAuth Button */}
          <button
            onClick={handleGoogleAuth}
            type="button"
            className="w-full py-3 px-4 rounded-full font-semibold flex items-center justify-center gap-3 transition-all duration-200 border-0 hover:scale-105 active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#f2f4f4",
              color: "#191c1d",
            }}
            disabled={uiState.isGoogleLoading || uiState.isSubmitting}
            aria-label="Sign in with Google"
          >
            {uiState.isGoogleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            <span className="text-sm font-medium">
              {uiState.isGoogleLoading ? "Connecting..." : "Google"}
            </span>
          </button>

          {/* Footer Link */}
          <p className="mt-8 text-center text-sm" style={{ color: "#3e4947" }}>
            {mode === "signin" ? (
              <>
                Don't have an account?{" "}
                <button
                  onClick={() => switchMode("signup")}
                  className="font-bold hover:underline"
                  style={{ color: "#00615c" }}
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => switchMode("signin")}
                  className="font-bold hover:underline"
                  style={{ color: "#00615c" }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Google Icon Component
function GoogleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="matrix(1, 0, 0, 1, 12, 12)">
        <path
          fill="#4285F4"
          d="M11.6 -1.1C11.6 -1.9 11.5 -2.6 11.4 -3.4L-0.3 -3.4L-0.3 3.1L6.4 3.1C6.1 5.3 4.9 7 3.1 8.2L3.1 11.1L7.2 11.1C9.6 8.9 11.6 5.5 11.6 -1.1Z"
        />
        <path
          fill="#34A853"
          d="M-0.3 12C3.1 12 5.8 10.9 8 8.9L3.9 6.1C2.8 6.9 1.4 7.4 -0.3 7.4C-3.4 7.4 -6 5.3 -6.9 2.5L-11.1 2.5L-11.1 5.8C-8.9 10 -4.9 12 -0.3 12Z"
        />
        <path
          fill="#FBBC05"
          d="M-6.9 2.5C-7.2 1.7 -7.3 0.9 -7.3 0C-7.3 -0.9 -7.2 -1.7 -6.9 -2.5L-6.9 -5.8L-11 -5.8C-11.8 -4.1 -12.3 -2.1 -12.3 0C-12.3 2.1 -11.8 4.1 -11 5.8L-6.9 2.5Z"
        />
        <path
          fill="#EA4335"
          d="M-0.3 -7.4C1.6 -7.4 3.2 -6.8 4.6 -5.5L8.2 -9.1C6 -11.1 3 -12 -0.3 -12C-4.9 -12 -8.9 -9.9 -11.1 -5.8L-6.9 -2.5C-6 -5.3 -3.5 -7.4 -0.3 -7.4Z"
        />
      </g>
    </svg>
  );
}

export default AuthDialog;
