import type {
  CoContamSummary,
  CoOccurrence,
  CommodityShare,
  DashboardFilters,
  HeatmapCell,
  HealthSummary,
  KPIData,
  NetworkData,
  ProvinceRank,
  ProvinceRisk,
  ThresholdData,
  ToxinDist,
  ToxinScore,
} from '@/types/dashboard';
import type { MycotoxinResult, ProcessState, RiskLevel, Sample } from '@/types/sample';
import {
  getThresholdRiskLevel,
  hasAboveThresholdResults,
  hasMeasuredResults,
  isAboveThresholdResult,
} from '@/lib/mycotoxinRisk';

const TOXIN_ALIASES: Record<string, string> = {
  'Aflatoxin B1': 'AFB1',
  'Aflatoxin G1': 'AFG1',
  'Aflatoxin G2': 'AFG2',
  'Aflatoxin M1': 'AFM1',
  'Fumonisin B1': 'FB1',
  Fumonisin: 'FUM',
  'Ochratoxin A': 'OTA',
  Deoxynivalenol: 'DON',
  Zearalenone: 'ZEA',
  'T-2 Toxin': 'T-2',
};

const TOXIN_PALETTE = ['#ef4444', '#f97316', '#a855f7', '#3b82f6', '#eab308', '#14b8a6', '#ec4899', '#22c55e', '#6366f1', '#06b6d4'];

const SAMPLE_TYPE_LABELS: Record<string, string> = {
  field: 'Farming communities',
  market: 'Consumers and market vendors',
  storage: 'Storage facility operators',
  export: 'Export supply chain',
};

export const ALL_TIME_QUARTER = 'All Time';
export const CUSTOM_RANGE_QUARTER = 'Custom Range';

export interface FilterOptions {
  commodities: string[];
  regions: string[];
  quarters: string[];
  dateRange: {
    from: string;
    to: string;
  };
}

export interface SurveillanceAnalytics {
  filteredSamples: Sample[];
  kpiData: KPIData;
  provinceRiskData: ProvinceRisk[];
  topProvinces: ProvinceRank[];
  publicHealthSummary: HealthSummary;
  mycotoxinBarData: ToxinScore[];
  commodityShare: CommodityShare[];
  thresholdByCommodity: ThresholdData[];
  heatmapData: HeatmapCell[];
  heatmapRegions: string[];
  heatmapCommodities: string[];
  coContamSummary: CoContamSummary;
  coOccurrenceList: CoOccurrence[];
  networkData: NetworkData;
  toxinsPerSample: ToxinDist[];
  toxinColors: Record<string, string>;
}

interface CommodityStats {
  name: string;
  sampleCount: number;
  positiveCount: number;
  aboveThresholdCount: number;
}

interface ToxinStats {
  name: string;
  shortName: string;
  detectedCount: number;
  dangerousCount: number;
}

function uniqSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function getShortToxinName(name: string) {
  if (TOXIN_ALIASES[name]) return TOXIN_ALIASES[name];

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return initials || name.slice(0, 4).toUpperCase();
}

function getToxinColor(shortName: string) {
  const explicit = TOXIN_ALIASES[shortName] ?? shortName;
  const paletteIndex = explicit.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % TOXIN_PALETTE.length;
  return TOXIN_PALETTE[paletteIndex];
}

function normalizeDate(dateValue: string) {
  return new Date(`${dateValue}T00:00:00`);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getQuarterFromDate(date: Date) {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function formatQuarterLabel(date: Date) {
  return `Q${getQuarterFromDate(date)} ${date.getFullYear()}`;
}

export function getQuarterDateRange(label: string) {
  const match = /^Q([1-4])\s+(\d{4})$/.exec(label);
  if (!match) {
    return null;
  }

  const quarter = Number(match[1]);
  const year = Number(match[2]);
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);

  return {
    from: start.toISOString().split('T')[0],
    to: end.toISOString().split('T')[0],
  };
}

function isWithinRange(sample: Sample, filters: DashboardFilters) {
  const date = normalizeDate(sample.collection_date);
  const from = filters.dateRange.from ? startOfDay(normalizeDate(filters.dateRange.from)) : null;
  const to = filters.dateRange.to ? endOfDay(normalizeDate(filters.dateRange.to)) : null;

  if (from && date < from) return false;
  if (to && date > to) return false;
  if (filters.commodities.length > 0 && !filters.commodities.includes(sample.vegetation_variety)) return false;
  if (filters.regions.length > 0 && !filters.regions.includes(sample.region)) return false;

  // Province Filtering (Deep Match)
  if (filters.provinces.length > 0 && !filters.provinces.includes(sample.province)) return false;

  return true;
}

function getSampleResults(sample: Sample) {
  return sample.mycotoxin_results ?? [];
}

export function hasRecordedResults(sample: Sample) {
  return hasMeasuredResults(sample);
}

export function getRiskLevel(sample: Sample, overrides?: Record<string, Record<string, number>>): RiskLevel {
  return getThresholdRiskLevel(sample, overrides);
}

export function getLatestProcessState(sample: Sample): ProcessState | null {
  const logs = sample.process_logs ?? [];
  if (logs.length > 0) {
    return logs[logs.length - 1]?.state ?? null;
  }

  if (sample.status === 'completed' || sample.status === 'flagged') return 'completed';
  if (sample.status === 'in_progress') return 'analyzing';
  if (sample.status === 'pending') return 'registered';
  return null;
}

export function getLastUpdatedAt(sample: Sample) {
  const logs = sample.process_logs ?? [];
  if (logs.length > 0) {
    return new Date(logs[logs.length - 1].timestamp);
  }
  return normalizeDate(sample.collection_date);
}

function getCompletionDate(sample: Sample) {
  const logs = sample.process_logs ?? [];
  const completedLog = [...logs].reverse().find((log) => log.state === 'completed');
  if (completedLog) return new Date(completedLog.timestamp);
  if (sample.status === 'completed' || sample.status === 'flagged') return getLastUpdatedAt(sample);
  return null;
}

function getCommodityStats(samples: Sample[], overrides?: Record<string, Record<string, number>>) {
  const groups = new Map<string, CommodityStats>();

  for (const sample of samples) {
    const commodity = sample.vegetation_variety || 'Unknown';
    const current = groups.get(commodity) ?? {
      name: commodity,
      sampleCount: 0,
      positiveCount: 0,
      aboveThresholdCount: 0,
    };

    current.sampleCount += 1;
    if (hasAboveThresholdResults(sample, overrides)) {
      current.positiveCount += 1;
      current.aboveThresholdCount += 1;
    }
    groups.set(commodity, current);
  }

  return [...groups.values()];
}

function getToxinStats(samples: Sample[], overrides?: Record<string, Record<string, number>>) {
  const groups = new Map<string, ToxinStats>();

  for (const sample of samples) {
    for (const result of getSampleResults(sample)) {
      const key = result.name;
      const current = groups.get(key) ?? {
        name: result.name,
        shortName: getShortToxinName(result.name),
        detectedCount: 0,
        dangerousCount: 0,
      };

      current.detectedCount += 1;
      if (isAboveThresholdResult(result, overrides, sample.vegetation_variety)) current.dangerousCount += 1;
      groups.set(key, current);
    }
  }

  return [...groups.values()];
    }

function getSeverityFromScore(score: number): ToxinScore['severity'] {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function buildToxinColors(toxinStats: ToxinStats[]) {
  return toxinStats.reduce<Record<string, string>>((accumulator, toxin) => {
    accumulator[toxin.shortName] = getToxinColor(toxin.shortName);
    return accumulator;
  }, {});
}

function buildProvinceRiskData(samples: Sample[], overrides?: Record<string, Record<string, number>>) {
  const groups = new Map<string, Sample[]>();

  for (const sample of samples) {
    const bucket = groups.get(sample.province) ?? [];
    bucket.push(sample);
    groups.set(sample.province, bucket);
  }

  return [...groups.entries()].map(([province, provinceSamples]) => {
    const sampleCount = provinceSamples.length;
    const aboveThresholdCount = provinceSamples.filter((sample) => getRiskLevel(sample, overrides) === 'high').length;
    const positiveCount = aboveThresholdCount;
    const aboveThresholdPct = toPercent(aboveThresholdCount, sampleCount);
    const positivePct = aboveThresholdPct;
    const toxinCounts = new Map<string, number>();
    const commodityCounts = new Map<string, number>();

    for (const sample of provinceSamples) {
      commodityCounts.set(sample.vegetation_variety, (commodityCounts.get(sample.vegetation_variety) ?? 0) + 1);
      for (const result of getSampleResults(sample)) {
        const key = isAboveThresholdResult(result, overrides, sample.vegetation_variety) ? result.name : getShortToxinName(result.name);
        toxinCounts.set(key, (toxinCounts.get(key) ?? 0) + (isAboveThresholdResult(result, overrides, sample.vegetation_variety) ? 2 : 1));
      }
    }

    const dominantToxin = [...toxinCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'None';
    const dominantCommodity = [...commodityCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Unknown';

    let riskLevel: ProvinceRisk['riskLevel'] = 'low';
    if (aboveThresholdPct >= 50) riskLevel = 'critical';
    else if (aboveThresholdPct >= 25) riskLevel = 'high';
    else if (aboveThresholdPct >= 10 || provinceSamples.some((sample) => getRiskLevel(sample, overrides) === 'medium')) riskLevel = 'medium';

    return {
      name: province,
      nameEn: province,
      region: provinceSamples[0]?.region ?? 'Unknown',
      riskLevel,
      sampleCount,
      positiveCount,
      positivePct,
      aboveThresholdPct,
      dominantToxin,
      dominantCommodity,
    };
  }).sort((left, right) => right.aboveThresholdPct - left.aboveThresholdPct || right.sampleCount - left.sampleCount);
}

function buildPublicHealthSummary(samples: Sample[], commodityStats: CommodityStats[], coContamSummary: CoContamSummary, overrides?: Record<string, Record<string, number>>): HealthSummary {
  const topCommodity = [...commodityStats].sort((left, right) => right.aboveThresholdCount - left.aboveThresholdCount)[0];
  const highRiskSamples = samples.filter((sample) => getRiskLevel(sample, overrides) === 'high');
  const topRegion = Object.entries(highRiskSamples.reduce<Record<string, number>>((accumulator, sample) => {
    accumulator[sample.region] = (accumulator[sample.region] ?? 0) + 1;
    return accumulator;
  }, {})).sort((left, right) => right[1] - left[1])[0];

  const toxinStats = getToxinStats(samples, overrides);
  const topToxin = [...toxinStats].sort((left, right) => right.dangerousCount - left.dangerousCount || right.detectedCount - left.detectedCount)[0];

  const riskDrivers = [
    topToxin ? `${topToxin.name} is the strongest detected toxin signal in the current sample window.` : null,
    topCommodity ? `${topCommodity.name} shows the highest above-threshold burden across sampled commodities.` : null,
    topRegion ? `${topRegion[0]} currently contains the largest cluster of above-threshold samples.` : null,
    coContamSummary.pctTwoPlus > 0 ? `${coContamSummary.pctTwoPlus}% of positive samples contain at least two toxins.` : null,
  ].filter((value): value is string => Boolean(value));

  const affectedCommodities = [...commodityStats]
    .filter((commodity) => commodity.sampleCount > 0)
    .sort((left, right) => toPercent(right.aboveThresholdCount, right.sampleCount) - toPercent(left.aboveThresholdCount, left.sampleCount))
    .slice(0, 4)
    .map((commodity) => ({
      name: commodity.name,
      pct: Math.round(toPercent(commodity.aboveThresholdCount, commodity.sampleCount)),
    }));

  const sampleTypeStats = Object.entries(samples.reduce<Record<string, { total: number; high: number }>>((accumulator, sample) => {
    const sampleType = sample.sample_type ?? 'field';
    const current = accumulator[sampleType] ?? { total: 0, high: 0 };
    current.total += 1;
    if (getRiskLevel(sample, overrides) === 'high') current.high += 1;
    accumulator[sampleType] = current;
    return accumulator;
  }, {}))
    .sort((left, right) => toPercent(right[1].high, right[1].total) - toPercent(left[1].high, left[1].total))
    .slice(0, 4);

  const impactedPopulations = sampleTypeStats.map(([sampleType, stats]) => ({
    group: SAMPLE_TYPE_LABELS[sampleType] ?? sampleType,
    severity: toPercent(stats.high, stats.total) >= 25 ? 'High' as const : 'Medium' as const,
  }));

  return {
    riskDrivers,
    affectedCommodities,
    impactedPopulations,
  };
}

function buildPairKey(toxins: string[]) {
  return toxins.join(' + ');
}

function buildCoContamination(samples: Sample[], toxinColors: Record<string, string>) {
  const positiveSamples = samples.filter((sample) => getSampleResults(sample).length > 0);
  const toxinCounts = positiveSamples.map((sample) => uniqSorted(getSampleResults(sample).map((result) => getShortToxinName(result.name))));
  const pairCounts = new Map<string, number>();
  const combinationCounts = new Map<string, { toxins: string[]; count: number }>();
  const toxinFrequency = new Map<string, number>();

  for (const toxins of toxinCounts) {
    toxins.forEach((toxin) => toxinFrequency.set(toxin, (toxinFrequency.get(toxin) ?? 0) + 1));

    for (let first = 0; first < toxins.length; first += 1) {
      for (let second = first + 1; second < toxins.length; second += 1) {
        const pair = [toxins[first], toxins[second]];
        const key = buildPairKey(pair);
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
      }
    }

    if (toxins.length >= 2) {
      const combo = toxins.slice(0, Math.min(toxins.length, 3));
      const key = buildPairKey(combo);
      const current = combinationCounts.get(key) ?? { toxins: combo, count: 0 };
      current.count += 1;
      combinationCounts.set(key, current);
    }
  }

  const positiveCount = positiveSamples.length;
  const withTwoPlus = toxinCounts.filter((toxins) => toxins.length >= 2).length;
  const withThreePlus = toxinCounts.filter((toxins) => toxins.length >= 3).length;
  const mostCommonPair = [...pairCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'None';

  const coContamSummary: CoContamSummary = {
    avgToxinsPerSample: positiveCount > 0 ? Number((toxinCounts.reduce((sum, toxins) => sum + toxins.length, 0) / positiveCount).toFixed(1)) : 0,
    pctTwoPlus: Number(toPercent(withTwoPlus, positiveCount).toFixed(1)),
    pctThreePlus: Number(toPercent(withThreePlus, positiveCount).toFixed(1)),
    mostCommonPair,
  };

  const coOccurrenceList: CoOccurrence[] = [...combinationCounts.values()]
    .sort((left, right) => right.count - left.count)
    .slice(0, 5)
    .map((entry) => ({
      toxins: entry.toxins,
      sampleCount: entry.count,
      pct: Number(toPercent(entry.count, positiveCount).toFixed(1)),
    }));

  const networkNodes = [...toxinFrequency.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10)
    .map(([toxin, count]) => ({
      id: toxin,
      frequency: Math.round(toPercent(count, positiveCount)),
      color: toxinColors[toxin] ?? getToxinColor(toxin),
    }));

  const allowedNodeIds = new Set(networkNodes.map((node) => node.id));
  const networkLinks = [...pairCounts.entries()]
    .map(([pair, count]) => {
      const [source, target] = pair.split(' + ');
      return { source, target, value: count };
    })
    .filter((link) => allowedNodeIds.has(link.source) && allowedNodeIds.has(link.target))
    .sort((left, right) => right.value - left.value)
    .slice(0, 10);

  const toxinsPerSample: ToxinDist[] = [1, 2, 3].map((count) => ({
    count: String(count),
    pct: Number(toPercent(toxinCounts.filter((toxins) => toxins.length === count).length, positiveCount).toFixed(1)),
    highlight: count === 2,
  }));

  toxinsPerSample.push({
    count: '4+',
    pct: Number(toPercent(toxinCounts.filter((toxins) => toxins.length >= 4).length, positiveCount).toFixed(1)),
  });

  return {
    coContamSummary,
    coOccurrenceList,
    networkData: {
      nodes: networkNodes,
      links: networkLinks,
    } as NetworkData,
    toxinsPerSample,
  };
}

function buildKpiData(currentSamples: Sample[], previousSamples: Sample[], overrides?: Record<string, Record<string, number>>) {
  const currentPositive = currentSamples.filter((sample) => hasAboveThresholdResults(sample, overrides)).length;
  const currentAboveThreshold = currentSamples.filter((sample) => getRiskLevel(sample, overrides) === 'high').length;
  const currentHighRiskRegions = new Set(
    currentSamples.filter((sample) => getRiskLevel(sample, overrides) === 'high').map((sample) => sample.region)
  ).size;
  const currentAlerts = currentSamples.filter((sample) => sample.status === 'flagged').length;

  const previousPositive = previousSamples.filter((sample) => hasAboveThresholdResults(sample, overrides)).length;
  const previousAboveThreshold = previousSamples.filter((sample) => getRiskLevel(sample, overrides) === 'high').length;
  const previousHighRiskRegions = new Set(
    previousSamples.filter((sample) => getRiskLevel(sample, overrides) === 'high').map((sample) => sample.region)
  ).size;
  const previousAlerts = previousSamples.filter((sample) => sample.status === 'flagged').length;

  const commodityStats = getCommodityStats(currentSamples, overrides);
  const highestRiskCommodity = [...commodityStats]
    .filter((commodity) => commodity.sampleCount > 0)
    .sort((left, right) => toPercent(right.aboveThresholdCount, right.sampleCount) - toPercent(left.aboveThresholdCount, left.sampleCount))[0]
    ?.name ?? 'None';

  const currentPositivePct = toPercent(currentPositive, currentSamples.length);
  const currentThresholdPct = toPercent(currentAboveThreshold, currentSamples.length);
  const previousPositivePct = toPercent(previousPositive, previousSamples.length);
  const previousThresholdPct = toPercent(previousAboveThreshold, previousSamples.length);

  const delta = (currentValue: number, previousValue: number) => {
    if (previousValue === 0) return currentValue === 0 ? 0 : 100;
    return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(1));
  };

  return {
    cards: [
      {
        label: 'Total Samples Reported',
        value: currentSamples.length,
        delta: Math.abs(delta(currentSamples.length, previousSamples.length)),
        deltaDirection: currentSamples.length >= previousSamples.length ? 'up' : 'down',
        isImprovement: null,
        context: 'vs previous period',
      },
      {
        label: '% Positive Samples',
        value: `${currentPositivePct.toFixed(1)}%`,
        delta: Math.abs(delta(currentPositivePct, previousPositivePct)),
        deltaDirection: currentPositivePct >= previousPositivePct ? 'up' : 'down',
        isImprovement: false,
        context: 'samples with recorded toxin results',
      },
      {
        label: '% Above Safety Threshold',
        value: `${currentThresholdPct.toFixed(1)}%`,
        delta: Math.abs(delta(currentThresholdPct, previousThresholdPct)),
        deltaDirection: currentThresholdPct >= previousThresholdPct ? 'up' : 'down',
        isImprovement: currentThresholdPct <= previousThresholdPct,
        context: 'dangerous toxin results in range',
      },
      {
        label: 'High Risk Regions',
        value: currentHighRiskRegions,
        delta: Math.abs(delta(currentHighRiskRegions, previousHighRiskRegions)),
        deltaDirection: currentHighRiskRegions >= previousHighRiskRegions ? 'up' : 'down',
        isImprovement: currentHighRiskRegions <= previousHighRiskRegions,
        context: 'regions with above-threshold samples',
      },
      {
        label: 'Highest Risk Commodity',
        value: highestRiskCommodity,
        delta: null,
        deltaDirection: null,
        isImprovement: null,
        context: 'ranked by above-threshold share',
      },
      {
        label: 'Active Alerts',
        value: currentAlerts,
        delta: Math.abs(delta(currentAlerts, previousAlerts)),
        deltaDirection: currentAlerts >= previousAlerts ? 'up' : 'down',
        isImprovement: currentAlerts <= previousAlerts,
        context: 'samples currently flagged',
        accent: 'red',
      },
    ],
  } satisfies KPIData;
}

function buildHeatmapData(samples: Sample[], commodities: string[], overrides?: Record<string, Record<string, number>>) {
  const grouped = new Map<string, { riskScore: number; total: number }>();
  const regions = uniqSorted(samples.map((sample) => sample.region));

  for (const sample of samples) {
    const key = `${sample.region}-${sample.vegetation_variety}`;
    const risk = getRiskLevel(sample, overrides);
    const score = risk === 'high' ? 100 : risk === 'medium' ? 65 : risk === 'low' ? 30 : 5;
    const current = grouped.get(key) ?? { riskScore: 0, total: 0 };
    current.riskScore += score;
    current.total += 1;
    grouped.set(key, current);
  }

  const heatmapData: HeatmapCell[] = [];
  for (const region of regions) {
    for (const commodity of commodities) {
      const key = `${region}-${commodity}`;
      const current = grouped.get(key);
      heatmapData.push({
        region,
        commodity,
        intensity: current ? Math.round(current.riskScore / current.total) : 0,
      });
    }
  }

  return { heatmapData, regions };
}

export function buildFilterOptions(samples: Sample[]): FilterOptions {
  if (samples.length === 0) {
    return {
      commodities: [],
      regions: [],
      quarters: [ALL_TIME_QUARTER, CUSTOM_RANGE_QUARTER],
      dateRange: { from: '', to: '' },
    };
  }

  const sortedDates = samples
    .map((sample) => sample.collection_date)
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const quarters = uniqSorted(
    samples.map((sample) => formatQuarterLabel(normalizeDate(sample.collection_date)))
  ).sort((left, right) => {
    const leftRange = getQuarterDateRange(left);
    const rightRange = getQuarterDateRange(right);
    if (!leftRange || !rightRange) return right.localeCompare(left);
    return rightRange.from.localeCompare(leftRange.from);
  });

  return {
    commodities: uniqSorted(samples.map((sample) => sample.vegetation_variety)),
    regions: uniqSorted(samples.map((sample) => sample.region)),
    quarters: [ALL_TIME_QUARTER, ...quarters, CUSTOM_RANGE_QUARTER],
    dateRange: {
      from: sortedDates[0],
      to: sortedDates[sortedDates.length - 1],
    },
  };
}

export function filterSamples(samples: Sample[], filters: DashboardFilters) {
  return samples.filter((sample) => isWithinRange(sample, filters));
}

export function buildSurveillanceAnalytics(
  allSamples: Sample[], 
  filters: DashboardFilters,
  overrides?: Record<string, Record<string, number>>
): SurveillanceAnalytics {
  const filteredSamples = filterSamples(allSamples, filters);
  const startDate = filters.dateRange.from ? startOfDay(normalizeDate(filters.dateRange.from)) : null;
  const endDate = filters.dateRange.to ? endOfDay(normalizeDate(filters.dateRange.to)) : null;
  const rangeDays = startDate && endDate ? Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1) : 30;
  const previousFrom = startDate ? addDays(startDate, -rangeDays) : null;
  const previousTo = startDate ? addDays(startDate, -1) : null;

  const previousSamples = allSamples.filter((sample) => {
    if (filters.commodities.length > 0 && !filters.commodities.includes(sample.vegetation_variety)) return false;
    if (filters.regions.length > 0 && !filters.regions.includes(sample.region)) return false;

    if (!previousFrom || !previousTo) return false;
    const sampleDate = normalizeDate(sample.collection_date);
    return sampleDate >= previousFrom && sampleDate <= previousTo;
  });

  const toxinStats = getToxinStats(filteredSamples, overrides);
  const toxinColors = buildToxinColors(toxinStats);
  const commodityStats = getCommodityStats(filteredSamples, overrides);
  const topCommodities = [...commodityStats]
    .sort((left, right) => right.sampleCount - left.sampleCount)
    .slice(0, 5)
    .map((commodity) => commodity.name);

  const mycotoxinBarData: ToxinScore[] = toxinStats
    .sort((left, right) => right.dangerousCount - left.dangerousCount || right.detectedCount - left.detectedCount)
    .slice(0, 10)
    .map((toxin) => {
      const score = clamp(
        Math.round(toPercent(toxin.dangerousCount, filteredSamples.length || 1)),
        0,
        100,
      );
      return {
        name: toxin.name,
        shortName: toxin.shortName,
        score,
        severity: getSeverityFromScore(score),
      };
    });

  const commodityPalette = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#6b7280'];
  const positiveSamples = filteredSamples.filter((sample) => hasAboveThresholdResults(sample, overrides));
  const positiveCommodityCounts = getCommodityStats(positiveSamples, overrides)
    .sort((left, right) => right.positiveCount - left.positiveCount)
    .slice(0, 5);

  const commodityShare: CommodityShare[] = positiveCommodityCounts.map((commodity, index) => ({
    name: commodity.name,
    value: Math.round(toPercent(commodity.positiveCount, positiveSamples.length || 1)),
    color: commodityPalette[index % commodityPalette.length],
  }));

  const thresholdByCommodity: ThresholdData[] = commodityStats
    .filter((commodity) => commodity.sampleCount > 0)
    .sort((left, right) => toPercent(right.aboveThresholdCount, right.sampleCount) - toPercent(left.aboveThresholdCount, left.sampleCount))
    .slice(0, 5)
    .map((commodity) => ({
      commodity: commodity.name,
      pctAbove: Math.round(toPercent(commodity.aboveThresholdCount, commodity.sampleCount)),
    }));

  const { heatmapData, regions: heatmapRegions } = buildHeatmapData(filteredSamples, topCommodities, overrides);
  const provinceRiskData = buildProvinceRiskData(filteredSamples, overrides);
  const topProvinces: ProvinceRank[] = provinceRiskData
    .filter((province) => province.aboveThresholdPct > 0)
    .slice(0, 5)
    .map((province, index) => ({
      rank: index + 1,
      province: province.name,
      sampleCount: province.sampleCount,
      aboveThresholdPct: province.aboveThresholdPct,
      dominantToxin: province.dominantToxin,
      riskLevel: province.riskLevel === 'critical' ? 'critical' : 'high',
    }));

  const coContamination = buildCoContamination(filteredSamples, toxinColors);

  return {
    filteredSamples,
    kpiData: buildKpiData(filteredSamples, previousSamples, overrides),
    provinceRiskData,
    topProvinces,
    publicHealthSummary: buildPublicHealthSummary(filteredSamples, commodityStats, coContamination.coContamSummary, overrides),
    mycotoxinBarData,
    commodityShare,
    thresholdByCommodity,
    heatmapData,
    heatmapRegions,
    heatmapCommodities: topCommodities,
    coContamSummary: coContamination.coContamSummary,
    coOccurrenceList: coContamination.coOccurrenceList,
    networkData: coContamination.networkData,
    toxinsPerSample: coContamination.toxinsPerSample,
    toxinColors,
  };
}
