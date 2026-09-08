import { useState } from 'react';
import ToxinDistributionChart from './ToxinDistributionChart';
import CoOccurrenceNetwork from './CoOccurrenceNetwork';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, ChevronDown, Info } from 'lucide-react';
import type { CoContamSummary, CoOccurrence, NetworkData } from '@/types/dashboard';

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

interface CoContaminationAnalysisProps {
  coContamSummary: CoContamSummary;
  coOccurrenceList: CoOccurrence[];
  toxinsPerSample: { count: string; pct: number }[];
  networkData: NetworkData;
  embedded?: boolean;
}

export default function CoContaminationAnalysis({
  coContamSummary,
  coOccurrenceList,
  toxinsPerSample,
  networkData,
  embedded = false,
}: CoContaminationAnalysisProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const maxCount = Math.max(...coOccurrenceList.map(item => item.sampleCount), 1);

  const subHeader = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gfs-maroon/10 text-gfs-maroon dark:bg-gfs-gold/15 dark:text-gfs-gold">
          <Activity className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white">
            Co-contamination Analysis
          </h3>
          <p className="text-xs font-medium text-gfs-text-muted">Detection Analytics &amp; Hazard Patterns</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        aria-expanded={isExpanded}
        aria-controls="co-contamination-analysis-content"
        className="p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon hover:text-white transition-all border border-gfs-maroon/20 active:scale-90"
        title={isExpanded ? "Collapse Section" : "Expand Section"}
      >
        <ChevronDown className={cn("w-4 h-4 transition-transform duration-500", !isExpanded && "rotate-180")} />
      </button>
    </div>
  );

  const bodyContent = (
    <div className="space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
      {/* 1. Quick Analytics Summary */}
      <div className="space-y-6">
        {/* Key Metrics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gfs-maroon/10 pb-6 border-b border-gfs-maroon/10">
          {[
            { label: 'Avg toxins per positive sample', value: coContamSummary.avgToxinsPerSample.toFixed(1) },
            { label: 'Samples with 2+ toxins', value: `${coContamSummary.pctTwoPlus}%` },
            { label: 'Samples with 3+ toxins', value: `${coContamSummary.pctThreePlus}%` },
          ].map((tile, idx) => (
            <div key={tile.label} className={cn("py-3 md:py-0", idx === 0 ? "md:pr-6" : idx === 2 ? "md:pl-6" : "md:px-6")}>
              <p className="text-3xl font-extrabold tracking-tight mb-1 text-gfs-maroon dark:text-gfs-gold">{tile.value}</p>
              <p className="text-xs font-medium text-gfs-text-muted">
                {tile.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Top Common Patterns Row */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold tracking-tight text-gfs-maroon dark:text-white">Common Co-occurrences</h3>
          <p className="text-xs text-gfs-text-secondary leading-relaxed max-w-4xl font-medium">
            Lists the most frequent combinations of mycotoxins detected in single samples, ordered by prevalence.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {coOccurrenceList.slice(0, 10).map((co, i) => (
            <div
              key={`${co.toxins.join('+')}-${co.sampleCount}`}
              className="bg-gfs-canvas/40 dark:bg-white/5 border border-gfs-maroon/10 rounded-xl p-3.5 space-y-2.5 transition-colors hover:border-gfs-maroon/25"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-gfs-maroon dark:text-gfs-gold px-2 py-0.5 rounded-full bg-gfs-maroon/10 dark:bg-gfs-gold/20 border border-gfs-maroon/15">Rank #{i+1}</span>
                <span className="text-xs font-extrabold text-gfs-maroon dark:text-gfs-gold">{co.pct}%</span>
              </div>
              <div className="text-xs font-semibold text-gfs-text-primary dark:text-white truncate">
                {co.toxins.join(' + ')}
              </div>
              <div className="h-1.5 w-full bg-gfs-thumb/40 dark:bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gfs-maroon dark:bg-gfs-gold rounded-full transition-all duration-1000" style={{ width: `${(co.sampleCount / maxCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Core Analytical Row (Network & Distribution) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Strength */}
        <div className="space-y-3">
          <div className="flex items-center">
            <h3 className="text-sm font-bold tracking-tight text-gfs-maroon dark:text-white">Network Strength Analysis</h3>
            <ChartInfo text="Visualizes the co-occurrence relationships between toxins. The thickness of connections represents the statistical probability and strength of finding these toxins together in the same sample." />
          </div>
          <div className="h-[420px] bg-white dark:bg-slate-900/60 rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 overflow-hidden shadow-sm">
            <CoOccurrenceNetwork networkData={networkData} />
          </div>
        </div>

        {/* Toxin Distribution */}
        <div className="space-y-3">
          <div className="flex items-center">
            <h3 className="text-sm font-bold tracking-tight text-gfs-maroon dark:text-white">Burden Distribution (Toxins per Sample)</h3>
            <ChartInfo text="Illustrates the frequency of multiple mycotoxicosis, showing how many different toxins are present simultaneously in positive samples." />
          </div>
          <div className="h-[420px] bg-white dark:bg-slate-900/60 p-6 rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 shadow-sm">
            <ToxinDistributionChart data={toxinsPerSample} useBarChart />
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <section className="font-sans" aria-label="Co-contamination Analysis">
        {bodyContent}
      </section>
    );
  }

  return (
    <section className="space-y-6 font-sans" aria-label="Co-contamination Analysis">
      <Card className="border border-gfs-maroon/15 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900/80 rounded-gfs-card shadow-gfs-card">
        <CardHeader className="pb-4 px-6 pt-5 bg-white dark:bg-slate-900 border-b border-gfs-maroon/10 dark:border-white/10">
          {subHeader}
        </CardHeader>

        {isExpanded && (
          <CardContent id="co-contamination-analysis-content" className="px-6 pb-8 pt-6 space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
            {bodyContent}
          </CardContent>
        )}
      </Card>
    </section>
  );
}
