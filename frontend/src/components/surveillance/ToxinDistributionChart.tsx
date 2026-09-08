import type { CSSProperties } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart as RechartsBarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { useTheme } from 'next-themes';

interface ToxinDist {
  count: string;
  pct: number;
}

interface ToxinDistributionChartProps {
  data: ToxinDist[];
  useBarChart?: boolean;
}

const COLORS = {
  g1: ['#10b981', '#059669'],
  g2: ['#FFC72C', '#d97706'],
  g3: ['#ea580c', '#c2410c'],
  g4: ['#7a1f1f', '#5c1515'],
} as const;

const PIE_COLORS = ['#10b981', '#FFC72C', '#ea580c', '#7a1f1f'];

const RISK_STEPS = [
  { limit: 25, label: '<25%', color: '#10b981' },
  { limit: 50, label: '25–50%', color: '#FFC72C' },
  { limit: 75, label: '50–75%', color: '#ea580c' },
  { limit: 101, label: '>75%', color: '#7a1f1f' },
] as const;

export default function ToxinDistributionChart({ data, useBarChart }: ToxinDistributionChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Sort data to ensure correct order (1, 2, 3, 4+)
  const orderedData = [...(data ?? [])].sort((a, b) => {
    if (a.count === '4+') return 1;
    if (b.count === '4+') return -1;
    return Number.parseInt(a.count, 10) - Number.parseInt(b.count, 10);
  });

  const tooltipStyle: CSSProperties = {
    backgroundColor: isDark ? '#0f1418' : '#ffffff',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(122,31,31,0.2)'}`,
    borderRadius: '14px',
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
    color: isDark ? '#f8fafc' : '#313131',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 'bold',
  };

  const tooltipItemStyle: CSSProperties = {
    color: isDark ? '#f8fafc' : '#313131',
    fontWeight: 'bold',
  };

  const tooltipLabelStyle: CSSProperties = {
    color: isDark ? '#FFC72C' : '#7a1f1f',
    fontWeight: 'bold',
    marginBottom: '4px',
  };

  function aboveThresholdColor(pct: number): string {
    if (pct <= 0) return 'transparent';
    const step = RISK_STEPS.find(s => pct < s.limit) || RISK_STEPS[RISK_STEPS.length - 1];
    return step.color;
  }

  if (useBarChart) {
    return (
      <div className="w-full h-full min-h-[300px] flex flex-col">
        {/* Color Legend */}
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

        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={orderedData} margin={{ top: 20, right: 30, left: 10, bottom: 50 }}>
              <defs>
                <linearGradient id="bar-g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.g1[0]} stopOpacity={0.9}/>
                  <stop offset="100%" stopColor={COLORS.g1[1]} stopOpacity={0.8}/>
                </linearGradient>
                <linearGradient id="bar-g2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.g2[0]} stopOpacity={0.9}/>
                  <stop offset="100%" stopColor={COLORS.g2[1]} stopOpacity={0.8}/>
                </linearGradient>
                <linearGradient id="bar-g3" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.g3[0]} stopOpacity={0.9}/>
                  <stop offset="100%" stopColor={COLORS.g3[1]} stopOpacity={0.8}/>
                </linearGradient>
                <linearGradient id="bar-g4" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.g4[0]} stopOpacity={0.9}/>
                  <stop offset="100%" stopColor={COLORS.g4[1]} stopOpacity={0.8}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} vertical={false} />
              <XAxis 
                dataKey="count" 
                tick={{ fill: isDark ? '#cbd5e1' : '#64748b', fontSize: 12, fontWeight: '800' }} 
                axisLine={false}
                tickLine={false}
                dy={15}
                tickFormatter={(val) => `${val} Toxin${val !== '1' ? 's' : ''}`}
                label={{ value: 'Number of toxins per sample', position: 'insideBottom', offset: -25, fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
              />
              <YAxis 
                tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 'bold' }} 
                axisLine={false}
                tickLine={false}
                dx={-5}
                label={{ 
                  value: '% of positive samples', 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: 20, 
                  fill: isDark ? '#94a3b8' : '#64748b', 
                  fontSize: 11,
                  style: { textAnchor: 'middle' }
                }}
              />
              <Tooltip 
                contentStyle={tooltipStyle}
                itemStyle={tooltipItemStyle}
                labelStyle={tooltipLabelStyle}
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', radius: 12 }}
                formatter={(val: number) => [`${val}% of Samples`, 'Prevalence']}
              />
              <Bar 
                dataKey="pct" 
                radius={[12, 12, 0, 0]} 
                barSize={50}
                animationDuration={1500}
              >
                {orderedData.map((entry) => {
                  return <Cell key={entry.count} fill={aboveThresholdColor(entry.pct)} />;
                })}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={orderedData}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="75%"
            paddingAngle={6}
            dataKey="pct"
            stroke="none"
            animationDuration={1200}
            label={({ count, pct }) => `${count} Tox: ${pct}%`}
            labelLine={{ stroke: isDark ? '#ffffff40' : '#00000040', strokeWidth: 1 }}
          >
            {orderedData.map((entry, index) => (
              <Cell 
                key={entry.count}
                fill={PIE_COLORS[index % PIE_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={tooltipStyle}
            itemStyle={tooltipItemStyle}
            labelStyle={tooltipLabelStyle}
            formatter={(val: number) => [`${val}%`, 'Prevalence']}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
