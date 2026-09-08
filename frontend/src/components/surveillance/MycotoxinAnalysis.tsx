import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Label,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ChevronDown, Info } from 'lucide-react';
import type { HeatmapCell, ThresholdData, ToxinScore } from '@/types/dashboard';

function intensityColor(value: number, isDark: boolean): string {
  if (value > 75) return '#7a1f1f';
  if (value > 50) return '#a51931';
  if (value > 30) return '#d97706';
  if (value > 15) return '#FFC72C';
  return isDark ? '#1e293b' : '#f0e8dc';
}

const RISK_STEPS = [
  { limit: 25, color: '#10b981', label: '<25%' },
  { limit: 50, color: '#FFC72C', label: '25–50%' },
  { limit: 75, color: '#ea580c', label: '50–75%' },
  { limit: 101, color: '#ef4444', label: '>75%' },
] as const;

const getHeatmapKey = (region: string, commodity: string) => `${region}\u0000${commodity}`;

interface MycotoxinAnalysisProps {
  mycotoxinBarData: ToxinScore[];
  thresholdByCommodity: ThresholdData[];
  heatmapData: HeatmapCell[];
  heatmapRegions: string[];
  heatmapCommodities: string[];
  embedded?: boolean;
}

type ChartTooltipProps = TooltipProps<number, string>;

function ChartInfo({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="ml-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        aria-label="Chart description"
        type="button"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {visible && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-64 rounded-xl bg-popover border border-border shadow-lg px-3 py-2.5 text-xs text-popover-foreground leading-relaxed pointer-events-none">
          {text}
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-border" />
        </div>
      )}
    </div>
  );
}

export default function MycotoxinAnalysis({
  mycotoxinBarData = [],
  thresholdByCommodity = [],
  heatmapData = [],
  heatmapRegions = [],
  heatmapCommodities = [],
  embedded = false,
}: MycotoxinAnalysisProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(true);

  const { top3, heatmapLookup } = useMemo(() => {
    const sorted = [...(heatmapData || [])].sort((a, b) => b.intensity - a.intensity);
    const top = new Set(sorted.slice(0, 3).map((cell) => getHeatmapKey(cell.region, cell.commodity)));
    const lookup = new Map<string, number>();
    (heatmapData || []).forEach((cell) => {
      lookup.set(getHeatmapKey(cell.region, cell.commodity), cell.intensity);
    });
    return { top3: top, heatmapLookup: lookup };
  }, [heatmapData]);

  const combinedData = useMemo(
    () => thresholdByCommodity.map((item) => {
      const total = Math.max(0, Math.round(item.totalCount));
      const risk = Math.min(total, Math.max(0, Math.round(item.aboveCount)));

      return {
        ...item,
        safeSamples: total - risk,
        riskSamples: risk,
      };
    }),
    [thresholdByCommodity],
  );

  function aboveThresholdColor(pct: number): string {
    if (pct <= 0) return 'transparent';
    const step = RISK_STEPS.find(s => pct < s.limit) || RISK_STEPS[RISK_STEPS.length - 1];
    return step.color;
  }

  function getSeverityFromScore(score: number): string {
    if (score >= 75) return 'critical';
    if (score >= 50) return 'high';
    if (score >= 25) return 'medium';
    return 'low';
  }

  const tickFill = isDark ? '#94a3b8' : '#666666';
  const labelFill = isDark ? '#cbd5e1' : '#313131';

  const ToxinTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      const toxinData = mycotoxinBarData.find((t) => t.shortName === label);
      const score = Number(payload[0]?.value ?? 0);
      const severity = getSeverityFromScore(score);
      const color = aboveThresholdColor(score);
      return (
        <div className="bg-white dark:bg-slate-900 border border-gfs-maroon/20 dark:border-white/10 p-3 rounded-xl shadow-gfs-modal min-w-[170px]">
          <p className="text-xs font-bold text-gfs-text-primary dark:text-white mb-2">{toxinData?.name || String(label ?? '')}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-xs text-gfs-text-muted font-medium">Prevalence</span>
              <span className="text-xs font-extrabold text-gfs-maroon dark:text-gfs-gold">{score}%</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-gfs-text-muted font-medium">Concern</span>
              <span className="text-xs font-bold capitalize flex items-center gap-1.5" style={{ color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {severity}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CombinedTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      const safeSamples = Number(payload.find((item) => item.dataKey === 'safeSamples')?.value ?? 0);
      const riskSamples = Number(payload.find((item) => item.dataKey === 'riskSamples')?.value ?? 0);
      const total = safeSamples + riskSamples;
      const rate = total > 0 ? ((riskSamples / total) * 100).toFixed(1) : '0';

      return (
        <div className="bg-white dark:bg-slate-900 border border-gfs-maroon/20 dark:border-white/10 p-3 rounded-xl shadow-gfs-modal min-w-[180px]">
          <p className="text-xs font-bold text-gfs-text-primary dark:text-white mb-2">{String(label ?? '')}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-xs text-gfs-text-muted font-medium">Total Samples</span>
              <span className="text-xs font-bold text-gfs-text-primary dark:text-white">{total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-emerald-600 font-medium">Safe Samples</span>
              <span className="text-xs font-bold text-emerald-600">{safeSamples.toLocaleString()}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-gfs-maroon dark:text-gfs-gold font-medium">Above Threshold</span>
              <span className="text-xs font-bold text-gfs-maroon dark:text-gfs-gold">{riskSamples.toLocaleString()}</span>
            </div>
            <div className="pt-1 mt-1 border-t border-gfs-maroon/10 flex justify-between gap-4">
              <span className="text-xs text-gfs-text-muted font-medium">Risk Rate</span>
              <span className="text-xs font-extrabold text-gfs-maroon dark:text-gfs-gold">{rate}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const analysisContent = (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4 lg:pr-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h3 className="text-sm font-bold tracking-tight text-gfs-maroon dark:text-white">
                Top Mycotoxins by Public Health Concern
              </h3>
              <ChartInfo text="Displays the prevalence of each toxin, representing the percentage of positive samples in which each specific mycotoxin was detected." />
            </div>
          </div>
          <div className="h-72" role="img" aria-label="Horizontal bar chart of mycotoxin risk scores">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={mycotoxinBarData}
                layout="vertical"
                margin={{ left: 10, right: 30, top: 5, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: tickFill, fontWeight: 600 }}
                  axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                  tickFormatter={(v) => `${v}%`}
                >
                  <Label value="Prevalence (% of positive samples)" offset={-20} position="insideBottom" fill={labelFill} style={{ fontSize: 11, fontWeight: 700 }} />
                </XAxis>
                <YAxis
                  dataKey="shortName"
                  type="category"
                  tick={{ fontSize: 11, fill: tickFill, fontWeight: 700 }}
                  axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                  width={60}
                />
                <Tooltip content={<ToxinTooltip />} />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={18}>
                  {mycotoxinBarData.map((entry) => (
                    <Cell key={entry.shortName} fill={aboveThresholdColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-4 lg:pl-8 lg:border-l lg:border-gfs-maroon/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h3 className="text-sm font-bold tracking-tight text-gfs-maroon dark:text-white">
                Sample Coverage & Risk by Commodity
              </h3>
              <ChartInfo text="Combines total sample volume (bar height) with risk classification. Red indicates samples that exceed European Union safety thresholds, while green denotes safe samples." />
            </div>
          </div>
          <div className="h-72" role="img" aria-label="Stacked bar chart showing commodity risk profile">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={combinedData}
                margin={{ left: 10, right: 10, top: 5, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                <XAxis
                  dataKey="commodity"
                  tick={{ fontSize: 11, fill: tickFill, fontWeight: 700 }}
                  axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: tickFill, fontWeight: 600 }}
                  axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                >
                  <Label value="Total Samples Reported" angle={-90} position="insideLeft" offset={-5} fill={labelFill} style={{ fontSize: 11, fontWeight: 700, textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip content={<CombinedTooltip />} />
                <Bar dataKey="safeSamples" name="Safe Samples" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={32} />
                <Bar dataKey="riskSamples" name="Above Threshold" stackId="a" fill="#7a1f1f" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="border-t border-gfs-maroon/10 pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold tracking-tight text-gfs-maroon dark:text-white">
              Region × Commodity Risk Intensity
            </h3>
            <p className="text-xs text-gfs-text-muted mt-0.5">
              Heatmap of above-threshold sample percentage across regional crop groups
            </p>
          </div>
          <span className="text-[10px] font-bold text-gfs-maroon dark:text-gfs-gold px-2.5 py-1 rounded-full bg-gfs-maroon/10 dark:bg-gfs-gold/20 border border-gfs-maroon/20 w-fit">
            Gold Outline = Top 3 Hotspots
          </span>
        </div>

        {heatmapRegions.length === 0 || heatmapCommodities.length === 0 ? (
          <div className="p-8 text-center bg-gfs-canvas/40 dark:bg-slate-800/40 rounded-xl border border-dashed border-gfs-maroon/20">
            <p className="text-xs font-semibold text-gfs-text-muted">No regional commodity data available for selected filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-gfs-maroon/15 shadow-sm">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-gfs-canvas/70 dark:bg-slate-800/80 border-b border-gfs-maroon/15">
                    <th className="p-3 text-left font-bold text-gfs-text-primary dark:text-slate-200 uppercase tracking-wider text-[11px]">Region</th>
                    {heatmapCommodities.map((comm) => (
                      <th key={comm} className="p-3 font-bold text-gfs-text-primary dark:text-slate-200">{comm}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gfs-maroon/10 bg-white dark:bg-slate-900/40 font-semibold">
                  {heatmapRegions.map((region) => (
                    <tr key={region} className="hover:bg-gfs-canvas/40 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 text-left font-bold text-gfs-text-primary dark:text-slate-200">{region}</td>
                      {heatmapCommodities.map((commodity) => {
                        const heatmapKey = getHeatmapKey(region, commodity);
                        const intensity = heatmapLookup.get(heatmapKey) || 0;
                        const isHotspot = top3.has(heatmapKey);

                        return (
                          <td key={commodity} className="p-2.5">
                            <div
                              className={cn(
                                'h-9 w-full rounded-lg flex items-center justify-center font-bold text-xs transition-transform duration-200 hover:scale-105',
                                isHotspot && 'ring-2 ring-gfs-gold shadow-md'
                              )}
                              style={{
                                backgroundColor: intensityColor(intensity, isDark),
                                color: intensity > 30 ? '#ffffff' : isDark ? '#ffffff' : '#313131',
                              }}
                            >
                              {intensity > 0 ? `${intensity}%` : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-gfs-maroon/10">
              <span className="text-xs font-bold text-gfs-text-muted tracking-normal">Risk Intensity:</span>
              <div className="flex gap-4">
                {[15, 30, 50, 75, 95].map((v) => (
                  <div key={v} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded shadow-sm" style={{ backgroundColor: intensityColor(v, isDark) }} />
                    <span className="text-xs font-semibold text-gfs-text-muted">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return analysisContent;
  }

  return (
    <section aria-label="Mycotoxin and Commodity Analysis">
      <Card className="border border-gfs-maroon/15 dark:border-white/10 bg-white dark:bg-slate-900/80 transition-all duration-500 rounded-gfs-card shadow-gfs-card">
        <CardHeader className="pb-4 px-6 pt-5 bg-white dark:bg-slate-900 border-b border-gfs-maroon/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 font-sans">
              <div className="h-6 w-1.5 bg-gfs-gold rounded-full shrink-0" />
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white">
                  Analytics &amp; Trends
                </CardTitle>
                <p className="text-xs font-medium text-gfs-text-muted">
                  Mycotoxin &amp; Commodity Analysis
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              aria-expanded={isExpanded}
              aria-controls="mycotoxin-analysis-content"
              className="p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon hover:text-white transition-all active:scale-95 border border-gfs-maroon/20"
              title={isExpanded ? "Collapse Section" : "Expand Section"}
            >
              <ChevronDown className={cn("w-4 h-4 transition-transform duration-500", !isExpanded && "rotate-180")} />
            </button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent id="mycotoxin-analysis-content" className="px-6 pb-8 pt-6 space-y-8 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
            {analysisContent}
          </CardContent>
        )}
      </Card>
    </section>
  );
}
