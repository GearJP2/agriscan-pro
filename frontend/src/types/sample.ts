export type ProcessState =
  | 'registered'
  | 'preparing'
  | 'prepared'
  | 'analyzing'
  | 'recorded'
  | 'completed';

export const PROCESS_STATE_ORDER: ProcessState[] = [
  'registered',
  'preparing',
  'prepared',
  'analyzing',
  'recorded',
  'completed',
];

// State descriptions for the workflow
export const PROCESS_STATE_INFO: Record<ProcessState, { label: string; description: string }> = {
  registered: { label: 'Registered', description: 'Raw sample received' },
  preparing: { label: 'Preparing', description: 'Researcher preparing sample for test' },
  prepared: { label: 'Prepared', description: 'Preparing process finished' },
  analyzing: { label: 'Analyzing', description: 'Testing machine is ready and analyzing' },
  recorded: { label: 'Recorded', description: 'Test result extracted' },
  completed: { label: 'Completed', description: 'Test result recorded on dashboard' },
};

export interface ProcessLog {
  id: string;
  timestamp: string;
  state: ProcessState;
  test_id?: string;
  notes?: string;
  conducted_by: string;
}

export interface TestMethod {
  name: string;
  sopLink: string;
}

export interface MycotoxinResult {
  toxin_type?: string;
  name: string;
  intensity: number; // Exact measured concentration from lab
  is_detected?: boolean;
  dangerous: boolean;
  risk_level?: 'safe' | 'detected' | 'high' | 'critical' | 'unclassified';
  eu_threshold_low?: number | null;
  eu_threshold_high?: number | null;
  is_below_lod?: boolean;
  threshold?: number | null;
  unit: string;
  method?: TestMethod;
}

export type ProcessingType = 'raw' | 'dried' | 'milled' | 'processed' | 'fermented';

export const PROCESSING_TYPES: ProcessingType[] = ['raw', 'dried', 'milled', 'processed', 'fermented'];

export const PROCESSING_TYPE_LABELS: Record<ProcessingType, string> = {
  raw: 'Raw',
  dried: 'Dried',
  milled: 'Milled',
  processed: 'Processed',
  fermented: 'Fermented',
};

export type SampleType = 'field' | 'market' | 'storage' | 'export';
export type FoodFeedType = 'food' | 'feed';

export const SAMPLE_TYPES: SampleType[] = ['field', 'market', 'storage', 'export'];

export const SAMPLE_TYPE_LABELS: Record<SampleType, string> = {
  field: 'Field',
  market: 'Market',
  storage: 'Storage',
  export: 'Export',
};

export interface Sample {
  sample_id: string;
  region: string;
  province: string;
  district: string;
  /** Legacy response field retained while historical analytics migrate. */
  vegetation_variety: string;
  food_feed_type?: FoodFeedType;
  sub_type?: string;
  collection_date: string;
  received_at?: string;
  process_logs?: ProcessLog[];
  mycotoxin_results?: MycotoxinResult[];
  results_count?: number;
  risk_level?: RiskLevel;
  status: 'pending' | 'in_progress' | 'completed' | 'flagged';
  purpose?: 'research' | 'customer';
  sample_type?: SampleType;
  processing_type?: ProcessingType;
  recorded_by?: string;
  prediction_context?: PredictionContext;
  /** Deprecated compatibility field; new registrations use recorded_by. */
  collected_by?: string;
  additional_info?: string;
}

export interface PredictionContext {
  latitude?: number | null;
  longitude?: number | null;
  location_type?: 'farm' | 'market' | 'storage' | 'unknown';
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
  created_at?: string;
  updated_at?: string;
}

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high';

export interface FilterState {
  region: string[];
  province: string[];
  district: string[];
  vegetation: string[];
  status: string[];
  sampleType: SampleType[];
  search: string;
  watchlistOnly: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}
