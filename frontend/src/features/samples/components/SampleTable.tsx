import { useState, useMemo, useCallback, memo } from 'react';
import { Sample } from '@/types/sample';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Eye, AlertTriangle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown, Bell, BellOff, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useWatchlist } from '@/hooks/useWatchlist';
import { cn } from '@/lib/utils';

interface SampleTableProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
  isAdmin?: boolean;
  isSelectionMode?: boolean;
  onDeleteSample?: (sampleId: string) => void;
  onBulkDeleteSamples?: (sampleIds: string[]) => void;
}

type SortField = 'sample_id' | 'region' | 'province' | 'district' | 'collection_date' | 'status' | 'risk' | 'vegetation_variety';
type SortDirection = 'asc' | 'desc' | null;

// --- Helper Functions ---
const getMaxIntensity = (sample: Sample) => {
  if (!sample.mycotoxin_results || sample.mycotoxin_results.length === 0) return null;
  return Math.max(...sample.mycotoxin_results.map(r => r.intensity));
};

const hasPositiveResults = (sample: Sample) => {
  if (sample.mycotoxin_results && sample.mycotoxin_results.length > 0) {
    return sample.mycotoxin_results.some(r => (r.is_detected ?? r.intensity > 0));
  }
  return ['high', 'medium', 'low'].includes(sample.risk_level || '');
};

const hasRecordedResults = (sample: Sample) => {
  if (sample.mycotoxin_results && sample.mycotoxin_results.length > 0) {
    return true;
  }
  if (sample.status === 'completed') {
    return true;
  }
  return (sample.results_count ?? 0) > 0 || ['low', 'medium', 'high'].includes(sample.risk_level || '');
};

const getRiskScore = (sample: Sample) => {
  if (!hasRecordedResults(sample)) return -1;
  const maxIntensity = getMaxIntensity(sample);
  if (hasPositiveResults(sample)) return 100 + (maxIntensity ?? 1);
  if (sample.mycotoxin_results && sample.mycotoxin_results.length > 0) {
    return maxIntensity ?? 1;
  }

  const riskWeight: Record<string, number> = {
    safe: 1,
    low: 2,
    medium: 3,
    high: 4,
  };
  return riskWeight[sample.risk_level || 'safe'] || 0;
};

// --- Memoized Row Component ---
interface SampleRowProps {
  sample: Sample;
  index: number;
  isSelected: boolean;
  isWatching: boolean;
  isAdmin: boolean;
  isSelectionMode: boolean;
  onSelect: (sample: Sample) => void;
  onToggleSelect: (id: string) => void;
  onToggleWatch: (id: string) => void;
  getStatusBadge: (sample: Sample) => React.ReactNode;
}

const SampleRow = memo(({ 
  sample, 
  index, 
  isSelected, 
  isWatching, 
  isAdmin, 
  isSelectionMode,
  onSelect, 
  onToggleSelect, 
  onToggleWatch,
  getStatusBadge
}: SampleRowProps) => {
  const handleRowClick = () => {
    if (isSelectionMode) {
      onToggleSelect(sample.sample_id);
    } else {
      onSelect(sample);
    }
  };

  return (
    <TableRow
      key={sample.sample_id}
      className={cn(
        "group relative cursor-pointer border-l-4 border-l-transparent transition-all duration-200",
        "hover:bg-primary/[0.02] hover:border-l-primary/50 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary)/0.5)]",
        isWatching && "bg-info/[0.03] border-l-info/40",
        isSelected && "bg-primary/[0.08] border-l-primary z-10 shadow-sm",
        isSelectionMode && "hover:ring-1 hover:ring-primary/20"
      )}
      onClick={handleRowClick}
    >
      {isSelectionMode && (
        <TableCell className="w-[40px] px-4">
          <div className={cn(
             "flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-100",
             isSelected ? "bg-primary border-primary shadow-sm ring-2 ring-primary/20" : "border-muted-foreground/30 bg-background"
          )}>
             {isSelected && <div className="h-2 w-2 rounded-full bg-white animate-in zoom-in-50 duration-200" />}
          </div>
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-3">
          {!isSelectionMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "p-1.5 rounded-md transform",
                    isWatching 
                      ? 'text-primary bg-primary/10 ring-1 ring-primary/20' 
                      : 'text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWatch(sample.sample_id);
                  }}
                >
                  {isWatching ? (
                    <Bell className="h-3.5 w-3.5 fill-current" />
                  ) : (
                    <BellOff className="h-3.5 w-3.5 opacity-60" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
              </TooltipContent>
            </Tooltip>
          )}
          <span className="font-medium text-foreground">{sample.sample_id}</span>
        </div>
      </TableCell>
      <TableCell>{sample.region}</TableCell>
      <TableCell>{sample.province}</TableCell>
      <TableCell>{sample.district}</TableCell>
      <TableCell>
        <Badge variant="secondary">{sample.vegetation_variety}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {format(new Date(sample.collection_date), 'MMM dd, yyyy')}
      </TableCell>
      <TableCell>{getStatusBadge(sample)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {hasPositiveResults(sample) ? (
            <Badge className="bg-danger text-danger-foreground border-danger/20 font-bold uppercase text-[10px] px-2 py-0.5 tracking-tight shadow-sm">
              Positive
            </Badge>
          ) : hasRecordedResults(sample) ? (
            <Badge className="bg-info text-info-foreground border-info/20 font-bold uppercase text-[10px] px-2 py-0.5 tracking-tight shadow-sm">
              Negative
            </Badge>
          ) : (
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest ml-1">Pending</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
});

SampleRow.displayName = 'SampleRow';

const SampleTable = ({ samples, onSelectSample, isAdmin = false, isSelectionMode = false, onDeleteSample, onBulkDeleteSamples }: SampleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { isWatching, toggleWatchlist } = useWatchlist();

  // Reset selected IDs when leaving Selection Mode
  useMemo(() => {
    if (!isSelectionMode) {
      setSelectedIds(new Set());
    }
  }, [isSelectionMode]);

  const getStatusBadge = (sample: Sample) => {
    const logs = sample.process_logs ?? [];
    const latestState = logs.length > 0 ? logs[logs.length - 1].state : null;

    const stateLabels: Record<string, string> = {
      registered: 'Registered',
      preparing: 'Preparing',
      prepared: 'Prepared',
      analyzing: 'Analyzing',
      recorded: 'Recorded',
      completed: 'Completed',
    };

    const colorMap: Record<string, { bg: string; text: string }> = {
      registered: { bg: 'bg-slate-200', text: 'text-slate-800' },
      preparing: { bg: 'bg-amber-100', text: 'text-amber-700' },
      prepared: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
      analyzing: { bg: 'bg-blue-100', text: 'text-blue-700' },
      recorded: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
      completed: { bg: 'bg-success/20', text: 'text-success' },
    };

    const label = latestState ? stateLabels[latestState] : 'Not Started';
    const colors = latestState ? colorMap[latestState] : { bg: 'bg-slate-200', text: 'text-slate-800' };

    return (
      <Badge className={`${colors.bg} ${colors.text} border-0`}>
        {label}
      </Badge>
    );
  };

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') {
        setSortField(null);
        setSortDirection(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const sortedSamples = useMemo(() => {
    return [...samples].sort((a, b) => {
      if (!sortField || !sortDirection) return 0;

      let comparison = 0;
      switch (sortField) {
        case 'sample_id':
          comparison = a.sample_id.localeCompare(b.sample_id, undefined, { numeric: true, sensitivity: 'base' });
          break;
        case 'region':
          comparison = a.region.localeCompare(b.region);
          break;
        case 'province':
          comparison = a.province.localeCompare(b.province);
          break;
        case 'district':
          comparison = a.district.localeCompare(b.district);
          break;
        case 'collection_date':
          comparison = new Date(a.collection_date).getTime() - new Date(b.collection_date).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'risk':
          comparison = getRiskScore(a) - getRiskScore(b);
          break;
        case 'vegetation_variety':
          comparison = a.vegetation_variety.localeCompare(b.vegetation_variety);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [samples, sortField, sortDirection]);

  const allSelected = sortedSamples.length > 0 && sortedSamples.every(s => selectedIds.has(s.sample_id));
  const someSelected = !allSelected && sortedSamples.some(s => selectedIds.has(s.sample_id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedSamples.map(s => s.sample_id)));
    }
  };

  const toggleSelectRow = useCallback((sampleId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId); else next.add(sampleId);
      return next;
    });
  }, []);

  const handleBulkDelete = () => {
    if (onBulkDeleteSamples) {
      onBulkDeleteSamples(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`font-semibold cursor-pointer hover:bg-muted/30 transition-colors select-none sticky top-0 z-30 bg-card ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b border-destructive/20 relative z-40 animate-in fade-in duration-300">
            <span className="text-sm font-medium text-destructive">
              {selectedIds.size} sample{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="h-8 gap-1.5">
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedIds.size} Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedIds.size} Samples</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete{' '}
                    <span className="font-semibold text-foreground">{selectedIds.size} sample{selectedIds.size !== 1 ? 's' : ''}</span>?{' '}
                    All associated process logs and mycotoxin results will also be deleted.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleBulkDelete}
                  >
                    Delete All Selected
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
        <div className="max-h-[70vh] overflow-auto relative">
          <Table className="relative">
            <TableHeader className="sticky top-0 z-30 bg-card/70 backdrop-blur-xl shadow-[0_1px_0_0_hsl(var(--border)/0.5)]">
              <TableRow className="bg-muted hover:bg-muted h-12">
              {isSelectionMode && (
                <TableHead className="w-[40px] px-4">
                  <div 
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border cursor-pointer transition-all",
                      allSelected ? "bg-primary border-primary" : someSelected ? "bg-primary/50 border-primary" : "border-muted-foreground/30"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectAll();
                    }}
                  >
                    {allSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                    {!allSelected && someSelected && <div className="h-1 w-2 rounded-full bg-white" />}
                  </div>
                </TableHead>
              )}
              <SortableHeader field="sample_id" className="w-[160px]">Sample ID</SortableHeader>
              <SortableHeader field="region" className="w-[130px]">Region</SortableHeader>
              <SortableHeader field="province" className="w-[160px]">Province</SortableHeader>
              <SortableHeader field="district" className="w-[160px]">District</SortableHeader>
              <SortableHeader field="vegetation_variety" className="min-w-[200px]">Variety</SortableHeader>
              <SortableHeader field="collection_date" className="w-[140px]">Date</SortableHeader>
              <SortableHeader field="status" className="w-[140px]">Status</SortableHeader>
              <SortableHeader field="risk" className="w-[140px]">Risk</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSamples.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 10 : 9} className="h-32 text-center text-muted-foreground bg-muted/5 rounded-b-xl">
                  No samples found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedSamples.map((sample, index) => (
                <SampleRow
                  key={sample.sample_id}
                  sample={sample}
                  index={index}
                  isSelected={selectedIds.has(sample.sample_id)}
                  isWatching={isWatching(sample.sample_id)}
                  isAdmin={isAdmin}
                  isSelectionMode={isSelectionMode}
                  onSelect={onSelectSample}
                  onToggleSelect={toggleSelectRow}
                  onToggleWatch={toggleWatchlist}
                  getStatusBadge={getStatusBadge}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    </TooltipProvider>
  );
};

export default SampleTable;
