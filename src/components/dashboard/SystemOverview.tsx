import { FlaskConical, Clock, CheckCircle2, Hourglass, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sample } from '@/types/sample';
import { cn } from '@/lib/utils';

interface SystemOverviewProps {
  samples: Sample[];
}

const SystemOverview = ({ samples }: SystemOverviewProps) => {
  const stats = {
    total: samples.length,
    inProgress: samples.filter((s) => s.status === 'in_progress').length,
    completed: samples.filter((s) => s.status === 'completed').length,
    pending: samples.filter((s) => s.status === 'pending').length,
  };

  // Mock trend data - in real app would compare with previous period
  const weeklyCompleted = 12;
  const previousWeekCompleted = 10;
  const trend = weeklyCompleted > previousWeekCompleted ? 'up' : 'down';
  const trendPercent = Math.round(((weeklyCompleted - previousWeekCompleted) / previousWeekCompleted) * 100);

  const statCards = [
    {
      title: 'Total Registered',
      value: stats.total,
      subtitle: 'All samples in system',
      icon: FlaskConical,
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'In Progress',
      value: stats.inProgress,
      subtitle: 'Currently being analyzed',
      icon: Clock,
      color: 'bg-warning/10 text-warning',
    },
    {
      title: 'Completed',
      value: stats.completed,
      subtitle: 'Testing finished',
      icon: CheckCircle2,
      color: 'bg-success/10 text-success',
    },
    {
      title: 'Awaiting Processing',
      value: stats.pending,
      subtitle: 'Pending in queue',
      icon: Hourglass,
      color: 'bg-info/10 text-info',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">System Overview</h2>
        <div className="flex items-center gap-2 text-sm">
          {trend === 'up' ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-danger" />
          )}
          <span className={cn(trend === 'up' ? 'text-success' : 'text-danger')}>
            {trend === 'up' ? '+' : ''}{trendPercent}% this week
          </span>
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="mt-2 text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.subtitle}</p>
                </div>
                <div className={cn('rounded-lg p-3', stat.color)}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Team Workload Summary */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Team Workload (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{weeklyCompleted}</p>
              <p className="text-sm text-muted-foreground">Samples Completed</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
              <p className="text-sm text-muted-foreground">Currently Processing</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
              <p className="text-sm text-muted-foreground">In Queue</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemOverview;
