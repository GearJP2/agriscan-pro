import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, BellOff, Trash2 } from 'lucide-react';

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useWatchlist } from '@/hooks/useWatchlist';
import { cn } from '@/lib/utils';
import type { Sample } from '@/types/sample';

interface SampleTableProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
  isAdmin?: boolean;
  isSelectionMode?: boolean;
  onBulkDeleteSamples?: (sampleIds: string[]) => void;
}

type SortField =
  | 'sample_id'
  | 'region'
  | 'province'
  | 'district'
  | 'collection_date'
  | 'status'
  | 'risk'
  | 'vegetation_variety';
type SortDirection = 'asc' | 'desc' | null;

const TABLE_ROW_HEIGHT = 64;
const TABLE_OVERSCAN_ROWS = 8;
const VIRTUALIZATION_THRESHOLD = 60;

const getMaxIntensity = (sample: Sample) => {
  if (!sample.mycotoxin_results || sample.mycotoxin_results.length === 0) {
    return null;
  }

  return Math.max(...sample.mycotoxin_results.map((result) => result.intensity));
};

const hasPositiveResults = (sample: Sample) => {
  if (sample.mycotoxin_results && sample.mycotoxin_results.length > 0) {
    return sample.mycotoxin_results.some(
      (result) => result.is_detected ?? result.intensity > 0,
    );
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

  return (
    (sample.results_count ?? 0) > 0 ||
    ['low', 'medium', 'high'].includes(sample.risk_level || '')
  );
};

const getRiskScore = (sample: Sample) => {
  if (!hasRecordedResults(sample)) {
    return -1;
  }

  const maxIntensity = getMaxIntensity(sample);
  if (hasPositiveResults(sample)) {
    return 100 + (maxIntensity ?? 1);
  }

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

interface SampleRowProps {
  sample: Sample;
  isSelected: boolean;
  isWatching: boolean;
  isSelectionMode: boolean;
  onSelect: (sample: Sample) => void;
  onToggleSelect: (id: string) => void;
  onToggleWatch: (id: string) => void;
  getStatusBadge: (sample: Sample) => ReactNode;
}

const SampleRow = memo(
  ({
    sample,
    isSelected,
    isWatching,
    isSelectionMode,
    onSelect,
    onToggleSelect,
    onToggleWatch,
    getStatusBadge,
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
        className={cn(
          'group relative h-16 cursor-pointer border-l-4 border-l-transparent transition-all duration-200',
          'hover:bg-primary/[0.02] hover:border-l-primary/50 hover:shadow-[inset_4px_0_0_0_hsl(var(--primary)/0.5)]',
          isWatching && 'bg-info/[0.03] border-l-info/40',
          isSelected && 'bg-primary/[0.08] border-l-primary z-10 shadow-sm',
          isSelectionMode && 'hover:ring-1 hover:ring-primary/20',
        )}
        onClick={handleRowClick}
      >
        {isSelectionMode && (
          <TableCell className="w-[40px] px-4">
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-100',
                isSelected
                  ? 'bg-primary border-primary shadow-sm ring-2 ring-primary/20'
                  : 'border-muted-foreground/30 bg-background',
              )}
            >
              {isSelected && (
                <div className="h-2 w-2 rounded-full bg-white animate-in zoom-in-50 duration-200" />
              )}
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
                      'rounded-md p-1.5 transform',
                      isWatching
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleWatch(sample.sample_id);
                    }}
                    type="button"
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
              <Badge className="bg-danger text-danger-foreground border-danger/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight shadow-sm">
                Positive
              </Badge>
            ) : hasRecordedResults(sample) ? (
              <Badge className="bg-info text-info-foreground border-info/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight shadow-sm">
                Negative
              </Badge>
            ) : (
              <span className="ml-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Pending
              </span>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  },
);

SampleRow.displayName = 'SampleRow';

const SampleTable = ({
  samples,
  onSelectSample,
  isAdmin = false,
  isSelectionMode = false,
  onBulkDeleteSamples,
}: SampleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const { isWatching, toggleWatchlist } = useWatchlist();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSelectionMode) {
      setSelectedIds(new Set());
    }
  }, [isSelectionMode]);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }

    const syncViewport = () => {
      setViewportHeight(element.clientHeight);
      setScrollTop(element.scrollTop);
    };

    syncViewport();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(syncViewport)
        : null;

    resizeObserver?.observe(element);
    window.addEventListener('resize', syncViewport);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', syncViewport);
    };
  }, []);

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
    const colors = latestState
      ? colorMap[latestState]
      : { bg: 'bg-slate-200', text: 'text-slate-800' };

    return (
      <Badge className={`${colors.bg} ${colors.text} border-0`}>
        {label}
      </Badge>
    );
  };

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        if (sortDirection === 'asc') {
          setSortDirection('desc');
        } else if (sortDirection === 'desc') {
          setSortField(null);
          setSortDirection(null);
        }
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    },
    [sortDirection, sortField],
  );

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    }

    if (sortDirection === 'asc') {
      return <ArrowUp className="ml-1 h-3 w-3" />;
    }

    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const sortedSamples = useMemo(() => {
    return [...samples].sort((a, b) => {
      if (!sortField || !sortDirection) {
        return 0;
      }

      let comparison = 0;
      switch (sortField) {
        case 'sample_id':
          comparison = a.sample_id.localeCompare(b.sample_id, undefined, {
            numeric: true,
            sensitivity: 'base',
          });
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
          comparison =
            new Date(a.collection_date).getTime() -
            new Date(b.collection_date).getTime();
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
  }, [samples, sortDirection, sortField]);

  const allSelected =
    sortedSamples.length > 0 &&
    sortedSamples.every((sample) => selectedIds.has(sample.sample_id));
  const someSelected =
    !allSelected &&
    sortedSamples.some((sample) => selectedIds.has(sample.sample_id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(new Set(sortedSamples.map((sample) => sample.sample_id)));
  };

  const toggleSelectRow = useCallback((sampleId: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(sampleId)) {
        next.delete(sampleId);
      } else {
        next.add(sampleId);
      }

      return next;
    });
  }, []);

  const handleBulkDelete = () => {
    if (onBulkDeleteSamples) {
      onBulkDeleteSamples(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const shouldVirtualize = sortedSamples.length > VIRTUALIZATION_THRESHOLD;
  const effectiveViewportHeight = viewportHeight || 720;
  const visibleRowCount = Math.ceil(effectiveViewportHeight / TABLE_ROW_HEIGHT);
  const virtualStartIndex = shouldVirtualize
    ? Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - TABLE_OVERSCAN_ROWS)
    : 0;
  const virtualEndIndex = shouldVirtualize
    ? Math.min(
        sortedSamples.length,
        virtualStartIndex + visibleRowCount + TABLE_OVERSCAN_ROWS * 2,
      )
    : sortedSamples.length;
  const visibleSamples = sortedSamples.slice(virtualStartIndex, virtualEndIndex);
  const topSpacerHeight = shouldVirtualize
    ? virtualStartIndex * TABLE_ROW_HEIGHT
    : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? (sortedSamples.length - virtualEndIndex) * TABLE_ROW_HEIGHT
    : 0;
  const columnCount = isSelectionMode ? 9 : 8;

  const SortableHeader = ({
    field,
    children,
    className = '',
  }: {
    field: SortField;
    children: ReactNode;
    className?: string;
  }) => (
    <TableHead className={`sticky top-0 z-30 bg-card font-semibold ${className}`}>
      <button
        className="flex w-full select-none items-center hover:text-foreground"
        onClick={() => handleSort(field)}
        type="button"
      >
        {children}
        {getSortIcon(field)}
      </button>
    </TableHead>
  );

  return (
    <TooltipProvider>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {isAdmin && selectedIds.size > 0 && (
          <div className="relative z-40 flex items-center justify-between border-b border-destructive/20 bg-destructive/10 px-4 py-2 animate-in fade-in duration-300">
            <span className="text-sm font-medium text-destructive">
              {selectedIds.size} sample{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="h-8 gap-1.5" size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Delete {selectedIds.size} Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {selectedIds.size} Samples
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete{' '}
                    <span className="font-semibold text-foreground">
                      {selectedIds.size} sample
                      {selectedIds.size !== 1 ? 's' : ''}
                    </span>
                    ? All associated process logs and mycotoxin results will also
                    be deleted. This action cannot be undone.
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
        <div
          className="relative max-h-[70vh] overflow-auto"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          ref={scrollContainerRef}
        >
          <Table className="relative">
            <TableHeader className="sticky top-0 z-30 bg-card/70 shadow-[0_1px_0_0_hsl(var(--border)/0.5)] backdrop-blur-xl">
              <TableRow className="h-12 bg-muted hover:bg-muted">
                {isSelectionMode && (
                  <TableHead className="w-[40px] px-4">
                    <div
                      className={cn(
                        'flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border transition-all',
                        allSelected
                          ? 'bg-primary border-primary'
                          : someSelected
                            ? 'bg-primary/50 border-primary'
                            : 'border-muted-foreground/30',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelectAll();
                      }}
                    >
                      {allSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                      {!allSelected && someSelected && (
                        <div className="h-1 w-2 rounded-full bg-white" />
                      )}
                    </div>
                  </TableHead>
                )}
                <SortableHeader className="w-[160px]" field="sample_id">
                  Sample ID
                </SortableHeader>
                <SortableHeader className="w-[130px]" field="region">
                  Region
                </SortableHeader>
                <SortableHeader className="w-[160px]" field="province">
                  Province
                </SortableHeader>
                <SortableHeader className="w-[160px]" field="district">
                  District
                </SortableHeader>
                <SortableHeader
                  className="min-w-[200px]"
                  field="vegetation_variety"
                >
                  Variety
                </SortableHeader>
                <SortableHeader className="w-[140px]" field="collection_date">
                  Date
                </SortableHeader>
                <SortableHeader className="w-[140px]" field="status">
                  Status
                </SortableHeader>
                <SortableHeader className="w-[140px]" field="risk">
                  Risk
                </SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSamples.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="h-32 rounded-b-xl bg-muted/5 text-center text-muted-foreground"
                    colSpan={columnCount}
                  >
                    No samples found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {topSpacerHeight > 0 && (
                    <TableRow aria-hidden="true" className="hover:bg-transparent">
                      <TableCell
                        className="border-0 p-0"
                        colSpan={columnCount}
                        style={{ height: `${topSpacerHeight}px` }}
                      />
                    </TableRow>
                  )}
                  {visibleSamples.map((sample) => (
                    <SampleRow
                      getStatusBadge={getStatusBadge}
                      isSelected={selectedIds.has(sample.sample_id)}
                      isSelectionMode={isSelectionMode}
                      isWatching={isWatching(sample.sample_id)}
                      key={sample.sample_id}
                      onSelect={onSelectSample}
                      onToggleSelect={toggleSelectRow}
                      onToggleWatch={toggleWatchlist}
                      sample={sample}
                    />
                  ))}
                  {bottomSpacerHeight > 0 && (
                    <TableRow aria-hidden="true" className="hover:bg-transparent">
                      <TableCell
                        className="border-0 p-0"
                        colSpan={columnCount}
                        style={{ height: `${bottomSpacerHeight}px` }}
                      />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default SampleTable;
