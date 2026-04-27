import type { MycotoxinResult, RiskLevel, Sample } from '@/types/sample';
import { MYCOTOXIN_REGISTRY } from '@/constants/mycotoxins';

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
  // If we have simulation overrides, they take precedence
  if (overrides) {
    const toxinCode = result.toxin_type || result.name;
    const variety = sampleVariety || 'unknown';
    
    let threshold = MYCOTOXIN_REGISTRY[toxinCode]?.defaultThreshold;
    
    // Check for override
    if (overrides[toxinCode]) {
      if (overrides[toxinCode][variety] !== undefined) {
        threshold = overrides[toxinCode][variety];
      } else if (overrides[toxinCode][variety.toLowerCase()] !== undefined) {
        threshold = overrides[toxinCode][variety.toLowerCase()];
      }
    }

    if (threshold !== undefined) {
      return result.intensity > threshold;
    }
  }

  // Fallback to existing logic
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

export function hasAboveThresholdResults(
  sample: Sample, 
  overrides?: Record<string, Record<string, number>>
) {
  return sample.mycotoxin_results?.some(r => isAboveThresholdResult(r, overrides, sample.vegetation_variety)) ?? false;
}

export function hasMeasuredResults(sample: Sample) {
  return (sample.mycotoxin_results?.length ?? 0) > 0 || (sample.results_count ?? 0) > 0;
}

export function getThresholdRiskLevel(
  sample: Sample, 
  overrides?: Record<string, Record<string, number>>
): RiskLevel {
  const results = sample.mycotoxin_results ?? [];

  if (results.some(r => isAboveThresholdResult(r, overrides, sample.vegetation_variety))) {
    return 'high';
  }

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
      const ratio = threshold > 0 ? result.intensity / threshold : 0;

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
