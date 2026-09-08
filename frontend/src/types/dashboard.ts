// Dashboard types for Mycotoxin Risk Surveillance Dashboard

import type { LucideIcon } from 'lucide-react';

export interface KPICard {
  label: string;
  value: string | number;
  delta: number | null; // percentage change vs last quarter
  deltaDirection: 'up' | 'down' | null;
  isImprovement: boolean | null; // whether the delta direction is good
  context: string;
  accent?: 'red' | 'amber' | 'green' | 'default';
  icon?: LucideIcon;
}

export interface KPIData {
  cards: KPICard[];
}

export interface ProvinceRisk {
  name: string;
  nameEn?: string;
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

export interface DashboardFilterOptionsSection {
  commodities: string[];
  regions: string[];
  provinces: string[];
  date_range: { from: string; to: string };
}

export interface DashboardSections {
  filter_options: DashboardFilterOptionsSection;
  overview: AnalyticsOverviewResponse;
  regional: {
    provinces: ProvinceRisk[];
    regions: Array<{ name: string; sampleCount: number; aboveCount: number; aboveThresholdPct: number }>;
    suppressed: number;
  };
  commodities: {
    distribution: Array<{ name: string; sampleCount: number; aboveCount: number; pctAbove: number }>;
    suppressed: number;
  };
  toxins: {
    distribution: Array<{
      name: string;
      shortName: string;
      sampleCount: number;
      aboveCount: number;
      score: number;
    }>;
  };
  heatmap: { data: Array<HeatmapCell & { sampleCount: number }>; regions: string[]; commodities: string[] };
  co_contamination: CoContaminationResponse & { summary: CoContamSummary };
  public_health: HealthSummary;
  environmental: { status: 'fresh' | 'stale' | 'unavailable'; data: Record<string, unknown> };
}

export interface DashboardSnapshot {
  schema_version: 1;
  snapshot_id: string;
  generated_at: string;
  data_through: string;
  expires_at: string;
  sections: DashboardSections;
}

export interface DashboardContractResponse {
  schema_version: 1;
  sections: DashboardSections;
}
