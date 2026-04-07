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
          (() => {
            const isDetected = result.is_detected ?? result.intensity > 0;
            return (
          <div 
            key={index} 
            className={cn(
              'rounded-lg border p-4 transition-all',
              isDetected 
                ? 'border-danger/30 bg-danger/5' 
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">{result.name}</h4>
                  {isDetected ? (
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
                <span className="text-muted-foreground">Measured Concentration</span>
                <span className={cn(
                  'font-semibold',
                  isDetected ? 'text-danger' : 'text-foreground'
                )}>
                  {isDetected ? `${result.intensity} ${result.unit}` : 'LOD'}
                </span>
              </div>
            </div>
          </div>
            );
          })()
        ))}
      </div>
    </div>
  );
};

export default MycotoxinResults;
