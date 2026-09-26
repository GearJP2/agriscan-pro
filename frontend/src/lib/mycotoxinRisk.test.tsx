import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import MycotoxinResults from '@/features/samples/components/MycotoxinResults';
import ProcessTimeline from '@/features/samples/components/ProcessTimeline';
import SampleTable from '@/features/samples/components/SampleTable';
import type { MycotoxinResult, Sample, ProcessLog } from '@/types/sample';
import { getResultValue, getThresholdRiskLevel, hasMeasuredResults, isAboveThresholdResult, isDetectedResult } from './mycotoxinRisk';

vi.mock('@/hooks/useWatchlist', () => ({
  useWatchlist: () => ({ isWatching: () => false, toggleWatch: vi.fn() }),
}));

const result: MycotoxinResult = {
  toxin_type: 'NEW', name: '', value: 12, intensity: 999,
  unit: 'ug/kg', dangerous: false, risk_level: 'unclassified',
};
const sample: Sample = {
  sample_id: 'sample-1', region: 'Central', province: 'Bangkok', district: 'District',
  vegetation_variety: 'Rice', collection_date: '2026-01-01', status: 'completed',
  mycotoxin_results: [result],
};

describe('dynamic mycotoxin results', () => {
  it('uses the CSV screening outcome without displaying a second assessment', () => {
    const reported: Sample = {
      ...sample, screening_result: 'positive',
      mycotoxin_results: [{ ...result, toxin_type: 'AFB1', value: 1, risk_level: 'safe' }],
    };
    const html = renderToStaticMarkup(<SampleTable samples={[reported]} onSelectSample={() => {}} />);
    expect(html).toContain('Positive');
    expect(html).not.toContain('(reported)');
    expect(html).not.toContain('Below Threshold');
    expect(html).not.toContain('Unclassified');
    const negative: Sample = { ...sample, screening_result: 'negative', mycotoxin_results: [] };
    const negativeHtml = renderToStaticMarkup(<SampleTable samples={[negative]} onSelectSample={() => {}} />);
    expect(negativeHtml).toContain('Negative');
    expect(negativeHtml).not.toContain('Pending');
    const concentrations = renderToStaticMarkup(<MycotoxinResults results={[result]} showThresholdAssessment={false} />);
    expect(concentrations).toContain('12 ug/kg');
    expect(concentrations).not.toContain('No threshold data');
    expect(concentrations).not.toContain('Below Threshold');
  });

  it('uses canonical measurements and does not treat an unclassified detection as safe', () => {
    expect(getResultValue(result)).toBe(12);
    expect(getThresholdRiskLevel(sample)).toBe('unclassified');
    expect(isDetectedResult(result)).toBe(true);
    expect(isAboveThresholdResult(result, {})).toBe(false);
    expect(isAboveThresholdResult(result, { NEW: { Rice: 10 } }, 'Rice')).toBe(true);
    expect(isAboveThresholdResult({ ...result, value: null }, { NEW: { Rice: 0 } }, 'Rice')).toBe(false);
    expect(isDetectedResult({ ...result, is_below_lod: true })).toBe(false);
    expect(isDetectedResult({ ...result, value: null })).toBe(false);
  });

  it('renders unfamiliar and removed toxin codes without frontend metadata', () => {
    const html = renderToStaticMarkup(<MycotoxinResults results={[result]} />);
    expect(html).toContain('NEW');
    expect(html).toContain('12 ug/kg');
    expect(html).toContain('No threshold data');
    expect(html).not.toContain('Below Threshold');
    const list = renderToStaticMarkup(<SampleTable samples={[sample]} onSelectSample={() => {}} />);
    expect(list).toContain('Unclassified');
  });

  it('renders no results after the last result is removed, even with a stale summary count', () => {
    const empty = { ...sample, mycotoxin_results: [], results_count: 1 };
    expect(hasMeasuredResults(empty)).toBe(false);
    expect(renderToStaticMarkup(<MycotoxinResults results={[]} />)).toContain('No mycotoxin results');
    expect(renderToStaticMarkup(<SampleTable samples={[empty]} onSelectSample={() => {}} />)).toContain('Pending');
  });

  it('preserves recorded threshold decisions for removed catalog entries', () => {
    const historical = { ...result, toxin_type: 'RETIRED', risk_level: 'high' as const };
    expect(isAboveThresholdResult(historical, {})).toBe(true);
    expect(renderToStaticMarkup(<MycotoxinResults results={[historical]} />)).toContain('Positive');
  });

  it('keeps the process card renderable with an unfamiliar legacy step', () => {
    const log = { id: 'log-1', state: 'legacy_step', timestamp: '', conducted_by: 'Lab' } as unknown as ProcessLog;
    expect(renderToStaticMarkup(<ProcessTimeline logs={[log]} />)).toContain('legacy_step');
    expect(renderToStaticMarkup(<ProcessTimeline logs={[]} />)).toContain('Process Log');
  });
});
