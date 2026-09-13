import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sample, ProcessLog, PROCESSING_TYPE_LABELS, ProcessingType } from '@/types/sample';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { MapPin, Leaf, Calendar, ClipboardList, ArrowRight, User, Info, Tag, ChevronDown, AlertTriangle, CheckCircle2, Beaker, Plus, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ProcessTimeline from './ProcessTimeline';
import MycotoxinResults from './MycotoxinResults';
import AdminStatusApproval from './AdminStatusApproval';
import MycotoxinForm from './MycotoxinForm';
import { useAuth } from '@/contexts/AuthContext';
import {
  canRecordSampleResults,
  hasAboveThresholdResults,
  hasMeasuredResults,
  hasUnclassifiedResults,
} from '@/lib/mycotoxinRisk';
import { USER_ROLE_WEIGHT, UserRole } from '@/types/user';

interface SampleDetailModalProps {
  sample: Sample | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateSample?: (sampleId: string, newLog: ProcessLog) => void;
  onMycotoxinResultChange?: (sampleId: string) => void;
}

const SampleDetailModal = ({ sample, open, onOpenChange, onUpdateSample, onMycotoxinResultChange }: SampleDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('details');
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [showMycotoxinForm, setShowMycotoxinForm] = useState(false);
  const { isAdmin, role, user } = useAuth();

  useEffect(() => {
    setShowMycotoxinForm(false);
  }, [sample?.sample_id]);

  if (!sample) return null;

  const statusLabels = {
    pending: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed',
    flagged: 'Flagged',
  };

  const hasPositiveResults = hasAboveThresholdResults(sample);
  const hasResults = hasMeasuredResults(sample);
  const hasUnclassified = hasUnclassifiedResults(sample);
  const canUsePredictionTools = (USER_ROLE_WEIGHT[role as UserRole] ?? 0) >= USER_ROLE_WEIGHT.researcher;
  const canRecordResults = canRecordSampleResults(sample, role, isAdmin, user?.username);
  const predictionContext = sample.prediction_context;
  const predictionContextCount = [
    predictionContext?.location_type && predictionContext.location_type !== 'unknown',
    predictionContext?.harvest_date,
    predictionContext?.sowing_date,
    predictionContext?.latitude !== null && predictionContext?.latitude !== undefined
      && predictionContext?.longitude !== null && predictionContext?.longitude !== undefined,
    predictionContext?.moisture_pct !== null && predictionContext?.moisture_pct !== undefined,
    predictionContext?.soil_ph !== null && predictionContext?.soil_ph !== undefined,
    predictionContext?.crop_variety,
    predictionContext?.crop_season,
    predictionContext?.soil_type,
    predictionContext?.storage_duration_days !== null && predictionContext?.storage_duration_days !== undefined,
    predictionContext?.crop_rotation,
    predictionContext?.fertiliser_details,
    predictionContext?.fungicide_details,
  ].filter(Boolean).length;

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
          <span className="font-semibold text-foreground text-sm">{title}</span>
          {badge}
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">{sample.sample_id}</DialogTitle>
              <Badge variant={sample.status === 'flagged' ? 'destructive' : 'outline'} className="capitalize font-semibold text-xs">
                {statusLabels[sample.status]}
              </Badge>
            </div>
            <DialogDescription className="text-sm text-primary/60 font-medium">Research Sample Unit • AgriScan Pro</DialogDescription>
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
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Food / Feed Type</span>
                  </div>
                  <p className="font-bold text-foreground text-sm capitalize">{sample.food_feed_type || 'Legacy sample'}</p>
                  <p className="text-xs text-primary/60 font-medium">{sample.sub_type || sample.vegetation_variety || 'Not specified'}</p>
                </div>

                {/* Collection Date */}
                <div className="flex flex-col gap-1 p-3 rounded-xl bg-background border border-border/40 shadow-sm transition-all hover:border-primary/20">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-primary opacity-70" />
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Collection Date</span>
                  </div>
                  <p className="font-bold text-foreground text-sm">
                    {format(new Date(sample.collection_date), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium italic">Sample collection</p>
                </div>

                {/* Risk Status */}
                <div className={cn(
                  "flex flex-col gap-1 p-3 rounded-xl border shadow-sm transition-all",
                  hasPositiveResults ? "bg-danger/[0.03] border-danger/20" : !hasUnclassified && hasResults ? "bg-success/[0.03] border-success/20" : "bg-background border-border"
                )}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      {hasPositiveResults ? (
                        <AlertTriangle className="h-4 w-4 text-danger animate-pulse" />
                      ) : !hasUnclassified && hasResults ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <Beaker className="h-4 w-4 text-muted-foreground opacity-70" />
                      )}
                      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Mycotoxin Status</span>
                    </div>
                    {canRecordResults && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1 -mr-1"
                        onClick={() => {
                          setShowResults(true);
                          setShowMycotoxinForm(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        บันทึกผลตรวจ
                      </Button>
                    )}
                  </div>
                  <p className={cn(
                    "font-bold text-sm",
                    hasPositiveResults ? "text-danger" : !hasUnclassified && hasResults ? "text-success" : "text-muted-foreground"
                  )}>
                    {hasPositiveResults ? 'Positive (Above Threshold)' : hasUnclassified ? 'Threshold data incomplete' : hasResults ? 'Stable (Below Threshold)' : 'Awaiting Test'}
                  </p>
                </div>


              </div>
            </div>

            {canUsePredictionTools && (
              <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <TrendingUp className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold text-foreground">Prediction context</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {predictionContextCount > 0
                          ? `${predictionContextCount} of 13 optional predictor signals are recorded.`
                          : 'No optional predictor context has been recorded for this sample yet.'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Estimates use this sample ID plus saved context such as coordinates, crop timing,
                        storage, moisture, soil, and treatment notes.
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="shrink-0">
                    <Link
                      to={`/prediction?sample_id=${encodeURIComponent(sample.sample_id)}`}
                      onClick={() => onOpenChange(false)}
                    >
                      Open prediction
                    </Link>
                  </Button>
                </div>
              </div>
            )}

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
            {canRecordResults && (
              <div className="space-y-3">
                {showMycotoxinForm ? (
                  <MycotoxinForm
                    sampleId={sample.sample_id}
                    onSuccess={() => {
                      setShowMycotoxinForm(false);
                      onMycotoxinResultChange?.(sample.sample_id);
                    }}
                    onClose={() => setShowMycotoxinForm(false)}
                  />
                ) : (
                  <Button
                    onClick={() => setShowMycotoxinForm(true)}
                    variant="default"
                    className="w-full gap-2 shadow-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" />
                    บันทึกผลตรวจ (Record Test Result)
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
                    <p className="text-xs text-muted-foreground">Recorded By</p>
                    <p className="font-medium text-foreground text-sm">
                      {sample.recorded_by || 'System'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Received At</p>
                    <p className="font-medium text-foreground text-sm">{sample.received_at ? format(new Date(sample.received_at), 'MMM dd, yyyy p') : 'Legacy sample'}</p>
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
