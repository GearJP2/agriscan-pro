import { useState } from 'react';
import { Sample, ProcessState, PROCESS_STATE_ORDER, ProcessLog } from '@/types/sample';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, User, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface StatusUpdateFormProps {
  sample: Sample;
  onUpdate: (sampleId: string, newLog: ProcessLog) => void;
}

const stateLabels: Record<ProcessState, string> = {
  registered: 'Registered',
  preparing: 'Preparing',
  prepared: 'Prepared',
  analyzing: 'Analyzing',
  recorded: 'Recorded',
  notified: 'Notified',
  completed: 'Completed',
};

const StatusUpdateForm = ({ sample, onUpdate }: StatusUpdateFormProps) => {
  const [conductedBy, setConductedBy] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedState, setSelectedState] = useState<ProcessState | ''>('');

  // Get current state from the latest log
  const currentState = sample.process_logs.length > 0 
    ? sample.process_logs[sample.process_logs.length - 1].state 
    : null;

  const currentStateIndex = currentState ? PROCESS_STATE_ORDER.indexOf(currentState) : -1;
  
  // Get available next states (only states after current)
  const availableStates = PROCESS_STATE_ORDER.filter((_, index) => index > currentStateIndex);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedState) {
      toast.error('Please select a state');
      return;
    }
    
    if (!conductedBy.trim()) {
      toast.error('Please enter your name');
      return;
    }

    const newLog: ProcessLog = {
      id: `LOG-${Date.now()}`,
      timestamp: new Date().toISOString(),
      state: selectedState,
      conducted_by: conductedBy.trim(),
      notes: notes.trim() || undefined,
    };

    onUpdate(sample.sample_id, newLog);
    
    // Reset form
    setConductedBy('');
    setNotes('');
    setSelectedState('');
    
    toast.success(`Status updated to "${stateLabels[selectedState]}"`);
  };

  if (availableStates.length === 0) {
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

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ArrowRight className="h-5 w-5 text-primary" />
          Update Status
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Current: <span className="font-medium text-foreground">{currentState ? stateLabels[currentState] : 'Not started'}</span>
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* State Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Select Next State</Label>
            <RadioGroup 
              value={selectedState} 
              onValueChange={(value) => setSelectedState(value as ProcessState)}
              className="grid gap-2"
            >
              {availableStates.map((state) => (
                <div key={state} className="flex items-center">
                  <RadioGroupItem 
                    value={state} 
                    id={state}
                    className="peer sr-only"
                  />
                  <Label 
                    htmlFor={state}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-all",
                      "hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                    )}
                  >
                    <div className={cn(
                      "h-3 w-3 rounded-full border-2",
                      selectedState === state ? "border-primary bg-primary" : "border-muted-foreground"
                    )} />
                    <span className="font-medium">{stateLabels[state]}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Conducted By */}
          <div className="space-y-2">
            <Label htmlFor="conductedBy" className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Your Name
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

          <Button type="submit" className="w-full">
            Update Status
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default StatusUpdateForm;
