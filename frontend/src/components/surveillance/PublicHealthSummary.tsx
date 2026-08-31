import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HealthSummary } from '@/types/dashboard';

interface PublicHealthSummaryProps {
  summary: HealthSummary;
  isGenerating?: boolean;
  isLlmGenerated?: boolean;
}

export default function PublicHealthSummary({ summary, isGenerating = false, isLlmGenerated = false }: PublicHealthSummaryProps) {
  const { riskDrivers, affectedCommodities, impactedPopulations } = summary;

  return (
    <section aria-label="Public Health Risk Summary">
      <Card className="bg-white dark:bg-slate-900/80 border border-gfs-maroon/15 dark:border-white/10 rounded-gfs-card shadow-gfs-card font-sans overflow-hidden">
        <CardHeader className="p-5 md:p-6 pb-5 border-b border-gfs-maroon/10 dark:border-white/10 bg-white dark:bg-slate-900">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-1.5 bg-gfs-gold rounded-full" />
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white flex items-center gap-2">
                  Public Health Risk Summary
                </h2>
                <p className="text-xs text-gfs-text-muted font-medium">
                  Active surveillance signals, vulnerable commodities &amp; sector exposure
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-gfs-gold/20 border border-gfs-gold/40 px-3.5 py-1 shrink-0">
                <div className={cn('w-1.5 h-1.5 rounded-full bg-gfs-maroon dark:bg-gfs-gold', isGenerating && 'animate-pulse')} />
                <span className="text-xs text-gfs-maroon dark:text-gfs-gold font-bold tracking-normal">
                  {isGenerating ? 'LLM Drafting' : isLlmGenerated ? 'LLM Summary' : 'Local Summary'}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gfs-maroon/10 gap-0">

            {/* Column 1: Key Risk Drivers */}
            <div className="pb-6 lg:pb-0 lg:pr-8 space-y-5">
              <div className="flex items-center">
                <h3 className="text-base font-bold text-gfs-maroon dark:text-white tracking-tight">Key Risk Drivers</h3>
              </div>

              <div className="space-y-3.5" aria-label="Key risk drivers summary">
                {riskDrivers.map((driver, i) => (
                  <div key={`${driver}-${i}`} className="flex items-start gap-3">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-gfs-gold shrink-0 border border-gfs-maroon/40" />
                    <p className="text-sm text-gfs-text-primary dark:text-slate-200 leading-relaxed font-medium">
                      {driver}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Most Affected Commodities */}
            <div className="py-6 lg:py-0 lg:px-8 space-y-5">
              <div className="flex items-center">
                <h3 className="text-base font-bold text-gfs-maroon dark:text-white tracking-tight">Most Affected Commodities</h3>
              </div>
              <div className="space-y-4" aria-label="Affected commodities graph">
                {affectedCommodities.map((c) => {
                  const percentage = Math.min(100, Math.max(0, c.pct));
                  const barGradient = percentage > 60
                    ? 'from-gfs-maroon to-gfs-maroon-active'
                    : percentage > 45
                      ? 'from-amber-600 to-amber-500'
                      : 'from-gfs-gold to-amber-500';

                  return (
                    <div key={c.name} className="group cursor-default">
                      <div className="flex items-end justify-between mb-1.5">
                        <span className="text-xs font-bold text-gfs-text-primary dark:text-white group-hover:text-gfs-maroon transition-colors">{c.name}</span>
                        <span className="text-xs font-extrabold text-gfs-maroon dark:text-gfs-gold">{percentage}%</span>
                      </div>
                      <div className="relative w-full h-2 bg-gfs-thumb/40 dark:bg-slate-800 rounded-full overflow-hidden border border-gfs-maroon/10">
                        <div
                          className={cn(
                            'h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out',
                            barGradient
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Potentially Impacted */}
            <div className="pt-6 lg:pt-0 lg:pl-8 space-y-5 font-sans">
              <div className="flex items-center">
                <h3 className="text-base font-bold text-gfs-maroon dark:text-white tracking-tight">Potentially Impacted</h3>
              </div>
              <div className="divide-y divide-gfs-maroon/10" aria-label="Impacted population groups">
                {impactedPopulations.map((pop) => (
                  <div
                    key={pop.group}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-gfs-text-primary dark:text-slate-200">{pop.group}</span>
                    <span
                      className={cn(
                        'text-[10px] font-bold tracking-normal px-3 py-0.5 rounded-full flex-shrink-0 border',
                        pop.severity === 'High'
                          ? 'bg-red-50 text-gfs-maroon-dark dark:bg-red-950/40 dark:text-red-300 border-gfs-maroon/20'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/40'
                      )}
                    >
                      {pop.severity} Risk
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
