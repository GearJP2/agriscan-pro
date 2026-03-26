import { useState, useRef, useEffect } from 'react';
import { ALL_COMMODITIES, ALL_REGIONS, QUARTERS } from '@/data/mockDashboardData';
import type { DashboardFilters } from '@/types/dashboard';
import { Calendar, ChevronDown, X, Filter } from 'lucide-react';

interface Props {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
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
        className="flex items-center gap-1.5 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
        aria-label={`Filter by ${label}`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-amber-500/20 text-amber-400 text-xs px-1.5 rounded-full">{selected.length}</span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 w-52 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
          {options.map((opt) => {
            const isSelected = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() => onToggle(opt)}
                className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                  isSelected ? 'text-amber-400 bg-amber-500/10' : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className={`inline-block w-3 h-3 mr-2 rounded border ${
                  isSelected ? 'bg-amber-500 border-amber-500' : 'border-gray-600'
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

export default function DashboardNavbar({ filters, onChange }: Props) {
  const toggleItem = (list: string[], item: string) =>
    list.includes(item) ? list.filter((i) => i !== item) : [...list, item];

  const hasActiveFilters = filters.commodities.length > 0 || filters.regions.length > 0;

  return (
    <nav className="sticky top-0 z-40 bg-gray-950/90 backdrop-blur-md border-b border-gray-800" aria-label="Dashboard navigation">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <span className="text-lg font-bold text-gray-100">
              Agriscan<span className="text-emerald-400">Pro</span>
            </span>
            <span className="hidden sm:inline text-xs text-gray-500 border-l border-gray-700 ml-2 pl-2">
              Mycotoxin Surveillance
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />

            {/* Date range */}
            <div className="hidden md:flex items-center gap-1.5 rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-300">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <input
                type="date"
                value={filters.dateRange.from}
                onChange={(e) => onChange({ ...filters, dateRange: { ...filters.dateRange, from: e.target.value } })}
                className="bg-transparent text-sm text-gray-300 w-28 outline-none"
                aria-label="Start date"
              />
              <span className="text-gray-600">–</span>
              <input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) => onChange({ ...filters, dateRange: { ...filters.dateRange, to: e.target.value } })}
                className="bg-transparent text-sm text-gray-300 w-28 outline-none"
                aria-label="End date"
              />
            </div>

            <MultiSelect
              label="Commodity"
              options={ALL_COMMODITIES}
              selected={filters.commodities}
              onToggle={(opt) => onChange({ ...filters, commodities: toggleItem(filters.commodities, opt) })}
            />

            <MultiSelect
              label="Region"
              options={ALL_REGIONS}
              selected={filters.regions}
              onToggle={(opt) => onChange({ ...filters, regions: toggleItem(filters.regions, opt) })}
            />

            {/* Quarter select */}
            <select
              value={filters.quarter}
              onChange={(e) => onChange({ ...filters, quarter: e.target.value })}
              className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1.5 text-sm text-gray-300 outline-none"
              aria-label="Quarter comparison"
            >
              {QUARTERS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => onChange({ ...filters, commodities: [], regions: [] })}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                aria-label="Clear all filters"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
