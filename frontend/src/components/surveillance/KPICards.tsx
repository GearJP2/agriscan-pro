import type { KPICard } from '@/types/dashboard';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

function DeltaBadge({ card }: { card: KPICard }) {
  if (card.delta === null || card.deltaDirection === null) return null;

  const isGood = card.isImprovement === true;
  const isBad = card.isImprovement === false;

  const colorClass = isGood
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
    : isBad
      ? 'bg-red-50 text-gfs-maroon-dark border-gfs-maroon/20 dark:bg-red-950/40 dark:text-red-300'
      : 'bg-gfs-thumb/40 text-gfs-text-muted border-gfs-maroon/10';

  const Icon = card.deltaDirection === 'up' ? ArrowUp : ArrowDown;

  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold border', colorClass)}>
      <Icon className="h-3 w-3" />
      {Math.abs(card.delta)}%
    </span>
  );
}

export default function KPICards({ cards }: { cards: KPICard[] }) {
  return (
    <section aria-label="Key Performance Indicators" className="font-sans">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, idx) => {
          const hasRedAccent = card.accent === 'red';
          return (
            <div
              key={card.label}
              className={cn(
                "p-6 transition-colors hover:bg-gfs-canvas/40 dark:hover:bg-white/[0.02] flex flex-col justify-between gap-4",
                // Mobile: single column, bottom border on all except last
                "border-b border-gfs-maroon/10 last:border-b-0",
                // Tablet (md): 2 columns
                "md:border-b-0",
                idx < 4 && "md:border-b md:border-gfs-maroon/10",
                idx % 2 === 0 && "md:border-r md:border-gfs-maroon/10",
                // Desktop (lg): 3 columns
                "lg:border-b-0",
                idx < 3 && "lg:border-b lg:border-gfs-maroon/10",
                idx % 3 !== 2 && "lg:border-r lg:border-gfs-maroon/10",
                idx % 3 === 2 && "lg:border-r-0",
                hasRedAccent && "bg-red-50/25 dark:bg-red-950/15"
              )}
            >
              {/* Header row: Label/Icon on Left, Value on Right */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {card.icon && (
                    <div className={cn(
                      "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center",
                      hasRedAccent
                        ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                        : "bg-gfs-maroon/10 text-gfs-maroon dark:bg-gfs-gold/15 dark:text-gfs-gold"
                    )}>
                      <card.icon className="h-4 w-4" />
                    </div>
                  )}
                  <p className="text-xs font-bold text-gfs-text-muted uppercase tracking-wider">
                    {card.label}
                  </p>
                </div>
                <p className={cn(
                  "text-3xl font-extrabold tracking-tight shrink-0",
                  hasRedAccent
                    ? "text-red-700 dark:text-red-400"
                    : "text-gfs-maroon dark:text-gfs-gold"
                )}>
                  {card.value}
                </p>
              </div>

              {/* Delta badge and context row */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gfs-text-muted font-medium">
                  {card.context}
                </p>
                <DeltaBadge card={card} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
