import { useState, useRef, useEffect } from 'react';
import type { DashboardFilters } from '@/types/dashboard';
import { Calendar as CalendarIcon, ChevronDown, X, Filter, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
    filters: DashboardFilters;
    onChange: (filters: DashboardFilters) => void;
    commodityOptions: string[];
    regionOptions: string[];
    quarterOptions: string[];
}

function MultiSelect({
    label,
    options,
    selected,
    onToggle,
}: {
    label: string;
    options: string[];
    selected: string[];
    onToggle: (opt: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black tracking-normal transition-all duration-300 border font-sans",
                    selected.length > 0
                        ? "bg-transparent border-primary text-primary shadow-sm shadow-primary/5"
                        : "bg-muted/50 border-border/40 text-muted-foreground hover:bg-accent hover:border-border"
                )}
                aria-label={`Filter by ${label}`}
            >
                {selected.length > 0 && (
                    <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                )}
                {label}
                {selected.length > 0 && (
                    <span className="ml-1 opacity-60">({selected.length})</span>
                )}
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute top-full mt-2 right-0 w-60 bg-white dark:bg-slate-900 border border-border/40 rounded-2xl shadow-2xl z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 font-sans">
                    {options.map((opt) => {
                        const isSelected = selected.includes(opt);
                        return (
                            <button
                                key={opt}
                                onClick={() => onToggle(opt)}
                                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${isSelected ? 'text-warning bg-warning/10' : 'text-popover-foreground hover:bg-accent'
                                    }`}
                            >
                                <span className={`inline-block w-3 h-3 mr-2 rounded border ${isSelected ? 'bg-warning border-warning' : 'border-border'
                                    }`} />
                                {opt}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function SingleSelect({
    label,
    options,
    selected,
    onSelect,
}: {
    label: string;
    options: string[];
    selected: string;
    onSelect: (opt: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black tracking-normal transition-all duration-300 border font-sans",
                    "bg-muted/50 border-border/40 text-muted-foreground hover:bg-accent hover:border-border"
                )}
            >
                <span>{selected || label}</span>
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-300", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-slate-900 border border-border/40 rounded-2xl shadow-2xl z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 font-sans">
                    {options.map((opt) => (
                        <button
                            key={opt}
                            onClick={() => {
                                onSelect(opt);
                                setOpen(false);
                            }}
                            className={cn(
                                "w-full text-left px-4 py-2 text-[11px] font-bold tracking-normal transition-all",
                                selected === opt ? "text-primary bg-transparent border-l-2 border-primary font-black" : "text-slate-600 dark:text-slate-300 hover:bg-accent"
                            )}
                        >
                            {opt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function DashboardFilterBar({ filters, onChange, commodityOptions, regionOptions, quarterOptions }: Props) {
    const [isStuck, setIsStuck] = useState(false);
    const observerRef = useRef<HTMLDivElement>(null);

    const toggleItem = (list: string[], item: string) =>
        list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

    useEffect(() => {
        // Intersection Observer to detect if stuck against header
        // Header bottom is approx 88px. We observe the container hitting that mark.
        const observer = new IntersectionObserver(
            ([e]) => setIsStuck(e.intersectionRatio < 1),
            { threshold: [1], rootMargin: '-89px 0px 0px 0px' }
        );
        
        if (observerRef.current) {
            observer.observe(observerRef.current);
        }

        return () => {
            observer.disconnect();
        };
    }, []);

    const hasActiveFilters = filters.commodities.length > 0 || filters.regions.length > 0;

    return (
        <div ref={observerRef} className={cn(
            "sticky z-40 transition-all duration-300",
            isStuck ? "top-[87px]" : "top-[88px]" // Shift up 1px when stuck to cover header border
        )}>
            <div className={cn(
                "w-full transition-all duration-500 font-sans backdrop-blur-xl",
                isStuck 
                    ? "rounded-b-2xl border border-white/20 dark:border-slate-800/50 bg-white/70 dark:bg-slate-950/70 border-t-0 p-2.5 px-6 shadow-none" 
                    : "rounded-2xl border border-border/40 bg-card/95 p-3 px-5 shadow-lg"
            )}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                        <Filter className="h-3.5 w-3.5 text-primary" />
                        <div>
                            <span className="text-sm font-black text-black dark:text-white tracking-normal">Dashboard Filters</span>
                        </div>
                    </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Date range group as Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                className={cn(
                                    "flex items-center gap-2 rounded-full px-8 py-1.5 text-xs font-black tracking-normal transition-all duration-300 border font-sans",
                                    "bg-muted/50 border-border/40 text-muted-foreground hover:bg-accent hover:border-border"
                                )}
                            >
                                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[11px] font-black text-foreground tracking-normal">
                                    {filters.dateRange.from ? format(new Date(filters.dateRange.from), 'yyyy-MM-dd') : 'START'} 
                                    <span className="mx-3 opacity-40">—</span> 
                                    {filters.dateRange.to ? format(new Date(filters.dateRange.to), 'yyyy-MM-dd') : 'END'}
                                </span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 flex flex-col md:flex-row bg-white dark:bg-slate-900 border border-border/40 rounded-2xl shadow-2xl z-[110]" align="start">
                            <div className="p-3 border-b md:border-b-0 md:border-r border-border/40">
                                <span className="block text-[10px] font-black text-muted-foreground tracking-normal mb-2 px-2 uppercase">Start Date</span>
                                <Calendar
                                    mode="single"
                                    selected={filters.dateRange.from ? new Date(filters.dateRange.from) : undefined}
                                    onSelect={(date) => onChange({ ...filters, dateRange: { ...filters.dateRange, from: date ? format(date, 'yyyy-MM-dd') : '' } })}
                                    initialFocus
                                />
                            </div>
                            <div className="p-3">
                                <span className="block text-[10px] font-black text-muted-foreground tracking-normal mb-2 px-2 uppercase">End Date</span>
                                <Calendar
                                    mode="single"
                                    selected={filters.dateRange.to ? new Date(filters.dateRange.to) : undefined}
                                    onSelect={(date) => onChange({ ...filters, dateRange: { ...filters.dateRange, to: date ? format(date, 'yyyy-MM-dd') : '' } })}
                                    initialFocus
                                />
                            </div>
                        </PopoverContent>
                    </Popover>


                    <div className="flex items-center gap-2">
                        <MultiSelect
                            label="Commodity"
                            options={commodityOptions}
                            selected={filters.commodities}
                            onToggle={(opt) => onChange({ ...filters, commodities: toggleItem(filters.commodities, opt) })}
                        />

                        <MultiSelect
                            label="Region"
                            options={regionOptions}
                            selected={filters.regions}
                            onToggle={(opt) => onChange({ ...filters, regions: toggleItem(filters.regions, opt) })}
                        />

                        {/* Quarter select */}
                        <SingleSelect
                            label="Quarter"
                            options={quarterOptions}
                            selected={filters.quarter}
                            onSelect={(q) => onChange({ ...filters, quarter: q })}
                        />
                    </div>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => onChange({ ...filters, commodities: [], regions: [] })}
                            className="p-2 rounded-full hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-all duration-300"
                            title="Clear all filters"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
    );
}
