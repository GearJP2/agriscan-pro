import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '@/lib/utils';
import { MYCOTOXIN_REGISTRY } from '@/constants/mycotoxins';

interface DynamicThresholdControlProps {
  onOverridesChange: (overrides: Record<string, Record<string, number>>) => void;
  commodityOptions: string[];
}

const TOXIN_METADATA = MYCOTOXIN_REGISTRY;

// Only toxins with a verified default threshold can be simulated.
const ACTIVE_TOXINS = Object.entries(TOXIN_METADATA)
  .filter(([, metadata]) => !metadata.isUncertain)
  .map(([toxin]) => toxin);

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
      <button
        type="button"
        aria-expanded={false}
        aria-controls="threshold-controller-content"
        className="flex w-full items-center justify-between bg-white dark:bg-slate-900/80 border border-gfs-maroon/15 dark:border-white/10 px-6 py-4 rounded-gfs-card group transition-all duration-300 hover:border-gfs-maroon/40 cursor-pointer shadow-gfs-card text-left"
        onClick={() => setIsOpen(true)}
      >
        <span className="flex items-center gap-3">
          <span className="text-lg font-bold text-gfs-maroon dark:text-white tracking-tight px-1 font-sans">Threshold Controller</span>
        </span>
        
        <span
          className="p-2 rounded-xl bg-gfs-maroon/10 dark:bg-white/10 text-gfs-maroon dark:text-white transition-all border border-gfs-maroon/20 group-hover:bg-gfs-maroon group-hover:text-white group-hover:border-gfs-maroon shadow-none"
        >
          <ChevronDown className="w-4 h-4 transition-transform group-hover:translate-y-0.5" />
        </span>
      </button>
    );
  }

  return (
    <div className="relative z-[1] w-full">
      <Card className="w-full bg-white dark:bg-slate-900/80 border border-gfs-maroon/15 dark:border-white/10 relative overflow-hidden animate-in fade-in slide-in-from-top-8 duration-500 ease-out rounded-gfs-card shadow-gfs-card">
        <CardContent className="p-0">
          {/* Header Section */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-5 px-6 border-b border-gfs-maroon/10 dark:border-white/10">
            <div className="font-sans">
              <h3 className="font-bold text-xl tracking-tight text-gfs-maroon dark:text-white font-sans">Threshold Controller</h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  const zeroOverrides: Record<string, Record<string, number>> = {};
                  ACTIVE_TOXINS.forEach(toxin => {
                    zeroOverrides[toxin] = { [targetCommodity]: 0 };
                  });
                  setOverrides(zeroOverrides);
                }}
                className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:bg-amber-100 bg-amber-50 dark:hover:bg-amber-950/50 dark:bg-amber-950/30 px-3.5 py-1.5 rounded-full transition-all tracking-normal border border-amber-300 dark:border-amber-700/40"
              >
                Set All to 0
              </button>
              {isSimulating && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-bold text-gfs-maroon dark:text-red-300 hover:bg-gfs-maroon hover:text-white bg-gfs-maroon/10 dark:bg-red-950/30 px-3.5 py-1.5 rounded-full transition-all tracking-normal border border-gfs-maroon/30 dark:border-red-800/40"
                >
                  Reset System
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-expanded={isOpen}
                aria-label="Minimize threshold simulator"
                aria-controls="threshold-controller-content"
                className="p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-white transition-all active:scale-90 border border-gfs-maroon/20 dark:border-white/20 hover:bg-gfs-maroon hover:text-white"
                title="Minimize Simulator"
              >
                <ChevronUp className="w-4 h-4 transition-transform hover:-translate-y-0.5" />
              </button>
            </div>
          </div>

          <div id="threshold-controller-content" className="bg-white dark:bg-transparent">
            {/* Grid Section */}
            <div className="p-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto pr-3 mr-1 custom-scrollbar scroll-py-6">
                {ACTIVE_TOXINS.map((toxin, index) => {
                  const meta = TOXIN_METADATA[toxin];
                  const val = overrides[toxin]?.[targetCommodity] ?? meta.defaultThreshold;
                  const isFloat = toxin === 'AFM1';
                  const isOverridden = overrides[toxin]?.[targetCommodity] !== undefined;

                  return (
                    <div 
                      key={toxin}
                      className={cn(
                        "p-3.5 rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-2 duration-300",
                        isOverridden
                          ? "bg-gfs-maroon/5 border-gfs-maroon"
                          : "bg-gfs-canvas/30 dark:bg-white/5 border-gfs-maroon/10 hover:border-gfs-maroon/30"
                      )}
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-extrabold text-sm text-gfs-text-primary dark:text-white tracking-tight">
                          {toxin}
                        </span>
                        {!meta.isUncertain && (
                          <span className="text-[10px] text-gfs-text-muted font-medium">
                            {meta.source}
                          </span>
                        )}
                        {meta.isUncertain && (
                          <span className="text-[10px] text-gfs-maroon dark:text-red-400 font-bold flex items-center gap-1">
                            <AlertCircle className="w-2.5 h-2.5" /> No official limit
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <Input
                          type="number"
                          aria-label={`${toxin} threshold in ppb`}
                          value={val}
                          step={isFloat ? "0.1" : "1"}
                          min="0"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => handleSliderChange(toxin, targetCommodity, parseFloat(e.target.value) || 0)}
                          className={cn(
                            "h-10 bg-white dark:bg-black/40 border border-gfs-maroon/20 dark:border-white/20 font-mono text-base font-bold px-3 pr-10 rounded-xl focus-visible:outline-none focus-visible:border-gfs-maroon focus-visible:ring-1 focus-visible:ring-gfs-gold",
                            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          )}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <span className="text-[10px] font-bold text-gfs-text-muted tracking-normal">ppb</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 px-6 bg-gfs-canvas/80 dark:bg-muted/10 border-t border-gfs-maroon/10 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  isSimulating
                    ? "bg-gfs-gold animate-pulse"
                    : "bg-emerald-500"
                )} />
                <span className="text-xs font-bold text-gfs-text-primary dark:text-white/80 tracking-normal">
                  {isSimulating ? 'Custom Simulation Active' : 'System Standard Compliance'}
                </span>
              </div>
              <p className="text-[10px] text-gfs-text-muted font-semibold italic tracking-wide">
                AgriScan Intelligence Inference Engine
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
