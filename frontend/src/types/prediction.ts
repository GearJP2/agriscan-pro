export interface PredictionReadinessTarget {
  toxinType: string;
  label: string;
  measured: number;
  detected: number;
  belowLodOrZero: number;
  belowLodRecorded: number;
  usableContext: number;
  eligibleForBaseline: boolean;
}

export interface PredictionReadinessResponse {
  modelStatus: 'not_trained' | 'trained_unpublished' | 'published';
  latestModel: {
    version: string;
    createdAt: string;
    trainedTargets: number;
    publishedTargets: number;
  } | null;
  trainingGuardrails: {
    minDetected: number;
    minBelowLodOrZero: number;
    minUsableContext: number;
  };
  summary: {
    toxinsWithResults: number;
    eligibleForBaseline: number;
    message: string;
  };
  targets: PredictionReadinessTarget[];
}

export interface PredictionEstimateRequest {
  food_feed_type: 'food' | 'feed';
  sub_type: string;
  province: string;
  collection_date: string;
  region?: string;
  district?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_type?: 'farm' | 'market' | 'storage' | 'unknown' | '';
  harvest_date?: string | null;
  sowing_date?: string | null;
  crop_variety?: string;
  crop_season?: string;
  storage_duration_days?: number | null;
  moisture_pct?: number | null;
  soil_type?: string;
  soil_ph?: number | null;
  crop_rotation?: string;
  fertiliser_details?: string;
  fungicide_details?: string;
  purpose?: 'research' | 'customer' | '';
  sample_type?: 'field' | 'market' | 'storage' | 'export' | '';
  processing_type?: 'raw' | 'dried' | 'milled' | 'processed' | 'fermented' | '';
}

export interface PredictionEstimateItem {
  toxinType: string;
  detectionProbability: number;
  riskBand: 'low' | 'medium' | 'high';
  estimatedConcentrationUgKg: number | null;
  classificationMetrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    roc_auc?: number;
    prevalence?: number;
    test_rows?: number;
  };
  trainingRows: number;
  detectedRows: number;
  published: boolean;
}

export interface PredictionEstimateResponse {
  modelVersion: string;
  modelFamily: string;
  createdAt: string;
  featureColumns: string[];
  usesWeatherFeatures: boolean;
  input: PredictionEstimateRequest;
  predictions: PredictionEstimateItem[];
  warning: string;
}

export interface PredictionModelStatusTarget {
  toxinType: string;
  published: boolean;
  trainingRows: number;
  detectedRows: number;
  usableContext: number;
  classificationMetrics: PredictionEstimateItem['classificationMetrics'];
}

export interface PredictionModelStatusVersion {
  version: string;
  createdAt: string;
  modelFamily: string;
  metadataPath: string;
  trainedTargets: number;
  publishedTargets: number;
  skippedTargets: number;
  targets: PredictionModelStatusTarget[];
}

export interface PredictionModelStatusResponse {
  status: 'not_trained' | 'trained_unpublished' | 'published';
  latest: PredictionModelStatusVersion | null;
  versions: PredictionModelStatusVersion[];
}

export interface PredictionEstimateHistoryItem {
  id: number;
  sample_id: string | null;
  requested_by_username: string | null;
  model_version: string;
  model_family: string;
  uses_weather_features: boolean;
  input_payload: PredictionEstimateRequest;
  predictions_payload: PredictionEstimateItem[];
  warning: string;
  created_at: string;
}
