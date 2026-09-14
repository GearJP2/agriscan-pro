import { Search, Filter, X, Bell, CalendarIcon, Plus, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterState, SampleType, SAMPLE_TYPE_LABELS } from '@/types/sample';
import { regions, vegetationTypes, statuses, sampleTypes } from '@/constants/sampleConstants';
import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  embedded?: boolean;
  className?: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Registered',
  in_progress: 'Preparing',
  completed: 'Completed',
  flagged: 'Analyzed',
};

type FilterKey = 'region' | 'vegetation' | 'status' | 'sampleType';

interface FilterSectionProps {
  title: string;
  items: readonly string[];
  filterKey: FilterKey;
  labelFn?: (item: string) => string;
  filters: FilterState;
  onToggleFilter: (key: FilterKey, value: string) => void;
}

const FilterPill = ({
  title,
  items,
  filterKey,
  labelFn = (item: string) => item,
  filters,
  onToggleFilter
}: FilterSectionProps) => {
  const selectedCount = (filters[filterKey] as string[]).length;
  const hasSelected = selectedCount > 0;

  return (
    <div className="flex-1 basis-[calc(100%/6-0.5rem)] min-w-[120px]">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "w-full rounded-full h-10 px-4 text-xs font-bold tracking-normal transition-all duration-200 border justify-between font-sans active:scale-[0.98]",
              hasSelected
                ? "bg-gfs-maroon text-white border-gfs-maroon shadow-sm"
                : "bg-white/80 dark:bg-slate-900/80 border-gfs-maroon/20 text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5"
            )}
          >
            <div className="flex items-center">
              {hasSelected && (
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gfs-gold opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gfs-gold"></span>
                </span>
              )}
              {title}
              {hasSelected && (
                <span className="ml-1 text-gfs-gold font-bold">({selectedCount})</span>
              )}
            </div>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 transition-transform duration-300",
              hasSelected ? "text-gfs-gold" : "text-gfs-text-muted opacity-70"
            )} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="bottom" 
          sideOffset={8} 
          align="start" 
          avoidCollisions={false}
          className="w-64 p-2 bg-white dark:bg-slate-900 border border-gfs-maroon/20 rounded-gfs-card shadow-gfs-modal z-[110] animate-in fade-in zoom-in-95 duration-200 font-sans"
        >
          <div className="max-h-[380px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
            {[...items].sort((a, b) => labelFn(a).localeCompare(labelFn(b))).map((item) => {
              const isChecked = (filters[filterKey] as string[]).includes(item);
              return (
                <div
                  key={item}
                  onClick={(e) => {
                    e.preventDefault();
                    onToggleFilter(filterKey, item);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer text-xs font-medium transition-all",
                    isChecked
                      ? "bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold font-bold"
                      : "hover:bg-gfs-maroon/5 text-gfs-text-primary dark:text-slate-200"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => {}} // Controlled by div onClick
                    className={cn(
                      "h-3.5 w-3.5 rounded border-gfs-maroon/30 pointer-events-none data-[state=checked]:bg-gfs-maroon data-[state=checked]:border-gfs-maroon data-[state=checked]:text-white",
                      isChecked && "bg-gfs-maroon border-gfs-maroon"
                    )}
                  />
                  <span className="flex-1">{labelFn(item)}</span>
                </div>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

const FilterBar = ({ filters, onFilterChange, embedded = false, className }: FilterBarProps) => {
  const { watchlistCount } = useWatchlist();

  const toggleArrayFilter = (key: FilterKey, value: string) => {
    const current = filters[key] as string[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFilterChange({ ...filters, [key]: updated });
  };

  const clearFilters = () => {
    onFilterChange({
      region: [],
      province: [],
      district: [],
      vegetation: [],
      status: [],
      sampleType: [],
      search: '',
      watchlistOnly: false,
      dateFrom: null,
      dateTo: null,
    });
  };

  const activeFilterCount =
    filters.region.length +
    filters.vegetation.length +
    filters.status.length +
    filters.sampleType.length +
    (filters.search ? 1 : 0) +
    (filters.watchlistOnly ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  return (
    <div
      className={cn(
        "space-y-4 font-sans",
        !embedded
          ? "rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-5 shadow-gfs-card"
          : "",
        className
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gfs-maroon/10 dark:bg-gfs-gold/15 text-gfs-maroon dark:text-gfs-gold">
            <Filter className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gfs-maroon dark:text-white tracking-tight uppercase">Surveillance Filters</span>
            {activeFilterCount > 0 && (
              <Badge className="h-5 px-2 text-[10px] font-bold bg-gfs-maroon text-white dark:bg-gfs-gold dark:text-gfs-maroon rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters} 
              className="h-8 rounded-full px-3 text-xs font-bold text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon/5 transition-all"
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Top Row: Search and Dates */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gfs-maroon/50 dark:text-gfs-gold/60" />
          <Input
            placeholder="Search by Sample ID or Variety..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="h-11 pl-11 pr-4 bg-gfs-canvas/50 dark:bg-slate-800/60 border border-gfs-maroon/20 dark:border-white/10 rounded-full text-xs font-medium placeholder:text-gfs-text-muted/60 text-gfs-text-primary dark:text-white focus-visible:ring-2 focus-visible:ring-gfs-gold/40 focus-visible:border-gfs-maroon transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 rounded-full border border-gfs-maroon/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-5 text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5 transition-all">
                <CalendarIcon className="h-3.5 w-3.5 text-gfs-maroon dark:text-gfs-gold" />
                {filters.dateFrom ? format(new Date(filters.dateFrom), 'MMM dd, yyyy') : 'Start Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal overflow-hidden bg-white dark:bg-slate-900" align="end">
              <Calendar
                mode="single"
                selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                onSelect={(date) => onFilterChange({ ...filters, dateFrom: date ? format(date, 'yyyy-MM-dd') : null })}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 gap-2 rounded-full border border-gfs-maroon/20 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 px-5 text-xs font-bold text-gfs-text-primary dark:text-slate-200 hover:border-gfs-maroon/50 hover:bg-gfs-maroon/5 transition-all">
                <CalendarIcon className="h-3.5 w-3.5 text-gfs-maroon dark:text-gfs-gold" />
                {filters.dateTo ? format(new Date(filters.dateTo), 'MMM dd, yyyy') : 'End Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal overflow-hidden bg-white dark:bg-slate-900" align="end">
              <Calendar
                mode="single"
                selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                onSelect={(date) => onFilterChange({ ...filters, dateTo: date ? format(date, 'yyyy-MM-dd') : null })}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Bottom Row: Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <FilterPill
          title="Region"
          items={regions}
          filterKey="region"
          filters={filters}
          onToggleFilter={toggleArrayFilter}
        />
        <FilterPill
          title="Variety"
          items={vegetationTypes}
          filterKey="vegetation"
          filters={filters}
          onToggleFilter={toggleArrayFilter}
        />
        <FilterPill
          title="Status"
          items={statuses}
          filterKey="status"
          labelFn={(status) => statusLabels[status] || status}
          filters={filters}
          onToggleFilter={toggleArrayFilter}
        />
        <FilterPill
          title="Sample Type"
          items={sampleTypes}
          filterKey="sampleType"
          labelFn={(type) => SAMPLE_TYPE_LABELS[type as SampleType] || type}
          filters={filters}
          onToggleFilter={toggleArrayFilter}
        />
      </div>
    </div>
  );
};

export default FilterBar;
