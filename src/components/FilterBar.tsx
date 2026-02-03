import { Search, Filter, X, Bell } from 'lucide-react';
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
    });
  };

  const activeFilterCount = 
    filters.region.length + 
    filters.vegetation.length + 
    filters.status.length + 
    filters.risk.length +
    (filters.search ? 1 : 0) +
    (filters.watchlistOnly ? 1 : 0);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const FilterSection = ({ 
    title, 
    sectionKey, 
    items, 
    filterKey,
    labelFn = (item: string) => item 
  }: { 
    title: string; 
    sectionKey: string;
    items: string[]; 
    filterKey: 'region' | 'vegetation' | 'status' | 'risk';
    labelFn?: (item: string) => string;
  }) => (
    <Collapsible open={openSections[sectionKey]} onOpenChange={() => toggleSection(sectionKey)}>
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
              onCheckedChange={() => toggleArrayFilter(filterKey, item)}
            />
            {labelFn(item)}
          </label>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 animate-slide-up">
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

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by Sample ID..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className="pl-10"
          />
        </div>
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
          <FilterSection
            title="Region"
            sectionKey="region"
            items={regions}
            filterKey="region"
          />
        </div>

        <div className="space-y-1">
          <FilterSection
            title="Variety"
            sectionKey="vegetation"
            items={vegetationTypes}
            filterKey="vegetation"
          />
        </div>

        <div className="space-y-1">
          <FilterSection
            title="Status"
            sectionKey="status"
            items={statuses}
            filterKey="status"
            labelFn={(status) => statusLabels[status] || status}
          />
        </div>

        <div className="space-y-1">
          <FilterSection
            title="Risk Level"
            sectionKey="risk"
            items={riskLevels}
            filterKey="risk"
            labelFn={(risk) => riskLabels[risk as RiskLevel] || risk}
          />
        </div>
      </div>
    </div>
  );
};

export default FilterBar;
