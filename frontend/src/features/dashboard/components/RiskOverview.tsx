import { AlertTriangle, MapPin, Wheat, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sample, RiskLevel } from '@/types/sample';
import { cn } from '@/lib/utils';

interface RiskOverviewProps {
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

const RiskOverview = ({ samples }: RiskOverviewProps) => {
  const highRiskSamples = samples.filter((s) => getRiskLevel(s) === 'high');
  const mediumRiskSamples = samples.filter((s) => getRiskLevel(s) === 'medium');
  
  // Calculate risk distribution by region
  const riskByRegion = samples.reduce((acc, sample) => {
    const risk = getRiskLevel(sample);
    if (risk === 'high') {
      acc[sample.region] = (acc[sample.region] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Calculate risk distribution by vegetation
  const riskByVegetation = samples.reduce((acc, sample) => {
    const risk = getRiskLevel(sample);
    if (risk === 'high') {
      acc[sample.vegetation_variety] = (acc[sample.vegetation_variety] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const topRiskRegions = Object.entries(riskByRegion)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const topRiskVegetation = Object.entries(riskByVegetation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // Mock trend - in real app would compare with historical data
  const riskTrend = 'stable' as 'improving' | 'stable' | 'worsening';

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Risk Overview</h2>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* High Risk Count */}
        <Card className="glass-card border-danger/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Risk Samples</p>
                <p className="mt-2 text-4xl font-bold text-danger">{highRiskSamples.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Require immediate attention</p>
              </div>
              <div className="rounded-lg bg-danger/10 p-3 text-danger">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medium Risk Count */}
        <Card className="glass-card border-warning/30">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Medium Risk Samples</p>
                <p className="mt-2 text-4xl font-bold text-warning">{mediumRiskSamples.length}</p>
                <p className="mt-1 text-xs text-muted-foreground">Monitor closely</p>
              </div>
              <div className="rounded-lg bg-warning/10 p-3 text-warning">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Trend */}
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Risk Trend</p>
                <p className={cn(
                  'mt-2 text-2xl font-bold',
                  riskTrend === 'improving' && 'text-success',
                  riskTrend === 'stable' && 'text-muted-foreground',
                  riskTrend === 'worsening' && 'text-danger'
                )}>
                  {riskTrend === 'improving' ? 'Improving' : riskTrend === 'stable' ? 'Stable' : 'Worsening'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Compared to last month</p>
              </div>
              <div className={cn(
                'rounded-lg p-3',
                riskTrend === 'improving' && 'bg-success/10 text-success',
                riskTrend === 'stable' && 'bg-muted text-muted-foreground',
                riskTrend === 'worsening' && 'bg-danger/10 text-danger'
              )}>
                {riskTrend === 'improving' ? (
                  <TrendingDown className="h-6 w-6" />
                ) : riskTrend === 'stable' ? (
                  <Minus className="h-6 w-6" />
                ) : (
                  <TrendingUp className="h-6 w-6" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Distribution */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* By Region */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              High Risk by Region
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRiskRegions.length > 0 ? (
              <div className="space-y-3">
                {topRiskRegions.map(([region, count]) => (
                  <div key={region} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{region}</span>
                    <Badge variant="destructive">{count} samples</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No high-risk samples detected</p>
            )}
          </CardContent>
        </Card>

        {/* By Vegetation */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wheat className="h-5 w-5 text-muted-foreground" />
              High Risk by Crop Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topRiskVegetation.length > 0 ? (
              <div className="space-y-3">
                {topRiskVegetation.map(([veg, count]) => (
                  <div key={veg} className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{veg}</span>
                    <Badge variant="destructive">{count} samples</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No high-risk samples detected</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RiskOverview;
