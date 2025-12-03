export interface ProcessLog {
  id: string;
  timestamp: string;
  state: 'received' | 'prepared' | 'testing' | 'analyzed' | 'completed';
  test_id?: string;
  notes?: string;
}

export interface MycotoxinResult {
  name: string;
  intensity: number; // 1-10 scale
  dangerous: boolean;
  threshold: number;
  unit: string;
}

export interface Sample {
  sample_id: string;
  region: string;
  province: string;
  district: string;
  vegetation_variety: string;
  collection_date: string;
  process_logs: ProcessLog[];
  mycotoxin_results: MycotoxinResult[];
  status: 'pending' | 'in_progress' | 'completed' | 'flagged';
}

export type FilterState = {
  region: string;
  province: string;
  district: string;
  vegetation: string;
  status: string;
  search: string;
};
