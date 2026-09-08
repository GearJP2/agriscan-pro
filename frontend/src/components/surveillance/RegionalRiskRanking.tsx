import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProvinceRisk } from '@/types/dashboard';
import { cn } from '@/lib/utils';

interface Props {
  onSelectProvince: (province: string) => void;
  selectedProvince: string | null;
  provinces: ProvinceRisk[];
  viewMode: 'risk' | 'samples';
}

const RISK_BADGE: Record<string, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-50 text-gfs-maroon-dark dark:bg-red-950/40 dark:text-red-300 border-gfs-maroon/30' },
  high: { label: 'High', className: 'bg-rose-50 text-red-700 dark:bg-rose-950/40 dark:text-rose-300 border-red-200 dark:border-red-900/40' },
  medium: { label: 'Elevated', className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/50' },
  low: { label: 'Low', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40' },
};

const normalizeName = (name: string | null | undefined) => {
  if (!name) return '';
  return name.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
};

export default function RegionalRiskRanking({ onSelectProvince, selectedProvince, provinces, viewMode }: Props) {

  const displayList = useMemo(() => {
    const sorted = [...provinces].sort((a, b) => {
      if (viewMode === 'risk') {
        const riskDiff = b.aboveThresholdPct - a.aboveThresholdPct;
        if (riskDiff !== 0) return riskDiff;
        return a.name.localeCompare(b.name, 'th');
      } else {
        const countA = a.positiveCount ?? Math.round((a.sampleCount * a.aboveThresholdPct) / 100);
        const countB = b.positiveCount ?? Math.round((b.sampleCount * b.aboveThresholdPct) / 100);
        const countDiff = countB - countA;
        if (countDiff !== 0) return countDiff;
        return a.name.localeCompare(b.name, 'th');
      }
    });

    return sorted.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      nameEn: p.nameEn,
      province: p.nameEn || p.name, // Use English as display if possible
      sampleCount: p.sampleCount,
      aboveThresholdPct: p.aboveThresholdPct,
      positiveCount: p.positiveCount ?? Math.round((p.sampleCount * p.aboveThresholdPct) / 100),
      dominantToxin: p.dominantToxin,
      riskLevel: p.riskLevel,
    }));
  }, [provinces, viewMode]);

  const normSelected = normalizeName(selectedProvince);

  return (
    <Card className="h-full flex flex-col border border-gfs-maroon/15 dark:border-white/10 relative overflow-hidden bg-white dark:bg-slate-900/80 rounded-gfs-card shadow-gfs-card">
      <CardHeader className="pb-3 px-5 pt-5 space-y-2 border-b border-gfs-maroon/10 dark:border-white/10">
        <div className="font-sans">
          <CardTitle className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white">Regional Risk Ranking</CardTitle>
          <p className="text-xs text-gfs-text-muted font-medium mt-0.5">
            {viewMode === 'risk' ? 'Sorted by % Risk Rate' : 'Sorted by Positive Sample Count'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gfs-text-muted font-medium">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gfs-maroon dark:bg-gfs-gold shrink-0" />
            <span><strong className="text-gfs-text-primary dark:text-white">Risk Rate:</strong> (Hazard / Total) × 100</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-gfs-maroon dark:bg-gfs-gold shrink-0" />
            <span><strong className="text-gfs-text-primary dark:text-white">Pos. Samples:</strong> Hazard volume</span>
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col px-3 pb-3 pt-2 min-h-0">
        {provinces.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed border-gfs-maroon/20 text-sm text-gfs-text-muted">
            No data available for selected filters.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto max-h-[380px] min-h-[180px] pr-1.5 custom-scrollbar space-y-1">
              {displayList.map((p) => {
                // Hyper-reliable matching
                const target = normalizeName(selectedProvince);
                const currentName = normalizeName(p.name);
                const currentEn = normalizeName(p.nameEn);
                const isSelected = target !== '' && (currentName === target || currentEn === target);

                const badge = RISK_BADGE[p.riskLevel] ?? RISK_BADGE.low;

                return (
                  <button
                    key={`${p.rank}-${p.nameEn || p.name}`}
                    type="button"
                    onClick={() => onSelectProvince(p.nameEn || p.name)}
                    aria-pressed={isSelected}
                    aria-label={`${p.province}, ${badge.label} risk, ${p.aboveThresholdPct}% risk rate`}
                    className={cn(
                      "w-full text-left py-2 px-3 rounded-lg transition-colors border-l-2 relative",
                      isSelected
                        ? "border-gfs-maroon dark:border-gfs-gold bg-gfs-maroon/10 dark:bg-gfs-gold/10"
                        : "border-transparent hover:bg-gfs-canvas/70 dark:hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Rank Indicator */}
                      <div className={cn(
                        "w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5",
                        isSelected ? "bg-gfs-maroon text-white dark:bg-gfs-gold dark:text-gfs-maroon" : "bg-gfs-thumb/50 dark:bg-slate-800 text-gfs-text-muted"
                      )}>
                        {p.rank}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className={cn(
                            "text-sm font-bold truncate tracking-tight",
                            isSelected ? "text-gfs-maroon dark:text-gfs-gold" : "text-gfs-text-primary dark:text-white"
                          )}>
                            {p.province}
                          </span>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full tracking-normal border",
                            badge.className
                          )}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3 mt-1.5">
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-gfs-text-muted">Risk Rate</p>
                            <p className={cn("text-sm font-extrabold", isSelected ? "text-gfs-maroon dark:text-gfs-gold" : "text-gfs-text-primary dark:text-slate-200")}>
                              {p.aboveThresholdPct}%
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-gfs-text-muted">Pos. Samples</p>
                            <p className={cn("text-sm font-extrabold", isSelected ? "text-gfs-maroon dark:text-gfs-gold" : "text-gfs-text-primary dark:text-slate-200")}>
                              {p.positiveCount}
                            </p>
                          </div>
                        </div>

                        {/* Footer Info */}
                        <div className="mt-2 pt-2 border-t border-gfs-maroon/10 dark:border-white/10 flex items-center justify-between">
                          <span className="text-[10px] text-gfs-text-muted font-medium">Dominant Toxin</span>
                          <span className="text-[10px] font-bold text-gfs-maroon dark:text-gfs-gold tracking-tight">{p.dominantToxin}</span>
                        </div>
                      </div>
                    </div>

                    {/* Left highlight strip for selected item */}
                    {isSelected && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-gfs-gold rounded-r-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
