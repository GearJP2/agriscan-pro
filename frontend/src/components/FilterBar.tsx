import { Search, Filter, X, Bell, CalendarIcon, Plus, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterState, SampleType, SAMPLE_TYPE_LABELS } from '@/types/sample';
import { regions, vegetationTypes, statuses, sampleTypes } from '@/data/mockSamples';
import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
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
  items: string[];
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
              "w-full rounded-full h-9 px-4 text-[12px] font-semibold transition-all duration-300 border justify-between",
              hasSelected
                ? "bg-primary/10 border-primary/40 text-primary shadow-sm shadow-primary/10"
                : "bg-background border-border/60 text-foreground/70 hover:bg-accent hover:text-foreground hover:border-border"
            )}
          >
            <div className="flex items-center">
              {hasSelected && (
                <span className="relative flex h-1.5 w-1.5 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                </span>
              )}
              {title}
              {hasSelected && (
                <span className="ml-1.5 font-bold opacity-100">({selectedCount})</span>
              )}
            </div>
            <ChevronDown className={cn(
              "h-3.5 w-3.5 transition-transform duration-300",
              hasSelected ? "text-primary opacity-80" : "text-muted-foreground opacity-60"
            )} />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          side="bottom" 
          sideOffset={10} 
          align="start" 
          avoidCollisions={false}
          className="w-64 p-2 bg-white dark:bg-slate-900 border border-border/40 rounded-2xl shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-200"
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
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer text-[12px] font-semibold transition-all",
                    isChecked ? "bg-primary/10 text-primary" : "hover:bg-accent text-foreground/70 hover:text-foreground"
                  )}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => {}} // Controlled by div onClick
                    className={cn(
                      "h-3.5 w-3.5 rounded border-border/40 pointer-events-none",
                      isChecked && "bg-primary border-primary"
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

const FilterBar = ({ filters, onFilterChange }: FilterBarProps) => {
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
    <div className="space-y-4 rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-black text-foreground/80 uppercase tracking-widest">
          <Filter className="h-3.5 w-3.5 text-primary" />
          <span>Surveillance Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="h-5 px-1.5 text-[10px] font-black bg-primary text-primary-foreground">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters} 
                className="h-8 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-danger hover:bg-danger/5 transition-all"
            >
                <X className="mr-1.5 h-3 w-3" />
                Clear All
            </Button>
            )}
        </div>
      </div>

      {/* Top Row: Search and Dates */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Search by Sample ID or Variety..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="h-10 pl-10 pr-4 bg-muted/30 border-border/40 rounded-2xl text-[13px] font-medium placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="h-10 gap-2 rounded-2xl border-border/40 bg-muted/30 px-4 text-[12px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                    <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
                    {filters.dateFrom ? format(new Date(filters.dateFrom), 'MMM dd, yyyy') : 'Start Date'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border/40 shadow-2xl" align="end">
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
                    <Button variant="outline" className="h-10 gap-2 rounded-2xl border-border/40 bg-muted/30 px-4 text-[12px] font-bold text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                    <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
                    {filters.dateTo ? format(new Date(filters.dateTo), 'MMM dd, yyyy') : 'End Date'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl border-border/40 shadow-2xl" align="end">
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
