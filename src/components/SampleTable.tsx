import { useState } from 'react';
import { Sample } from '@/types/sample';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, AlertTriangle, CheckCircle2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format } from 'date-fns';

interface SampleTableProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
}

type SortField = 'province' | 'collection_date' | 'status' | 'risk' | 'vegetation_variety';
type SortDirection = 'asc' | 'desc' | null;

const SampleTable = ({ samples, onSelectSample }: SampleTableProps) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const getStatusBadge = (status: Sample['status']) => {
    const statusLabels = {
      pending: 'Data uploaded',
      in_progress: 'Preparing',
      completed: 'Completed',
      flagged: 'Analyzed',
    };
    return <Badge variant={status}>{statusLabels[status]}</Badge>;
  };

  const hasDangerousResults = (sample: Sample) => {
    return sample.mycotoxin_results.some(r => r.dangerous);
  };

  const getMaxIntensity = (sample: Sample) => {
    if (sample.mycotoxin_results.length === 0) return null;
    return Math.max(...sample.mycotoxin_results.map(r => r.intensity));
  };

  const getRiskScore = (sample: Sample) => {
    if (sample.mycotoxin_results.length === 0) return -1;
    if (hasDangerousResults(sample)) return 100 + getMaxIntensity(sample)!;
    return getMaxIntensity(sample)!;
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
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Sample ID</TableHead>
              <TableHead className="font-semibold">Region</TableHead>
              <SortableHeader field="province">Province</SortableHeader>
              <TableHead className="font-semibold">District</TableHead>
              <SortableHeader field="vegetation_variety">Variety</SortableHeader>
              <SortableHeader field="collection_date">Date</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <SortableHeader field="risk">Risk</SortableHeader>
              <TableHead className="font-semibold text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSamples.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No samples found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              sortedSamples.map((sample, index) => (
                <TableRow 
                  key={sample.sample_id} 
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
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
                  <TableCell>{getStatusBadge(sample.status)}</TableCell>
                  <TableCell>
                    {hasDangerousResults(sample) ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-danger cursor-help">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs font-medium">High</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold text-danger">⚠️ High Risk - Exceeds Threshold</p>
                            {sample.mycotoxin_results.filter(r => r.dangerous).map((r, i) => (
                              <p key={i} className="text-xs">
                                {r.name}: <span className="font-medium">{r.intensity}/{r.threshold} {r.unit}</span>
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : sample.mycotoxin_results.length > 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5 text-success cursor-help">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Safe</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <div className="space-y-1">
                            <p className="font-semibold text-success">✓ Safe - Within Limits</p>
                            {sample.mycotoxin_results.map((r, i) => (
                              <p key={i} className="text-xs">
                                {r.name}: <span className="font-medium">{r.intensity}/{r.threshold} {r.unit}</span>
                              </p>
                            ))}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => onSelectSample(sample)}
                      className="h-8"
                    >
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
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
