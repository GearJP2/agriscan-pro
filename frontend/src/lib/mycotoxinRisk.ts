import type { MycotoxinResult, RiskLevel, Sample } from '@/types/sample';

const ABOVE_THRESHOLD_RISK_LEVELS = new Set(['high', 'critical']);
const DETECTED_RISK_LEVELS = new Set(['detected', 'high', 'critical']);

export function isAboveThresholdResult(result: MycotoxinResult) {
  if (result.risk_level) {
    return ABOVE_THRESHOLD_RISK_LEVELS.has(result.risk_level);
  }

  if (typeof result.dangerous === 'boolean') {
    return result.dangerous;
  }

  return Boolean(result.threshold && result.threshold > 0 && result.intensity > result.threshold);
}

export function isDetectedResult(result: MycotoxinResult) {
  if (result.risk_level) {
    return DETECTED_RISK_LEVELS.has(result.risk_level);
  }

  if (typeof result.is_detected === 'boolean') {
    return result.is_detected;
  }

  return result.intensity > 0;
}

export function hasAboveThresholdResults(sample: Sample) {
  return sample.mycotoxin_results?.some(isAboveThresholdResult) ?? false;
}

export function hasMeasuredResults(sample: Sample) {
  return (sample.mycotoxin_results?.length ?? 0) > 0 || (sample.results_count ?? 0) > 0;
}

export function getThresholdRiskLevel(sample: Sample): RiskLevel {
  const results = sample.mycotoxin_results ?? [];

  if (results.some(isAboveThresholdResult)) {
    return 'high';
  }

  if (results.some(isDetectedResult)) {
    return 'low';
  }

  return sample.risk_level ?? 'safe';
}

export function getThresholdRiskScore(sample: Sample) {
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
      const ratio = threshold > 0 ? result.intensity / threshold : 0;

      if (isAboveThresholdResult(result)) {
        return 100 + ratio;
      }

      if (isDetectedResult(result)) {
        return 10 + ratio;
      }

      return ratio;
    }),
  );
}
