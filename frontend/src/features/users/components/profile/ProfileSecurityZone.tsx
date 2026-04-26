import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileSecurityZoneProps {
  setShowPasswordReset: (val: boolean) => void;
}

export const ProfileSecurityZone = ({
  setShowPasswordReset,
}: ProfileSecurityZoneProps) => {
  return (
    <div className="md:col-span-4 rounded-3xl border border-destructive/20 bg-gradient-to-b from-card/40 to-destructive/5 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md border-t-4 border-t-destructive flex flex-col h-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">
            Security
          </h2>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Authentication</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ensure your account remains safe. We recommend updating your
            passphrase every 90 days.
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
  );
};
