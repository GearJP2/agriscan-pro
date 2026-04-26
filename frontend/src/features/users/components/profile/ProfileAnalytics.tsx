import {
  BarChart3,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

interface StatBlockProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}

const StatBlock = ({ label, value, icon }: StatBlockProps) => (
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

interface ProfileAnalyticsProps {
  stats: {
    total: number;
    completed: number;
    flagged: number;
    pending: number;
  } | null;
}

export const ProfileAnalytics = ({ stats }: ProfileAnalyticsProps) => {
  return (
    <div className="md:col-span-12 rounded-3xl border border-border/50 bg-card/20 backdrop-blur-xl p-8 shadow-sm transition-all duration-300 hover:shadow-md mt-2">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 ring-1 ring-indigo-500/20">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">
            Output Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your lifetime contribution metrics
          </p>
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
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
        />
        <StatBlock
          label="Flagged"
          value={stats ? stats.flagged : "—"}
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
        />
        <StatBlock
          label="Pending"
          value={stats ? stats.pending : "—"}
          icon={<Clock className="h-5 w-5 text-muted-foreground" />}
        />
      </div>
    </div>
  );
};
