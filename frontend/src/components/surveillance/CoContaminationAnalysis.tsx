import { useState, useMemo } from 'react';
import ToxinDistributionChart from './ToxinDistributionChart';
import CoOccurrenceNetwork from './CoOccurrenceNetwork';
import CoOccurrenceHeatmap from './CoOccurrenceHeatmap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { ChevronDown, Share2, Network, ListOrdered, BarChart3, Grid3X3, Activity, Filter, Info } from 'lucide-react';

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

interface Intersection {
  toxins: string[];
  sampleCount: number;
  pct: number;
}

interface CoContamSummary {
  avgToxinsPerSample: number;
  pctTwoPlus: number;
  pctThreePlus: number;
  mostCommonPair: string;
}

interface CoContaminationAnalysisProps {
  coContamSummary: CoContamSummary;
  coOccurrenceList: Intersection[];
  toxinsPerSample: { count: string; pct: number }[];
  toxinColors: Record<string, string>;
  intersections: Intersection[];
}

function ToxinSelector({ 
  allToxins, 
  selectedToxins, 
  onToggle, 
  toxinColors 
}: { 
  allToxins: string[], 
  selectedToxins: string[], 
  onToggle: (t: string) => void,
  toxinColors: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-2 p-1">
      {allToxins.map(toxin => {
        const isSelected = selectedToxins.includes(toxin);
        const color = toxinColors[toxin] || '#6b7280';
        return (
          <button
            key={toxin}
            onClick={() => onToggle(toxin)}
            className={cn(
              "flex items-center justify-between px-4 py-2.5 rounded-xl border text-[10px] font-black tracking-normal transition-all",
              isSelected 
                ? "bg-white dark:bg-muted border-slate-900 shadow-sm opacity-100" 
                : "bg-card dark:bg-white/5 border-transparent opacity-40 grayscale"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className={cn(
                "transition-colors",
                isSelected ? "text-slate-900 dark:text-white" : "text-slate-400"
              )}>
                {toxin}
              </span>
            </div>
            {isSelected && <div className="w-1 h-1 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

export default function CoContaminationAnalysis({
  coContamSummary,
  coOccurrenceList,
  toxinsPerSample,
  intersections,
  toxinColors,
}: CoContaminationAnalysisProps) {
  const { resolvedTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  const MASTER_TOXINS = ['AFB1', 'DON', 'FB1', 'ZEA', 'OTA', 'T-2', 'AFG1', 'AFG2', 'AFM1'];
  
  // State for selective matrix
  const [selectedToxins, setSelectedToxins] = useState<string[]>(MASTER_TOXINS);
  const [matrixZoom, setMatrixZoom] = useState(1.0);

  const toggleToxin = (t: string) => {
    setSelectedToxins(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // Global Network Data
  const networkData = useMemo(() => {
    interface Node {
      id: string;
      frequency: number;
      color: string;
    }
    interface Link {
      source: string;
      target: string;
      value: number;
    }

    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeMap = new Map<string, Node>();

    intersections.forEach(inter => {
      // Only process toxins that are currently selected
      const filteredToxins = inter.toxins.filter(t => selectedToxins.includes(t));
      if (filteredToxins.length < 1) return;

      filteredToxins.forEach(t => {
        if (!nodeMap.has(t)) {
          const count = intersections
            .filter(i => i.toxins.includes(t) && i.toxins.every(it => selectedToxins.includes(it)))
            .reduce((acc, curr) => acc + curr.sampleCount, 0);
          
          const node: Node = { id: t, frequency: count, color: toxinColors[t] || '#6b7280' };
          nodeMap.set(t, node);
          nodes.push(node);
        }
      });

      if (filteredToxins.length === 2) {
        links.push({ 
          source: filteredToxins[0], 
          target: filteredToxins[1], 
          value: inter.sampleCount 
        });
      }
    });
    return { nodes, links };
  }, [intersections, toxinColors, selectedToxins]);

  const summaryTiles = [
    { label: 'Avg toxins per positive sample', value: coContamSummary.avgToxinsPerSample.toFixed(1), icon: Network, tint: 'bg-blue-500/5 text-blue-600 border-blue-500/20' },
    { label: 'Samples with 2+ toxins', value: `${coContamSummary.pctTwoPlus}%`, icon: Share2, tint: 'bg-amber-500/5 text-amber-600 border-amber-500/20' },
    { label: 'Samples with 3+ toxins', value: `${coContamSummary.pctThreePlus}%`, icon: ListOrdered, tint: 'bg-red-500/5 text-red-600 border-red-500/20' },
    { label: 'Most common co-occurrence', value: coContamSummary.mostCommonPair, icon: BarChart3, tint: 'bg-purple-500/5 text-purple-600 border-purple-500/20' },
  ];

  const maxCount = Math.max(...coOccurrenceList.map(item => item.sampleCount), 1);

  return (
    <div className="space-y-6" aria-label="Co-contamination Analysis">
      {/* Section Divider */}
      <div className="flex items-center gap-3 mb-4 mt-12">
        <div className="h-5 w-1.5 bg-primary/40 rounded-full"></div>
        <h2 className="text-sm font-black tracking-normal text-slate-500 dark:text-white/60">Analytics & Trends</h2>
      </div>

      <Card className="glass-card border-2 border-border dark:border-white/10 overflow-hidden shadow-none bg-card dark:bg-card">
        <CardHeader className="pb-4 px-6 pt-6 bg-slate-100/30 dark:bg-card border-b border-border/5 shadow-none">
           <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Activity className="w-6 h-6 text-primary" />
              <div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  Co-contamination Analysis
                </CardTitle>
                <p className="text-[11px] font-bold text-slate-400 tracking-normal">Detection Analytics & Hazard Patterns</p>
              </div>
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-3 rounded-2xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all border border-border/40 active:scale-90"
            >
              <ChevronDown className={cn("w-6 h-6 transition-transform duration-500", !isExpanded && "rotate-180")} />
            </button>
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="px-6 pb-8 pt-8 space-y-12 animate-in fade-in slide-in-from-top-2 duration-500">
            
            {/* 1. Quick Analytics Summary */}
            <div className="space-y-6">
              {/* Most Common Highlight Card (Top) */}
              <div className="bg-card dark:bg-card rounded-2xl p-8 border-2 border-border dark:border-border/50 flex flex-col md:flex-row items-center justify-between gap-8 group transition-all duration-500 shadow-none">
                <div className="text-center md:text-left space-y-1">
                  <h4 className="text-[13px] font-black tracking-normal text-slate-500 dark:text-white/50">Most Frequent Pathogenic Cluster</h4>
                  <p className="text-base font-black text-slate-900 dark:text-white tracking-tight">Co-occurrence pattern signature</p>
                </div>
                
                <div className="flex flex-wrap justify-center md:justify-end gap-3 max-w-2xl">
                  {coContamSummary.mostCommonPair.split('+').map((t, idx) => {
                    const toxin = t.trim();
                    const color = toxinColors[toxin] || '#6b7280';
                    return (
                      <div 
                        key={idx} 
                        className="px-5 py-2.5 rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900 group-hover:scale-105 transition-all duration-500 shadow-none"
                        style={{ borderColor: color + '30' }}
                      >
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-[11px] font-black text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white tracking-normal">{toxin}</span>
                      </div>
                    );
                  })}
                  {coContamSummary.mostCommonPair === 'None' && (
                    <span className="text-sm font-bold text-white/30 italic">No active clusters detected</span>
                  )}
                </div>
              </div>

              {/* Secondary Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Avg toxins per positive sample', value: coContamSummary.avgToxinsPerSample.toFixed(1), color: 'text-blue-600', bg: 'bg-blue-50/30', border: 'border-blue-200' },
                  { label: 'Samples with 2+ toxins', value: `${coContamSummary.pctTwoPlus}%`, color: 'text-amber-600', bg: 'bg-amber-50/30', border: 'border-amber-200' },
                  { label: 'Samples with 3+ toxins', value: `${coContamSummary.pctThreePlus}%`, color: 'text-red-600', bg: 'bg-red-50/30', border: 'border-red-200' },
                ].map((tile) => (
                  <div key={tile.label} className={cn("rounded-2xl p-10 border-2 bg-card dark:bg-card transition-all hover:border-slate-900 group shadow-none", tile.border)}>
                    <p className={cn("text-5xl font-black tracking-tight mb-3", tile.color)}>{tile.value}</p>
                    <p className="text-[12px] font-black tracking-normal text-slate-500 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                      {tile.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Top Common Patterns Row */}
            <div className="space-y-5">
              <div className="space-y-2">
                <h3 className="text-[13px] font-black tracking-normal text-slate-900 dark:text-white">Common Co-occurrences</h3>
                <p className="text-[11px] text-slate-900 dark:text-white/80 font-medium leading-relaxed max-w-4xl">
                  Lists the most frequent combinations of mycotoxins detected in single samples, ordered by prevalence. These patterns identify key multiple-hazard clusters in the supply chain.
                </p>
              </div>
              <div className="flex flex-wrap gap-6">
                {coOccurrenceList.slice(0, 10).map((co, i) => (
                  <div 
                    key={i} 
                    className="flex-grow flex-shrink-0 basis-full sm:basis-[calc(50%-1.5rem)] md:basis-[calc(33.333%-1.5rem)] xl:basis-[calc(20%-1.5rem)] min-w-[260px] bg-card dark:bg-card border-2 border-border dark:border-white/10 rounded-2xl p-8 space-y-5 hover:border-teal-500/50 transition-all group shadow-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-teal-600 px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-900/20 tracking-normal border border-teal-600/20">Rank #{i+1}</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">{co.pct}%</span>
                    </div>
                    <div className="text-[12px] font-black tracking-tight text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors leading-tight min-h-[2.5rem] flex items-center">
                      {co.toxins.join(' + ')}
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-600 rounded-full transition-all duration-1000" style={{ width: `${(co.sampleCount / maxCount) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Core Analytical Row (Network & Distribution) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              {/* Network Strength */}
              <div className="space-y-5">
                <div className="flex items-center">
                  <h3 className="text-[13px] font-black tracking-normal text-slate-900 dark:text-white">Network Strength Analysis</h3>
                  <ChartInfo text="Visualizes the co-occurrence relationships between toxins. The thickness of connections represents the statistical probability and strength of finding these toxins together in the same sample." />
                </div>
                <div className="h-[420px] bg-card dark:bg-card rounded-2xl border-2 border-border dark:border-white/10 overflow-hidden shadow-none">
                  <CoOccurrenceNetwork networkData={networkData} />
                </div>
              </div>

              {/* Toxin Distribution */}
              <div className="space-y-5">
                <div className="flex items-center">
                  <h3 className="text-[13px] font-black tracking-normal text-slate-900 dark:text-white">Burden Distribution (Toxins per Sample)</h3>
                  <ChartInfo text="Illustrates the frequency of multiple mycotoxicosis, showing how many different toxins are present simultaneously in positive samples." />
                </div>
                <div className="h-[420px] bg-card dark:bg-card p-10 rounded-2xl border-2 border-border dark:border-white/10 shadow-none">
                  <ToxinDistributionChart data={toxinsPerSample} useBarChart />
                </div>
              </div>
            </div>

            {/* 4. Matrix Workspace (Correlation Matrix + Selector) - Temporarily hidden
            <div className="space-y-6 pt-6">
              <div className="space-y-2">
                <h3 className="text-[13px] font-black tracking-normal text-slate-900 dark:text-white">Conditional Probability Matrix Workspace</h3>
                <p className="text-[11px] text-slate-900 dark:text-white/80 font-medium leading-relaxed max-w-5xl">
                  A dynamic workspace showing the probability of detecting 'Toxin A' given the presence of 'Toxin B'. This matrix pinpoints critical hazardous cross-linkages. Use the sidebar to focus on specific toxins.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-10 bg-slate-100/30 dark:bg-slate-900/20 p-12 rounded-2xl border-2 border-border dark:border-white/10 shadow-none">
                <div className="min-h-[500px] bg-card dark:bg-card rounded-2xl border-2 border-border dark:border-white/10 flex items-center justify-center p-10 overflow-auto custom-scrollbar shadow-none">
                  <CoOccurrenceHeatmap 
                    intersections={intersections} 
                    allToxins={selectedToxins} 
                    toxinColors={toxinColors} 
                    zoom={matrixZoom}
                  />
                </div>

                <div className="space-y-6">
                    <div className="bg-card dark:bg-card p-6 rounded-2xl border-2 border-border dark:border-white/10 space-y-4 shadow-none">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black tracking-normal text-slate-400">Matrix Zoom</span>
                        <span className="text-[10px] font-black text-slate-900 dark:text-white">{(matrixZoom * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.2" 
                        max="2.0" 
                        step="0.1" 
                        value={matrixZoom}
                        onChange={(e) => setMatrixZoom(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                      />
                    </div>

                   <div className="bg-card dark:bg-card p-6 rounded-2xl border-2 border-border dark:border-white/10 shadow-none">
                    <ToxinSelector 
                      allToxins={MASTER_TOXINS} 
                      selectedToxins={selectedToxins} 
                      onToggle={toggleToxin} 
                      toxinColors={toxinColors} 
                    />
                   </div>
                </div>
              </div>
            </div> */}

          </CardContent>
        )}
      </Card>
    </div>
  );
}
