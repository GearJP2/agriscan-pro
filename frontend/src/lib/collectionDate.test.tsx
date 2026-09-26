import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import SampleTable from '@/features/samples/components/SampleTable';
import type { Sample } from '@/types/sample';
import { parseResearchDataFile } from './dataImport';
import { buildFilterOptions, filterSamples } from './sampleAnalytics';

vi.mock('@/hooks/useWatchlist', () => ({
  useWatchlist: () => ({ isWatching: () => false, toggleWatch: vi.fn() }),
}));

const sample: Sample = {
  sample_id: '13052026_Sample1', region: 'Central', province: 'Bangkok',
  district: 'District', vegetation_variety: 'Rice', collection_date: null,
  status: 'pending',
};

describe('missing collection dates', () => {
  it('shows Not provided instead of a fabricated date', () => {
    const html = renderToStaticMarkup(<SampleTable samples={[sample]} onSelectSample={() => {}} />);
    expect(html).toContain('Not provided');
    expect(html).not.toContain('Jan 01, 1970');
  });

  it('does not create date ranges or invalid quarters for undated samples', () => {
    const options = buildFilterOptions([sample]);
    expect(options.dateRange).toEqual({ from: '', to: '' });
    expect(options.quarters).toEqual(['All Time', 'Custom Range']);
    const mixed = buildFilterOptions([sample, { ...sample, collection_date: '2026-05-12' }]);
    expect(mixed.dateRange).toEqual({ from: '2026-05-12', to: '2026-05-12' });
    expect(mixed.quarters).toContain('Q2 2026');
  });

  it('includes undated samples in all-time views but not a specific date range', () => {
    const filters = {
      dateRange: { from: '', to: '' }, commodities: [], regions: [], provinces: [], quarter: 'All Time',
    };
    expect(filterSamples([sample], filters)).toHaveLength(1);
    expect(filterSamples([sample], {
      ...filters, dateRange: { from: '2026-01-01', to: '2026-12-31' },
    })).toHaveLength(0);
  });

  it('imports only supplied dates instead of defaulting to today', () => {
    const headers = ['Province', 'District', 'Variety', 'Collection date', 'AFB1'];
    const parsed = parseResearchDataFile(headers, [
      ['Bangkok', 'District', 'Rice', '', '1'],
      ['Bangkok', 'District', 'Rice', '12/05/2026', '2'],
    ]);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].sample.collection_date).toBeNull();
    expect(parsed[1].sample.collection_date).toBe('2026-05-12');
  });
});
