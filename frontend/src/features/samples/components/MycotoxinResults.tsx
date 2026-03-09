import { MycotoxinResult } from '@/types/sample';
import { AlertTriangle, CheckCircle2, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MycotoxinResultsProps {
  results?: MycotoxinResult[] | null;
}

const MycotoxinResults = ({ results }: MycotoxinResultsProps) => {
  if (!results || results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">No mycotoxin results available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Mycotoxin Analysis</h3>
      <div className="space-y-3">
        {results.map((result, index) => (
          <div 
            key={index} 
            className={cn(
              'rounded-lg border p-4 transition-all',
              result.dangerous 
                ? 'border-danger/30 bg-danger/5' 
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{result.name}</h4>
                  {result.dangerous ? (
                    <div className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                      <AlertTriangle className="h-3 w-3" />
                      Positive
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Negative
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Threshold: {result.threshold} {result.unit}
                </p>
                {result.method && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Method: <span className="font-medium text-foreground">{result.method.name}</span>
                    </span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-primary hover:text-primary/80"
                      onClick={() => window.open(result.method?.sopLink, '_blank')}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      View SOP
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Intensity Level</span>
                <span className={cn(
                  'font-semibold',
                  result.dangerous ? 'text-danger' : 'text-foreground'
                )}>
                  {result.intensity}/10
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div 
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    result.dangerous ? 'gradient-danger' : 'gradient-primary'
                  )}
                  style={{ width: `${result.intensity * 10}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MycotoxinResults;
