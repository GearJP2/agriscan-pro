import { Sample } from '@/types/sample';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { MapPin, Leaf, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import ProcessTimeline from './ProcessTimeline';
import MycotoxinResults from './MycotoxinResults';

interface SampleDetailModalProps {
  sample: Sample | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SampleDetailModal = ({ sample, open, onOpenChange }: SampleDetailModalProps) => {
  if (!sample) return null;

  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    flagged: 'Flagged',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl font-bold text-primary">
              {sample.sample_id}
            </DialogTitle>
            <Badge variant={sample.status}>{statusLabels[sample.status]}</Badge>
          </div>
        </DialogHeader>
        
        <div className="mt-4 space-y-6">
          {/* Sample Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Location</p>
                <p className="font-medium text-foreground">
                  {sample.district}, {sample.province}
                </p>
                <p className="text-sm text-muted-foreground">{sample.region} Region</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Leaf className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Variety</p>
                <p className="font-medium text-foreground">{sample.vegetation_variety}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
              <Calendar className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Collection Date</p>
                <p className="font-medium text-foreground">
                  {format(new Date(sample.collection_date), 'MMMM dd, yyyy')}
                </p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Process Timeline */}
          <ProcessTimeline logs={sample.process_logs} />
          
          <Separator />
          
          {/* Mycotoxin Results */}
          <MycotoxinResults results={sample.mycotoxin_results} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SampleDetailModal;
