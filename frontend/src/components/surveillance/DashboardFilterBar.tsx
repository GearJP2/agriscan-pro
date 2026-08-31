import { useState, useRef, useEffect } from 'react';
import type { DashboardFilters } from '@/types/dashboard';
import { Calendar as CalendarIcon, ChevronDown, X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
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
                type="button"
                onClick={() => setOpen((isOpen) => !isOpen)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={`${label.toLowerCase()}-filter-options`}
                className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-normal transition-all duration-200 ease-out border font-sans active:scale-[0.98]",
                    selected.length > 0
                        ? "bg-gfs-maroon text-white border-gfs-maroon shadow-sm"
                        : "bg-white/80 dark:bg-slate-900/80 border-gfs-maroon/20 text-gfs-text-primary hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5"
                )}
                aria-label={`Filter by ${label}`}
            >
                {selected.length > 0 && (
                    <span className="relative flex h-2 w-2 mr-1">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gfs-gold opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-gfs-gold"></span>
                    </span>
                )}
                {label}
                {selected.length > 0 && (
                    <span className="ml-1 text-gfs-gold font-bold">({selected.length})</span>
                )}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", open && "rotate-180")} />
            </button>

            {open && (
                <div
                    className="absolute top-full mt-2 right-0 w-60 bg-white dark:bg-slate-900 border border-gfs-maroon/20 rounded-gfs-card shadow-gfs-modal z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none font-sans"
                    id={`${label.toLowerCase()}-filter-options`}
                    role="listbox"
                    aria-label={`${label} options`}
                >
                    {options.map((opt) => {
                        const isSelected = selected.includes(opt);
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => onToggle(opt)}
                                role="option"
                                aria-selected={isSelected}
                                className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors flex items-center ${
                                    isSelected
                                        ? 'text-gfs-maroon dark:text-gfs-gold bg-gfs-maroon/10 font-bold'
                                        : 'text-gfs-text-primary dark:text-slate-200 hover:bg-gfs-maroon/5'
                                }`}
                            >
                                <span className={`inline-flex items-center justify-center w-3.5 h-3.5 mr-2.5 rounded border transition-colors ${
                                    isSelected ? 'bg-gfs-maroon border-gfs-maroon text-white' : 'border-gfs-maroon/30'
                                }`}>
                                    {isSelected && <span className="text-[10px] leading-none">✓</span>}
                                </span>
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
                type="button"
                onClick={() => setOpen((isOpen) => !isOpen)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={`${label.toLowerCase()}-filter-options`}
                aria-label={`Filter by ${label}`}
                className={cn(
                    "flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-normal transition-all duration-200 ease-out border font-sans active:scale-[0.98]",
                    "bg-white/80 dark:bg-slate-900/80 border-gfs-maroon/20 text-gfs-text-primary hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5"
                )}
            >
                <span>{selected || label}</span>
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", open && "rotate-180")} />
            </button>

            {open && (
                <div
                    className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-slate-900 border border-gfs-maroon/20 rounded-gfs-card shadow-gfs-modal z-[110] py-2 animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none font-sans"
                    id={`${label.toLowerCase()}-filter-options`}
                    role="listbox"
                    aria-label={`${label} options`}
                >
                    {options.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => {
                                onSelect(opt);
                                setOpen(false);
                            }}
                            role="option"
                            aria-selected={selected === opt}
                            className={cn(
                                "w-full text-left px-4 py-2 text-xs transition-all",
                                selected === opt
                                    ? "text-gfs-maroon dark:text-gfs-gold bg-gfs-maroon/10 border-l-2 border-gfs-maroon font-bold"
                                    : "text-gfs-text-primary dark:text-slate-200 hover:bg-gfs-maroon/5 font-medium"
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
    const filterRef = useRef<HTMLDivElement>(null);

    const toggleItem = (list: string[], item: string) =>
        list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

    useEffect(() => {
        let frameId: number | null = null;

        const checkStuck = () => {
            if (frameId !== null) return;

            frameId = window.requestAnimationFrame(() => {
                frameId = null;
                if (!filterRef.current) return;

                const rect = filterRef.current.getBoundingClientRect();
                const headerBottom = window.innerWidth >= 1024 ? 89 : 81;
                const nextIsStuck = rect.top <= headerBottom;
                setIsStuck((current) => current === nextIsStuck ? current : nextIsStuck);
            });
        };

        window.addEventListener('scroll', checkStuck, { passive: true });
        window.addEventListener('resize', checkStuck, { passive: true });
        checkStuck();

        return () => {
            window.removeEventListener('scroll', checkStuck);
            window.removeEventListener('resize', checkStuck);
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        };
    }, []);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('filter-stuck-change', { detail: { isStuck } }));
    }, [isStuck]);

    useEffect(() => {
        return () => {
            window.dispatchEvent(new CustomEvent('filter-stuck-change', { detail: { isStuck: false } }));
        };
    }, []);

    const hasActiveFilters = filters.commodities.length > 0 || filters.regions.length > 0;

    return (
        <div ref={filterRef} className={cn(
            "sticky top-[80px] z-50 transition-all duration-300 ease-out motion-reduce:transition-none lg:top-[88px]",
            isStuck ? "-translate-y-px" : "translate-y-0"
        )} data-stuck={isStuck}>
            <div className={cn(
                "w-full min-h-[72px] border border-gfs-maroon/15 dark:border-white/10 px-6 font-sans bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl transition-all duration-300 ease-out",
                isStuck
                    ? "rounded-t-none rounded-b-2xl border-t-0 shadow-2xl shadow-gfs-maroon/15 dark:shadow-black/50 py-3 md:py-3.5"
                    : "rounded-2xl shadow-gfs-card py-4"
            )}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gfs-maroon/10 dark:bg-gfs-gold/15 text-gfs-maroon dark:text-gfs-gold">
                            <Filter className="h-4 w-4" />
                        </div>
                        <div>
                            <span className="text-base font-bold text-gfs-maroon dark:text-white tracking-tight">Dashboard Filters</span>
                        </div>
                    </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Date range group as Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    "flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-xs font-bold tracking-normal transition-all duration-200 ease-out border font-sans active:scale-[0.98]",
                                    "bg-white/80 dark:bg-slate-900/80 border-gfs-maroon/20 text-gfs-text-primary hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5"
                                )}
                                aria-label="Select date range"
                            >
                                <CalendarIcon className="h-3.5 w-3.5 text-gfs-maroon dark:text-gfs-gold" />
                                <span className="text-xs font-bold text-gfs-text-primary dark:text-white tracking-normal">
                                    {filters.dateRange.from ? format(parseISO(filters.dateRange.from), 'yyyy-MM-dd') : 'START'}
                                    <span className="mx-2 text-gfs-text-muted/60">—</span>
                                    {filters.dateRange.to ? format(parseISO(filters.dateRange.to), 'yyyy-MM-dd') : 'END'}
                                </span>
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 flex flex-col md:flex-row bg-white dark:bg-slate-900 border border-gfs-maroon/20 rounded-gfs-card shadow-gfs-modal z-[110]" align="start">
                            <div className="p-3 border-b md:border-b-0 md:border-r border-gfs-maroon/10">
                                <span className="block text-[10px] font-bold text-gfs-maroon dark:text-gfs-gold uppercase tracking-wider mb-2 px-2">Start Date</span>
                                <Calendar
                                    mode="single"
                                    selected={filters.dateRange.from ? parseISO(filters.dateRange.from) : undefined}
                                    onSelect={(date) => onChange({ ...filters, dateRange: { ...filters.dateRange, from: date ? format(date, 'yyyy-MM-dd') : '' } })}
                                    initialFocus
                                />
                            </div>
                            <div className="p-3">
                                <span className="block text-[10px] font-bold text-gfs-maroon dark:text-gfs-gold uppercase tracking-wider mb-2 px-2">End Date</span>
                                <Calendar
                                    mode="single"
                                    selected={filters.dateRange.to ? parseISO(filters.dateRange.to) : undefined}
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
                            type="button"
                            onClick={() => onChange({ ...filters, commodities: [], regions: [] })}
                            className="min-h-11 min-w-11 rounded-full p-2.5 text-gfs-maroon dark:text-gfs-gold border border-gfs-maroon/20 hover:bg-gfs-maroon/10 hover:border-gfs-maroon transition-all active:scale-95 flex items-center justify-center"
                            title="Clear all filters"
                            aria-label="Clear all filters"
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
