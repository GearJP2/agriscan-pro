import { User, Edit3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthenticatedUser } from "@/lib/authApi";

interface DataRowProps {
  label: string;
  children: React.ReactNode;
}

const DataRow = ({ label, children }: DataRowProps) => (
  <div className="space-y-1">
    <p className="text-[9px] tracking-widest uppercase text-muted-foreground">
      {label}
    </p>
    <div>{children}</div>
  </div>
);

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  researcher: "Researcher",
  research_assistant: "Research Assistant",
  head_researcher: "Head Researcher",
  user: "User",
};

interface ProfileInformationProps {
  user: AuthenticatedUser | null;
  role: string;
  isEditingEmail: boolean;
  setIsEditingEmail: (val: boolean) => void;
  emailDraft: string;
  setEmailDraft: (val: string) => void;
  handleEmailEditSave: () => void;
}

export const ProfileInformation = ({
  user,
  role,
  isEditingEmail,
  setIsEditingEmail,
  emailDraft,
  setEmailDraft,
  handleEmailEditSave,
}: ProfileInformationProps) => {
  return (
    <div className="md:col-span-8 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md hover:bg-card/60">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">
            Registry Metadata
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your core system identity
          </p>
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
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 border-border/60 shadow-sm bg-background/50"
            >
              {ROLE_LABELS[role] || "User"}
            </Badge>
          </div>
        </DataRow>

        <DataRow label="Account Node ID">
          <span className="font-mono text-xs font-medium text-muted-foreground mt-1 block bg-muted/30 px-2 py-1 rounded w-fit border border-border/40">
            {String(user?.id ?? "").toUpperCase() || "—"}
          </span>
        </DataRow>

        <DataRow label="Account Status">
          <div className="mt-1 flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                user?.is_active
                  ? "bg-success shadow-[0_0_8px_hsl(var(--success)/0.5)]"
                  : "bg-destructive shadow-[0_0_8px_hsl(var(--destructive)/0.5)]"
              }`}
            />
            <span className="text-sm font-medium">
              {user?.is_active ? "Active Platform Node" : "Disabled Node"}
            </span>
          </div>
        </DataRow>
      </div>
    </div>
  );
};
