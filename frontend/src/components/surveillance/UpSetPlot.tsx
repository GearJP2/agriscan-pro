import React from 'react';
import { BarChart, Bar, ResponsiveContainer, Tooltip as RechartsTooltip, Cell } from 'recharts';
import { useTheme } from 'next-themes';

interface Intersection {
  toxins: string[];
  sampleCount: number;
  pct: number;
}

interface UpSetPlotProps {
  intersections: Intersection[];
  toxinColors: Record<string, string>;
}

export default function UpSetPlot({ intersections, toxinColors }: UpSetPlotProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (!intersections || intersections.length === 0) {
    return <div className="text-center text-muted-foreground p-8">No overlapping data found.</div>;
  }

  // Extract all unique toxins across all intersections to form the Y-axis matrix
  const allToxins = Array.from(new Set(intersections.flatMap(i => i.toxins))).sort();

  const tooltipStyle = { 
    backgroundColor: isDark ? '#1f2937' : '#ffffff', 
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`, 
    borderRadius: 8, 
    color: isDark ? '#f9fafb' : '#111827' 
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 font-sans">
      {/* Top Bar Chart: Intersection Sizes */}
      <div className="h-40 w-full pr-4 pb-2" style={{ paddingLeft: '110px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={intersections} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <RechartsTooltip 
              contentStyle={tooltipStyle} 
              formatter={(val: number) => [val, 'Samples']}
              labelFormatter={(_, payload) => {
                const item = payload[0]?.payload as Intersection;
                return item ? item.toxins.join(' + ') : 'Intersection';
              }}
              cursor={false}
            />
            <Bar dataKey="sampleCount" radius={[4, 4, 0, 0]} barSize={20}>
              {intersections.map((_, index) => (
                <Cell key={`cell-${index}`} fill={isDark ? '#475569' : '#1e293b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Matrix: Set Intersections */}
      <div className="flex">
        {/* Left Side: Toxin Labels with fixed alignment */}
        <div className="w-[110px] flex flex-col gap-4 shrink-0 pt-0.5">
          {allToxins.map(toxin => (
            <div 
              key={toxin} 
              className="text-[10px] font-black text-right pr-6 truncate uppercase tracking-tighter" 
              style={{ color: toxinColors[toxin] || (isDark ? '#94a3b8' : '#475569') }}
            >
              {toxin}
            </div>
          ))}
        </div>

        {/* Right Side: Dot Grid with Row Guideline Stripes */}
        <div className="flex-1 overflow-x-auto custom-scrollbar pb-6 overflow-y-hidden">
          <div className="relative" style={{ minWidth: intersections.length * 32 }}>
            {/* Background stripes for rows */}
            <div className="absolute inset-0 flex flex-col gap-4 pointer-events-none pt-2.5">
              {allToxins.map((_, i) => (
                <div key={i} className="h-[1px] w-full bg-slate-200/40 dark:bg-white/5" />
              ))}
            </div>

            <div className="flex relative z-10" style={{ width: '100%', justifyContent: 'space-around' }}>
              {intersections.map((intersection, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-4 relative items-center w-8">
                  {allToxins.map(toxin => {
                    const isActive = intersection.toxins.includes(toxin);
                    const color = toxinColors[toxin] || (isDark ? '#ffffff' : '#000000');
                    
                    return (
                      <div key={`${colIdx}-${toxin}`} className="relative flex justify-center w-full h-[10px]">
                        {isActive ? (
                          <div 
                            className="w-3.5 h-3.5 rounded-full shadow-sm z-20 border-2 border-white dark:border-slate-900" 
                            style={{ backgroundColor: color }}
                          />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 z-10" />
                        )}
                      </div>
                    );
                  })}

                  {/* Connecting lines for multiple toxins */}
                  {intersection.toxins.length > 1 && (
                    <div 
                      className="absolute w-1 bg-slate-400 dark:bg-slate-600 left-1/2 -translate-x-1/2 z-0 opacity-40 rounded-full"
                      style={{
                        top: `${allToxins.indexOf(intersection.toxins[0]) * 26 + 6}px`,
                        bottom: `${(allToxins.length - 1 - allToxins.indexOf(intersection.toxins[intersection.toxins.length - 1])) * 26 + 10}px`,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
