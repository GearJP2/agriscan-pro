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
import { motion, AnimatePresence } from 'framer-motion';

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
import {
  getThresholdRiskScore,
  hasAboveThresholdResults,
  hasMeasuredResults,
  hasUnclassifiedResults,
} from '@/lib/mycotoxinRisk';
import { cn } from '@/lib/utils';
import type { Sample } from '@/types/sample';

interface SampleTableProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
  isAdmin?: boolean;
  isSelectionMode?: boolean;
  onBulkDeleteSamples?: (sampleIds: string[]) => void;
  watchlistOnly?: boolean;
  onToggleWatchlistOnly?: () => void;
  toolbar?: ReactNode;
}

type SortField =
  | 'sample_id'
  | 'region'
  | 'province'
  | 'district'
  | 'collection_date'
  | 'received_at'
  | 'status'
  | 'risk'
  | 'sub_type';
type SortDirection = 'asc' | 'desc' | null;

const TABLE_ROW_HEIGHT = 64;
const TABLE_OVERSCAN_ROWS = 8;
const VIRTUALIZATION_THRESHOLD = 60;

const getRiskScore = (sample: Sample) => {
  if (!hasMeasuredResults(sample)) {
    return -1;
  }

  return getThresholdRiskScore(sample);
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
          'group relative h-16 cursor-pointer border-b border-gfs-maroon/10 dark:border-white/5 border-l-4 border-l-transparent transition-all duration-200',
          'hover:bg-gfs-canvas/70 dark:hover:bg-white/[0.02] hover:border-l-gfs-maroon',
          isWatching && 'bg-amber-500/[0.04] border-l-gfs-gold',
          isSelected && 'bg-gfs-maroon/[0.08] border-l-gfs-maroon z-10',
          isSelectionMode && 'hover:ring-1 hover:ring-gfs-maroon/20',
        )}
        onClick={handleRowClick}
      >
        {isSelectionMode && (
          <TableCell className="w-[40px] px-4">
            <div
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-100',
                isSelected
                  ? 'bg-gfs-maroon border-gfs-maroon shadow-sm ring-2 ring-gfs-maroon/20'
                  : 'border-gfs-maroon/30 bg-background',
              )}
            >
              {isSelected && (
                <div className="h-2 w-2 rounded-full bg-white animate-in zoom-in-50 duration-200" />
              )}
            </div>
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              hasAboveThresholdResults(sample) ? "bg-rose-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                hasMeasuredResults(sample) ? "bg-blue-500" : "bg-muted-foreground/30"
            )} />
            <span className="font-bold text-gfs-maroon dark:text-gfs-gold tracking-tight">{sample.sample_id}</span>
          </div>
        </TableCell>
        <TableCell className="text-xs font-medium text-gfs-text-primary dark:text-slate-200">{sample.region}</TableCell>
        <TableCell className="text-xs font-medium text-gfs-text-primary dark:text-slate-200">{sample.province}</TableCell>
        <TableCell className="text-xs font-medium text-gfs-text-primary dark:text-slate-200">{sample.district}</TableCell>
        <TableCell>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="capitalize text-[10px] font-bold rounded-full bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold border border-gfs-maroon/20">
              {sample.food_feed_type || 'Legacy'}
            </Badge>
            <span className="text-xs font-semibold text-gfs-text-primary dark:text-slate-200">
              {sample.sub_type || sample.vegetation_variety || '—'}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-xs font-medium text-gfs-text-muted dark:text-slate-400">
          {format(new Date(sample.collection_date), 'MMM dd, yyyy')}
        </TableCell>
        <TableCell className="text-xs font-medium text-gfs-text-muted dark:text-slate-400">
          {sample.received_at ? format(new Date(sample.received_at), 'MMM dd, yyyy') : '—'}
        </TableCell>
        <TableCell>{getStatusBadge(sample)}</TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="flex items-center gap-2">
            {hasAboveThresholdResults(sample) ? (
              <Badge className="bg-rose-600 hover:bg-rose-700 text-white border-none px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight rounded-full shadow-sm">
                Positive
              </Badge>
            ) : hasUnclassifiedResults(sample) ? (
              <Badge variant="secondary" className="rounded-full text-[10px] font-bold">Unclassified</Badge>
            ) : hasMeasuredResults(sample) ? (
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-none px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-tight rounded-full shadow-sm">
                Below Threshold
              </Badge>
            ) : (
              <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-gfs-text-muted">
                Pending
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="w-12">
          <div className="flex justify-center">
            {!isSelectionMode && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={cn(
                      'rounded-full p-2 transform transition-all duration-300',
                      isWatching
                        ? 'bg-amber-500/15 text-gfs-gold ring-1 ring-gfs-gold/30 opacity-100'
                        : 'text-gfs-text-muted hover:text-gfs-maroon hover:bg-gfs-maroon/5 opacity-0 group-hover:opacity-100',
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleWatch(sample.sample_id);
                    }}
                    type="button"
                  >
                    <motion.div
                      initial={false}
                      animate={{ scale: isWatching ? 1.1 : 1 }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {isWatching ? (
                        <Bell className="h-4 w-4 fill-gfs-gold text-gfs-gold" />
                      ) : (
                        <BellOff className="h-4 w-4 opacity-60" />
                      )}
                    </motion.div>
                  </button>
                </TooltipTrigger>
                <TooltipContent className="rounded-xl font-sans text-xs">
                  {isWatching ? 'Remove from watchlist' : 'Add to watchlist'}
                </TooltipContent>
              </Tooltip>
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
  watchlistOnly = false,
  onToggleWatchlistOnly,
  toolbar,
}: SampleTableProps) => {
  console.log('SampleTable: current watchlistOnly prop is', watchlistOnly);
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

    const colorMap: Record<string, string> = {
      registered: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
      preparing: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      prepared: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
      analyzing: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      recorded: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      completed: 'bg-success/10 text-success border-success/20',
    };

    const label = latestState ? stateLabels[latestState] : 'Not Started';
    const classes = latestState ? colorMap[latestState] : 'bg-slate-500/10 text-slate-600 border-slate-500/20';

    return (
      <Badge variant="outline" className={cn("font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm transition-all duration-300", classes)}>
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
        case 'received_at':
          comparison =
            new Date(a.received_at || 0).getTime() -
            new Date(b.received_at || 0).getTime();
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'risk':
          comparison = getRiskScore(a) - getRiskScore(b);
          break;
        case 'sub_type':
          comparison = (a.sub_type || a.vegetation_variety || '').localeCompare(b.sub_type || b.vegetation_variety || '');
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
  const columnCount = isSelectionMode ? 11 : 10;

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
        className="flex w-full select-none items-center hover:text-foreground transition-colors"
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
      <div className="overflow-hidden rounded-gfs-card border border-gfs-maroon/15 dark:border-white/10 bg-white dark:bg-slate-900/90 shadow-gfs-card font-sans">
        {toolbar && (
          <div className="border-b border-gfs-maroon/10 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 p-4 sm:px-6">
            {toolbar}
          </div>
        )}
        {isAdmin && selectedIds.size > 0 && (
          <div className="relative z-40 flex items-center justify-between border-b border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-6 py-3 animate-in fade-in duration-300">
            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wide">
              {selectedIds.size} sample{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="h-8 rounded-md gap-1.5 px-4 text-xs font-bold" size="sm" variant="destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete {selectedIds.size} Selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-gfs-card border border-gfs-maroon/20 shadow-gfs-modal bg-white dark:bg-slate-900 font-sans">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-bold text-rose-600">
                    Delete {selectedIds.size} Samples
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-gfs-text-muted">
                    Are you sure you want to permanently delete{' '}
                    <span className="font-bold text-rose-600">
                      {selectedIds.size} sample
                      {selectedIds.size !== 1 ? 's' : ''}
                    </span>
                    ? All associated process logs and mycotoxin results will also
                    be deleted. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-md text-xs font-bold">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-rose-600 text-white hover:bg-rose-700 rounded-md text-xs font-bold"
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
          className="relative max-h-[70vh] overflow-auto scrollbar-thin scrollbar-thumb-gfs-maroon/20 hover:scrollbar-thumb-gfs-maroon/40"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          ref={scrollContainerRef}
        >
          <Table className="relative">
            <TableHeader className="sticky top-0 z-30 bg-card shadow-[0_1px_0_0_hsl(var(--border)/0.5)]">
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
                  field="sub_type"
                >
                  Food / Feed
                </SortableHeader>
                <SortableHeader className="w-[140px]" field="collection_date">
                  Collected
                </SortableHeader>
                <SortableHeader className="w-[140px]" field="received_at">
                  Received
                </SortableHeader>
                <SortableHeader className="w-[140px]" field="status">
                  Status
                </SortableHeader>
                <SortableHeader className="min-w-[150px] w-[150px]" field="risk">
                  Risk
                </SortableHeader>
                <TableHead className={cn(
                  "sticky top-0 z-30 bg-card w-12 text-center transition-all duration-300 px-0",
                  watchlistOnly && "bg-info/10"
                )}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Watchlist header clicked, toggling:', !watchlistOnly);
                      onToggleWatchlistOnly?.();
                    }}
                    className={cn(
                      "flex items-center justify-center w-full h-12 hover:text-info transition-colors group cursor-pointer",
                      watchlistOnly ? "text-info" : "opacity-70"
                    )}
                    title={watchlistOnly ? "Show all samples" : "Show watchlist only"}
                  >
                    <motion.div
                      animate={{ 
                        scale: watchlistOnly ? [1, 1.2, 1] : 1,
                        rotate: watchlistOnly ? [0, 15, -15, 0] : 0
                      }}
                      transition={{ duration: 0.4 }}
                    >
                      <Bell className={cn("h-4 w-4", watchlistOnly && "fill-current")} />
                    </motion.div>
                  </button>
                </TableHead>
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
