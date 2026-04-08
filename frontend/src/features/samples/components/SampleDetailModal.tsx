import { useState } from 'react';
import { Sample, ProcessLog, PROCESSING_TYPE_LABELS, ProcessingType } from '@/types/sample';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Leaf, Calendar, ClipboardList, ArrowRight, User, Info, Tag, ChevronDown, AlertTriangle, CheckCircle2, Beaker, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ProcessTimeline from './ProcessTimeline';
import MycotoxinResults from './MycotoxinResults';
import AdminStatusApproval from './AdminStatusApproval';
import MycotoxinForm from './MycotoxinForm';
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
  const [showMycotoxinForm, setShowMycotoxinForm] = useState(false);
  const { isAdmin } = useAuth();

  if (!sample) return null;

  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    flagged: 'Flagged',
  };

  const hasPositiveResults = sample.mycotoxin_results?.some(r => (r.is_detected ?? r.intensity > 0)) ?? false;
  const hasResults = (sample.mycotoxin_results?.length ?? 0) > 0;

  const handleStatusUpdate = (sampleId: string, newLog: ProcessLog) => {
    // Call the update callback if provided
    if (onUpdateSample) {
      onUpdateSample(sampleId, newLog);
      // Close modal after a brief delay to allow the update to process
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    }
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:rounded-2xl duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] border-primary/10">
        <DialogHeader className="relative overflow-hidden pt-8 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <Leaf className="h-24 w-24 -rotate-12" />
          </div>
          <div className="flex flex-col gap-1 relative z-10">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-3xl font-black tracking-tight text-primary">
                {sample.sample_id}
              </DialogTitle>
              <Badge variant={sample.status} className="rounded-full px-3 py-0.5 font-bold uppercase tracking-wider text-[10px]">
                {statusLabels[sample.status]}
              </Badge>
            </div>
            <p className="text-sm text-primary/60 font-medium">Research Sample Unit • AgriScan Pro</p>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} bg-muted/50 p-1 rounded-xl`}>
            <TabsTrigger value="details" className="flex items-center gap-2 rounded-lg transition-all duration-300">
              <ClipboardList className="h-4 w-4" />
              Details
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="update" className="flex items-center gap-2 rounded-lg transition-all duration-300">
                <ArrowRight className="h-4 w-4" />
                Approve Status
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            {/* Key Information - Always Visible */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-4">
              <h3 className="text-lg font-semibold text-primary uppercase tracking-wide">Key Information</h3>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Location */}
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-background border border-border/40 shadow-sm transition-all hover:border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-primary opacity-70" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Origin & Location</span>
                  </div>
                  <p className="font-bold text-foreground text-sm">
                    {sample.district}, {sample.province}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">{sample.region}</p>
                </div>

                {/* Variety */}
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-background border border-border/40 shadow-sm transition-all hover:border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Leaf className="h-4 w-4 text-primary opacity-70" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Vegetation Species</span>
                  </div>
                  <p className="font-bold text-foreground text-sm">{sample.vegetation_variety}</p>
                  <p className="text-xs text-primary/60 font-medium">Standard Variety</p>
                </div>

                {/* Collection Date */}
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-background border border-border/40 shadow-sm transition-all hover:border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-primary opacity-70" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Registry Date</span>
                  </div>
                  <p className="font-bold text-foreground text-sm">
                    {format(new Date(sample.collection_date), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium italic">Archive Entry</p>
                </div>

                {/* Risk Status */}
                <div className={cn(
                  "flex flex-col gap-1 p-3 rounded-xl border shadow-sm transition-all",
                  hasPositiveResults ? "bg-danger/[0.03] border-danger/20" : hasResults ? "bg-success/[0.03] border-success/20" : "bg-background border-border"
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    {hasPositiveResults ? (
                      <AlertTriangle className="h-4 w-4 text-danger animate-pulse" />
                    ) : hasResults ? (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    ) : (
                      <Beaker className="h-4 w-4 text-muted-foreground opacity-70" />
                    )}
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Mycotoxin Status</span>
                  </div>
                  <p className={cn(
                    "font-bold text-sm",
                    hasPositiveResults ? "text-danger" : hasResults ? "text-success" : "text-muted-foreground"
                  )}>
                    {hasPositiveResults ? 'Positive (Detected)' : hasResults ? 'Stable (LOD)' : 'Awaiting Test'}
                  </p>
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
                isDangerous={hasPositiveResults}
                badge={
                  hasPositiveResults ? (
                    <Badge variant="destructive" className="ml-2">Positive</Badge>
                  ) : (
                    <Badge variant="secondary" className="ml-2 bg-success/10 text-success">Negative</Badge>
                  )
                }
              >
                <MycotoxinResults results={sample.mycotoxin_results} />
              </CollapsibleSection>
            )}

            {/* Add Mycotoxin Result Form */}
            {isAdmin && (
              <div className="space-y-3">
                {showMycotoxinForm ? (
                  <MycotoxinForm
                    sampleId={sample.sample_id}
                    onSuccess={() => setShowMycotoxinForm(false)}
                    onClose={() => setShowMycotoxinForm(false)}
                  />
                ) : (
                  <Button
                    onClick={() => setShowMycotoxinForm(true)}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Test Result
                  </Button>
                )}
              </div>
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
                  {(sample.process_logs?.length ?? 0)} steps
                </Badge>
              }
            >
              <ProcessTimeline logs={sample.process_logs ?? []} />
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
