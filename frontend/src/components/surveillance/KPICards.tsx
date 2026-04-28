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

export default function KPICards({ cards }: { cards: KPICard[] }) {
  return (
    <section aria-label="Key Performance Indicators" className="font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((card) => {
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
                {/* Header row: Label/Icon on Left, Value on Right */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {card.icon && (
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <card.icon className="h-4 w-4" />
                      </div>
                    )}
                    <p className="text-sm font-black text-slate-900 dark:text-white tracking-normal">
                      {card.label}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {card.value}
                  </p>
                </div>

                {/* Delta badge and context row */}
                <div className="flex items-center justify-between mt-4 border-t border-border/50 pt-3">
                  <p className="text-[10px] text-muted-foreground/60 font-bold tracking-normal">
                    {card.context}
                  </p>
                  <DeltaBadge card={card} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
