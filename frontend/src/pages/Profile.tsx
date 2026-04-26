import { useProfile } from "@/features/users/hooks/useProfile";

// Modular Components
import { ProfileHeader } from "@/features/users/components/profile/ProfileHeader";
import { ProfileInformation } from "@/features/users/components/profile/ProfileInformation";
import { ProfileSecurityZone } from "@/features/users/components/profile/ProfileSecurityZone";
import { ProfileAnalytics } from "@/features/users/components/profile/ProfileAnalytics";
import { ProfileDialogs } from "@/features/users/components/profile/ProfileDialogs";

const Profile = () => {
  const {
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
  } = useProfile();

  return (
    <div className="min-h-screen pb-16">
      <main className="container pt-6 pb-10 max-w-5xl space-y-8">
        <ProfileHeader
          user={user}
          role={role}
          isEditing={isEditing}
          setIsEditing={setIsEditing}
          formData={formData}
          setFormData={setFormData}
          isSubmitting={isSubmitting}
          handleSaveProfile={handleSaveProfile}
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <ProfileInformation
            user={user}
            role={role}
            isEditingEmail={isEditingEmail}
            setIsEditingEmail={setIsEditingEmail}
            emailDraft={emailDraft}
            setEmailDraft={setEmailDraft}
            handleEmailEditSave={handleEmailEditSave}
          />

          <ProfileSecurityZone setShowPasswordReset={setShowPasswordReset} />

          <ProfileAnalytics stats={stats} />
        </div>
      </main>

      <ProfileDialogs
        showPasswordConfirm={showPasswordConfirm}
        setShowPasswordConfirm={setShowPasswordConfirm}
        currentPassword={currentPassword}
        setCurrentPassword={setCurrentPassword}
        handleConfirmEmailChange={handleConfirmEmailChange}
        isSubmitting={isSubmitting}
        userEmail={user?.email}
        showPasswordReset={showPasswordReset}
        setShowPasswordReset={setShowPasswordReset}
        resetStep={resetStep}
        setResetStep={setResetStep}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        newPassword={newPassword}
        setNewPassword={setNewPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        handleRequestOTP={handleRequestOTP}
        handleResetPassword={handleResetPassword}
      />
    </div>
  );
};

export default Profile;
