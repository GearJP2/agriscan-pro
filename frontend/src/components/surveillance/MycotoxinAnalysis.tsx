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
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ChevronDown, BarChart2, Info } from 'lucide-react';
import type { CommodityShare, HeatmapCell, ThresholdData, ToxinScore } from '@/types/dashboard';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

function intensityColor(value: number, isDark: boolean): string {
  if (value > 75) return '#991b1b';
  if (value > 50) return '#ef4444';
  if (value > 30) return '#f59e0b';
  if (value > 15) return '#fbbf24';
  return isDark ? '#1e293b' : '#e5e7eb';
}

interface MycotoxinAnalysisProps {
  mycotoxinBarData: ToxinScore[];
  commodityShare: CommodityShare[];
  thresholdByCommodity: ThresholdData[];
  heatmapData: HeatmapCell[];
  heatmapRegions: string[];
  heatmapCommodities: string[];
  affectedSampleCount: number;
}

const COMMODITY_PALETTE = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];

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
  mycotoxinBarData,
  thresholdByCommodity,
  heatmapData,
  heatmapRegions,
  heatmapCommodities,
}: MycotoxinAnalysisProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [isExpanded, setIsExpanded] = useState(true);

  const { sortedCells, top3, heatmapLookup } = useMemo(() => {
    const sorted = [...heatmapData].sort((a, b) => b.intensity - a.intensity);
    const top = new Set(sorted.slice(0, 3).map((cell) => `${cell.region}-${cell.commodity}`));
    const lookup = new Map<string, number>();
    heatmapData.forEach((cell) => lookup.set(`${cell.region}-${cell.commodity}`, cell.intensity));
    return { sortedCells: sorted, top3: top, heatmapLookup: lookup };
  }, [heatmapData]);

  // Precompute stacked bar data: aboveCount + remaining per commodity
  const combinedData = thresholdByCommodity.map((d, i) => ({
    ...d,
    remaining: d.totalCount - d.aboveCount,
    color: COMMODITY_PALETTE[i % COMMODITY_PALETTE.length],
  }));

  const RISK_STEPS = [
    { limit: 25, color: '#10b981', label: '<25%' },
    { limit: 50, color: '#3b82f6', label: '25–50%' },
    { limit: 75, color: '#f59e0b', label: '50–75%' },
    { limit: 100, color: '#ef4444', label: '>75%' },
  ];

  function aboveThresholdColor(pct: number): string {
    if (pct === 0) return 'transparent';
    const step = RISK_STEPS.find(s => pct < s.limit) || RISK_STEPS[RISK_STEPS.length - 1];
    return step.color;
  }

  // Theme-aware chart colors
  const gridStroke = isDark ? '#374151' : '#e5e7eb';
  const tickFill = isDark ? '#9ca3af' : '#6b7280';
  const labelFill = isDark ? '#d1d5db' : '#374151';

  interface TooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
  }

  const ToxinTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-900/10 dark:border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-black tracking-normal text-slate-500 dark:text-white/40 mb-1">
            {payload[0].payload.name || label}
          </p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {payload[0].value}%
            <span className="text-[10px] ml-1.5 opacity-60 font-bold tracking-normal">Prevalence</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CombinedTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      const aboveEntry = payload.find((p: any) => p.dataKey === 'aboveCount');
      const remainEntry = payload.find((p: any) => p.dataKey === 'remaining');
      const total = (aboveEntry?.value ?? 0) + (remainEntry?.value ?? 0);
      const above = aboveEntry?.value ?? 0;
      const pct = total > 0 ? Math.round((above / total) * 100) : 0;
      return (
        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-900/10 dark:border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-md min-w-[180px]">
          <p className="text-[10px] font-black tracking-normal text-slate-500 dark:text-white/40 mb-3">{label}</p>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-6">
              <span className="text-xs text-slate-500 dark:text-white/50">Total tested</span>
              <span className="text-xs font-black text-slate-900 dark:text-white">{total}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-xs text-red-500">Above threshold</span>
              <span className="text-xs font-black text-red-500">{above} <span className="text-[10px] opacity-70">({pct}%)</span></span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-xs text-slate-400">Within safe range</span>
              <span className="text-xs font-black text-slate-400">{total - above}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <section aria-label="Mycotoxin and Commodity Analysis">
      <Card className="glass-card border-2 border-border dark:border-border/50 bg-card dark:bg-card transition-all duration-500 rounded-2xl shadow-none">
        <CardHeader className="pb-4 px-6 pt-5 bg-card dark:bg-card border-b border-border/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 font-sans">
              <BarChart2 className="w-5 h-5 text-primary" />
              <CardTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Mycotoxin & Commodity Analysis
              </CardTitle>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2.5 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 border border-border/40"
              title={isExpanded ? "Collapse Section" : "Expand Section"}
            >
              <ChevronDown className={cn("w-5 h-5 transition-transform duration-500", !isExpanded && "rotate-180")} />
            </button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="px-6 pb-8 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Top-left: Mycotoxin severity bar chart */}
              <div className="rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <div className="flex items-center mb-8">
                  <h3 className="text-[13px] font-black tracking-normal text-slate-500 dark:text-white/40">
                    Top Mycotoxins by Public Health Concern
                  </h3>
                  <ChartInfo text="Displays the prevalence of each toxin, representing the percentage of positive samples in which each specific mycotoxin was detected." />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] font-bold text-muted-foreground">Prevalence/Severity:</span>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS.critical }} />
                    <span className="text-[10px] text-muted-foreground">&gt;75%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS.high }} />
                    <span className="text-[10px] text-muted-foreground">50–75%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS.medium }} />
                    <span className="text-[10px] text-muted-foreground">25–50%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: SEVERITY_COLORS.low }} />
                    <span className="text-[10px] text-muted-foreground">&lt;25%</span>
                  </div>
                </div>
                <div className="h-72" aria-label="Horizontal bar chart of mycotoxin risk scores">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mycotoxinBarData}
                      layout="vertical"
                      margin={{ left: 10, right: 30, top: 5, bottom: 30 }}
                      barCategoryGap="30%"
                    >
                      <defs>
                        <linearGradient id="bar-g1" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="bar-g2" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="bar-g3" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#d97706" stopOpacity={0.8} />
                        </linearGradient>
                        <linearGradient id="bar-g4" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#b91c1c" stopOpacity={0.8} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 'dataMax + 5']}
                        tick={{ fill: tickFill, fontSize: 11, fontWeight: 'bold' }}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'Prevalence (% of Positive Samples)', position: 'insideBottom', offset: -15, fill: tickFill, fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="shortName"
                        tick={{ fill: labelFill, fontSize: 12, fontWeight: '800' }}
                        width={75}
                        axisLine={false}
                        tickLine={false}
                        label={{
                          value: 'Toxin',
                          angle: -90,
                          position: 'insideLeft',
                          offset: 15,
                          fill: tickFill,
                          fontSize: 11,
                          style: { textAnchor: 'middle' }
                        }}
                      />
                      <Tooltip content={<ToxinTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', radius: 12 }} />
                      <Bar dataKey="score" radius={[0, 12, 12, 0]} barSize={24} animationDuration={1500}>
                        {mycotoxinBarData.map((entry) => (
                          <Cell key={entry.shortName} fill={aboveThresholdColor(entry.score)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top-right: Combined Sample Coverage & Risk Threshold */}
              <div className="rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <div className="flex items-center mb-2">
                  <h3 className="text-[13px] font-black tracking-normal text-slate-500 dark:text-white/40">
                    Sample Coverage &amp; Risk by Commodity
                  </h3>
                  <ChartInfo text="Each bar shows the total number of samples tested per commodity. The red portion shows samples that exceeded the safety threshold; the gray portion is within safe range." />
                </div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[10px] font-bold text-muted-foreground">Above threshold:</span>
                  {RISK_STEPS.map((step) => (
                    <div key={step.limit} className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: step.color }} />
                      <span className="text-[10px] text-muted-foreground">{step.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: isDark ? '#374151' : '#e5e7eb' }} />
                    <span className="text-[10px] text-muted-foreground">Safe</span>
                  </div>
                </div>
                <div className="h-64" aria-label="Stacked bar chart showing total vs above-threshold samples per commodity">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={combinedData} margin={{ top: 5, right: 20, left: 10, bottom: 30 }} barCategoryGap="35%">
                      <defs>
                        <linearGradient id="bar-stack-g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#475569" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#1e293b" stopOpacity={0.2} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
                      <XAxis
                        dataKey="commodity"
                        tick={{ fill: tickFill, fontSize: 12, fontWeight: '800' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                        label={{ value: 'Commodity', position: 'insideBottom', offset: -15, fill: tickFill, fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: tickFill, fontSize: 11, fontWeight: 'bold' }}
                        allowDecimals={false}
                        axisLine={false}
                        tickLine={false}
                        label={{ value: 'No. of samples', angle: -90, position: 'insideLeft', offset: 20, fill: tickFill, fontSize: 11, style: { textAnchor: 'middle' } }}
                      />
                      <Tooltip content={<CombinedTooltip />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', radius: 12 }} />
                      <Bar dataKey="aboveCount" stackId="a" radius={[0, 0, 0, 0]} animationDuration={1500}>
                        {combinedData.map((entry) => (
                          <Cell key={entry.commodity} fill={aboveThresholdColor(entry.pctAbove)} />
                        ))}
                      </Bar>
                      <Bar dataKey="remaining" stackId="a" fill={isDark ? 'url(#bar-stack-g1)' : '#e5e7eb'} radius={[12, 12, 0, 0]} animationDuration={1500} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom: Region × Commodity Risk Intensity Heatmap (full width) */}
              <div className="lg:col-span-2 rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <div className="flex items-center mb-8">
                  <h3 className="text-[13px] font-black tracking-normal text-slate-500 dark:text-white/40">
                    Region × Commodity Risk Intensity
                  </h3>
                  <ChartInfo text="A matrix representing risk intensity across regions and product types to pinpoint localized surveillance hotspots." />
                </div>
                <div className="overflow-x-auto custom-scrollbar" aria-label="Heatmap of risk intensity by region and commodity">
                  <table className="w-full border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="text-[9px] text-slate-400 dark:text-white/20 text-left p-2 font-black tracking-widest px-1 w-px whitespace-nowrap">Region × Commodity</th>
                        {heatmapCommodities.map((c) => (
                          <th key={c} className="text-[9px] text-slate-500 dark:text-white/40 font-black text-center p-2 min-w-[70px] tracking-normal">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapRegions.map((region) => (
                        <tr key={region}>
                          <td className="text-[10px] text-slate-600 dark:text-white/40 font-black p-2 whitespace-nowrap tracking-tight w-px">{region}</td>
                          {heatmapCommodities.map((commodity) => {
                            const key = `${region}-${commodity}`;
                            const value = heatmapLookup.get(key) ?? 0;
                            const isTop3 = top3.has(key);

                            // Softer contrast logic for Yellow backgrounds (Slate 800 instead of pure black)
                            let textColor = isDark ? '#94a3b8' : '#475569'; // Default
                            if (value > 50) {
                              textColor = '#ffffff'; // Red background
                            } else if (value >= 15) {
                              textColor = '#1e293b'; // Yellow/Orange background (Slate 800 - softer)
                            } else if (isDark) {
                              textColor = '#94a3b8'; // Low intensity dark mode
                            }

                            return (
                              <td key={key} className="p-0.5">
                                <div
                                  className={cn(
                                    "rounded-lg text-center text-xs font-bold py-3 border transition-colors cursor-default",
                                    isTop3 ? "border-primary/40 shadow-sm" : "border-transparent"
                                  )}
                                  style={{
                                    backgroundColor: intensityColor(value, isDark),
                                    color: textColor,
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
                <div className="flex items-center gap-4 mt-6 pt-4 border-t border-border/50">
                  <span className="text-[9px] font-black text-muted-foreground/60 tracking-normal">Risk Intensity:</span>
                  <div className="flex gap-3">
                    {[15, 30, 50, 75, 95].map((v) => (
                      <div key={v} className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded shadow-sm" style={{ backgroundColor: intensityColor(v, isDark) }} />
                        <span className="text-[9px] font-bold text-muted-foreground/60">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </section>
  );
}
