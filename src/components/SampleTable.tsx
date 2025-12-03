import { Sample } from '@/types/sample';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface SampleTableProps {
  samples: Sample[];
  onSelectSample: (sample: Sample) => void;
}

const SampleTable = ({ samples, onSelectSample }: SampleTableProps) => {
  const getStatusBadge = (status: Sample['status']) => {
    const statusLabels = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
      flagged: 'Flagged',
    };
    return <Badge variant={status}>{statusLabels[status]}</Badge>;
  };

  const hasDangerousResults = (sample: Sample) => {
    return sample.mycotoxin_results.some(r => r.dangerous);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-slide-up">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold">Sample ID</TableHead>
            <TableHead className="font-semibold">Region</TableHead>
            <TableHead className="font-semibold">Province</TableHead>
            <TableHead className="font-semibold">District</TableHead>
            <TableHead className="font-semibold">Variety</TableHead>
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Risk</TableHead>
            <TableHead className="font-semibold text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No samples found matching your filters.
              </TableCell>
            </TableRow>
          ) : (
            samples.map((sample, index) => (
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
                    <div className="flex items-center gap-1.5 text-danger">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">High</span>
                    </div>
                  ) : sample.mycotoxin_results.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-xs font-medium">Safe</span>
                    </div>
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
  );
};

export default SampleTable;
