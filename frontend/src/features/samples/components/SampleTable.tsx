import { useState } from 'react';
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

interface SampleTableProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
  isAdmin?: boolean;
  onDeleteSample?: (sampleId: string) => void;
  onBulkDeleteSamples?: (sampleIds: string[]) => void;
}

type SortField = 'province' | 'collection_date' | 'status' | 'risk' | 'vegetation_variety';
type SortDirection = 'asc' | 'desc' | null;

const SampleTable = ({ samples, onSelectSample, isAdmin = false, onDeleteSample, onBulkDeleteSamples }: SampleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { isWatching, toggleWatchlist } = useWatchlist();

  const getStatusBadge = (sample: Sample) => {
    // Get the latest process state from logs (this is what's actually recorded)
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
      preparing: { bg: 'bg-amber-200', text: 'text-amber-800' },
      prepared: { bg: 'bg-cyan-200', text: 'text-cyan-800' },
      analyzing: { bg: 'bg-blue-200', text: 'text-blue-800' },
      recorded: { bg: 'bg-teal-200', text: 'text-teal-800' },
      completed: { bg: 'bg-green-200', text: 'text-green-800' },
    };
    
    const label = latestState ? stateLabels[latestState] : 'Not Started';
    const colors = latestState ? colorMap[latestState] : { bg: 'bg-slate-200', text: 'text-slate-800' };
    
    return (
      <Badge className={`${colors.bg} ${colors.text} border-0`}>
        {label}
      </Badge>
    );
  };

  const hasDangerousResults = (sample: Sample) => {
    if (sample.mycotoxin_results && sample.mycotoxin_results.length > 0) {
      return sample.mycotoxin_results.some(r => r.dangerous);
    }
    return sample.risk_level === 'high';
  };

  const hasRecordedResults = (sample: Sample) => {
    if (sample.mycotoxin_results && sample.mycotoxin_results.length > 0) {
      return true;
    }
    return (sample.results_count ?? 0) > 0 || ['low', 'medium', 'high'].includes(sample.risk_level || '');
  };

  const getMaxIntensity = (sample: Sample) => {
    if (!sample.mycotoxin_results || sample.mycotoxin_results.length === 0) return null;
    return Math.max(...sample.mycotoxin_results.map(r => r.intensity));
  };

  const getRiskScore = (sample: Sample) => {
    if (!hasRecordedResults(sample)) return -1;
    const maxIntensity = getMaxIntensity(sample);
    if (hasDangerousResults(sample)) return 100 + (maxIntensity ?? 1);
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

  const handleSort = (field: SortField) => {
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
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3 w-3" />;
    return <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const sortedSamples = [...samples].sort((a, b) => {
    if (!sortField || !sortDirection) return 0;

    let comparison = 0;
    switch (sortField) {
      case 'province':
        comparison = a.province.localeCompare(b.province);
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

  const allSelected = sortedSamples.length > 0 && sortedSamples.every(s => selectedIds.has(s.sample_id));
  const someSelected = !allSelected && sortedSamples.some(s => selectedIds.has(s.sample_id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedSamples.map(s => s.sample_id)));
    }
  };

  const toggleSelectRow = (sampleId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(sampleId)) next.delete(sampleId); else next.add(sampleId);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (onBulkDeleteSamples) {
      onBulkDeleteSamples(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="font-semibold cursor-pointer hover:bg-muted/30 transition-colors select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        {/* {getSortIcon(field)} */}
      </div>
    </TableHead>
  );

  return (
    <TooltipProvider>
      <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-up">
        {isAdmin && selectedIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-destructive/10 border-b border-destructive/20">
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
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {isAdmin && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead className="font-semibold w-10">Track</TableHead>
              <TableHead className="font-semibold">Sample ID</TableHead>
              <TableHead className="font-semibold">Region</TableHead>
              <SortableHeader field="province">Province</SortableHeader>
              <TableHead className="font-semibold">District</TableHead>
              <SortableHeader field="vegetation_variety">Variety</SortableHeader>
              <SortableHeader field="collection_date">Date</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="risk">Risk</SortableHeader>
              <TableHead className="font-semibold text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSamples.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 11 : 10} className="h-24 text-center text-muted-foreground">
                  No samples found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedSamples.map((sample, index) => (
                <TableRow
                  key={sample.sample_id}
                  className={`cursor-pointer transition-colors hover:bg-muted/30 ${isWatching(sample.sample_id) ? 'bg-primary/5' : ''} ${selectedIds.has(sample.sample_id) ? 'bg-destructive/5' : ''}`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {isAdmin && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(sample.sample_id)}
                        onCheckedChange={() => toggleSelectRow(sample.sample_id)}
                        aria-label={`Select ${sample.sample_id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${isWatching(sample.sample_id) ? 'text-primary' : 'text-muted-foreground'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWatchlist(sample.sample_id);
                          }}
                        >
                          {isWatching(sample.sample_id) ? (
                            <Bell className="h-4 w-4 fill-current" />
                          ) : (
                            <BellOff className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isWatching(sample.sample_id) ? 'Remove from watchlist' : 'Add to watchlist'}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="font-medium text-primary">{sample.sample_id}</TableCell>
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
                    {hasDangerousResults(sample) ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-danger cursor-help">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs font-medium">Positive</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold text-danger">Positive - Exceeds threshold</p>
                            {sample.mycotoxin_results?.filter(r => r.dangerous).map((r, i) => (
                              <p key={i} className="text-xs">
                                {r.name}: <span className="font-medium">{r.intensity} {r.unit}</span>
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : hasRecordedResults(sample) ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-success cursor-help">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Negative</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold text-success">Negative - No result exceeded threshold</p>
                            {sample.mycotoxin_results?.map((r, i) => (
                              <p key={i} className="text-xs">
                                {r.name}: <span className="font-medium">{r.intensity} {r.unit}</span>
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onSelectSample(sample)}
                        className="h-8"
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        View
                      </Button>
                      {isAdmin && onDeleteSample && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Sample</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to permanently delete{' '}
                                <span className="font-semibold text-foreground">{sample.sample_id}</span>?{' '}
                                This will also delete all associated process logs and mycotoxin results.
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onDeleteSample(sample.sample_id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
};

export default SampleTable;
