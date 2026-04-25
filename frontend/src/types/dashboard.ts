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
