import { ProcessLog } from '@/types/sample';
import { format } from 'date-fns';
import { Package, FlaskConical, Microscope, FileCheck, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProcessTimelineProps {
  logs: ProcessLog[];
}

const stateConfig = {
  received: { icon: Package, label: 'Received', color: 'text-muted-foreground bg-muted' },
  prepared: { icon: FlaskConical, label: 'Prepared', color: 'text-primary bg-primary/10' },
  testing: { icon: Microscope, label: 'Testing', color: 'text-warning bg-warning/10' },
  analyzed: { icon: FileCheck, label: 'Analyzed', color: 'text-accent-foreground bg-accent' },
  completed: { icon: CheckCircle, label: 'Completed', color: 'text-success bg-success/10' },
};

const ProcessTimeline = ({ logs }: ProcessTimelineProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Process Log</h3>
      <div className="relative space-y-4">
        {logs.map((log, index) => {
          const config = stateConfig[log.state];
          const Icon = config.icon;
          const isLast = index === logs.length - 1;
          
          return (
            <div key={log.id} className="relative flex gap-4">
              {!isLast && (
                <div className="absolute left-5 top-10 h-full w-0.5 bg-border" />
              )}
              <div className={cn('relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full', config.color)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-foreground">{config.label}</p>
                  <time className="text-xs text-muted-foreground">
                    {format(new Date(log.timestamp), 'MMM dd, HH:mm')}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Conducted by: <span className="font-medium text-foreground">{log.conducted_by}</span>
                </p>
                {log.test_id && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Test ID: <span className="font-mono text-primary">{log.test_id}</span>
                  </p>
                )}
                {log.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">{log.notes}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessTimeline;
