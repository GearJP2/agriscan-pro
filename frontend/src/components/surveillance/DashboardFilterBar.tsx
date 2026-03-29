import { useState, useRef, useEffect } from 'react';
import type { DashboardFilters } from '@/types/dashboard';
import { Calendar, ChevronDown, X, Filter } from 'lucide-react';

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
                className="flex items-center gap-1.5 rounded-lg bg-muted border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
                aria-label={`Filter by ${label}`}
            >
                {label}
                {selected.length > 0 && (
                    <span className="bg-warning/20 text-warning text-xs px-1.5 rounded-full">{selected.length}</span>
                )}
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {open && (
                <div className="absolute top-full mt-1 right-0 w-52 bg-popover border border-border rounded-lg shadow-xl z-50 py-1">
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

export default function DashboardFilterBar({ filters, onChange, commodityOptions, regionOptions, quarterOptions }: Props) {
    const toggleItem = (list: string[], item: string) =>
        list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

    const hasActiveFilters = filters.commodities.length > 0 || filters.regions.length > 0;

    return (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Dashboard Filters</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Date range */}
                    <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-muted border border-border px-3 py-1.5 text-sm text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="date"
                            value={filters.dateRange.from}
                            onChange={(e) => onChange({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value } })}
                            className="bg-transparent text-sm text-foreground w-28 outline-none focus:ring-0"
                            aria-label="Start date"
                        />
                        <span className="text-muted-foreground">–</span>
                        <input
                            type="date"
                            value={filters.dateRange.to}
                            onChange={(e) => onChange({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value } })}
                            className="bg-transparent text-sm text-foreground w-28 outline-none focus:ring-0"
                            aria-label="End date"
                        />
                    </div>

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
                    <select
                        value={filters.quarter}
                        onChange={(e) => onChange({ ...filters, quarter: e.target.value })}
                        className="rounded-lg bg-muted border border-border px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary/20"
                        aria-label="Quarter comparison"
                    >
                        {quarterOptions.map((q) => (
                            <option key={q} value={q}>{q}</option>
                        ))}
                    </select>

                    {/* Clear filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => onChange({ ...filters, commodities: [], regions: [] })}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
                            aria-label="Clear all filters"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
