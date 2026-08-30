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
  modelStatus: 'not_trained';
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
