import { publicHealthSummary } from '@/data/mockDashboardData';
import { AlertTriangle, Wheat, Users } from 'lucide-react';

export default function PublicHealthSummary() {
  const { riskDrivers, affectedCommodities, impactedPopulations } = publicHealthSummary;

  return (
    <section aria-label="Public Health Risk Summary">
      <div className="rounded-xl border-2 border-amber-500/30 bg-gray-900 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Column 1: Key Risk Drivers */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-gray-100">Key Risk Drivers</h3>
            </div>
            <ul className="space-y-2.5" aria-label="List of key risk drivers">
              {riskDrivers.map((driver, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-amber-400 mt-0.5 flex-shrink-0">•</span>
                  {driver}
                </li>
              ))}
            </ul>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs text-amber-400">AI-generated · Pending admin review</span>
            </div>
          </div>

          {/* Column 2: Most Affected Commodities */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Wheat className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-gray-100">Most Affected Commodities</h3>
            </div>
            <div className="space-y-3" aria-label="Affected commodities with contamination percentages">
              {affectedCommodities.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300">{c.name}</span>
                    <span className="text-sm font-medium text-gray-200">{c.pct}%</span>
                  </div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        c.pct > 60 ? 'bg-red-500' : c.pct > 45 ? 'bg-amber-500' : 'bg-yellow-500'
                      }`}
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
              <Users className="h-5 w-5 text-amber-400" />
              <h3 className="text-lg font-semibold text-gray-100">Populations Potentially Impacted</h3>
            </div>
            <div className="space-y-2.5" aria-label="Impacted population groups">
              {impactedPopulations.map((pop) => (
                <div
                  key={pop.group}
                  className="flex items-center justify-between gap-2 rounded-lg bg-gray-800/50 px-3 py-2"
                >
                  <span className="text-sm text-gray-300">{pop.group}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                      pop.severity === 'High'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {pop.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
