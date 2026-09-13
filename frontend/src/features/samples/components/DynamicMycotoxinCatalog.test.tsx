import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DynamicThresholdControl from '@/components/surveillance/DynamicThresholdControl';
import { canRecordSampleResults } from '@/lib/mycotoxinRisk';
import { invalidateSampleQueries, SAMPLE_DATA_QUERY_KEYS } from '@/lib/api';
import { SampleDetailCoordinator } from '../hooks/useSampleDetailCoordinator';
import type { Sample } from '@/types/sample';
import type { UserRole } from '@/types/user';

const mockRegistry = {
  AFB1: {
    name: 'Aflatoxin B1',
    shortName: 'AFB1',
    defaultThreshold: 2.0,
    maxThreshold: 4.0,
    unit: 'ug/kg',
    source: 'EU 2023/915',
    isUncertain: false,
  },
  DON: {
    name: 'Deoxynivalenol',
    shortName: 'DON',
    defaultThreshold: 1000.0,
    maxThreshold: 1750.0,
    unit: 'ug/kg',
    source: 'EU 2023/915',
    isUncertain: false,
  },
  AFG1: {
    name: 'Aflatoxin G1',
    shortName: 'AFG1',
    defaultThreshold: null,
    maxThreshold: null,
    unit: 'ug/kg',
    source: 'No threshold defined',
    isUncertain: true,
  },
};

vi.mock('@/hooks/useMycotoxinRegistry', () => ({
  useMycotoxinRegistry: () => ({
    data: mockRegistry,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe('Dynamic Mycotoxin Catalog and Invalidation', () => {
  it('SAMPLE_DATA_QUERY_KEYS contains the four required cache keys', () => {
    expect(SAMPLE_DATA_QUERY_KEYS).toEqual([
      'samples-list',
      'dashboard-aggregate',
      'dashboard-aggregate-fallback',
      'surveillance-environmental-correlation',
    ]);
  });

  it('invalidateSampleQueries calls queryClient.invalidateQueries for all sample and dashboard query keys', () => {
    const invalidatedKeys: string[] = [];
    const mockQueryClient = {
      invalidateQueries: vi.fn(({ queryKey }) => {
        invalidatedKeys.push(queryKey[0]);
        return Promise.resolve();
      }),
    };

    invalidateSampleQueries(mockQueryClient as any);

    expect(invalidatedKeys).toEqual([
      'samples-list',
      'dashboard-aggregate',
      'dashboard-aggregate-fallback',
      'surveillance-environmental-correlation',
    ]);
  });

  it('renders collapsed threshold controller with prominent button and active toxin summary', () => {
    const html = renderToStaticMarkup(
      <DynamicThresholdControl
        onOverridesChange={() => {}}
        commodityOptions={['maize']}
      />
    );

    expect(html).toContain('ปรับเกณฑ์ Mycotoxin');
    expect(html).toContain('Threshold Controller');
    expect(html).toContain('2 สารที่มีเกณฑ์'); // AFB1 and DON have thresholds, AFG1 does not
  });

  describe('SampleDetailModal ownership permission for Research Assistant', () => {
    const ownSample: Sample = {
      sample_id: 'S-OWN',
      region: 'Central',
      province: 'Bangkok',
      district: 'Dusit',
      vegetation_variety: 'Rice',
      collection_date: '2026-01-01',
      status: 'pending',
      recorded_by: 'assistant_somchai',
    };

    const ownCollectedSample: Sample = {
      sample_id: 'S-OWN-COLLECTED',
      region: 'Central',
      province: 'Bangkok',
      district: 'Dusit',
      vegetation_variety: 'Rice',
      collection_date: '2026-01-01',
      status: 'pending',
      collected_by: 'assistant_somchai',
    };

    const otherSample: Sample = {
      sample_id: 'S-OTHER',
      region: 'North',
      province: 'Chiang Mai',
      district: 'Muang',
      vegetation_variety: 'Corn',
      collection_date: '2026-01-01',
      status: 'pending',
      recorded_by: 'researcher_bob',
      collected_by: 'researcher_bob',
    };

    it('allows Research Assistant to record results on their OWN sample (recorded_by or collected_by)', () => {
      expect(canRecordSampleResults(ownSample, 'research_assistant', false, 'assistant_somchai')).toBe(true);
      expect(canRecordSampleResults(ownCollectedSample, 'research_assistant', false, 'assistant_somchai')).toBe(true);
    });

    it('HIDES record result button for Research Assistant on samples owned by others', () => {
      expect(canRecordSampleResults(otherSample, 'research_assistant', false, 'assistant_somchai')).toBe(false);
      expect(canRecordSampleResults(otherSample, 'research_assistant', false, undefined)).toBe(false);
    });

    it('allows Researcher and Admin to record results on ANY sample', () => {
      expect(canRecordSampleResults(otherSample, 'researcher', false, 'assistant_somchai')).toBe(true);
      expect(canRecordSampleResults(otherSample, 'head_researcher', false, 'assistant_somchai')).toBe(true);
      expect(canRecordSampleResults(otherSample, 'guest', true, 'assistant_somchai')).toBe(true);
    });

    it('prioritizes backend-computed can_record_results capability for legacy samples (e.g. updated_by only)', () => {
      const legacySampleWithBackendAuth = {
        ...otherSample,
        can_record_results: true,
      };
      // Even though recorded_by and collected_by don't match, backend says true -> UI allows
      expect(canRecordSampleResults(legacySampleWithBackendAuth, 'research_assistant', false, 'assistant_somchai')).toBe(true);

      const deniedSampleWithBackendAuth = {
        ...ownSample,
        can_record_results: false,
      };
      // Even though recorded_by matches, backend says false -> UI denies
      expect(canRecordSampleResults(deniedSampleWithBackendAuth, 'research_assistant', false, 'assistant_somchai')).toBe(false);
    });

    it('denies guests, regular users, and null samples', () => {
      expect(canRecordSampleResults(otherSample, 'user', false, 'assistant_somchai')).toBe(false);
      expect(canRecordSampleResults(otherSample, 'guest', false, 'assistant_somchai')).toBe(false);
      expect(canRecordSampleResults(null, 'admin', true)).toBe(false);
    });
  });

  describe('SampleList request sequence and stale response prevention', () => {
    it('discards stale response when newer request completes earlier using production coordinator', async () => {
      let resolveSlowA: (value: Sample) => void;
      let resolveFastB: (value: Sample) => void;

      const mockGetSampleDetail = vi.fn((sampleId: string) => {
        if (sampleId === 'SAM-A') {
          return new Promise<Sample>((resolve) => {
            resolveSlowA = resolve;
          });
        }
        return new Promise<Sample>((resolve) => {
          resolveFastB = resolve;
        });
      });

      const coordinator = new SampleDetailCoordinator({
        getSampleDetail: mockGetSampleDetail,
      });

      const sampleA: Sample = {
        sample_id: 'SAM-A',
        region: 'Central',
        province: 'Bangkok',
        district: 'Chatuchak',
        vegetation_variety: 'Rice',
        collection_date: '2026-01-01',
        status: 'pending',
      };
      const sampleB: Sample = {
        sample_id: 'SAM-B',
        region: 'North',
        province: 'Chiang Mai',
        district: 'Muang',
        vegetation_variety: 'Corn',
        collection_date: '2026-01-02',
        status: 'pending',
      };

      // 1. Select A (slow request in flight)
      coordinator.selectSample(sampleA, [sampleA, sampleB]);
      // 2. Quickly switch to B (fast request in flight)
      coordinator.selectSample(sampleB, [sampleA, sampleB]);

      // 3. Fast B completes first
      resolveFastB!({ ...sampleB, status: 'completed' });
      await Promise.resolve();
      expect(coordinator.getSelectedSample()?.sample_id).toBe('SAM-B');

      // 4. Slow A completes afterwards
      resolveSlowA!({ ...sampleA, status: 'flagged' });
      await Promise.resolve();

      // Selected sample must remain B, discarded stale response from A
      expect(coordinator.getSelectedSample()?.sample_id).toBe('SAM-B');
    });

    it('does not abort active sample B fetch when sample A save callback returns (production code test)', async () => {
      let resolveSampleB: (value: Sample) => void;
      let signalB: AbortSignal | undefined;
      let invalidated = false;

      const mockGetSampleDetail = vi.fn((sampleId: string, signal?: AbortSignal) => {
        if (sampleId === 'SAM-B' && !signalB) {
          signalB = signal;
          return new Promise<Sample>((resolve) => {
            resolveSampleB = resolve;
          });
        }
        return Promise.resolve({
          sample_id: sampleId,
          region: 'Central',
          province: 'Bangkok',
          district: 'Chatuchak',
          vegetation_variety: 'Rice',
          collection_date: '2026-01-01',
          status: 'completed',
        } as Sample);
      });

      const coordinator = new SampleDetailCoordinator({
        getSampleDetail: mockGetSampleDetail,
        invalidateSampleData: () => {
          invalidated = true;
        },
      });

      const sampleA: Sample = {
        sample_id: 'SAM-A',
        region: 'Central',
        province: 'Bangkok',
        district: 'Chatuchak',
        vegetation_variety: 'Rice',
        collection_date: '2026-01-01',
        status: 'pending',
      };

      const sampleB: Sample = {
        sample_id: 'SAM-B',
        region: 'North',
        province: 'Chiang Mai',
        district: 'Muang',
        vegetation_variety: 'Corn',
        collection_date: '2026-01-02',
        status: 'pending',
      };

      // 1. User opens sample B
      coordinator.selectSample(sampleB, [sampleA, sampleB]);
      expect(coordinator.getActiveSampleId()).toBe('SAM-B');
      expect(signalB).toBeDefined();
      expect(signalB?.aborted).toBe(false);

      // 2. Callback for sample A returns (save of A finished while B is active)
      await coordinator.handleMycotoxinResultChange('SAM-A');

      // Invalidation occurred so list/dashboard refresh
      expect(invalidated).toBe(true);

      // CRITICAL REGRESSION CHECK: Request for active sample B must NOT be aborted
      expect(signalB?.aborted).toBe(false);

      // 3. Sample B request finishes and updates state
      resolveSampleB!({
        ...sampleB,
        status: 'completed',
        mycotoxin_results: [],
      });
      await Promise.resolve();

      expect(coordinator.getSelectedSample()?.sample_id).toBe('SAM-B');
      expect(coordinator.getSelectedSample()?.status).toBe('completed');

      // 4. If callback returns for the active sample B itself, it refreshes B
      await coordinator.handleMycotoxinResultChange('SAM-B');
      expect(mockGetSampleDetail).toHaveBeenCalledWith('SAM-B', expect.anything());
    });
  });
});
