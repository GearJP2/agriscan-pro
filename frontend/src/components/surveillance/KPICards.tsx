import { kpiData } from '@/data/mockDashboardData';
import type { KPICard } from '@/types/dashboard';
import { ArrowUp, ArrowDown } from 'lucide-react';

function DeltaBadge({ card }: { card: KPICard }) {
  if (card.delta === null || card.deltaDirection === null) return null;

  const isGood = card.isImprovement === true;
  const isBad = card.isImprovement === false;

  const colorClass = isGood
    ? 'bg-emerald-500/20 text-emerald-400'
    : isBad
      ? 'bg-red-500/20 text-red-400'
      : 'bg-gray-500/20 text-gray-400';

  const Icon = card.deltaDirection === 'up' ? ArrowUp : ArrowDown;

  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {Math.abs(card.delta)}%
    </span>
  );
}

export default function KPICards({ filters }: { filters?: { commodities: string[]; regions: string[] } }) {
  // Re-render with filtered data (mock: vary values slightly based on filter count)
  const scale = filters && (filters.commodities.length > 0 || filters.regions.length > 0)
    ? 0.6 + Math.random() * 0.4
    : 1;

  return (
    <section aria-label="Key Performance Indicators">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiData.cards.map((card) => {
          const hasRedAccent = card.accent === 'red';
          return (
            <div
              key={card.label}
              className={`
                relative rounded-xl bg-gray-900 border border-gray-800 p-5
                ${hasRedAccent ? 'border-l-4 border-l-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : ''}
              `}
            >
              {/* Delta badge - top right */}
              <div className="absolute top-3 right-3">
                <DeltaBadge card={card} />
              </div>

              {/* Main value */}
              <p className="text-3xl font-bold text-gray-50 mt-2">
                {typeof card.value === 'number'
                  ? Math.round(Number(card.value) * scale)
                  : card.value}
              </p>

              {/* Label */}
              <p className="text-sm text-gray-400 mt-1">{card.label}</p>

              {/* Context line */}
              <p className="text-xs text-gray-500 mt-3 border-t border-gray-800 pt-2">
                {card.context}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
