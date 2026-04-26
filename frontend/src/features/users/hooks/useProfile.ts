import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { userAPI, sampleAPI } from "@/lib/api";

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

export const useProfile = () => {
  const { user, refreshUser, role, logout } = useAuth();
  const navigate = useNavigate();

  // Basic Profile State
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

  // Email Editing State
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(user?.email || "");
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  // Password Reset State
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

  return {
    user,
    role,
    isEditing,
    setIsEditing,
    isSubmitting,
    formData,
    setFormData,
    stats,
    isEditingEmail,
    setIsEditingEmail,
    emailDraft,
    setEmailDraft,
    showPasswordConfirm,
    setShowPasswordConfirm,
    currentPassword,
    setCurrentPassword,
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
    handleSaveProfile,
    handleEmailEditSave,
    handleConfirmEmailChange,
    handleRequestOTP,
    handleResetPassword,
  };
};
