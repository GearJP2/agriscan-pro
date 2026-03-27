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
  name: string;
  intensity: number; // Exact measured concentration from lab
  dangerous: boolean;
  threshold: number;
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
  sample_type?: 'field' | 'market' | 'storage' | 'export';
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
  risk: RiskLevel[];
  search: string;
  watchlistOnly: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}
