// Dashboard types for Mycotoxin Risk Surveillance Dashboard

export interface KPICard {
  label: string;
  value: string | number;
  delta: number | null; // percentage change vs last quarter
  deltaDirection: 'up' | 'down' | null;
  isImprovement: boolean | null; // whether the delta direction is good
  context: string;
  accent?: 'red' | 'amber' | 'green' | 'default';
  icon?: any;
}

export interface KPIData {
  cards: KPICard[];
}

export interface ProvinceRisk {
  name: string;
  nameEn: string;
  region: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  sampleCount: number;
  positiveCount: number;
  positivePct: number;
  aboveThresholdPct: number;
  dominantToxin: string;
  dominantCommodity: string;
}

export interface ProvinceRank {
  rank: number;
  province: string;
  sampleCount: number;
  aboveThresholdPct: number;
  dominantToxin: string;
  riskLevel: 'high' | 'critical';
}

export interface HealthSummary {
  riskDrivers: string[];
  affectedCommodities: { name: string; pct: number }[];
  impactedPopulations: { group: string; severity: 'High' | 'Medium' }[];
}

export interface ToxinScore {
  name: string;
  shortName: string;
  score: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface CommodityShare {
  name: string;
  value: number;
  color: string;
}

export interface ThresholdData {
  commodity: string;
  pctAbove: number;
  totalCount: number;
  aboveCount: number;
}

export interface HeatmapCell {
  region: string;
  commodity: string;
  intensity: number;
}

export interface CoContamSummary {
  avgToxinsPerSample: number;
  pctTwoPlus: number;
  pctThreePlus: number;
  mostCommonPair: string;
}

export interface CoOccurrence {
  toxins: string[];
  sampleCount: number;
  pct: number;
}

export interface NetworkNode {
  id: string;
  frequency: number;
  color: string;
}

export interface NetworkLink {
  source: string;
  target: string;
  value: number;
}

export interface NetworkData {
  nodes: NetworkNode[];
  links: NetworkLink[];
}

export interface ToxinDist {
  count: string; // "1", "2", "3", "4+"
  pct: number;
  highlight?: boolean;
}

export interface DashboardFilters {
  dateRange: { from: string; to: string };
  commodities: string[];
  regions: string[];
  provinces: string[];
  quarter: string;
}

/**
 * Backend API V2 Response Types
 */

export interface AnalyticsOverviewResponse {
  kpis: {
    total_samples: number;
    positive_pct: number;
    detected_pct: number;
    above_threshold_pct: number;
    high_risk_regions: number;
    highest_risk_commodity: string;
    active_alerts: number;
  };
  provinces: ProvinceRisk[];
  public_health_summary?: HealthSummary;
}

export interface CoContaminationResponse {
  toxins_per_sample: Record<string, number>;
  intersections: CoOccurrence[];
  network: {
    nodes: Array<{ id: string; frequency: number }>;
    links: Array<{ source: string; target: string; value: number }>;
  };
}

export interface EnvironmentalPoint {
  date: string;
  temperatureC: number | null;
  relativeHumidityPct: number | null;
  precipitationMmHour: number | null;
  soilTemperatureC: number | null;
}

export interface EnvironmentalCorrelationResponse {
  source: string;
  location: {
    label: string;
    latitude: number;
    longitude: number;
  };
  parameters: Record<string, { label: string; unit: string }>;
  request: {
    start: string;
    end: string;
    maxDays: number;
  };
  summary: {
    temperatureC: number | null;
    relativeHumidityPct: number | null;
    precipitationMmHour: number | null;
    precipitationTotalMm: number | null;
    soilTemperatureC: number | null;
  };
  cache?: {
    status: 'hit' | 'miss';
    ttlHours: number;
  };
  points: EnvironmentalPoint[];
  message?: string;
}
