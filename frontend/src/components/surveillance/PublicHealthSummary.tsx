import { Card, CardContent } from '@/components/ui/card';
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
      <Card className="glass-card border-2 border-warning/30 font-sans">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-black text-foreground tracking-tight">Key Risk Drivers</h3>
                <div className="inline-flex items-center gap-2 rounded-xl bg-warning/5 border border-warning/20 px-3 py-1.5 shrink-0">
                  <div className={cn('w-1.5 h-1.5 rounded-full bg-warning', isGenerating && 'animate-pulse')}></div>
                  <span className="text-[9px] text-warning font-black tracking-normal">
                    {isGenerating ? 'LLM Drafting' : isLlmGenerated ? 'LLM Summary' : 'Local Summary'}
                  </span>
                </div>
              </div>

              <div className="space-y-3" aria-label="Key risk drivers summary">
                {riskDrivers.map((driver, i) => (
                  <div 
                    key={i} 
                    className="relative group p-4 rounded-xl bg-muted/20 border border-transparent hover:bg-muted/40 hover:border-border/50 transition-all duration-300"
                  >
                    <div className="absolute left-0 top-4 bottom-4 w-1 bg-warning/40 rounded-full group-hover:bg-warning transition-colors" />
                    <p className="text-sm text-foreground/90 leading-relaxed font-medium pl-3">
                      {driver}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Most Affected Commodities */}
            <div className="space-y-6">
              <div className="flex items-center">
                <h3 className="text-lg font-black text-foreground tracking-tight">Most Affected Commodities</h3>
              </div>
              <div className="space-y-5" aria-label="Affected commodities graph">
                {affectedCommodities.map((c) => {
                  const barColorClass = c.pct > 60 
                    ? 'from-danger/40 to-danger shadow-danger/20' 
                    : c.pct > 45 
                      ? 'from-warning/40 to-warning shadow-warning/20' 
                      : 'from-amber-400/40 to-amber-500 shadow-amber-500/10';
                  
                  return (
                    <div key={c.name} className="group cursor-default">
                      <div className="flex items-end justify-between mb-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-muted-foreground tracking-normal mb-0.5">Commodity</span>
                          <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{c.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-muted-foreground tracking-normal mb-0.5">Risk Exposure</span>
                          <span className="text-sm font-black text-foreground">{c.pct}%</span>
                        </div>
                      </div>
                      <div className="relative w-full h-3 bg-muted/30 rounded-sm overflow-hidden border border-border/10">
                        {/* Background Grid Lines */}
                        <div className="absolute inset-0 flex justify-between px-[20%] pointer-events-none">
                          <div className="w-px h-full bg-border/20" />
                          <div className="w-px h-full bg-border/20" />
                          <div className="w-px h-full bg-border/20" />
                          <div className="w-px h-full bg-border/20" />
                        </div>
                        <div
                          className={cn(
                            'h-full rounded-sm bg-gradient-to-r transition-all duration-1000 ease-out shadow-[0_0_10px]',
                            barColorClass
                          )}
                          style={{ width: `${c.pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6 font-sans">
              <div className="flex items-center">
                <h3 className="text-lg font-black text-foreground tracking-tight">Potentially Impacted</h3>
              </div>
              <div className="space-y-3" aria-label="Impacted population groups">
                {impactedPopulations.map((pop) => (
                  <div
                    key={pop.group}
                    className="flex items-center justify-between gap-3 rounded-xl bg-muted/30 border border-border/20 px-4 py-2.5 transition-all hover:bg-muted/50"
                  >
                    <span className="text-sm font-bold text-foreground/90">{pop.group}</span>
                    <span
                      className={cn(
                        'text-[10px] font-black tracking-normal px-2.5 py-1 rounded-full flex-shrink-0 border',
                        pop.severity === 'High'
                          ? 'bg-danger/10 text-danger border-danger/20'
                          : 'bg-warning/10 text-warning border-warning/20'
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
