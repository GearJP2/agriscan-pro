import { Edit3, Loader2, Mail, FlaskConical, AlertCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/lib/authApi";
import type { UserRole } from "@/types/user";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  researcher: "Researcher",
  research_assistant: "Research Assistant",
  head_researcher: "Head Researcher",
  user: "User",
};

interface ProfileHeaderProps {
  user: AuthenticatedUser | null;
  role: UserRole | "guest";
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  formData: { name: string; email: string };
  setFormData: (data: { name: string; email: string }) => void;
  isSubmitting: boolean;
  handleSaveProfile: () => void;
}

export const ProfileHeader = ({
  user,
  role,
  isEditing,
  setIsEditing,
  formData,
  setFormData,
  isSubmitting,
  handleSaveProfile,
}: ProfileHeaderProps) => {
  return (
    <div className="relative mb-20 sm:mb-16">
      {/* Cover Photo */}
      <div className="h-48 sm:h-56 w-full rounded-3xl bg-gradient-to-tr from-primary/20 via-primary/5 to-background border border-border/50 overflow-hidden relative shadow-sm">
        <div className="absolute top-0 right-0 opacity-10 blur-2xl pointer-events-none">
          <FlaskConical className="w-96 h-96 text-primary translate-x-1/4 -translate-y-1/4" />
        </div>
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
          <div
            className={`absolute bottom-3 right-3 h-6 w-6 rounded-full border-4 border-background shadow-sm transition-colors duration-500 ${
              user?.is_active ? "bg-success" : "bg-destructive"
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
                  <p className="text-[10px] text-warning flex items-center gap-1.5 font-medium">
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
                  Save Changes
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
