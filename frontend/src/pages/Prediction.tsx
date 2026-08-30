import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Loader2,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsAPI } from '@/lib/api';
import type { PredictionEstimateRequest } from '@/types/prediction';

const researchRoles = ['admin', 'head_researcher', 'researcher'];

const initialForm: PredictionEstimateRequest = {
  food_feed_type: 'food',
  sub_type: 'White Rice',
  province: 'Bangkok',
  collection_date: new Date().toISOString().slice(0, 10),
  region: '',
  district: '',
  purpose: 'research',
  sample_type: 'market',
  processing_type: 'milled',
};

const riskBadgeVariant = {
  low: 'success',
  medium: 'warning',
  high: 'destructive',
} as const;

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { detail?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
  }
  return 'Unable to estimate prediction. Please try again.';
}

const Prediction = () => {
  const { isAuthenticated, role } = useAuth();
  const canView = isAuthenticated && researchRoles.includes(role);
  const [form, setForm] = useState<PredictionEstimateRequest>(initialForm);
  const [sampleId, setSampleId] = useState('');
  const readiness = useQuery({
    queryKey: ['prediction-readiness'],
    queryFn: analyticsAPI.getPredictionReadiness,
    enabled: canView,
  });
  const estimate = useMutation({
    mutationFn: analyticsAPI.estimatePrediction,
  });
  const sampleEstimate = useMutation({
    mutationFn: analyticsAPI.estimateSamplePrediction,
  });
  const activeEstimate = sampleEstimate.data ?? estimate.data;
  const activeError = sampleEstimate.error ?? estimate.error;
  const hasEstimateError = sampleEstimate.isError || estimate.isError;
  const isEstimating = sampleEstimate.isPending || estimate.isPending;

  const setField = <K extends keyof PredictionEstimateRequest>(
    field: K,
    value: PredictionEstimateRequest[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitEstimate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sampleEstimate.reset();
    estimate.mutate(form);
  };

  const submitSampleEstimate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    estimate.reset();
    sampleEstimate.mutate(sampleId.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-6xl py-8">
        <div className="mb-8 flex items-start gap-3">
          <TrendingUp className="mt-1 h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Prediction</h1>
            <p className="mt-1 text-muted-foreground">
              Research-only mycotoxin risk estimates from trained baseline models.
            </p>
          </div>
        </div>

        {!canView ? (
          <Card className="glass-card">
            <CardContent className="p-10 text-center">
              <Database className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Researcher access required</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Sign in with a researcher account to view model readiness and request estimates.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estimate registered sample</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitSampleEstimate}>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="sample-id">Sample ID</Label>
                    <Input
                      id="sample-id"
                      value={sampleId}
                      onChange={(event) => setSampleId(event.target.value)}
                      placeholder="RIC-2026-001"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" disabled={isEstimating || !sampleId.trim()}>
                      {sampleEstimate.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TrendingUp />
                      )}
                      Estimate sample
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estimate from sample context</CardTitle>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={submitEstimate}>
                  <div className="space-y-2">
                    <Label htmlFor="food-feed-type">Type</Label>
                    <Select
                      value={form.food_feed_type}
                      onValueChange={(value) => setField('food_feed_type', value as 'food' | 'feed')}
                    >
                      <SelectTrigger id="food-feed-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="feed">Feed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sub-type">Sub type</Label>
                    <Input
                      id="sub-type"
                      value={form.sub_type}
                      onChange={(event) => setField('sub_type', event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="province">Province</Label>
                    <Input
                      id="province"
                      value={form.province}
                      onChange={(event) => setField('province', event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="collection-date">Collection date</Label>
                    <Input
                      id="collection-date"
                      type="date"
                      value={form.collection_date}
                      onChange={(event) => setField('collection_date', event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      value={form.region}
                      onChange={(event) => setField('region', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <Input
                      id="district"
                      value={form.district}
                      onChange={(event) => setField('district', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Purpose</Label>
                    <Select
                      value={form.purpose || 'none'}
                      onValueChange={(value) => {
                        setField('purpose', value === 'none' ? '' : value as 'research' | 'customer');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="research">Research</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Sample type</Label>
                    <Select
                      value={form.sample_type || 'none'}
                      onValueChange={(value) => {
                        setField(
                          'sample_type',
                          value === 'none' ? '' : value as PredictionEstimateRequest['sample_type'],
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="field">Field</SelectItem>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="storage">Storage</SelectItem>
                        <SelectItem value="export">Export</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Processing</Label>
                    <Select
                      value={form.processing_type || 'none'}
                      onValueChange={(value) => {
                        setField(
                          'processing_type',
                          value === 'none' ? '' : value as PredictionEstimateRequest['processing_type'],
                        );
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not specified</SelectItem>
                        <SelectItem value="raw">Raw</SelectItem>
                        <SelectItem value="dried">Dried</SelectItem>
                        <SelectItem value="milled">Milled</SelectItem>
                        <SelectItem value="processed">Processed</SelectItem>
                        <SelectItem value="fermented">Fermented</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end md:col-span-2 lg:col-span-4">
                    <Button type="submit" disabled={isEstimating}>
                      {estimate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp />}
                      Run estimate
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {hasEstimateError && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="flex gap-3 p-5 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">Prediction model unavailable</p>
                    <p className="mt-1 text-muted-foreground">{errorMessage(activeError)}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeEstimate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                    Estimate results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <p>Model version: {activeEstimate.modelVersion}</p>
                    <p>Trained at: {activeEstimate.createdAt || 'Unknown'}</p>
                    <p>{activeEstimate.warning}</p>
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Toxin</th>
                          <th className="px-4 py-3 text-right">Detection probability</th>
                          <th className="px-4 py-3">Risk band</th>
                          <th className="px-4 py-3 text-right">Estimated ug/kg</th>
                          <th className="px-4 py-3 text-right">F1</th>
                          <th className="px-4 py-3 text-right">Training rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEstimate.predictions.map((prediction) => (
                          <tr key={prediction.toxinType} className="border-b last:border-0">
                            <td className="px-4 py-3 font-medium">{prediction.toxinType}</td>
                            <td className="px-4 py-3 text-right">
                              {(prediction.detectionProbability * 100).toFixed(1)}%
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={riskBadgeVariant[prediction.riskBand]}>
                                {prediction.riskBand}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {prediction.estimatedConcentrationUgKg ?? 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {prediction.classificationMetrics.f1 ?? 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-right">{prediction.trainingRows}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {readiness.isLoading ? (
              <Card className="glass-card">
                <CardContent className="flex items-center justify-center gap-3 p-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Checking available training data...
                </CardContent>
              </Card>
            ) : readiness.isError || !readiness.data ? (
              <Card className="border-destructive/30">
                <CardContent className="flex gap-3 p-6 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                  Unable to load prediction readiness. Please try again.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-primary" />
                    Training-data readiness
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{readiness.data.summary.message}</p>
                  {readiness.data.latestModel && (
                    <div className="grid gap-2 rounded-md border bg-primary/[0.03] p-3 text-sm md:grid-cols-3">
                      <p>Model version: {readiness.data.latestModel.version}</p>
                      <p>Trained targets: {readiness.data.latestModel.trainedTargets}</p>
                      <p>Created: {readiness.data.latestModel.createdAt || 'Unknown'}</p>
                    </div>
                  )}
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Mycotoxin</th>
                          <th className="px-4 py-3 text-right">Measured</th>
                          <th className="px-4 py-3 text-right">Detected</th>
                          <th className="px-4 py-3 text-right">Below LOD / zero</th>
                          <th className="px-4 py-3 text-right">Usable context</th>
                          <th className="px-4 py-3">Baseline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {readiness.data.targets.map((target) => (
                          <tr key={target.toxinType} className="border-b last:border-0">
                            <td className="px-4 py-3 font-medium">{target.label}</td>
                            <td className="px-4 py-3 text-right">{target.measured}</td>
                            <td className="px-4 py-3 text-right">{target.detected}</td>
                            <td className="px-4 py-3 text-right">{target.belowLodOrZero}</td>
                            <td className="px-4 py-3 text-right">{target.usableContext}</td>
                            <td className="px-4 py-3">
                              {target.eligibleForBaseline ? (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Eligible
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Needs more data</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Prediction;
