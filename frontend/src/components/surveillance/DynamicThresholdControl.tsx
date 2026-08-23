import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, AlertCircle, Info } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '@/lib/utils';
import { MYCOTOXIN_REGISTRY } from '@/constants/mycotoxins';

interface DynamicThresholdControlProps {
  onOverridesChange: (overrides: Record<string, Record<string, number>>) => void;
  commodityOptions: string[];
}

const TOXIN_METADATA = MYCOTOXIN_REGISTRY;

const ACTIVE_TOXINS = Object.keys(TOXIN_METADATA);

export default function DynamicThresholdControl({ onOverridesChange, commodityOptions }: DynamicThresholdControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});
  const isSimulating = Object.keys(overrides).length > 0;
  const debouncedOverrides = useDebounce(overrides, 500);

  useEffect(() => {
    onOverridesChange(debouncedOverrides);
  }, [debouncedOverrides, onOverridesChange]);

  const handleSliderChange = (toxin: string, variety: string, value: number) => {
    setOverrides(prev => ({
      ...prev,
      [toxin]: {
        ...prev[toxin],
        [variety]: value
      }
    }));
  };

  const handleReset = () => {
    setOverrides({});
  };

  const targetCommodity = commodityOptions.length > 0 ? commodityOptions[0] : 'maize';

  if (!isOpen) {
    return (
      <div 
        className="flex items-center justify-between bg-card dark:bg-card backdrop-blur-xl border-2 border-border dark:border-white/10 px-6 py-4 rounded-2xl group transition-all duration-300 hover:border-primary/30 cursor-pointer animate-in fade-in slide-in-from-bottom-2 shadow-none"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter px-1 font-sans">Threshold Controller</span>
        </div>
        
        <div 
          className="p-2 rounded-xl bg-card dark:bg-white/10 text-slate-600 dark:text-white transition-all border border-slate-200 dark:border-white/10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary shadow-none"
        >
          <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-[1] w-full">
      <Card className="w-full glass-card border-2 border-border dark:border-border/50 bg-card dark:bg-card relative overflow-hidden animate-in fade-in slide-in-from-top-8 duration-500 ease-out rounded-2xl shadow-none">
        <CardContent className="p-0">
          {/* Header Section */}
          <div className="flex justify-between items-center bg-card dark:bg-card backdrop-blur-md p-5 px-6 border-b border-border/40">
            <div className="font-sans">
              <h3 className="font-black text-xl tracking-tight text-slate-900 dark:text-white font-sans">Threshold Controller</h3>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  const zeroOverrides: Record<string, Record<string, number>> = {};
                  ACTIVE_TOXINS.forEach(toxin => {
                    zeroOverrides[toxin] = { [targetCommodity]: 0 };
                  });
                  setOverrides(zeroOverrides);
                }}
                className="text-xs font-black text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 px-4 py-2 rounded-xl transition-all tracking-normal border border-amber-200 dark:border-amber-500/30"
              >
                Set All to 0
              </button>
              {isSimulating && (
                <button
                  onClick={handleReset}
                  className="text-xs font-black text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-4 py-2 rounded-xl transition-all tracking-normal border border-rose-200 dark:border-rose-500/30"
                >
                  Reset System
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white transition-all active:scale-90 border border-slate-300 dark:border-white/20 hover:bg-slate-300 dark:hover:bg-white/20"
                title="Minimize Simulator"
              >
                <ChevronUp className="w-5 h-5 transition-transform hover:-translate-y-0.5" />
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-transparent">
            {/* Grid Section */}
            <div className="p-6 pt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-h-[65vh] overflow-y-auto pr-4 mr-1 custom-scrollbar scroll-py-6">
                {ACTIVE_TOXINS.map((toxin, index) => {
                  const meta = TOXIN_METADATA[toxin];
                  const val = overrides[toxin]?.[targetCommodity] ?? meta.defaultThreshold;
                  const isFloat = toxin === 'AFM1';
                  const isOverridden = overrides[toxin]?.[targetCommodity] !== undefined;

                  return (
                    <div 
                      className={cn(
                        "space-y-4 p-5 rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-3 duration-500",
                        isOverridden
                          ? "bg-transparent border-primary/40 border-2"
                          : "bg-transparent border-slate-200/50 dark:border-border/50 hover:border-primary/40"
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="space-y-2">
                        <Badge 
                          variant="outline"
                          className={cn(
                            "font-black text-xs px-4 py-2.5 tracking-widest rounded-xl w-full justify-center border h-10 cursor-default",
                            isOverridden 
                              ? "bg-primary text-primary-foreground border-primary/20" 
                              : meta.isUncertain 
                                ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800/40" 
                                : "bg-muted dark:bg-white/5 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-800"
                          )}
                        >
                          {toxin}
                        </Badge>
                        <div className="flex items-center gap-1">
                          {!meta.isUncertain && (
                            <span className="text-[9px] text-slate-400 dark:text-white/40 font-black tracking-widest flex items-center gap-1.5">
                              <Info className="w-2.5 h-2.5" /> {meta.source}
                            </span>
                          )}
                          {meta.isUncertain && (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5 text-rose-500 dark:text-rose-400" />
                              <span className="text-[9px] text-rose-500 dark:text-rose-400 font-black tracking-tight">
                                No official Threshholds
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="relative">
                        <Input
                          type="number"
                          value={val}
                          step={isFloat ? "0.1" : "1"}
                          min="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleSliderChange(toxin, targetCommodity, parseFloat(e.target.value) || 0)}
                          className={cn(
                            "h-12 bg-muted/20 dark:bg-black/40 border border-slate-300 dark:border-white/20 font-mono text-lg font-black px-4 pr-12 rounded-xl focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0",
                            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          )}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <span className="text-[10px] font-black text-slate-400 dark:text-white/40 tracking-normal">ppb</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 px-8 bg-muted/30 dark:bg-muted/10 border-t border-border/40 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-3 h-3 rounded-full border border-slate-900/20 dark:border-white/20",
                  isSimulating
                    ? "bg-amber-500 animate-pulse"
                    : "bg-emerald-500"
                )} />
                <span className="text-[11px] font-black text-slate-600 dark:text-white/70 tracking-normal">
                  {isSimulating ? 'Custom Simulation Active' : 'System Standard Compliance'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-white/30 font-bold italic tracking-wide">
                AgriScan Intelligence Inference Engine
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
