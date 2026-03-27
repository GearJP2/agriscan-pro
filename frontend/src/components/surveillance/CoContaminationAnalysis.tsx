import {
  coContamSummary,
  coOccurrenceList,
  toxinsPerSample,
  TOXIN_COLORS,
} from '@/data/mockDashboardData';
import CoOccurrenceNetwork from './CoOccurrenceNetwork';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';

function ToxinTag({ name }: { name: string }) {
  const color = TOXIN_COLORS[name] || '#6b7280';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}33`, color }}
    >
      {name}
    </span>
  );
}

const summaryTiles = [
  { label: 'Avg toxins per positive sample', value: coContamSummary.avgToxinsPerSample.toFixed(1), tint: 'bg-info/10' },
  { label: 'Samples with 2+ toxins', value: `${coContamSummary.pctTwoPlus}%`, tint: 'bg-warning/10' },
  { label: 'Samples with 3+ toxins', value: `${coContamSummary.pctThreePlus}%`, tint: 'bg-danger/10' },
  { label: 'Most common co-occurrence', value: coContamSummary.mostCommonPair, tint: 'bg-purple-500/10' },
];

export default function CoContaminationAnalysis() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const gridStroke = isDark ? '#374151' : '#e5e7eb';
  const tickFill = isDark ? '#9ca3af' : '#6b7280';
  const labelFill = isDark ? '#6b7280' : '#9ca3af';
  const tooltipBg = isDark ? '#1f2937' : '#ffffff';
  const tooltipBorder = isDark ? '#374151' : '#e5e7eb';
  const tooltipColor = isDark ? '#f3f4f6' : '#1f2937';
  const tooltipStyle = { backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, color: tooltipColor };

  return (
    <section aria-label="Co-contamination Analysis">
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Co-contamination Analysis</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Left column: Summary + Table stacked */}
            <div className="space-y-6">

              {/* Panel 1: Summary Indicators (2x2 mini-grid) */}
              <div className="grid grid-cols-2 gap-3">
                {summaryTiles.map((tile) => (
                  <div key={tile.label} className={`rounded-lg p-4 ${tile.tint}`}>
                    <p className="text-2xl font-bold text-foreground">{tile.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{tile.label}</p>
                  </div>
                ))}
              </div>

              {/* Panel 2: Common Co-occurrences Table */}
              <div className="rounded-lg bg-muted/50 p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Common Co-occurrences</h3>
                <div className="space-y-2" aria-label="Ranked list of common toxin co-occurrences">
                  {coOccurrenceList.map((co, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        {co.toxins.map((t, j) => (
                          <span key={t} className="flex items-center gap-1">
                            <ToxinTag name={t} />
                            {j < co.toxins.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                          </span>
                        ))}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-sm font-medium text-foreground">{co.sampleCount}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">{co.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: Network + Distribution stacked */}
            <div className="space-y-6">

              {/* Panel 3: Co-occurrence Network (D3) */}
              <div className="rounded-lg bg-muted/50 p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Co-occurrence Network</h3>
                <CoOccurrenceNetwork />
              </div>

              {/* Panel 4: Toxins per Sample Distribution */}
              <div className="rounded-lg bg-muted/50 p-4">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Toxins per Sample Distribution</h3>
                <div className="h-52" aria-label="Bar chart showing distribution of toxin count per sample">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={toxinsPerSample} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                      <XAxis
                        dataKey="count"
                        tick={{ fill: tickFill, fontSize: 12 }}
                        label={{ value: 'Toxins per sample', position: 'insideBottom', offset: -2, fill: labelFill, fontSize: 11 }}
                      />
                      <YAxis
                        tick={{ fill: tickFill, fontSize: 12 }}
                        label={{ value: '% of positive', angle: -90, position: 'insideLeft', fill: labelFill, fontSize: 11 }}
                      />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}%`, '% of positive samples']} />
                      <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                        {toxinsPerSample.map((entry) => (
                          <Cell
                            key={entry.count}
                            fill={entry.highlight ? '#f59e0b' : '#6b7280'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-warning mt-2">Amber bar = "watch zone" (2 toxins)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
