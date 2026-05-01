import React from 'react';
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

export default function ToxinDistributionChart({ data, useBarChart }: ToxinDistributionChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Sort data to ensure correct order (1, 2, 3, 4+)
  const orderedData = [...data].sort((a, b) => {
    if (a.count === '4+') return 1;
    if (b.count === '4+') return -1;
    return parseInt(a.count) - parseInt(b.count);
  });

  // Semantic Color Palette
  const COLORS = {
    g1: ['#10b981', '#059669'], // Green (Safe/1)
    g2: ['#3b82f6', '#2563eb'], // Blue (Cautious/2)
    g3: ['#f59e0b', '#d97706'], // Amber (Alert/3)
    g4: ['#ef4444', '#b91c1c'], // Red (Critical/4+)
  };

  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: '12px',
    boxShadow: 'none',
    color: isDark ? '#f8fafc' : '#0f172a',
    padding: '10px 14px',
    fontSize: '12px',
    fontWeight: 'bold',
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

  // Shared Risk Thresholds
  const RISK_STEPS = [
    { limit: 25, color: '#10b981', label: '<25%' },
    { limit: 50, color: '#3b82f6', label: '25–50%' },
    { limit: 75, color: '#f59e0b', label: '50–75%' },
    { limit: 101, color: '#ef4444', label: '>75%' },
  ];

  function aboveThresholdColor(pct: number): string {
    if (pct === 0) return 'transparent';
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
                {orderedData.map((entry, index) => {
                  return <Cell key={`cell-${index}`} fill={aboveThresholdColor(entry.pct)} />;
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
                key={`cell-${index}`} 
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
