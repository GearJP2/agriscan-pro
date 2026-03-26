import { topProvinces } from '@/data/mockDashboardData';
import { TOXIN_COLORS } from '@/data/mockDashboardData';

interface Props {
  onSelectProvince: (province: string) => void;
  selectedProvince: string | null;
}

export default function RegionalRiskRanking({ onSelectProvince, selectedProvince }: Props) {
  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">Top 5 High-Risk Provinces</h3>

      <div className="space-y-3 flex-1">
        {topProvinces.map((p) => {
          const isSelected = selectedProvince === p.province;
          const rankColor = p.riskLevel === 'critical' ? 'bg-red-600' : 'bg-amber-500';

          return (
            <button
              key={p.rank}
              onClick={() => onSelectProvince(p.province)}
              className={`
                w-full text-left rounded-lg p-3 transition-colors border
                ${isSelected
                  ? 'bg-gray-800 border-amber-500/50'
                  : 'bg-gray-900 border-gray-800 hover:bg-gray-800/70'}
              `}
              aria-label={`Rank ${p.rank}: ${p.province}, ${p.aboveThresholdPct}% above threshold`}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <span className={`flex-shrink-0 w-7 h-7 rounded-full ${rankColor} flex items-center justify-center text-xs font-bold text-white`}>
                  {p.rank}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-200 truncate">{p.province}</span>
                    <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{p.sampleCount} samples</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        p.aboveThresholdPct > 60 ? 'bg-red-500' : p.aboveThresholdPct > 40 ? 'bg-amber-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${p.aboveThresholdPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">{p.aboveThresholdPct}% above threshold</span>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor: `${TOXIN_COLORS[p.dominantToxin] || '#6b7280'}33`,
                        color: TOXIN_COLORS[p.dominantToxin] || '#9ca3af',
                      }}
                    >
                      {p.dominantToxin}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
