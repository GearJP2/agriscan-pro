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
  modelStatus: 'not_trained' | 'trained';
  latestModel: {
    version: string;
    createdAt: string;
    trainedTargets: number;
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
  input: PredictionEstimateRequest;
  predictions: PredictionEstimateItem[];
  warning: string;
}
