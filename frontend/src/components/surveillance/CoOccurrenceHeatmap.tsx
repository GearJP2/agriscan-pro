import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Intersection {
  toxins: string[];
  sampleCount: number;
}

interface CoOccurrenceHeatmapProps {
  intersections: Intersection[];
  allToxins: string[];
  toxinColors: Record<string, string>;
  zoom: number;
}

export default function CoOccurrenceHeatmap({ intersections, allToxins, toxinColors, zoom = 1.0 }: CoOccurrenceHeatmapProps) {
  // Calculate the correlation matrix
  // Value = Jaccard Similarity or Co-occurrence probability
  const matrix = useMemo(() => {
    const size = allToxins.length;
    const data = Array(size).fill(0).map(() => Array(size).fill(0));
    
    // Total samples for each toxin individually
    const individualCounts: Record<string, number> = {};
    allToxins.forEach(t => {
      individualCounts[t] = intersections
        .filter(i => i.toxins.includes(t))
        .reduce((acc, curr) => acc + curr.sampleCount, 0);
    });

    allToxins.forEach((t1, i) => {
      allToxins.forEach((t2, j) => {
        if (i === j) {
          data[i][j] = 1; // Self-correlation
          return;
        }

        // Count intersection of T1 and T2
        const sharedCount = intersections
          .filter(inter => inter.toxins.includes(t1) && inter.toxins.includes(t2))
          .reduce((acc, curr) => acc + curr.sampleCount, 0);

        if (sharedCount === 0) {
          data[i][j] = 0;
        } else {
          // Conditional probability: P(T1|T2) or Union-based Jaccard?
          const union = (individualCounts[t1] || 0) + (individualCounts[t2] || 0) - sharedCount;
          data[i][j] = sharedCount / (union || 1);
        }
      });
    });

    return data;
  }, [intersections, allToxins]);

  const getColor = (value: number) => {
    if (value === 0) return 'bg-slate-50 dark:bg-card';
    if (value === 1) return 'bg-slate-900 dark:bg-white text-white dark:text-slate-900';
    if (value > 0.8) return 'bg-red-700 text-white';
    if (value > 0.6) return 'bg-red-500 text-white';
    if (value > 0.4) return 'bg-orange-500 text-white';
    if (value > 0.2) return 'bg-amber-400 text-black';
    if (value > 0.1) return 'bg-teal-400 text-black';
    return 'bg-blue-400 text-black';
  };

  // Base sizes multiplied by zoom factor (Recalibrated: 1.0 is now significantly larger)
  const cellSize = 80 * zoom;
  const labelSize = 13 * zoom;
  const fontSize = 12 * zoom;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 overflow-visible">
      <div className="relative pt-32 pl-32"> {/* Increased padding for larger base scale */}
        <table className="border-collapse">
          <thead>
            <tr>
              <td style={{ width: labelSize * 4 }}></td>
              {allToxins.map(t => (
                <th 
                  key={t} 
                  className="p-1 font-black uppercase tracking-widest text-slate-400 whitespace-nowrap rotate-[-45deg] origin-bottom-left leading-none"
                  style={{ fontSize: labelSize }}
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allToxins.map((t1, i) => (
              <tr key={t1}>
                <th 
                  className="pr-4 font-black uppercase tracking-widest text-slate-400 text-right whitespace-nowrap"
                  style={{ fontSize: labelSize, height: cellSize }}
                >
                  {t1}
                </th>
                {allToxins.map((t2, j) => {
                  const val = matrix[i][j];
                  return (
                    <td key={`${t1}-${t2}`} className="p-0.5">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={cn(
                                "rounded-md transition-all hover:scale-110 hover:z-50 cursor-help flex items-center justify-center font-black shadow-sm",
                                getColor(val)
                              )}
                              style={{ width: cellSize, height: cellSize, fontSize: fontSize }}
                            >
                              {val > 0 && val < 1 ? (val * 100).toFixed(0) : ''}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-slate-900 text-white border-transparent p-4 rounded-2xl shadow-2xl z-[100]">
                            <div className="space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Hazard Correlation</p>
                              <p className="text-sm font-bold text-white">{t1} × {t2}</p>
                              <div className="h-px w-full bg-white/20 my-2" />
                              <p className="text-2xl font-black text-red-400">{(val * 100).toFixed(1)}%</p>
                              <p className="text-[9px] opacity-70 uppercase tracking-widest">Jaccard Index Strength</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="mt-16 flex items-center gap-6 border-t border-border dark:border-white/10 pt-8">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Low Interaction</span>
        <div className="flex gap-2">
          {['#60a5fa', '#2dd4bf', '#fbbf24', '#f97316', '#ef4444', '#b91c1c'].map(c => (
            <div key={c} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">High Interaction</span>
      </div>
    </div>
  );
}
