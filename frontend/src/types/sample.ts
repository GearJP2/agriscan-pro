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
  vegetation_variety: string;
  collection_date: string;
  process_logs?: ProcessLog[];
  mycotoxin_results?: MycotoxinResult[];
  results_count?: number;
  risk_level?: RiskLevel;
  status: 'pending' | 'in_progress' | 'completed' | 'flagged';
  purpose?: 'routine' | 'complaint driven' | 'target surveillance';
  sample_type?: SampleType;
  processing_type?: ProcessingType;
  collected_by?: string;
  additional_info?: string;
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
