import type { MycotoxinResult, RiskLevel, Sample } from '@/types/sample';
import { USER_ROLE_WEIGHT, type UserRole } from '@/types/user';

const ABOVE_THRESHOLD_RISK_LEVELS = new Set(['high', 'critical']);
const DETECTED_RISK_LEVELS = new Set(['detected', 'high', 'critical']);

/**
 * Checks if a result is above threshold, optionally using simulator overrides
 */
export function isAboveThresholdResult(
  result: MycotoxinResult, 
  overrides?: Record<string, Record<string, number>>,
  sampleVariety?: string
) {
  const value = getResultValue(result);
  if (value === null || result.is_below_lod) return false;
  const toxinCode = result.toxin_type || result.name;
  const variety = sampleVariety || 'unknown';
  const threshold = overrides?.[toxinCode]?.[variety]
    ?? overrides?.[toxinCode]?.[variety.toLowerCase()];
  if (typeof threshold === 'number' && Number.isFinite(threshold)) {
    return value > threshold;
  }

  // Fallback to existing logic
  if (result.risk_level) {
    return ABOVE_THRESHOLD_RISK_LEVELS.has(result.risk_level);
  }

  if (typeof result.dangerous === 'boolean') {
    return result.dangerous;
  }

  const storedThreshold = result.eu_threshold_low ?? result.threshold;
  return storedThreshold != null && value > storedThreshold;
}

export function isDetectedResult(result: MycotoxinResult) {
  if (result.is_below_lod) return false;
  const value = getResultValue(result);
  if (value !== null) return value > 0;
  if (result.value === null) return false;
  if (typeof result.is_detected === 'boolean') return result.is_detected;
  return DETECTED_RISK_LEVELS.has(result.risk_level ?? '');
}

export function hasAboveThresholdResults(
  sample: Sample, 
  overrides?: Record<string, Record<string, number>>
) {
  return sample.mycotoxin_results?.some(r => isAboveThresholdResult(r, overrides, sample.vegetation_variety)) ?? false;
}

export function hasMeasuredResults(sample: Sample) {
  return sample.mycotoxin_results != null
    ? sample.mycotoxin_results.length > 0
    : (sample.results_count ?? 0) > 0;
}

export function getThresholdRiskLevel(
  sample: Sample, 
  overrides?: Record<string, Record<string, number>>
): RiskLevel {
  const results = sample.mycotoxin_results ?? [];

  if (results.some(r => isAboveThresholdResult(r, overrides, sample.vegetation_variety))) {
    return 'high';
  }

  if (results.some(isUnclassifiedResult)) return 'unclassified';

  if (results.some(isDetectedResult)) {
    return 'low';
  }

  return sample.risk_level ?? 'safe';
}

export function getThresholdRiskScore(
  sample: Sample, 
  overrides?: Record<string, Record<string, number>>
) {
  const results = sample.mycotoxin_results ?? [];

  if (results.length === 0) {
    const riskWeight: Record<string, number> = {
      safe: 1,
      low: 2,
      medium: 3,
      high: 4,
    };

    return riskWeight[sample.risk_level || 'safe'] || 0;
  }

  return Math.max(
    ...results.map((result) => {
      const threshold = result.threshold ?? result.eu_threshold_low ?? 0;
      const ratio = threshold > 0 ? (getResultValue(result) ?? 0) / threshold : 0;

      if (isAboveThresholdResult(result, overrides, sample.vegetation_variety)) {
        return 100 + ratio;
      }

      if (isDetectedResult(result)) {
        return 10 + ratio;
      }

      return ratio;
    }),
  );
}

export function getResultValue(result: MycotoxinResult): number | null {
  const value = result.value !== undefined ? result.value : result.intensity;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function getResultName(result: MycotoxinResult): string {
  return result.name || result.toxin_type || 'Unknown toxin';
}

export function isUnclassifiedResult(result: MycotoxinResult): boolean {
  if (result.risk_level === 'unclassified' || getResultValue(result) === null) return true;
  if (result.risk_level) return false;
  return result.eu_threshold_low == null && result.threshold == null;
}

export function hasUnclassifiedResults(sample: Sample): boolean {
  return sample.mycotoxin_results?.some(isUnclassifiedResult) ?? false;
}

export function canRecordSampleResults(
  sample: Sample | null,
  role: UserRole | 'guest',
  isAdmin: boolean,
  currentUsername?: string
): boolean {
  if (!sample) return false;
  if (typeof sample.can_record_results === 'boolean') {
    return sample.can_record_results;
  }
  if (isAdmin) return true;
  if ((USER_ROLE_WEIGHT[role as UserRole] ?? 0) >= USER_ROLE_WEIGHT.researcher) return true;
  if (role === 'research_assistant' && currentUsername) {
    return sample.recorded_by === currentUsername || sample.collected_by === currentUsername;
  }
  return false;
}
