import { Search, Filter, X, Bell, CalendarIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterState, RiskLevel } from '@/types/sample';
import { regions, vegetationTypes, statuses } from '@/data/mockSamples';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

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

const riskLevels: RiskLevel[] = ['safe', 'low', 'medium', 'high'];

const riskLabels: Record<RiskLevel, string> = {
  safe: 'Safe',
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
};

interface FilterSectionProps {
  title: string;
  sectionKey: string;
  items: string[];
  filterKey: 'region' | 'vegetation' | 'status' | 'risk';
  labelFn?: (item: string) => string;
  filters: FilterState;
  openSections: Record<string, boolean>;
  onToggleSection: (section: string, isOpen: boolean) => void;
  onToggleFilter: (key: 'region' | 'vegetation' | 'status' | 'risk', value: string) => void;
}

const FilterSectionBlock = ({
  title,
  sectionKey,
  items,
  filterKey,
  labelFn = (item: string) => item,
  filters,
  openSections,
  onToggleSection,
  onToggleFilter
}: FilterSectionProps) => (
  <Collapsible open={openSections[sectionKey]} onOpenChange={(isOpen) => onToggleSection(sectionKey, isOpen)}>
    <CollapsibleTrigger className="flex w-full items-center justify-between py-2 text-sm font-medium text-foreground hover:text-primary transition-colors">
      <span className="flex items-center gap-2">
        {title}
        {(filters[filterKey] as string[]).length > 0 && (
          <Badge variant="secondary" className="h-5 px-1.5 text-xs">
            {(filters[filterKey] as string[]).length}
          </Badge>
        )}
      </span>
      <ChevronDown className={`h-4 w-4 transition-transform ${openSections[sectionKey] ? 'rotate-180' : ''}`} />
    </CollapsibleTrigger>
    <CollapsibleContent className="space-y-2 pb-3">
      {items.map((item) => (
        <label
          key={item}
          className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Checkbox
            checked={(filters[filterKey] as string[]).includes(item)}
            onCheckedChange={() => onToggleFilter(filterKey, item)}
          />
          {labelFn(item)}
        </label>
      ))}
    </CollapsibleContent>
  </Collapsible>
);

const FilterBar = ({ filters, onFilterChange }: FilterBarProps) => {
  const { watchlistCount } = useWatchlist();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    region: true,
    vegetation: true,
    status: true,
    risk: true,
  });

  const toggleArrayFilter = (key: 'region' | 'vegetation' | 'status' | 'risk', value: string) => {
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
      risk: [],
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
    filters.risk.length +
    (filters.search ? 1 : 0) +
    (filters.watchlistOnly ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0);

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Filter className="h-4 w-4" />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="default" className="h-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
            <X className="mr-1 h-3 w-3" />
            Clear all
          </Button>
        )}
      </div>

      {/* Search and Date Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Sample ID..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>

        {/* Date From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[140px]">
              <CalendarIcon className="h-4 w-4" />
              {filters.dateFrom ? format(new Date(filters.dateFrom), 'MMM dd, yyyy') : 'From Date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              onSelect={(date) => onFilterChange({ ...filters, dateFrom: date ? format(date, 'yyyy-MM-dd') : null })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[140px]">
              <CalendarIcon className="h-4 w-4" />
              {filters.dateTo ? format(new Date(filters.dateTo), 'MMM dd, yyyy') : 'To Date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
              onSelect={(date) => onFilterChange({ ...filters, dateTo: date ? format(date, 'yyyy-MM-dd') : null })}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        <Button
          variant={filters.watchlistOnly ? 'default' : 'outline'}
          onClick={() => onFilterChange({ ...filters, watchlistOnly: !filters.watchlistOnly })}
          className="gap-2"
        >
          <Bell className="h-4 w-4" />
          Watchlist
          {watchlistCount > 0 && (
            <Badge variant={filters.watchlistOnly ? 'secondary' : 'default'} className="h-5 px-1.5 text-xs">
              {watchlistCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Checkbox Filters */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="space-y-1">
          <FilterSectionBlock
            title="Region"
            sectionKey="region"
            items={regions}
            filterKey="region"
            filters={filters}
            openSections={openSections}
            onToggleSection={(key, val) => setOpenSections(prev => ({ ...prev, [key]: val }))}
            onToggleFilter={toggleArrayFilter}
          />
        </div>

        <div className="space-y-1">
          <FilterSectionBlock
            title="Variety"
            sectionKey="vegetation"
            items={vegetationTypes}
            filterKey="vegetation"
            filters={filters}
            openSections={openSections}
            onToggleSection={(key, val) => setOpenSections(prev => ({ ...prev, [key]: val }))}
            onToggleFilter={toggleArrayFilter}
          />
        </div>

        <div className="space-y-1">
          <FilterSectionBlock
            title="Status"
            sectionKey="status"
            items={statuses}
            filterKey="status"
            labelFn={(status) => statusLabels[status] || status}
            filters={filters}
            openSections={openSections}
            onToggleSection={(key, val) => setOpenSections(prev => ({ ...prev, [key]: val }))}
            onToggleFilter={toggleArrayFilter}
          />
        </div>

        <div className="space-y-1">
          <FilterSectionBlock
            title="Risk Level"
            sectionKey="risk"
            items={riskLevels}
            filterKey="risk"
            labelFn={(risk) => riskLabels[risk as RiskLevel] || risk}
            filters={filters}
            openSections={openSections}
            onToggleSection={(key, val) => setOpenSections(prev => ({ ...prev, [key]: val }))}
            onToggleFilter={toggleArrayFilter}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
