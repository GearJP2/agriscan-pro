import { useState } from 'react';
import { Sample, ProcessState, PROCESS_STATE_ORDER, PROCESS_STATE_INFO, ProcessLog } from '@/types/sample';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, User, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AdminStatusApprovalProps {
  sample: Sample;
  onUpdate: (sampleId: string, newLog: ProcessLog) => void;
}

const AdminStatusApproval = ({ sample, onUpdate }: AdminStatusApprovalProps) => {
  const [conductedBy, setConductedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Get current state from the latest log
  const currentState = sample.process_logs.length > 0 
    ? sample.process_logs[sample.process_logs.length - 1].state 
    : null;

  const currentStateIndex = currentState ? PROCESS_STATE_ORDER.indexOf(currentState) : -1;
  
  // Get the next state only (one step at a time)
  const nextState: ProcessState | null = currentStateIndex < PROCESS_STATE_ORDER.length - 1 
    ? PROCESS_STATE_ORDER[currentStateIndex + 1] 
    : null;

  const handleApprove = () => {
    if (!nextState) return;
    
    if (!conductedBy.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const newLog: ProcessLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      state: nextState,
      conducted_by: conductedBy.trim(),
      notes: notes.trim() || undefined,
    };

    onUpdate(sample.sample_id, newLog);
    
    // Reset form
    setConductedBy('');
    setNotes('');
    
    toast.success(`Status updated to "${PROCESS_STATE_INFO[nextState].label}"`);
  };

  if (!nextState) {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <p className="font-medium">This sample has completed all process steps.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const nextStateInfo = PROCESS_STATE_INFO[nextState];
  const currentStateInfo = currentState ? PROCESS_STATE_INFO[currentState] : null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowRight className="h-5 w-5 text-primary" />
          Approve Next Step
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current to Next State Display */}
        <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/50 p-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Current</p>
            <p className="font-semibold text-foreground">
              {currentStateInfo?.label || 'Not started'}
            </p>
          </div>
          <ChevronRight className="h-6 w-6 text-primary" />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Next Step</p>
            <p className="font-semibold text-primary">{nextStateInfo.label}</p>
          </div>
        </div>

        {/* Description of next step */}
        <p className="text-sm text-muted-foreground text-center italic">
          {nextStateInfo.description}
        </p>

        {/* Conducted By */}
        <div className="space-y-2">
          <Label htmlFor="conductedBy" className="flex items-center gap-2 text-sm font-medium">
            <User className="h-4 w-4" />
            Your Name *
          </Label>
          <Input
            id="conductedBy"
            value={conductedBy}
            onChange={(e) => setConductedBy(e.target.value)}
            placeholder="Enter your name"
            required
          />
        </div>

        {/* Notes (Optional) */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Notes (Optional)
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any relevant notes..."
            rows={2}
          />
        </div>

        <Button 
          onClick={handleApprove} 
          className="w-full gap-2"
          size="lg"
        >
          <CheckCircle2 className="h-5 w-5" />
          Approve: {nextStateInfo.label}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdminStatusApproval;
