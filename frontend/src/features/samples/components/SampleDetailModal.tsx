import { useState } from 'react';
import { Sample, ProcessLog, PROCESSING_TYPE_LABELS, ProcessingType } from '@/types/sample';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Leaf, Calendar, ClipboardList, ArrowRight, User, Info, Tag, ChevronDown, AlertTriangle, CheckCircle2, Beaker } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import ProcessTimeline from './ProcessTimeline';
import MycotoxinResults from './MycotoxinResults';
import AdminStatusApproval from './AdminStatusApproval';
import { useAuth } from '@/contexts/AuthContext';

interface SampleDetailModalProps {
  sample: Sample | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSample?: (sampleId: string, newLog: ProcessLog) => void;
}

const SampleDetailModal = ({ sample, open, onOpenChange, onUpdateSample }: SampleDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('details');
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const { isAdmin } = useAuth();

  if (!sample) return null;

  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    flagged: 'Flagged',
  };

  const hasDangerousResults = sample.mycotoxin_results.some(r => r.dangerous);
  const hasResults = sample.mycotoxin_results.length > 0;

  const handleStatusUpdate = (sampleId: string, newLog: ProcessLog) => {
    onUpdateSample?.(sampleId, newLog);
  };

  const CollapsibleSection = ({ 
    title, 
    icon: Icon, 
    isOpen, 
    onToggle, 
    children,
    badge,
    isDangerous = false
  }: { 
    title: string; 
    icon: React.ElementType; 
    isOpen: boolean; 
    onToggle: () => void; 
    children: React.ReactNode;
    badge?: React.ReactNode;
    isDangerous?: boolean;
  }) => (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className={cn(
        "flex w-full items-center justify-between rounded-lg border p-3 transition-colors",
        isDangerous 
          ? "border-danger/50 bg-danger/10 hover:bg-danger/20" 
          : "border-border bg-muted/30 hover:bg-muted/50"
      )}>
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", isDangerous ? "text-danger" : "text-primary")} />
          <span className="font-medium text-sm">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="details" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Details
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="update" className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                Approve Status
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            {/* Key Information - Always Visible */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Key Information</h3>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Location */}
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">
                      {sample.district}, {sample.province}
                    </p>
                    <p className="text-sm text-muted-foreground">{sample.region}</p>
                  </div>
                </div>

                {/* Variety */}
                <div className="flex items-start gap-3">
                  <Leaf className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Variety</p>
                    <p className="font-medium text-foreground">{sample.vegetation_variety}</p>
                  </div>
                </div>

                {/* Collection Date */}
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Collection Date</p>
                    <p className="font-medium text-foreground">
                      {format(new Date(sample.collection_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Risk Status */}
                <div className="flex items-start gap-3">
                  {hasDangerousResults ? (
                    <AlertTriangle className="h-5 w-5 text-danger shrink-0 mt-0.5" />
                  ) : hasResults ? (
                    <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  ) : (
                    <Beaker className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Risk Level</p>
                    <p className={`font-medium ${hasDangerousResults ? 'text-danger' : hasResults ? 'text-success' : 'text-muted-foreground'}`}>
                      {hasDangerousResults ? 'High Risk' : hasResults ? 'Safe' : 'Pending Analysis'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Mycotoxin Results - Collapsible but default open if results exist */}
            {hasResults && (
              <CollapsibleSection
                title="Test Results"
                icon={Beaker}
                isOpen={showResults}
                onToggle={() => setShowResults(!showResults)}
                isDangerous={hasDangerousResults}
                badge={
                  hasDangerousResults ? (
                    <Badge variant="destructive" className="ml-2">Positive</Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2 bg-success/10 text-success">Negative</Badge>
                  )
                }
              >
                <MycotoxinResults results={sample.mycotoxin_results} />
              </CollapsibleSection>
            )}

            {/* Additional Information - Collapsible */}
            <CollapsibleSection
              title="Additional Details"
              icon={Info}
              isOpen={showMoreInfo}
              onToggle={() => setShowMoreInfo(!showMoreInfo)}
            >
              <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex items-start gap-3">
                  <Tag className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Purpose</p>
                    <p className="font-medium text-foreground text-sm capitalize">
                      {sample.purpose || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Tag className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Sample Type</p>
                    <p className="font-medium text-foreground text-sm capitalize">
                      {sample.sample_type || 'N/A'}
                    </p>
                  </div>
                </div>

                {sample.processing_type && (
                  <div className="flex items-start gap-3">
                    <Beaker className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Processing Type</p>
                      <p className="font-medium text-foreground text-sm">
                        {PROCESSING_TYPE_LABELS[sample.processing_type as ProcessingType] || sample.processing_type}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Collected By</p>
                    <p className="font-medium text-foreground text-sm">
                      {sample.collected_by || 'Unknown'}
                    </p>
                  </div>
                </div>

                {sample.additional_info && (
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="font-medium text-foreground text-sm">
                        {sample.additional_info}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            {/* Process Timeline - Collapsible */}
            <CollapsibleSection
              title="Process Timeline"
              icon={ClipboardList}
              isOpen={showTimeline}
              onToggle={() => setShowTimeline(!showTimeline)}
              badge={
                <Badge variant="secondary" className="ml-2">
                  {sample.process_logs.length} steps
                </Badge>
              }
            >
              <ProcessTimeline logs={sample.process_logs} />
            </CollapsibleSection>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="update" className="mt-4">
              <AdminStatusApproval sample={sample} onUpdate={handleStatusUpdate} />
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SampleDetailModal;
