import { kpiData } from '@/data/mockDashboardData';
import type { KPICard } from '@/types/dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function DeltaBadge({ card }: { card: KPICard }) {
  if (card.delta === null || card.deltaDirection === null) return null;

  const isGood = card.isImprovement === true;
  const isBad = card.isImprovement === false;

  const colorClass = isGood
    ? 'bg-success/20 text-success'
    : isBad
      ? 'bg-danger/20 text-danger'
      : 'bg-muted text-muted-foreground';

  const Icon = card.deltaDirection === 'up' ? ArrowUp : ArrowDown;

  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}>
      <Icon className="h-3 w-3" />
      {Math.abs(card.delta)}%
    </span>
  );
}

export default function KPICards({ filters }: { filters?: { commodities: string[]; regions: string[] } }) {
  const scale = filters && (filters.commodities.length > 0 || filters.regions.length > 0)
    ? 0.6 + Math.random() * 0.4
    : 1;

  return (
    <section aria-label="Key Performance Indicators">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiData.cards.map((card) => {
          const hasRedAccent = card.accent === 'red';
          return (
            <Card
              key={card.label}
              className={cn(
                'glass-card relative',
                hasRedAccent && 'border-l-4 border-l-danger shadow-[0_0_15px_rgba(239,68,68,0.1)]'
              )}
            >
              <CardContent className="p-5">
                {/* Delta badge - top right */}
                <div className="absolute top-3 right-3">
                  <DeltaBadge card={card} />
                </div>

                {/* Main value */}
                <p className="text-3xl font-bold text-foreground mt-2">
                  {typeof card.value === 'number'
                    ? Math.round(Number(card.value) * scale)
                    : card.value}
                </p>

                {/* Label */}
                <p className="text-sm text-muted-foreground mt-1">{card.label}</p>

                {/* Context line */}
                <p className="text-xs text-muted-foreground/60 mt-3 border-t border-border pt-2">
                  {card.context}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
