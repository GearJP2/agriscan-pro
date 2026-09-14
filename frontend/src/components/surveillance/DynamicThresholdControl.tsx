import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RotateCcw,
  Search,
  X,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '@/lib/utils';
import { useMycotoxinRegistry } from '@/hooks/useMycotoxinRegistry';

interface DynamicThresholdControlProps {
  onOverridesChange: (overrides: Record<string, Record<string, number>>) => void;
  commodityOptions: string[];
}

export default function DynamicThresholdControl({ onOverridesChange, commodityOptions }: DynamicThresholdControlProps) {
  const { data: registry, isPending, isError, refetch } = useMycotoxinRegistry();
  const activeToxins = useMemo(() => Object.entries(registry ?? {})
    .filter(([, meta]) => !meta.isUncertain && meta.defaultThreshold !== null), [registry]);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [overrides, setOverrides] = useState<Record<string, Record<string, number>>>({});

  // ponytail: discard removed toxin overrides using the current server catalog.
  const validOverrides = useMemo(() => Object.fromEntries(Object.entries(overrides)
    .filter(([code]) => activeToxins.some(([active]) => active === code))), [overrides, activeToxins]);
  const targetCommodity = commodityOptions.length > 0 ? commodityOptions[0] : 'maize';

  const overriddenCount = useMemo(() => {
    return Object.keys(validOverrides).filter(code => validOverrides[code]?.[targetCommodity] !== undefined).length;
  }, [validOverrides, targetCommodity]);

  const isSimulating = overriddenCount > 0;
  const debouncedOverrides = useDebounce(validOverrides, 500);

  useEffect(() => {
    setOverrides(current => Object.keys(current).some(code => !activeToxins.some(([active]) => active === code))
      ? Object.fromEntries(Object.entries(current).filter(([code]) => activeToxins.some(([active]) => active === code)))
      : current);
  }, [activeToxins]);

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

  const filteredToxins = useMemo(() => {
    if (!searchQuery.trim()) return activeToxins;
    const query = searchQuery.toLowerCase().trim();
    return activeToxins.filter(([code, meta]) => {
      const codeMatch = code.toLowerCase().includes(query);
      const nameMatch = meta.name ? meta.name.toLowerCase().includes(query) : false;
      return codeMatch || nameMatch;
    });
  }, [activeToxins, searchQuery]);

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-expanded={false}
        aria-controls="threshold-controller-content"
        className="flex w-full items-center justify-between bg-white dark:bg-slate-900/80 border border-gfs-maroon/20 dark:border-white/10 px-6 py-4 rounded-gfs-card group transition-all duration-300 hover:border-gfs-maroon/50 hover:shadow-md cursor-pointer shadow-gfs-card text-left"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gfs-maroon/10 dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gfs-maroon dark:text-white tracking-tight font-sans">
                Mycotoxin Threshold Controller
              </span>
              {isSimulating && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-xs border border-amber-300 dark:border-amber-800">
                  {overriddenCount} modified
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Simulate and test safety thresholds for {targetCommodity} ({activeToxins.length} regulated toxins)
            </p>
          </div>
        </div>
        
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 px-6 border-b border-gfs-maroon/10 dark:border-white/10">
            <div className="font-sans">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-gfs-maroon dark:text-gfs-gold" />
                <h3 className="font-bold text-xl tracking-tight text-gfs-maroon dark:text-white font-sans">
                  Threshold Controller
                </h3>
                {isSimulating && (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/50 font-bold text-xs">
                    {overriddenCount} modified
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulate commodity-specific safety thresholds for <strong>{targetCommodity}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Reset Button */}
              {isSimulating && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 text-xs font-semibold gap-1.5 text-gfs-maroon border-gfs-maroon/30 hover:bg-gfs-maroon hover:text-white dark:text-red-300 dark:border-red-800/50 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset All ({overriddenCount})
                </Button>
              )}

              {/* Set All to 0 - Secondary low emphasis with scope explanation */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  const zeroOverrides: Record<string, Record<string, number>> = {};
                  activeToxins.forEach(([toxin]) => {
                    zeroOverrides[toxin] = { [targetCommodity]: 0 };
                  });
                  setOverrides(zeroOverrides);
                }}
                title={`Set to 0 only for regulated toxins (${activeToxins.length} toxins for ${targetCommodity})`}
                className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted font-normal rounded-lg"
              >
                Set all to 0 <span className="opacity-70 text-[10px] ml-1">({activeToxins.length} toxins)</span>
              </Button>

              {/* Minimize Trigger */}
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

          {/* Search bar for filtering toxins in controller */}
          <div className="p-3 px-6 bg-gfs-canvas/40 dark:bg-slate-900/50 border-b border-gfs-maroon/10 dark:border-white/10 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search code or toxin name..."
                className="pl-9 pr-8 h-8 text-xs bg-white dark:bg-slate-900 border-gfs-maroon/20 rounded-lg"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              Showing {filteredToxins.length} of {activeToxins.length} regulated toxins
            </span>
          </div>

          <div id="threshold-controller-content" className="bg-white dark:bg-transparent">
            {isPending && (
              <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground" role="status">
                <RefreshCw className="w-4 h-4 animate-spin text-gfs-maroon dark:text-gfs-gold" />
                <span>Loading toxin thresholds from system...</span>
              </div>
            )}

            {isError && (
              <div className="p-6 flex items-center justify-between text-sm text-destructive" role="alert">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>Unable to load toxin thresholds</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void refetch()}
                  className="gap-1.5 h-8 text-xs font-medium"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            )}

            {registry && activeToxins.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground text-center" role="status">
                No regulated toxin thresholds are currently available in the system
              </p>
            )}

            {registry && activeToxins.length > 0 && filteredToxins.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No toxins found matching "{searchQuery}"
              </div>
            )}

            {/* Grid Section */}
            {filteredToxins.length > 0 && (
              <div className="p-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[65vh] overflow-y-auto pr-3 mr-1 custom-scrollbar scroll-py-6">
                  {filteredToxins.map(([toxin, meta], index) => {
                    const val = validOverrides[toxin]?.[targetCommodity] ?? meta.defaultThreshold ?? 0;
                    const isOverridden = validOverrides[toxin]?.[targetCommodity] !== undefined;

                    return (
                      <div
                        key={toxin}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all animate-in fade-in slide-in-from-bottom-2 duration-300",
                          isOverridden
                            ? "bg-gfs-maroon/5 border-gfs-maroon dark:border-gfs-gold/80"
                            : "bg-gfs-canvas/30 dark:bg-white/5 border-gfs-maroon/10 hover:border-gfs-maroon/30"
                        )}
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-sm text-gfs-text-primary dark:text-white tracking-tight">
                              {toxin}
                            </span>
                            {meta.name && meta.name !== toxin && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {meta.name}
                              </span>
                            )}
                          </div>
                          {!meta.isUncertain && (
                            <span className="text-[10px] text-gfs-text-muted font-medium">
                              {meta.source}
                            </span>
                          )}
                          {meta.isUncertain && (
                            <span className="text-[10px] text-gfs-maroon dark:text-red-400 font-bold flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" /> No regulated threshold
                            </span>
                          )}
                        </div>

                        <div className="relative">
                          <Input
                            type="number"
                            aria-label={`${toxin} threshold in ${meta.unit}`}
                            value={val}
                            step="any"
                            min="0"
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleSliderChange(toxin, targetCommodity, parseFloat(e.target.value) || 0)}
                            className={cn(
                              "h-10 bg-white dark:bg-black/40 border border-gfs-maroon/20 dark:border-white/20 font-mono text-base font-bold px-3 pr-12 rounded-xl focus-visible:outline-none focus-visible:border-gfs-maroon focus-visible:ring-1 focus-visible:ring-gfs-gold",
                              "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            )}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <span className="text-[10px] font-bold text-gfs-text-muted tracking-normal">{meta.unit}</span>
                          </div>
                        </div>

                        {isOverridden && (
                          <div className="mt-1.5 flex items-center justify-between text-[10px]">
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              Standard: {meta.defaultThreshold} {meta.unit}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setOverrides(prev => {
                                  const updated = { ...prev };
                                  if (updated[toxin]) {
                                    delete updated[toxin][targetCommodity];
                                    if (Object.keys(updated[toxin]).length === 0) {
                                      delete updated[toxin];
                                    }
                                  }
                                  return updated;
                                });
                              }}
                              className="text-gfs-maroon hover:underline dark:text-red-300"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-4 px-6 bg-gfs-canvas/80 dark:bg-muted/10 border-t border-gfs-maroon/10 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  isSimulating
                    ? "bg-gfs-gold animate-pulse"
                    : "bg-emerald-500"
                )} />
                <span className="text-xs font-bold text-gfs-text-primary dark:text-white/80 tracking-normal">
                  {isSimulating ? `Custom Simulation Active (${overriddenCount} toxins modified)` : 'Using Regulatory Standard Thresholds (Standard Compliance)'}
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
