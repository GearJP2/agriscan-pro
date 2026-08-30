import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, Loader2, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsAPI } from '@/lib/api';

const researchRoles = ['admin', 'head_researcher', 'researcher'];

const Prediction = () => {
  const { isAuthenticated, role } = useAuth();
  const canView = isAuthenticated && researchRoles.includes(role);
  const readiness = useQuery({
    queryKey: ['prediction-readiness'],
    queryFn: analyticsAPI.getPredictionReadiness,
    enabled: canView,
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-5xl py-8">
        <div className="mb-8 flex items-start gap-3">
          <TrendingUp className="mt-1 h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prediction</h1>
            <p className="mt-1 text-muted-foreground">Mycotoxin risk-model readiness and future research estimates.</p>
          </div>
        </div>

        {!canView ? (
          <Card className="glass-card">
            <CardContent className="p-10 text-center">
              <Database className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Researcher access required</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Prediction work uses detailed sample and laboratory data. Sign in with a researcher account to view training readiness.
              </p>
            </CardContent>
          </Card>
        ) : readiness.isLoading ? (
          <Card className="glass-card"><CardContent className="flex items-center justify-center gap-3 p-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking available training data…</CardContent></Card>
        ) : readiness.isError || !readiness.data ? (
          <Card className="border-destructive/30"><CardContent className="flex gap-3 p-6 text-sm"><AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />Unable to load prediction readiness. Please try again.</CardContent></Card>
        ) : (
          <div className="space-y-6">
            <Card className="border-primary/20 bg-primary/[0.03]">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5 text-primary" />Model status: not trained</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{readiness.data.summary.message}</p>
                <p>Baseline eligibility requires at least {readiness.data.trainingGuardrails.minDetected} detections, {readiness.data.trainingGuardrails.minBelowLodOrZero} below-LOD/zero results, and {readiness.data.trainingGuardrails.minUsableContext} records with a date and usable location.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Training-data readiness</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3">Mycotoxin</th><th className="px-4 py-3 text-right">Measured</th><th className="px-4 py-3 text-right">Detected</th><th className="px-4 py-3 text-right">Below LOD / zero</th><th className="px-4 py-3 text-right">Usable context</th><th className="px-6 py-3">Baseline</th></tr></thead>
                  <tbody>
                    {readiness.data.targets.map((target) => <tr key={target.toxinType} className="border-b last:border-0"><td className="px-6 py-3 font-medium">{target.label}</td><td className="px-4 py-3 text-right">{target.measured}</td><td className="px-4 py-3 text-right">{target.detected}</td><td className="px-4 py-3 text-right">{target.belowLodOrZero}</td><td className="px-4 py-3 text-right">{target.usableContext}</td><td className="px-6 py-3">{target.eligibleForBaseline ? <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />Eligible</span> : <span className="text-muted-foreground">Needs more data</span>}</td></tr>)}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <p className="text-xs leading-relaxed text-muted-foreground">A future estimate will combine sample type, location, seasonal date features, and 90 days of historical weather. It will be shown as a research estimate—not a laboratory result or compliance decision.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Prediction;
