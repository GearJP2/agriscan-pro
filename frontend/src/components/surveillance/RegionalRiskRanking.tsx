import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProvinceRank, ProvinceRisk } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface Props {
  onSelectProvince: (province: string) => void;
  selectedProvince: string | null;
  provinces: ProvinceRank[];
  allProvinces: ProvinceRisk[];
  toxinColors: Record<string, string>;
}

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  high:     { label: 'High',     className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  medium:   { label: 'Elevated', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  low:      { label: 'Low',      className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
};

export default function RegionalRiskRanking({ onSelectProvince, selectedProvince, provinces, allProvinces, toxinColors }: Props) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  // Build display list — top 5 or all sorted by aboveThresholdPct
  const displayList = showAll
    ? [...allProvinces]
        .sort((a, b) => b.aboveThresholdPct - a.aboveThresholdPct || b.sampleCount - a.sampleCount)
        .map((p, i) => ({
          rank: i + 1,
          province: p.name,
          sampleCount: p.sampleCount,
          aboveThresholdPct: p.aboveThresholdPct,
          dominantToxin: p.dominantToxin,
          riskLevel: p.riskLevel as ProvinceRank['riskLevel'],
        }))
    : provinces;

  return (
    <Card className="glass-card h-full flex flex-col">
      <CardHeader className="pb-1">
        <CardTitle className="text-lg">Regional Risk Ranking</CardTitle>
        <p className="text-sm text-muted-foreground">
          {showAll ? `All ${displayList.length} provinces` : 'Top 5 priority provinces'}
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col px-4 pb-4">
        {provinces.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No high-risk provinces in the selected filters.
          </div>
        ) : (
          <>
            <div className={cn('divide-y divide-border', showAll && 'overflow-y-auto max-h-[600px] pr-1')}>
              {displayList.map((p) => {
                const isSelected = selectedProvince === p.province;
                const badge = RISK_BADGE[p.riskLevel] ?? RISK_BADGE.low;

                return (
                  <button
                    key={p.rank}
                    onClick={() => onSelectProvince(p.province)}
                    className={cn(
                      'w-full text-left py-3 px-2 transition-colors rounded-lg',
                      isSelected ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    aria-label={`Rank ${p.rank}: ${p.province}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="w-5 flex-shrink-0 text-sm font-medium text-muted-foreground pt-0.5">{p.rank}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-foreground truncate">{p.province}</span>
                          <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0', badge.className)}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{p.sampleCount.toLocaleString()} samples</p>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Above Threshold</span>
                            <span className="font-medium text-foreground">{p.aboveThresholdPct}%</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Dominant Toxin</span>
                            <span className="font-semibold" style={{ color: toxinColors[p.dominantToxin] || '#6b7280' }}>
                              {p.dominantToxin}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-auto pt-3 border-t border-border text-center">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-sm text-primary hover:underline font-medium"
              >
                {showAll ? '← Show Top 5 Only' : `View All Provinces (${allProvinces.length}) →`}
              </button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

