import { topProvinces } from '@/data/mockDashboardData';
import { TOXIN_COLORS } from '@/data/mockDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  onSelectProvince: (province: string) => void;
  selectedProvince: string | null;
}

export default function RegionalRiskRanking({ onSelectProvince, selectedProvince }: Props) {
  return (
    <Card className="glass-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Top 5 High-Risk Provinces</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 flex-1">
        {topProvinces.map((p) => {
          const isSelected = selectedProvince === p.province;
          const rankColor = p.riskLevel === 'critical' ? 'bg-danger' : 'bg-warning';

          return (
            <button
              key={p.rank}
              onClick={() => onSelectProvince(p.province)}
              className={cn(
                'w-full text-left rounded-lg p-3 transition-colors border',
                isSelected
                  ? 'bg-accent border-warning/50'
                  : 'bg-card border-border hover:bg-accent/70'
              )}
              aria-label={`Rank ${p.rank}: ${p.province}, ${p.aboveThresholdPct}% above threshold`}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <span className={cn('flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white', rankColor)}>
                  {p.rank}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-foreground truncate">{p.province}</span>
                    <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{p.sampleCount} samples</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        p.aboveThresholdPct > 60 ? 'bg-danger' : p.aboveThresholdPct > 40 ? 'bg-warning' : 'bg-yellow-500'
                      )}
                      style={{ width: `${p.aboveThresholdPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{p.aboveThresholdPct}% above threshold</span>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${TOXIN_COLORS[p.dominantToxin] || '#6b7280'}33`,
                        color: TOXIN_COLORS[p.dominantToxin] || '#9ca3af',
                      }}
                    >
                      {p.dominantToxin}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
