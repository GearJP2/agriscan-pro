import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MYCOTOXIN_REGISTRY } from '@/constants/mycotoxins';
import { useAuth } from '@/contexts/AuthContext';
import { analyticsAPI, sampleAPI } from '@/lib/api';
import type {
  PredictionEstimateRequest,
  PredictionSamplingRecommendationItem,
  PredictionSamplingRecommendationRequest,
} from '@/types/prediction';
import type { PredictionContext } from '@/types/sample';

const researchRoles = ['admin', 'head_researcher', 'researcher'];

function toxinDisplayName(code: string, label?: string) {
  const registryLabel = MYCOTOXIN_REGISTRY[code]?.name;
  const toxinLabel = label || registryLabel;
  return toxinLabel && toxinLabel !== code ? `${toxinLabel} (${code})` : code;
}

function formatContribution(value: number) {
  return `${(value * 100).toFixed(1)} pts`;
}

function SamplingRecommendationTable({
  items,
  showAreaWarning = false,
}: {
  items: PredictionSamplingRecommendationItem[];
  showAreaWarning?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Rank</th>
            <th className="px-4 py-3">Test target</th>
            <th className="px-4 py-3">Area</th>
            <th className="px-4 py-3">Toxin</th>
            <th className="px-4 py-3 text-right">Priority</th>
            <th className="px-4 py-3 text-right">Expected detection</th>
            <th className="px-4 py-3">Priority band</th>
            <th className="px-4 py-3 text-right">Historical samples</th>
            <th className="px-4 py-3 text-right">Historical detected</th>
            <th className="px-4 py-3 text-right">Historical rate</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <Fragment key={`${item.rank}-${item.subType}-${item.province}-${item.district}-${item.recommendedToxin}`}>
              <tr
                className="border-b"
              >
                <td className="px-4 py-3 font-medium">#{item.rank}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{item.subType}</div>
                  <div className="text-xs uppercase text-muted-foreground">{item.foodFeedType}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{item.district ? `${item.district}, ${item.province}` : item.province}</div>
                  {showAreaWarning && !item.areaSpecific && (
                    <div className="text-xs text-warning">
                      Historical area is missing; use as national surveillance signal
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {toxinDisplayName(item.recommendedToxin, item.recommendedToxinLabel)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {(item.priorityScore * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right">
                  {(item.detectionProbability * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  <Badge variant={riskBadgeVariant[item.priorityBand]}>{item.priorityBand}</Badge>
                </td>
                <td className="px-4 py-3 text-right">{item.historicalSampleCount}</td>
                <td className="px-4 py-3 text-right">{item.historicalDetectedCount}</td>
                <td className="px-4 py-3 text-right">
                  {(item.historicalDetectionRate * 100).toFixed(1)}%
                </td>
              </tr>
              <tr className="border-b last:border-0">
                <td colSpan={10} className="bg-muted/10 px-4 py-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      Why this recommendation
                    </summary>
                    <div className="mt-3 grid gap-3 text-sm text-muted-foreground lg:grid-cols-[1.4fr_1fr]">
                      <p>{item.reason}</p>
                      <div className="rounded-md border bg-background p-3">
                        <p className="font-medium text-foreground">Score breakdown</p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <dt>Model probability</dt>
                          <dd className="text-right">
                            {formatContribution(item.scoreBreakdown.modelProbabilityContribution)}
                          </dd>
                          <dt>Historical detection</dt>
                          <dd className="text-right">
                            {formatContribution(item.scoreBreakdown.historicalDetectionContribution)}
                          </dd>
                          <dt>Historical volume</dt>
                          <dd className="text-right">
                            {formatContribution(item.scoreBreakdown.volumeContribution)}
                          </dd>
                          <dt>Weather context</dt>
                          <dd className="text-right">
                            {formatContribution(item.scoreBreakdown.weatherContribution)}
                          </dd>
                        </dl>
                        <p className="mt-2 text-xs">
                          Drivers: {item.priorityDrivers.join(', ')} · Basis: {item.actionBasis.replaceAll('_', ' ')}
                        </p>
                      </div>
                    </div>
                  </details>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

const initialContext: PredictionContext = {
  latitude: null,
  longitude: null,
  location_type: 'unknown',
  harvest_date: null,
  sowing_date: null,
  crop_variety: '',
  crop_season: '',
  storage_duration_days: null,
  moisture_pct: null,
  soil_type: '',
  soil_ph: null,
  crop_rotation: '',
  fertiliser_details: '',
  fungicide_details: '',
};

const initialRecommendationForm: PredictionSamplingRecommendationRequest = {
  target_date: new Date().toISOString().slice(0, 10),
  limit: 10,
  max_candidates: 25,
  min_priority_score: 0.4,
  mode: 'all',
  food_feed_type: '',
  provinces: [],
  sub_types: [],
  include_districts: true,
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

function numberOrNull(value: string) {
  return value === '' ? null : Number(value);
}

function dateOrNull(value: string) {
  return value || null;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

const Prediction = () => {
  const { isAuthenticated, role } = useAuth();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const handledQuerySampleRef = useRef<string | null>(null);
  const canView = isAuthenticated && researchRoles.includes(role);
  const canPublishModels = isAuthenticated && role === 'admin';
  const [form, setForm] = useState<PredictionEstimateRequest>(initialForm);
  const [sampleId, setSampleId] = useState('');
  const [historySampleId, setHistorySampleId] = useState('');
  const [batchSampleIds, setBatchSampleIds] = useState('');
  const [contextSampleId, setContextSampleId] = useState('');
  const [contextForm, setContextForm] = useState<PredictionContext>(initialContext);
  const [recommendationForm, setRecommendationForm] = useState<PredictionSamplingRecommendationRequest>(
    initialRecommendationForm,
  );
  const [recommendationProvinces, setRecommendationProvinces] = useState('');
  const [recommendationSubTypes, setRecommendationSubTypes] = useState('');
  const [selectedPublishToxins, setSelectedPublishToxins] = useState<string[]>([]);
  const [forcePublish, setForcePublish] = useState(false);
  const readiness = useQuery({
    queryKey: ['prediction-readiness'],
    queryFn: analyticsAPI.getPredictionReadiness,
    enabled: canView,
  });
  const modelStatus = useQuery({
    queryKey: ['prediction-model-status'],
    queryFn: analyticsAPI.getPredictionStatus,
    enabled: canView,
  });
  const estimate = useMutation({
    mutationFn: analyticsAPI.estimatePrediction,
  });
  const publishModels = useMutation({
    mutationFn: analyticsAPI.publishPredictionModels,
    onSuccess: () => {
      setSelectedPublishToxins([]);
      void queryClient.invalidateQueries({ queryKey: ['prediction-model-status'] });
      void queryClient.invalidateQueries({ queryKey: ['prediction-readiness'] });
    },
  });
  const sampleEstimate = useMutation({
    mutationFn: analyticsAPI.estimateSamplePrediction,
    onSuccess: (_data, submittedSampleId) => {
      setHistorySampleId(submittedSampleId);
      void queryClient.invalidateQueries({ queryKey: ['prediction-history', submittedSampleId] });
    },
  });
  const batchEstimate = useMutation({
    mutationFn: analyticsAPI.batchEstimatePrediction,
  });
  const samplingRecommendations = useMutation({
    mutationFn: analyticsAPI.getPredictionRecommendations,
  });
  const sampleHistory = useQuery({
    queryKey: ['prediction-history', historySampleId],
    queryFn: () => sampleAPI.getPredictionHistory(historySampleId),
    enabled: canView && Boolean(historySampleId),
  });
  const contextLoad = useMutation({
    mutationFn: sampleAPI.getPredictionContext,
    onSuccess: (data) => {
      setContextForm({ ...initialContext, ...data });
    },
  });
  const contextSave = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PredictionContext }) => (
      sampleAPI.updatePredictionContext(id, data)
    ),
    onSuccess: (data) => {
      setContextForm({ ...initialContext, ...data });
    },
  });

  useEffect(() => {
    if (!canView) return;

    const querySampleId = searchParams.get('sample_id')?.trim();
    if (!querySampleId || handledQuerySampleRef.current === querySampleId) return;

    handledQuerySampleRef.current = querySampleId;
    setSampleId(querySampleId);
    setHistorySampleId(querySampleId);
    setContextSampleId(querySampleId);
    contextLoad.mutate(querySampleId);
  }, [canView, contextLoad, searchParams]);

  const activeEstimate = sampleEstimate.data ?? estimate.data;
  const activeError = sampleEstimate.error ?? estimate.error ?? batchEstimate.error;
  const hasEstimateError = sampleEstimate.isError || estimate.isError || batchEstimate.isError;
  const isEstimating = sampleEstimate.isPending || estimate.isPending || batchEstimate.isPending;
  const contextCompleteness = [
    contextForm.location_type && contextForm.location_type !== 'unknown',
    hasValue(contextForm.harvest_date),
    hasValue(contextForm.sowing_date),
    hasValue(contextForm.latitude) && hasValue(contextForm.longitude),
    hasValue(contextForm.moisture_pct),
    hasValue(contextForm.soil_ph),
    hasValue(contextForm.crop_variety),
    hasValue(contextForm.crop_season),
    hasValue(contextForm.soil_type),
    hasValue(contextForm.storage_duration_days),
    hasValue(contextForm.crop_rotation),
    hasValue(contextForm.fertiliser_details),
    hasValue(contextForm.fungicide_details),
  ].filter(Boolean).length;
  const manualCompleteness = [
    form.location_type && form.location_type !== 'unknown',
    hasValue(form.harvest_date),
    hasValue(form.sowing_date),
    hasValue(form.latitude) && hasValue(form.longitude),
    hasValue(form.moisture_pct),
    hasValue(form.soil_ph),
    hasValue(form.crop_variety),
    hasValue(form.crop_season),
    hasValue(form.soil_type),
    hasValue(form.storage_duration_days),
    hasValue(form.crop_rotation),
    hasValue(form.fertiliser_details),
    hasValue(form.fungicide_details),
  ].filter(Boolean).length;

  const setField = <K extends keyof PredictionEstimateRequest>(
    field: K,
    value: PredictionEstimateRequest[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const setContextField = <K extends keyof PredictionContext>(
    field: K,
    value: PredictionContext[K],
  ) => {
    setContextForm((current) => ({ ...current, [field]: value }));
  };

  const submitEstimate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sampleEstimate.reset();
    estimate.mutate(form);
  };

  const submitSampleEstimate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    estimate.reset();
    const cleanSampleId = sampleId.trim();
    setHistorySampleId(cleanSampleId);
    sampleEstimate.mutate(cleanSampleId);
  };

  const submitBatchEstimate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    estimate.reset();
    sampleEstimate.reset();
    const sampleIds = batchSampleIds
      .split(/[\s,]+/)
      .map((value) => value.trim())
      .filter(Boolean);
    batchEstimate.mutate([...new Set(sampleIds)]);
  };

  const submitSamplingRecommendations = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const splitList = (value: string) => (
      value
        .split(/[\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean)
    );

    samplingRecommendations.mutate({
      ...recommendationForm,
      target_date: recommendationForm.target_date || undefined,
      limit: recommendationForm.limit || 10,
      max_candidates: recommendationForm.max_candidates || 25,
      min_priority_score: recommendationForm.min_priority_score ?? recommendationForm.min_risk_threshold ?? 0.4,
      provinces: splitList(recommendationProvinces),
      sub_types: splitList(recommendationSubTypes),
    });
  };

  const loadContext = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    contextLoad.mutate(contextSampleId.trim());
  };

  const saveContext = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    contextSave.mutate({ id: contextSampleId.trim(), data: contextForm });
  };

  const togglePublishToxin = (toxinType: string, checked: boolean) => {
    setSelectedPublishToxins((current) => (
      checked
        ? [...new Set([...current, toxinType])]
        : current.filter((toxin) => toxin !== toxinType)
    ));
  };

  const submitPublishModels = () => {
    if (!modelStatus.data?.latest || selectedPublishToxins.length === 0) return;
    publishModels.mutate({
      version: modelStatus.data.latest.version,
      toxins: selectedPublishToxins,
      force: forcePublish,
    });
  };

  const applyContextToManualForm = () => {
    setForm((current) => ({
      ...current,
      latitude: contextForm.latitude,
      longitude: contextForm.longitude,
      location_type: contextForm.location_type || 'unknown',
      harvest_date: contextForm.harvest_date || null,
      sowing_date: contextForm.sowing_date || null,
      crop_variety: contextForm.crop_variety || '',
      crop_season: contextForm.crop_season || '',
      storage_duration_days: contextForm.storage_duration_days ?? null,
      moisture_pct: contextForm.moisture_pct ?? null,
      soil_type: contextForm.soil_type || '',
      soil_ph: contextForm.soil_ph ?? null,
      crop_rotation: contextForm.crop_rotation || '',
      fertiliser_details: contextForm.fertiliser_details || '',
      fungicide_details: contextForm.fungicide_details || '',
    }));
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container max-w-6xl py-8">
        <div className="mb-8 flex items-start gap-3">
          <TrendingUp className="mt-1 h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Area Risk Prediction</h1>
            <p className="mt-1 text-muted-foreground">
              Estimate likely mycotoxin risk for a food/feed type in a specific area before lab testing.
            </p>
          </div>
        </div>

        {!canView ? (
          <Card className="glass-card">
            <CardContent className="p-10 text-center">
              <Database className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Researcher access required</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Sign in with a researcher account to check area risk, stored sample context, and model readiness.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {modelStatus.data && (
              <Card className={modelStatus.data.status === 'published' ? 'border-primary/20' : 'border-warning/40'}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-primary" />
                    Model status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {modelStatus.data.latest ? (
                    <>
                      <div className="grid gap-3 text-sm md:grid-cols-4">
                        <p>Latest trained: {modelStatus.data.latest.version}</p>
                        <p>
                          Active published:
                          {' '}
                          {modelStatus.data.activePublished?.version || 'None'}
                        </p>
                        <p>Trained targets: {modelStatus.data.latest.trainedTargets}</p>
                        <p>Published targets: {modelStatus.data.latest.publishedTargets}</p>
                      </div>
                      {modelStatus.data.activePublished
                        && modelStatus.data.activePublished.version !== modelStatus.data.latest.version && (
                          <div
                            className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
                          >
                            A newer model version is trained but not published. Estimates still use active published
                            version
                            {' '}
                            <span className="font-medium text-foreground">
                              {modelStatus.data.activePublished.version}
                            </span>
                            .
                          </div>
                      )}
                      {modelStatus.data.status !== 'published' && (
                        <div
                          className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm text-muted-foreground"
                        >
                          Models are trained but not published. Review metrics, then run
                          {' '}
                          <code>python manage.py publish_prediction_models</code>
                          {' '}
                          before researchers can get estimates.
                        </div>
                      )}
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[680px] text-left text-sm">
                          <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3">Toxin</th>
                              <th className="px-4 py-3">State</th>
                              <th className="px-4 py-3 text-right">F1</th>
                              <th className="px-4 py-3 text-right">ROC-AUC</th>
                              <th className="px-4 py-3 text-right">Training rows</th>
                              <th className="px-4 py-3 text-right">Detected rows</th>
                              <th className="px-4 py-3">Artifacts</th>
                              {canPublishModels && <th className="px-4 py-3 text-right">Publish</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {modelStatus.data.latest.targets.map((target) => (
                              <tr key={target.toxinType} className="border-b last:border-0">
                                <td className="px-4 py-3 font-medium">{target.toxinType}</td>
                                <td className="px-4 py-3">
                                  <Badge variant={target.published ? 'success' : 'warning'}>
                                    {target.published ? 'Published' : 'Unpublished'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {target.classificationMetrics.f1 ?? 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {target.classificationMetrics.roc_auc ?? 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-right">{target.trainingRows}</td>
                                <td className="px-4 py-3 text-right">{target.detectedRows}</td>
                                <td className="px-4 py-3">
                                  {target.artifactHealth.classifierArtifactExists ? (
                                    <Badge variant="success">Ready</Badge>
                                  ) : (
                                    <Badge variant="destructive">Missing file</Badge>
                                  )}
                                </td>
                                {canPublishModels && (
                                  <td className="px-4 py-3 text-right">
                                    <Checkbox
                                      checked={selectedPublishToxins.includes(target.toxinType)}
                                      disabled={
                                        target.published
                                        || publishModels.isPending
                                        || !target.artifactHealth.classifierArtifactExists
                                      }
                                      onCheckedChange={(checked) => {
                                        togglePublishToxin(target.toxinType, checked === true);
                                      }}
                                      aria-label={`Select ${target.toxinType} for publishing`}
                                      className="ml-auto"
                                    />
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {modelStatus.data.latest.skippedTargetDetails.length > 0 && (
                        <div className="rounded-md border border-warning/30 bg-warning/5 p-4">
                          <p className="font-medium text-foreground">Skipped toxin targets</p>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[680px] text-left text-sm">
                              <thead className="border-b text-xs uppercase text-muted-foreground">
                                <tr>
                                  <th className="px-3 py-2">Toxin</th>
                                  <th className="px-3 py-2 text-right">Measured</th>
                                  <th className="px-3 py-2 text-right">Detected</th>
                                  <th className="px-3 py-2 text-right">Below LOD / zero</th>
                                  <th className="px-3 py-2 text-right">Usable context</th>
                                  <th className="px-3 py-2">Reason</th>
                                </tr>
                              </thead>
                              <tbody>
                                {modelStatus.data.latest.skippedTargetDetails.map((target) => (
                                  <tr key={target.toxinType} className="border-b last:border-0">
                                    <td className="px-3 py-2 font-medium">{target.toxinType}</td>
                                    <td className="px-3 py-2 text-right">{target.measured}</td>
                                    <td className="px-3 py-2 text-right">{target.detected}</td>
                                    <td className="px-3 py-2 text-right">{target.belowLodOrZero}</td>
                                    <td className="px-3 py-2 text-right">{target.usableContext}</td>
                                    <td className="px-3 py-2 text-muted-foreground">
                                      {target.reasons.length ? target.reasons.join('; ') : 'Training guardrail not met'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {canPublishModels && (
                        <div className="rounded-md border border-primary/15 bg-primary/[0.03] p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="font-medium text-foreground">Admin model publishing</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Select reviewed toxin models, then publish them for researcher estimates.
                                Low-metric models are blocked unless force publish is enabled.
                              </p>
                              {publishModels.isError && (
                                <p className="mt-2 text-sm text-destructive">
                                  {errorMessage(publishModels.error)}
                                </p>
                              )}
                              {publishModels.isSuccess && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                  Published {publishModels.data.updated} model(s): {publishModels.data.publishedToxins.join(', ')}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Switch
                                  checked={forcePublish}
                                  onCheckedChange={setForcePublish}
                                  disabled={publishModels.isPending}
                                />
                                Force publish
                              </label>
                              <Button
                                type="button"
                                onClick={submitPublishModels}
                                disabled={publishModels.isPending || selectedPublishToxins.length === 0}
                              >
                                {publishModels.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Publish selected
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No trained model artifacts were found. Run training before publishing estimates.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="border-primary/20" style={{ order: -2 }}>
              <CardHeader>
                <CardTitle className="text-lg">Sampling Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border border-primary/15 bg-primary/[0.03] p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">What should researchers test next?</p>
                  <p className="mt-1">
                    The system builds candidate food/feed and area combinations from historical samples, runs the
                    published risk model for each candidate, then ranks which areas should be prioritized for testing.
                  </p>
                </div>

                <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={submitSamplingRecommendations}>
                  <div className="space-y-2">
                    <Label htmlFor="recommendation-date">Target date</Label>
                    <Input
                      id="recommendation-date"
                      type="date"
                      value={recommendationForm.target_date || ''}
                      onChange={(event) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          target_date: event.target.value,
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Food/feed filter</Label>
                    <Select
                      value={recommendationForm.food_feed_type || 'all'}
                      onValueChange={(value) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          food_feed_type: value === 'all' ? '' : value as 'food' | 'feed',
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="food">Food</SelectItem>
                        <SelectItem value="feed">Feed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Recommendation mode</Label>
                    <Select
                      value={recommendationForm.mode || 'all'}
                      onValueChange={(value) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          mode: value as 'all' | 'area_specific' | 'national_signal',
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="area_specific">Area-specific targets</SelectItem>
                        <SelectItem value="national_signal">National signals</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recommendation-limit">Recommendations</Label>
                    <Input
                      id="recommendation-limit"
                      type="number"
                      min={1}
                      max={50}
                      value={recommendationForm.limit ?? 10}
                      onChange={(event) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          limit: Number(event.target.value),
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recommendation-max-candidates">Candidate scan limit</Label>
                    <Input
                      id="recommendation-max-candidates"
                      type="number"
                      min={1}
                      max={100}
                      value={recommendationForm.max_candidates ?? 25}
                      onChange={(event) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          max_candidates: Number(event.target.value),
                        }));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="recommendation-min-priority">Minimum priority score</Label>
                    <Input
                      id="recommendation-min-priority"
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={recommendationForm.min_priority_score ?? recommendationForm.min_risk_threshold ?? 0.4}
                      onChange={(event) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          min_priority_score: Number(event.target.value),
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Combines model risk, historical detections, sample volume, and weather context.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="recommendation-provinces">Province filters</Label>
                    <Textarea
                      id="recommendation-provinces"
                      value={recommendationProvinces}
                      onChange={(event) => setRecommendationProvinces(event.target.value)}
                      placeholder="Bangkok, Chiang Mai, Nakhon Ratchasima"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Separate provinces with commas or new lines.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="recommendation-sub-types">Food/feed name filters</Label>
                    <Textarea
                      id="recommendation-sub-types"
                      value={recommendationSubTypes}
                      onChange={(event) => setRecommendationSubTypes(event.target.value)}
                      placeholder="oats, maize, rice"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Optional. Leave blank to let historical samples define candidates.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2 lg:col-span-3">
                    <Switch
                      checked={recommendationForm.include_districts ?? true}
                      onCheckedChange={(checked) => {
                        setRecommendationForm((current) => ({
                          ...current,
                          include_districts: checked,
                        }));
                      }}
                    />
                    Rank province + district combinations when district data exists
                  </label>

                  <div className="flex items-end md:col-span-2">
                    <Button type="submit" disabled={samplingRecommendations.isPending}>
                      {samplingRecommendations.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TrendingUp />
                      )}
                      Generate testing plan
                    </Button>
                  </div>
                </form>

                {samplingRecommendations.isError && (
                  <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                    <p className="font-medium text-foreground">Unable to generate recommendations</p>
                    <p className="mt-1 text-muted-foreground">{errorMessage(samplingRecommendations.error)}</p>
                  </div>
                )}

                {samplingRecommendations.data && (
                  <div className="space-y-4">
                    {(() => {
                      const areaSpecificRecommendations = samplingRecommendations.data.areaSpecificRecommendations
                        ?? samplingRecommendations.data.recommendations.filter((item) => item.areaSpecific);
                      const nationalSurveillanceSignals = samplingRecommendations.data.nationalSurveillanceSignals
                        ?? samplingRecommendations.data.recommendations.filter((item) => !item.areaSpecific);
                      const hasRecommendations = areaSpecificRecommendations.length > 0
                        || nationalSurveillanceSignals.length > 0;

                      return (
                        <>
                    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-5">
                      <div>
                        <p className="font-medium text-foreground">Candidates scanned</p>
                        <p className="text-muted-foreground">{samplingRecommendations.data.candidateCount}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Returned</p>
                        <p className="text-muted-foreground">{samplingRecommendations.data.returned}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Below priority</p>
                        <p className="text-muted-foreground">
                          {samplingRecommendations.data.belowPriorityThresholdCount
                            ?? samplingRecommendations.data.belowThresholdCount}
                          {' '}
                          under
                          {' '}
                          {((samplingRecommendations.data.minPriorityScore
                            ?? samplingRecommendations.data.minRiskThreshold) * 100).toFixed(0)}
                          %
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Target date</p>
                        <p className="text-muted-foreground">{samplingRecommendations.data.targetDate}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Weather model</p>
                        <p className="text-muted-foreground">
                          {samplingRecommendations.data.usesWeatherFeatures ? 'Included' : 'Not included'}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">{samplingRecommendations.data.warning}</p>

                    {hasRecommendations ? (
                      <div className="space-y-6">
                        <section className="space-y-3">
                          <div>
                            <h3 className="font-medium text-foreground">Area-specific targets</h3>
                            <p className="text-sm text-muted-foreground">
                              Use these for decisions about which province or district should be tested next.
                            </p>
                          </div>
                          {areaSpecificRecommendations.length > 0 ? (
                            <SamplingRecommendationTable items={areaSpecificRecommendations} />
                          ) : (
                            <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                              No area-specific targets met the current priority score.
                            </p>
                          )}
                        </section>

                        <section className="space-y-3">
                          <div>
                            <h3 className="font-medium text-foreground">
                              National signals from incomplete location data
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              These identify food/feed types with strong historical signal, but the source records do
                              not contain a usable province or district.
                            </p>
                          </div>
                          {nationalSurveillanceSignals.length > 0 ? (
                            <SamplingRecommendationTable items={nationalSurveillanceSignals} showAreaWarning />
                          ) : (
                            <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                              No national incomplete-location signals met the current priority score.
                            </p>
                          )}
                        </section>
                      </div>
                    ) : (
                      <p className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                        {samplingRecommendations.data.message
                          || 'No recommendations were generated. Try widening the province or food/feed filters, or publish at least one prediction model.'}
                      </p>
                    )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Use registered sample area</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Shortcut for an existing sample. The system reads the stored commodity, location, collection date,
                  and prediction context, then estimates risk for that sample area.
                </p>
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
                      Estimate area risk
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Batch area risk check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Check many registered sample areas at once to prioritize surveillance and follow-up testing.
                </p>
                <form className="space-y-3" onSubmit={submitBatchEstimate}>
                  <div className="space-y-2">
                    <Label htmlFor="batch-sample-ids">Sample IDs</Label>
                    <Textarea
                      id="batch-sample-ids"
                      value={batchSampleIds}
                      onChange={(event) => setBatchSampleIds(event.target.value)}
                      placeholder={`RIC-2026-001\nRIC-2026-002\nRIC-2026-003`}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste up to 100 sample IDs separated by commas, spaces, or new lines.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={isEstimating || !batchSampleIds.trim()}
                  >
                    {batchEstimate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp />}
                    Run batch area check
                  </Button>
                </form>
              </CardContent>
            </Card>

            {batchEstimate.data && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Batch area risk results</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm md:grid-cols-3">
                    <p>Requested: {batchEstimate.data.requested}</p>
                    <p>Completed: {batchEstimate.data.completed}</p>
                    <p>Failed: {batchEstimate.data.failed}</p>
                  </div>
                  {batchEstimate.data.results.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Sample</th>
                            <th className="px-4 py-3">Model</th>
                            <th className="px-4 py-3 text-right">Top risk</th>
                            <th className="px-4 py-3 text-right">Weather</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batchEstimate.data.results.map((item) => {
                            const topPrediction = item.estimate.predictions?.[0];
                            return (
                              <tr key={item.sampleId} className="border-b last:border-0">
                                <td className="px-4 py-3 font-medium">{item.sampleId}</td>
                                <td className="px-4 py-3">{item.estimate.modelVersion || 'Unknown'}</td>
                                <td className="px-4 py-3 text-right">
                                  {topPrediction
                                    ? `${topPrediction.toxinType} ${(topPrediction.detectionProbability * 100).toFixed(1)}%`
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {item.estimate.usesWeatherFeatures ? 'Included' : 'No'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {batchEstimate.data.errors.length > 0 && (
                    <div className="rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
                      <p className="font-medium text-foreground">Failed samples</p>
                      <ul className="mt-2 space-y-1 text-muted-foreground">
                        {batchEstimate.data.errors.map((error) => (
                          <li key={error.sampleId}>
                            {error.sampleId}: {error.detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {historySampleId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent area risk estimates for {historySampleId}</CardTitle>
                </CardHeader>
                <CardContent>
                  {sampleHistory.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading estimate history...
                    </div>
                  ) : sampleHistory.isError ? (
                    <p className="text-sm text-muted-foreground">
                      Unable to load estimate history for this sample.
                    </p>
                  ) : !sampleHistory.data?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No saved prediction estimates for this sample yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[720px] text-left text-sm">
                        <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Run time</th>
                            <th className="px-4 py-3">Model</th>
                            <th className="px-4 py-3">Requested by</th>
                            <th className="px-4 py-3 text-right">Top risk</th>
                            <th className="px-4 py-3 text-right">Weather</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sampleHistory.data.map((item) => {
                            const topPrediction = item.predictions_payload?.[0];
                            return (
                              <tr key={item.id} className="border-b last:border-0">
                                <td className="px-4 py-3">
                                  {item.created_at ? new Date(item.created_at).toLocaleString() : 'Unknown'}
                                </td>
                                <td className="px-4 py-3">{item.model_version || 'Unknown'}</td>
                                <td className="px-4 py-3">{item.requested_by_username || 'Unknown'}</td>
                                <td className="px-4 py-3 text-right">
                                  {topPrediction
                                    ? `${topPrediction.toxinType} ${(topPrediction.detectionProbability * 100).toFixed(1)}%`
                                    : 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {item.uses_weather_features ? 'Included' : 'No'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stored area context</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Store location, crop, storage, and field context for a registered sample so future risk checks
                  use the same documented area information.
                </p>
                <form className="flex flex-col gap-3 sm:flex-row" onSubmit={loadContext}>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="context-sample-id">Sample ID</Label>
                    <Input
                      id="context-sample-id"
                      value={contextSampleId}
                      onChange={(event) => setContextSampleId(event.target.value)}
                      placeholder="RIC-2026-001"
                      required
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="submit" variant="outline" disabled={contextLoad.isPending}>
                      {contextLoad.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Load
                    </Button>
                  </div>
                </form>

                <form className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" onSubmit={saveContext}>
                  <div className="space-y-2">
                    <Label>Location type</Label>
                    <Select
                      value={contextForm.location_type || 'unknown'}
                      onValueChange={(value) => {
                        setContextField('location_type', value as PredictionContext['location_type']);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="farm">Farm</SelectItem>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="storage">Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="harvest-date">Harvest date</Label>
                    <Input
                      id="harvest-date"
                      type="date"
                      value={contextForm.harvest_date || ''}
                      onChange={(event) => {
                        setContextField('harvest_date', dateOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sowing-date">Sowing date</Label>
                    <Input
                      id="sowing-date"
                      type="date"
                      value={contextForm.sowing_date || ''}
                      onChange={(event) => {
                        setContextField('sowing_date', dateOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={contextForm.latitude ?? ''}
                      onChange={(event) => {
                        setContextField('latitude', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={contextForm.longitude ?? ''}
                      onChange={(event) => {
                        setContextField('longitude', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="moisture">Moisture %</Label>
                    <Input
                      id="moisture"
                      type="number"
                      step="0.1"
                      value={contextForm.moisture_pct ?? ''}
                      onChange={(event) => {
                        setContextField('moisture_pct', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="storage-days">Storage days</Label>
                    <Input
                      id="storage-days"
                      type="number"
                      value={contextForm.storage_duration_days ?? ''}
                      onChange={(event) => {
                        setContextField('storage_duration_days', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="crop-variety">Crop variety</Label>
                    <Input
                      id="crop-variety"
                      value={contextForm.crop_variety || ''}
                      onChange={(event) => {
                        setContextField('crop_variety', event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="crop-season">Crop season</Label>
                    <Input
                      id="crop-season"
                      value={contextForm.crop_season || ''}
                      onChange={(event) => {
                        setContextField('crop_season', event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="soil-type">Soil type</Label>
                    <Input
                      id="soil-type"
                      value={contextForm.soil_type || ''}
                      onChange={(event) => {
                        setContextField('soil_type', event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="soil-ph">Soil pH</Label>
                    <Input
                      id="soil-ph"
                      type="number"
                      step="0.1"
                      value={contextForm.soil_ph ?? ''}
                      onChange={(event) => {
                        setContextField('soil_ph', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="crop-rotation">Crop rotation</Label>
                    <Input
                      id="crop-rotation"
                      value={contextForm.crop_rotation || ''}
                      onChange={(event) => {
                        setContextField('crop_rotation', event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="fertiliser-details">Fertiliser details</Label>
                    <Input
                      id="fertiliser-details"
                      value={contextForm.fertiliser_details || ''}
                      onChange={(event) => {
                        setContextField('fertiliser_details', event.target.value);
                      }}
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="fungicide-details">Fungicide details</Label>
                    <Input
                      id="fungicide-details"
                      value={contextForm.fungicide_details || ''}
                      onChange={(event) => {
                        setContextField('fungicide_details', event.target.value);
                      }}
                    />
                  </div>

                  <div className="flex items-end md:col-span-2 lg:col-span-4">
                    <Button type="submit" disabled={contextSave.isPending || !contextSampleId.trim()}>
                      {contextSave.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Save context
                    </Button>
                  </div>
                </form>

                {(contextLoad.isError || contextSave.isError) && (
                  <p className="text-sm text-destructive">
                    {errorMessage(contextLoad.error ?? contextSave.error)}
                  </p>
                )}
                {contextSave.isSuccess && (
                  <p className="text-sm text-muted-foreground">Area context saved.</p>
                )}
                {(contextLoad.isSuccess || contextSave.isSuccess) && (
                  <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Saved predictor coverage</p>
                      <p>{contextCompleteness} of 13 optional context signals are filled.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={applyContextToManualForm}>
                      Use context in area estimate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20" style={{ order: -1 }}>
              <CardHeader>
                <CardTitle className="text-lg">Estimate area risk</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-md border border-primary/15 bg-primary/[0.03] p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Primary researcher workflow</p>
                  <p className="mt-1">
                    Enter the food/feed type and the area to check which published mycotoxin models show elevated
                    risk. Use this to decide what toxins to prioritize for laboratory analysis or surveillance.
                  </p>
                </div>
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
                    <Label htmlFor="sub-type">Food/feed name</Label>
                    <Input
                      id="sub-type"
                      value={form.sub_type}
                      onChange={(event) => setField('sub_type', event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="province">Province / area</Label>
                    <Input
                      id="province"
                      value={form.province}
                      onChange={(event) => setField('province', event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="collection-date">Target check date</Label>
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
                    <Label>Use case</Label>
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
                    <Label>Source type</Label>
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

                  <div className="space-y-2">
                    <Label>Area type</Label>
                    <Select
                      value={form.location_type || 'unknown'}
                      onValueChange={(value) => {
                        setField('location_type', value as PredictionEstimateRequest['location_type']);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unknown">Unknown</SelectItem>
                        <SelectItem value="farm">Farm</SelectItem>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="storage">Storage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-harvest-date">Harvest date</Label>
                    <Input
                      id="manual-harvest-date"
                      type="date"
                      value={form.harvest_date || ''}
                      onChange={(event) => {
                        setField('harvest_date', dateOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-sowing-date">Sowing date</Label>
                    <Input
                      id="manual-sowing-date"
                      type="date"
                      value={form.sowing_date || ''}
                      onChange={(event) => {
                        setField('sowing_date', dateOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-latitude">Latitude</Label>
                    <Input
                      id="manual-latitude"
                      type="number"
                      step="any"
                      value={form.latitude ?? ''}
                      onChange={(event) => {
                        setField('latitude', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-longitude">Longitude</Label>
                    <Input
                      id="manual-longitude"
                      type="number"
                      step="any"
                      value={form.longitude ?? ''}
                      onChange={(event) => {
                        setField('longitude', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-moisture">Moisture %</Label>
                    <Input
                      id="manual-moisture"
                      type="number"
                      step="0.1"
                      value={form.moisture_pct ?? ''}
                      onChange={(event) => {
                        setField('moisture_pct', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-storage-days">Storage days</Label>
                    <Input
                      id="manual-storage-days"
                      type="number"
                      value={form.storage_duration_days ?? ''}
                      onChange={(event) => {
                        setField('storage_duration_days', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-crop-variety">Crop variety</Label>
                    <Input
                      id="manual-crop-variety"
                      value={form.crop_variety || ''}
                      onChange={(event) => setField('crop_variety', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-crop-season">Crop season</Label>
                    <Input
                      id="manual-crop-season"
                      value={form.crop_season || ''}
                      onChange={(event) => setField('crop_season', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-soil-type">Soil type</Label>
                    <Input
                      id="manual-soil-type"
                      value={form.soil_type || ''}
                      onChange={(event) => setField('soil_type', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="manual-soil-ph">Soil pH</Label>
                    <Input
                      id="manual-soil-ph"
                      type="number"
                      step="0.1"
                      value={form.soil_ph ?? ''}
                      onChange={(event) => {
                        setField('soil_ph', numberOrNull(event.target.value));
                      }}
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="manual-crop-rotation">Crop rotation</Label>
                    <Input
                      id="manual-crop-rotation"
                      value={form.crop_rotation || ''}
                      onChange={(event) => setField('crop_rotation', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="manual-fertiliser-details">Fertiliser details</Label>
                    <Input
                      id="manual-fertiliser-details"
                      value={form.fertiliser_details || ''}
                      onChange={(event) => setField('fertiliser_details', event.target.value)}
                    />
                  </div>

                  <div className="space-y-2 lg:col-span-2">
                    <Label htmlFor="manual-fungicide-details">Fungicide details</Label>
                    <Input
                      id="manual-fungicide-details"
                      value={form.fungicide_details || ''}
                      onChange={(event) => setField('fungicide_details', event.target.value)}
                    />
                  </div>

                  <div className="flex items-end md:col-span-2 lg:col-span-4">
                    <Button type="submit" disabled={isEstimating}>
                      {estimate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp />}
                      Estimate area risk
                    </Button>
                  </div>
                </form>
                <div className="mt-5 grid gap-3 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="font-medium text-foreground">Area context coverage</p>
                    <p className="text-muted-foreground">
                      {manualCompleteness} of 13 optional context signals are filled.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Location precision</p>
                    <p className="text-muted-foreground">
                      {hasValue(form.latitude) && hasValue(form.longitude)
                        ? 'Exact coordinates'
                        : 'Province centroid'}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Weather window</p>
                    <p className="text-muted-foreground">
                      Weather-trained models use 90 days before collection date.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {hasEstimateError && (
              <Card className="border-warning/40 bg-warning/5">
                <CardContent className="flex gap-3 p-5 text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium text-foreground">Area risk model unavailable</p>
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
                    Area risk summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <p>Model version: {activeEstimate.modelVersion}</p>
                    <p>Trained at: {activeEstimate.createdAt || 'Unknown'}</p>
                    <p>Weather features: {activeEstimate.usesWeatherFeatures ? 'Included' : 'Not included'}</p>
                  </div>
                  {activeEstimate.featureSummary && (
                    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 text-sm md:grid-cols-4">
                      <div>
                        <p className="font-medium text-foreground">Food/feed</p>
                        <p className="text-muted-foreground">{activeEstimate.featureSummary.commodity || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Area precision</p>
                        <p className="text-muted-foreground">
                          {activeEstimate.featureSummary.locationPrecision === 'exact_coordinates'
                            ? 'Exact coordinates'
                            : 'Province centroid'}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Area context signals</p>
                        <p className="text-muted-foreground">
                          {activeEstimate.featureSummary.optionalContextSignalsFilled}
                          {' '}
                          of
                          {' '}
                          {activeEstimate.featureSummary.optionalContextSignalsTotal}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Weather window</p>
                        <p className="text-muted-foreground">
                          {activeEstimate.featureSummary.weatherDaysObserved90d
                            ? `${activeEstimate.featureSummary.weatherDaysObserved90d} days`
                            : 'No weather data'}
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">{activeEstimate.warning}</p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">Toxin</th>
                          <th className="px-4 py-3 text-right">Expected detection</th>
                          <th className="px-4 py-3">Area risk band</th>
                          <th className="px-4 py-3 text-right">Estimated concentration ug/kg</th>
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
                      <p>Published targets: {readiness.data.latestModel.publishedTargets}</p>
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
