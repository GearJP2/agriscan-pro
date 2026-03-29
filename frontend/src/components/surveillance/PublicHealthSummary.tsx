import { AlertTriangle, Wheat, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { HealthSummary } from '@/types/dashboard';

export default function PublicHealthSummary({ summary }: { summary: HealthSummary }) {
  const { riskDrivers, affectedCommodities, impactedPopulations } = summary;

  return (
    <section aria-label="Public Health Risk Summary">
      <Card className="glass-card border-2 border-warning/30">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Column 1: Key Risk Drivers */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h3 className="text-lg font-semibold text-foreground">Key Risk Drivers</h3>
              </div>
              <ul className="space-y-2.5" aria-label="List of key risk drivers">
                {riskDrivers.map((driver, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/80">
                    <span className="text-warning mt-0.5 flex-shrink-0">•</span>
                    {driver}
                  </li>
                ))}
              </ul>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-warning/10 border border-warning/30 px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                <span className="text-xs text-warning">Generated from current sample data</span>
              </div>
            </div>

            {/* Column 2: Most Affected Commodities */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Wheat className="h-5 w-5 text-warning" />
                <h3 className="text-lg font-semibold text-foreground">Most Affected Commodities</h3>
              </div>
              <div className="space-y-3" aria-label="Affected commodities with contamination percentages">
                {affectedCommodities.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground/80">{c.name}</span>
                      <span className="text-sm font-medium text-foreground">{c.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          c.pct > 60 ? 'bg-danger' : c.pct > 45 ? 'bg-warning' : 'bg-yellow-500'
                        )}
                        style={{ width: `${c.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: Populations Potentially Impacted */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-warning" />
                <h3 className="text-lg font-semibold text-foreground">Populations Potentially Impacted</h3>
              </div>
              <div className="space-y-2.5" aria-label="Impacted population groups">
                {impactedPopulations.map((pop) => (
                  <div
                    key={pop.group}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
                  >
                    <span className="text-sm text-foreground/80">{pop.group}</span>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                        pop.severity === 'High'
                          ? 'bg-danger/20 text-danger'
                          : 'bg-warning/20 text-warning'
                      )}
                    >
                      {pop.severity}
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
