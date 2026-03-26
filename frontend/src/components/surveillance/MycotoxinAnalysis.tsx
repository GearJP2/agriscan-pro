import {
  mycotoxinBarData,
  commodityShare,
  thresholdByCommodity,
  heatmapData,
} from '@/data/mockDashboardData';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ReferenceLine,
} from 'recharts';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
};

function barColor(pct: number) {
  if (pct > 50) return '#ef4444';
  if (pct > 25) return '#f59e0b';
  return '#22c55e';
}

const allRegions = ['North', 'Northeast', 'Central', 'East', 'West', 'South'];
const allCommodities = ['Maize', 'Peanuts', 'Rice', 'Animal Feed', 'Others'];

// Intensity to color interpolation
function intensityColor(value: number): string {
  if (value > 75) return '#991b1b';
  if (value > 50) return '#ef4444';
  if (value > 30) return '#f59e0b';
  if (value > 15) return '#fbbf24';
  return '#374151';
}

// Find top 3 cells by intensity
const sortedCells = [...heatmapData].sort((a, b) => b.intensity - a.intensity);
const top3 = new Set(sortedCells.slice(0, 3).map((c) => `${c.region}-${c.commodity}`));

// Build heatmap lookup
const heatmapLookup = new Map<string, number>();
heatmapData.forEach((c) => heatmapLookup.set(`${c.region}-${c.commodity}`, c.intensity));

export default function MycotoxinAnalysis() {
  const totalAffected = commodityShare.reduce((s, c) => s + c.value, 0);
  const totalSamples = Math.round(4821 * 0.673); // ~positive samples

  return (
    <section aria-label="Mycotoxin and Commodity Analysis">
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-5">Mycotoxin & Commodity Analysis</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Top-left: Top Mycotoxins by Public Health Concern */}
          <div className="rounded-lg bg-gray-800/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Top Mycotoxins by Public Health Concern</h3>
            <div className="h-64" aria-label="Horizontal bar chart of mycotoxin risk scores">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mycotoxinBarData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    tick={{ fill: '#d1d5db', fontSize: 12 }}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }}
                    formatter={(value: number, _: any, entry: any) => [`${value}%`, entry.payload.name]}
                  />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {mycotoxinBarData.map((entry) => (
                      <Cell key={entry.shortName} fill={SEVERITY_COLORS[entry.severity]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top-right: Share of Affected Commodities (Donut) */}
          <div className="rounded-lg bg-gray-800/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Share of Affected Commodities</h3>
            <div className="h-64" aria-label="Donut chart showing share of affected commodities">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={commodityShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {commodityShare.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }}
                    formatter={(value: number, name: string) => [`${value}%`, name]}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12, color: '#9ca3af' }}
                    formatter={(value) => <span className="text-gray-400">{value}</span>}
                  />
                  {/* Center label */}
                  <text x="50%" y="48%" textAnchor="middle" fill="#f3f4f6" fontSize={22} fontWeight="bold">
                    {totalSamples.toLocaleString()}
                  </text>
                  <text x="50%" y="57%" textAnchor="middle" fill="#9ca3af" fontSize={11}>
                    affected
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom-left: % Above Threshold by Commodity */}
          <div className="rounded-lg bg-gray-800/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">% Above Threshold by Commodity</h3>
            <div className="h-64" aria-label="Bar chart showing percentage above safety threshold by commodity">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={thresholdByCommodity} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="commodity" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis domain={[0, 80]} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }}
                    formatter={(value: number) => [`${value}%`, 'Above threshold']}
                  />
                  <ReferenceLine y={25} stroke="#f59e0b" strokeDasharray="6 4" label={{ value: '25% threshold', fill: '#f59e0b', fontSize: 10, position: 'top' }} />
                  <Bar dataKey="pctAbove" radius={[4, 4, 0, 0]}>
                    {thresholdByCommodity.map((entry) => (
                      <Cell key={entry.commodity} fill={barColor(entry.pctAbove)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom-right: Region × Commodity Risk Intensity Heatmap */}
          <div className="rounded-lg bg-gray-800/50 p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Region × Commodity Risk Intensity</h3>
            <div className="overflow-x-auto" aria-label="Heatmap of risk intensity by region and commodity">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-xs text-gray-500 text-left p-1.5" />
                    {allCommodities.map((c) => (
                      <th key={c} className="text-xs text-gray-400 font-medium text-center p-1.5 min-w-[70px]">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allRegions.map((region) => (
                    <tr key={region}>
                      <td className="text-xs text-gray-400 font-medium p-1.5 whitespace-nowrap">{region}</td>
                      {allCommodities.map((commodity) => {
                        const key = `${region}-${commodity}`;
                        const value = heatmapLookup.get(key) ?? 0;
                        const isTop3 = top3.has(key);
                        return (
                          <td key={key} className="p-1">
                            <div
                              className={`rounded text-center text-xs font-medium py-2 ${
                                isTop3 ? 'ring-2 ring-amber-400' : ''
                              }`}
                              style={{
                                backgroundColor: intensityColor(value),
                                color: value > 30 ? '#fef2f2' : '#d1d5db',
                              }}
                            >
                              {value}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Heatmap legend */}
            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
              <span className="text-xs text-gray-500">Intensity:</span>
              <div className="flex gap-1">
                {[15, 30, 50, 75, 95].map((v) => (
                  <div key={v} className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: intensityColor(v) }} />
                    <span className="text-xs text-gray-500">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
