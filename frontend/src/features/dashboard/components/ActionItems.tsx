import { AlertCircle, Clock, Flag, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sample, RiskLevel } from '@/types/sample';
import { Link } from 'react-router-dom';

interface ActionItemsProps {
  samples: Sample[];
}

const getRiskLevel = (sample: Sample): RiskLevel => {
  if (!sample.mycotoxin_results || sample.mycotoxin_results.length === 0) return 'safe';
  const hasDangerous = sample.mycotoxin_results.some((r) => r.dangerous);
  if (hasDangerous) return 'high';
  const maxIntensity = Math.max(...sample.mycotoxin_results.map((r) => r.intensity));
  if (maxIntensity >= 7) return 'medium';
  if (maxIntensity >= 4) return 'low';
  return 'safe';
};

const getDaysSinceLastUpdate = (sample: Sample): number => {
  const logs = sample.process_logs ?? [];
  if (logs.length === 0) return 0;
  const lastLog = logs[logs.length - 1];
  const lastUpdate = new Date(lastLog.timestamp);
  const now = new Date();
  return Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
};

const ActionItems = ({ samples }: ActionItemsProps) => {
  // Recently flagged high-risk samples (last 7 days)
  const recentHighRisk = samples
    .filter((s) => getRiskLevel(s) === 'high')
    .filter((s) => {
      const logs = s.process_logs ?? [];
      if (logs.length === 0) return false;
      const lastLog = logs[logs.length - 1];
      if (!lastLog) return false;
      const daysSince = getDaysSinceLastUpdate(s);
      return daysSince <= 7;
    })
    .slice(0, 5);

  // Samples stuck in same status for too long (>3 days)
  const stuckSamples = samples
    .filter((s) => s.status === 'pending' || s.status === 'in_progress')
    .filter((s) => getDaysSinceLastUpdate(s) > 3)
    .slice(0, 5);

  // Urgent attention required
  const urgentSamples = samples
    .filter((s) => s.status === 'flagged' || (getRiskLevel(s) === 'high' && s.status !== 'completed'))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Action Required</h2>
        <Link to="/samples">
          <Button variant="outline" size="sm" className="gap-2">
            View All Samples
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Recently Flagged */}
        <Card className="glass-card border-danger/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-danger">
              <Flag className="h-5 w-5" />
              Recently Flagged High Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentHighRisk.length > 0 ? (
              <div className="space-y-3">
                {recentHighRisk.map((sample) => (
                  <div key={sample.sample_id} className="flex items-center justify-between p-2 rounded-lg bg-danger/5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{sample.sample_id}</p>
                      <p className="text-xs text-muted-foreground">{sample.vegetation_variety} - {sample.province}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">High Risk</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No recently flagged samples
              </p>
            )}
          </CardContent>
        </Card>

        {/* Urgent Attention */}
        <Card className="glass-card border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-warning">
              <AlertCircle className="h-5 w-5" />
              Requires Urgent Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {urgentSamples.length > 0 ? (
              <div className="space-y-3">
                {urgentSamples.map((sample) => (
                  <div key={sample.sample_id} className="flex items-center justify-between p-2 rounded-lg bg-warning/5">
                    <div>
                      <p className="text-sm font-medium text-foreground">{sample.sample_id}</p>
                      <p className="text-xs text-muted-foreground">{sample.vegetation_variety} - {sample.province}</p>
                    </div>
                    <Badge className="bg-warning/20 text-warning-foreground text-xs">
                      {sample.status === 'flagged' ? 'Flagged' : 'High Risk'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No urgent items
              </p>
            )}
          </CardContent>
        </Card>

        {/* Stuck Samples */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Stuck in Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stuckSamples.length > 0 ? (
              <div className="space-y-3">
                {stuckSamples.map((sample) => {
                  const days = getDaysSinceLastUpdate(sample);
                  return (
                    <div key={sample.sample_id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium text-foreground">{sample.sample_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {sample.status === 'pending' ? 'Pending' : 'In Progress'}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {days} days
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                All samples processing normally
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ActionItems;
