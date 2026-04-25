import { useState, useMemo } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ChevronDown, BarChart2 } from 'lucide-react';
import type { CommodityShare, HeatmapCell, ThresholdData, ToxinScore } from '@/types/dashboard';

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

export default function MycotoxinAnalysis({
  mycotoxinBarData,
  commodityShare,
  thresholdByCommodity,
  heatmapData,
  heatmapRegions,
  heatmapCommodities,
  affectedSampleCount,
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

  // Theme-aware chart colors
  const gridStroke = isDark ? '#374151' : '#e5e7eb';
  const tickFill = isDark ? '#9ca3af' : '#6b7280';
  const labelFill = isDark ? '#d1d5db' : '#374151';
  const centerTextFill = isDark ? '#f3f4f6' : '#1f2937';
  const subTextFill = isDark ? '#9ca3af' : '#6b7280';

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '12px',
    color: isDark ? '#f8fafc' : '#0f172a',
    boxShadow: 'none'
  };

  const tooltipItemStyle: React.CSSProperties = {
    color: isDark ? '#f8fafc' : '#0f172a'
  };

  const tooltipLabelStyle: React.CSSProperties = {
    color: isDark ? '#f8fafc' : '#0f172a',
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: '11px',
    marginBottom: '4px'
  };

  interface TooltipProps {
    active?: boolean;
    payload?: any[];
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-[#1e293b] border-2 border-slate-900/10 dark:border-white/10 p-4 rounded-2xl shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/40 mb-1">
            {payload[0].payload.name || payload[0].payload.commodity || payload[0].name}
          </p>
          <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">
            {payload[0].value}
            <span className="text-[10px] ml-1.5 opacity-60 font-bold uppercase tracking-widest">
              {payload[0].dataKey === 'score' ? 'Severity Score' : '% Share/Rate'}
            </span>
          </p>
          {label && label !== payload[0].name && (
            <div className="mt-2 pt-2 border-t border-slate-900/5 dark:border-white/5">
              <p className="text-[9px] font-black text-primary uppercase tracking-tighter italic">
                {label}
              </p>
            </div>
          )}
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
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <BarChart2 className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
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

              <div className="rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/40 mb-2">
                  Top Mycotoxins by Public Health Concern
                </h3>
                <p className="text-[11px] text-slate-900 dark:text-white/80 leading-relaxed mb-8 font-semibold">
                  Displays the most significant toxins to public health, such as Aflatoxin B1, Fumonisin, or Ochratoxin A, based on detection frequency and risk level in samples.
                </p>
                <div className="h-72" aria-label="Horizontal bar chart of mycotoxin risk scores">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mycotoxinBarData}
                      layout="vertical"
                      margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                      barCategoryGap="30%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: tickFill, fontSize: 11 }} />
                      <YAxis type="category" dataKey="shortName" tick={{ fill: labelFill, fontSize: 11, fontWeight: 'bold' }} width={60} />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar
                        dataKey="score"
                        radius={[0, 6, 6, 0]}
                        barSize={24}
                      >
                        {mycotoxinBarData.map((entry) => (
                          <Cell key={entry.shortName} fill={SEVERITY_COLORS[entry.severity]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top-right: Share of Affected Commodities (Donut) */}
              <div className="rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/40 mb-2">
                  Share of Affected Commodities
                </h3>
                <p className="text-[11px] text-slate-900 dark:text-white/80 leading-relaxed mb-8 font-semibold">
                  Shows the distribution of affected agricultural products (e.g., Corn, Peanuts, Rice) to identify high-risk commodities across the overall supply chain.
                </p>
                <div className="h-72" aria-label="Donut chart showing share of affected commodities">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={commodityShare}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                        animationDuration={1500}
                        label={({ name, value }) => `${name} ${value}%`}
                        labelLine={{ stroke: isDark ? '#ffffff40' : '#00000040', strokeWidth: 1 }}
                      >
                        {commodityShare.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <text x="50%" y="42%" textAnchor="middle" fill={centerTextFill} fontSize={28} fontWeight="900" className="font-sans">
                        {affectedSampleCount.toLocaleString()}
                      </text>
                      <text x="50%" y="52%" textAnchor="middle" fill={subTextFill} fontSize={10} fontWeight="bold" className="uppercase tracking-[0.2em]">
                        Affected
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom-left: % Above Threshold by Commodity */}
              <div className="rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/40 mb-2">
                  % Above Threshold by Commodity
                </h3>
                <p className="text-[11px] text-slate-900 dark:text-white/80 leading-relaxed mb-8 font-semibold">
                  Indicates the percentage of samples exceeding safety standards per commodity, identifying products requiring prioritized surveillance.
                </p>
                <div className="h-72" aria-label="Bar chart showing percentage above safety threshold by commodity">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={thresholdByCommodity} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis dataKey="commodity" tick={{ fill: tickFill, fontSize: 10, fontWeight: 'bold' }} />
                      <YAxis domain={[0, 80]} tick={{ fill: tickFill, fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} cursor={false} />
                      <Bar dataKey="pctAbove" radius={[6, 6, 0, 0]} barSize={40}>
                        {thresholdByCommodity.map((entry) => (
                          <Cell key={entry.commodity} fill={barColor(entry.pctAbove)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bottom-right: Region × Commodity Risk Intensity Heatmap */}
              <div className="rounded-3xl bg-transparent dark:bg-muted/30 p-8 border-2 border-border dark:border-border/50">
                <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white/40 mb-2">
                  Region × Commodity Risk Intensity
                </h3>
                <p className="text-[11px] text-slate-900 dark:text-white/80 leading-relaxed mb-8 font-semibold">
                  A matrix representing risk intensity across regions and product types to pinpoint localized surveillance hotspots.
                </p>
                <div className="overflow-x-auto custom-scrollbar" aria-label="Heatmap of risk intensity by region and commodity">
                  <table className="w-full border-separate border-spacing-1">
                    <thead>
                      <tr>
                        <th className="text-[9px] text-slate-400 dark:text-white/20 text-left p-2 uppercase font-black tracking-widest px-1">Region</th>
                        {heatmapCommodities.map((c) => (
                          <th key={c} className="text-[9px] text-slate-500 dark:text-white/40 font-black text-center p-2 min-w-[70px] uppercase tracking-widest">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapRegions.map((region) => (
                        <tr key={region}>
                          <td className="text-[10px] text-slate-600 dark:text-white/40 font-black p-2 whitespace-nowrap uppercase tracking-tighter">{region}</td>
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
                  <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Risk Intensity:</span>
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
