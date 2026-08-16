import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dashboardManifestSchema,
  dashboardSnapshotSchema,
  getSnapshotFreshness,
  loadDashboardSnapshot,
} from './dashboardSnapshot';

const checksum = 'a'.repeat(64);
const emptySections = {
  filter_options: { commodities: [], regions: [], provinces: [], date_range: { from: '', to: '' } },
  overview: {
    kpis: {
      total_samples: 0, positive_pct: 0, detected_pct: 0, above_threshold_pct: 0,
      high_risk_regions: 0, highest_risk_commodity: 'N/A', active_alerts: 0,
    },
    provinces: [],
  },
  regional: { provinces: [], regions: [], suppressed: 0 },
  commodities: { distribution: [], suppressed: 0 },
  toxins: { distribution: [] },
  heatmap: { data: [], regions: [], commodities: [] },
  co_contamination: {
    summary: { avgToxinsPerSample: 0, pctTwoPlus: 0, pctThreePlus: 0, mostCommonPair: 'None' },
    toxins_per_sample: {}, intersections: [], network: { nodes: [], links: [] },
  },
  public_health: { riskDrivers: [], affectedCommodities: [], impactedPopulations: [] },
  environmental: { status: 'unavailable', data: {} },
};

describe('dashboard snapshot schema v1', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('accepts v1 and rejects unknown versions', () => {
    const manifest = {
      schema_version: 1,
      snapshot_id: 'snapshot',
      generated_at: '2026-08-16T11:17:00Z',
      expires_at: '2026-08-16T13:17:00Z',
      snapshot_url: '/dashboard-data/versions/snapshot.json',
      checksum_sha256: checksum,
    };
    expect(dashboardManifestSchema.parse(manifest).schema_version).toBe(1);
    expect(() => dashboardManifestSchema.parse({ ...manifest, schema_version: 2 })).toThrow();
  });

  it('rejects malformed snapshots and identifies stale data', () => {
    const snapshot = dashboardSnapshotSchema.parse({
      schema_version: 1,
      snapshot_id: 'snapshot',
      generated_at: '2026-08-16T11:17:00Z',
      data_through: '2026-08-16T11:16:59Z',
      expires_at: '2026-08-16T13:17:00Z',
      checksum_sha256: checksum,
      sections: emptySections,
    });
    expect(getSnapshotFreshness(snapshot, new Date('2026-08-16T12:00:00Z'))).toBe('fresh');
    expect(getSnapshotFreshness(snapshot, new Date('2026-08-16T14:00:00Z'))).toBe('stale');
    expect(() => dashboardSnapshotSchema.parse({ ...snapshot, sections: '<html />' })).toThrow();
  });

  it('loads a versioned snapshot and uses its scoped cache on network failure', async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    vi.stubGlobal('crypto', {});
    const manifest = {
      schema_version: 1,
      snapshot_id: 'snapshot',
      generated_at: '2026-08-16T11:17:00Z',
      expires_at: '2026-08-16T13:17:00Z',
      snapshot_url: '/dashboard-data/versions/snapshot.json',
      checksum_sha256: checksum,
    };
    const snapshot = {
      schema_version: manifest.schema_version,
      snapshot_id: manifest.snapshot_id,
      generated_at: manifest.generated_at,
      expires_at: manifest.expires_at,
      checksum_sha256: manifest.checksum_sha256,
      data_through: '2026-08-16T11:16:59Z',
      sections: emptySections,
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(manifest), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify(snapshot), {
        status: 200, headers: { 'content-type': 'application/json' },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(loadDashboardSnapshot('https://dash.example/dashboard-data')).resolves.toMatchObject({ snapshot_id: 'snapshot' });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(loadDashboardSnapshot('https://dash.example/dashboard-data')).resolves.toMatchObject({ snapshot_id: 'snapshot' });
    await expect(loadDashboardSnapshot('https://other.example/dashboard-data')).rejects.toThrow('offline');

    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({
      ...manifest,
      schema_version: 2,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(loadDashboardSnapshot('https://dash.example/dashboard-data'))
      .rejects.toThrow();
  });

  it('rejects a manifest URL outside the configured snapshot path', async () => {
    vi.stubGlobal('crypto', {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      schema_version: 1,
      snapshot_id: 'snapshot',
      generated_at: '2026-08-16T11:17:00Z',
      expires_at: '2026-08-16T13:17:00Z',
      snapshot_url: 'https://other.example/versions/snapshot.json',
      checksum_sha256: checksum,
    }), { status: 200, headers: { 'content-type': 'application/json' } })));

    await expect(loadDashboardSnapshot('https://dash.example/dashboard-data'))
      .rejects.toThrow('outside the configured snapshot path');
  });

  it('rejects an HTML fallback instead of treating it as snapshot JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>SPA fallback</html>', {
      status: 200,
      headers: { 'content-type': 'text/html' },
    })));

    await expect(loadDashboardSnapshot('https://dash.example/dashboard-data'))
      .rejects.toThrow('text/html');
  });
});
