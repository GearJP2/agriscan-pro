import { useState, useRef, useEffect } from 'react';
import type { DashboardFilters } from '@/types/dashboard';
import { Calendar, ChevronDown, X, Filter, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

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
                    "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-all duration-300 border font-sans",
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
                    "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-black uppercase tracking-widest transition-all duration-300 border font-sans",
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
                                "w-full text-left px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-all",
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
    const [dateOpen, setDateOpen] = useState(false);
    const dateRef = useRef<HTMLDivElement>(null);

    const toggleItem = (list: string[], item: string) =>
        list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
                setDateOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const hasActiveFilters = filters.commodities.length > 0 || filters.regions.length > 0;

    return (
        <div className="relative z-[50] bg-card/90 backdrop-blur-xl border border-border/40 rounded-2xl p-3 px-5 shadow-lg font-sans">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 transition-colors">
                        <Filter className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Dashboard Filters</span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Date range group as Popover */}
                    <div className="relative" ref={dateRef}>
                        <button
                            onClick={() => setDateOpen(!dateOpen)}
                            className={cn(
                                "flex items-center gap-2 rounded-full px-8 py-1.5 text-xs font-black uppercase tracking-widest transition-all duration-300 border font-sans",
                                "bg-muted/50 border-border/40 text-muted-foreground hover:bg-accent hover:border-border"
                            )}
                        >
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-black text-foreground uppercase tracking-widest">
                                {filters.dateRange.from || 'START'} <span className="mx-3 opacity-40">—</span> {filters.dateRange.to || 'END'}
                            </span>
                        </button>

                        {dateOpen && (
                            <div className="absolute top-full mt-2 left-0 w-80 bg-white dark:bg-slate-900 border border-border/40 rounded-2xl shadow-2xl z-[110] p-5 animate-in fade-in zoom-in-95 duration-200 font-sans">
                                <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Select Date Range</span>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1 font-sans">Start Date</label>
                                        <input
                                            type="date"
                                            value={filters.dateRange.from}
                                            onChange={(e) => onChange({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value } })}
                                            className="w-full bg-muted/40 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1 font-sans">End Date</label>
                                        <input
                                            type="date"
                                            value={filters.dateRange.to}
                                            onChange={(e) => onChange({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value } })}
                                            className="w-full bg-muted/40 border border-border/40 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

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
    );
}
