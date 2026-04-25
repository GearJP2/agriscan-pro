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
  critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  high: { label: 'High', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  medium: { label: 'Elevated', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  low: { label: 'Low', className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
};

const normalizeName = (name: string | null | undefined) => {
  if (!name) return '';
  return name.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
};

export default function RegionalRiskRanking({ onSelectProvince, selectedProvince, provinces, viewMode }: Props) {

  const displayList = useMemo(() => {
    const sorted = [...provinces].sort((a, b) => {
      if (viewMode === 'risk') {
        return b.aboveThresholdPct - a.aboveThresholdPct || b.sampleCount - a.sampleCount;
      } else {
        const countA = Math.round((a.sampleCount * a.aboveThresholdPct) / 100);
        const countB = Math.round((b.sampleCount * b.aboveThresholdPct) / 100);
        return countB - countA || b.sampleCount - a.sampleCount;
      }
    });

    return sorted.map((p, i) => ({
      rank: i + 1,
      name: p.name,
      nameEn: p.nameEn,
      province: p.nameEn || p.name, // Use English as display if possible
      sampleCount: p.sampleCount,
      aboveThresholdPct: p.aboveThresholdPct,
      positiveCount: Math.round((p.sampleCount * p.aboveThresholdPct) / 100),
      dominantToxin: p.dominantToxin,
      riskLevel: p.riskLevel,
    }));
  }, [provinces, viewMode]);

  const normSelected = normalizeName(selectedProvince);

  return (
    <Card className="glass-card h-full flex flex-col border-2 border-border dark:border-border/50 relative overflow-hidden bg-card dark:bg-card rounded-2xl shadow-none">
      <CardHeader className="pb-3 px-5 pt-5 space-y-2">
        <div className="font-sans">
          <CardTitle className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Regional Risk Ranking</CardTitle>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mt-1 opacity-70">
            {viewMode === 'risk' ? 'Sorted by % Risk Rate' : 'Sorted by Positive Sample Count'}
          </p>
        </div>

        <div className="bg-muted/30 rounded-lg p-3 border border-border/40">
          <p className="text-xs text-muted-foreground flex items-center gap-2 leading-relaxed">
            <span className="w-2 h-2 rounded-full bg-primary/40 flex-shrink-0" />
            <span><strong>Risk Rate:</strong> (Hazardous Samples / Total Samples) × 100</span>
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-2 leading-relaxed mt-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/40 flex-shrink-0" />
            <span><strong>Pos. Samples:</strong> Total volume of hazardous detections (Absolute Count)</span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col px-4 pb-4">
        {provinces.length === 0 ? (
          <div className="flex h-full min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No data available for selected filters.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto max-h-[610px] pr-2 custom-scrollbar divide-y divide-border/30">
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
                    onClick={() => onSelectProvince(p.nameEn || p.name)}
                    className={cn(
                      "w-full text-left py-2.5 px-4 rounded-xl my-1 transition-colors border-2 relative",
                      isSelected
                        ? "border-primary bg-primary/[0.02] shadow-sm z-10"
                        : "border-slate-100 dark:border-border/50 hover:border-slate-300 dark:hover:border-white/20"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      {/* Rank Indicator */}
                      <div className={cn(
                        "w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-black pt-px shadow-sm",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      )}>
                        {p.rank}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className={cn(
                            "text-sm font-black truncate tracking-tight",
                            isSelected ? "text-primary" : "text-slate-900 dark:text-white"
                          )}>
                            {p.province}
                          </span>
                          <span className={cn(
                            "text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-widest border",
                            badge.className
                          )}>
                            {badge.label}
                          </span>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-0.5">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/30">Risk Rate</p>
                            <p className={cn("text-sm font-black", isSelected ? "text-primary" : "text-slate-700 dark:text-slate-300")}>
                              {p.aboveThresholdPct}%
                            </p>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/30">Pos. Samples</p>
                            <p className={cn("text-sm font-black", isSelected ? "text-primary" : "text-slate-700 dark:text-slate-300")}>
                              {p.positiveCount}
                            </p>
                          </div>
                        </div>

                        {/* Footer Info */}
                        <div className="mt-2 pt-2 border-t border-dashed border-border/50 flex items-center justify-between">
                          <span className="text-[9px] text-slate-400 dark:text-white/20 italic font-medium">Dominant Toxin</span>
                          <span className="text-[9px] font-black text-slate-600 dark:text-white/40 uppercase tracking-tighter">{p.dominantToxin}</span>
                        </div>
                      </div>
                    </div>

                    {/* Left highlight strip for selected item */}
                    {isSelected && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />
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

