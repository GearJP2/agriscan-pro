import { z } from 'zod';
import type { DashboardSnapshot } from '@/types/dashboard';

const dateTime = z.string().datetime({ offset: true });
const riskLevel = z.enum(['low', 'medium', 'high', 'critical']);
const province = z.object({
  name: z.string(),
  region: z.string(),
  sampleCount: z.number().nonnegative(),
  positiveCount: z.number().nonnegative(),
  positivePct: z.number(),
  aboveThresholdPct: z.number(),
  riskLevel,
  dominantToxin: z.string().optional().default('Unknown'),
  dominantCommodity: z.string().optional().default('Unknown'),
  nameEn: z.string().optional(),
});

const overview = z.object({
  kpis: z.object({
    total_samples: z.number().nonnegative(),
    positive_pct: z.number(),
    detected_pct: z.number(),
    above_threshold_pct: z.number(),
    high_risk_regions: z.number().nonnegative(),
    highest_risk_commodity: z.string(),
    active_alerts: z.number().nonnegative(),
  }),
  provinces: z.array(province),
});

export const dashboardSectionsSchema = z.object({
  filter_options: z.object({
    commodities: z.array(z.string()),
    regions: z.array(z.string()),
    provinces: z.array(z.string()),
    date_range: z.object({ from: z.string(), to: z.string() }),
  }),
  overview,
  regional: z.object({
    provinces: z.array(province),
    regions: z.array(z.object({
      name: z.string(), sampleCount: z.number(), aboveCount: z.number(), aboveThresholdPct: z.number(),
    })),
    suppressed: z.number().nonnegative(),
  }),
  commodities: z.object({
    distribution: z.array(z.object({
      name: z.string(), sampleCount: z.number(), aboveCount: z.number(), pctAbove: z.number(),
    })),
    suppressed: z.number().nonnegative(),
  }),
  toxins: z.object({
    distribution: z.array(z.object({
      name: z.string(), shortName: z.string(), sampleCount: z.number(), aboveCount: z.number(), score: z.number(),
    })),
  }),
  heatmap: z.object({
    data: z.array(z.object({ region: z.string(), commodity: z.string(), intensity: z.number(), sampleCount: z.number() })),
    regions: z.array(z.string()),
    commodities: z.array(z.string()),
  }),
  co_contamination: z.object({
    summary: z.object({
      avgToxinsPerSample: z.number(), pctTwoPlus: z.number(), pctThreePlus: z.number(), mostCommonPair: z.string(),
    }),
    toxins_per_sample: z.record(z.number()),
    intersections: z.array(z.object({ toxins: z.array(z.string()), sampleCount: z.number(), pct: z.number() })),
    network: z.object({
      nodes: z.array(z.object({ id: z.string(), frequency: z.number() })),
      links: z.array(z.object({ source: z.string(), target: z.string(), value: z.number() })),
    }),
  }),
  public_health: z.object({
    riskDrivers: z.array(z.string()),
    affectedCommodities: z.array(z.object({ name: z.string(), pct: z.number() })),
    impactedPopulations: z.array(z.object({ group: z.string(), severity: z.enum(['High', 'Medium']) })),
  }),
  environmental: z.object({ status: z.enum(['fresh', 'stale', 'unavailable']), data: z.record(z.unknown()) }),
}).strict();

export const dashboardManifestSchema = z.object({
  schema_version: z.literal(1),
  snapshot_id: z.string().min(1),
  generated_at: dateTime,
  expires_at: dateTime,
  snapshot_url: z.string().min(1),
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const dashboardSnapshotSchema = z.object({
  schema_version: z.literal(1),
  snapshot_id: z.string().min(1),
  generated_at: dateTime,
  data_through: dateTime,
  expires_at: dateTime,
  checksum_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  sections: dashboardSectionsSchema,
}).strict();

const CACHE_KEY = 'agriscan-dashboard-snapshot-v1';

class DashboardSnapshotUnavailableError extends Error {}

async function fetchJson(url: string | URL) {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    throw new DashboardSnapshotUnavailableError(
      `Dashboard snapshot network request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok) {
    if (response.status >= 500 || response.status === 429) {
      throw new DashboardSnapshotUnavailableError(`Dashboard snapshot service failed (${response.status}).`);
    }
    throw new Error(`Dashboard snapshot request failed (${response.status}).`);
  }
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`Dashboard snapshot request failed (${response.status}, ${contentType || 'unknown content type'}).`);
  }
  return response.json() as Promise<unknown>;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableStringify(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown) {
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(stableStringify(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((part) => part.toString(16).padStart(2, '0')).join('');
}

function cacheKey(baseUrl: URL) {
  return `${CACHE_KEY}:${baseUrl.href}`;
}

function readCachedSnapshot(key: string) {
  try {
    const cached = globalThis.localStorage?.getItem(key);
    return cached ? dashboardSnapshotSchema.parse(JSON.parse(cached)) as DashboardSnapshot : null;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(key: string, snapshot: DashboardSnapshot) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Browser storage is optional; the React Query cache still retains the response.
  }
}

export function getSnapshotFreshness(snapshot: DashboardSnapshot, now = new Date()) {
  const generatedAt = new Date(snapshot.generated_at);
  const expiresAt = new Date(snapshot.expires_at);
  if (Number.isNaN(generatedAt.getTime()) || Number.isNaN(expiresAt.getTime())) return 'invalid' as const;
  return now <= expiresAt ? 'fresh' as const : 'stale' as const;
}

export async function loadDashboardSnapshot(baseUrl: string): Promise<DashboardSnapshot> {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const base = new URL(`${normalizedBase}/`, `${globalThis.location?.origin ?? 'http://localhost'}/`);
  const key = cacheKey(base);
  try {
    const manifest = dashboardManifestSchema.parse(await fetchJson(`${normalizedBase}/manifest.json`));
    const snapshotUrl = new URL(manifest.snapshot_url, base);
    if (snapshotUrl.origin !== base.origin || !snapshotUrl.pathname.startsWith(`${base.pathname}versions/`)) {
      throw new Error('Dashboard snapshot URL is outside the configured snapshot path.');
    }
    const snapshot = dashboardSnapshotSchema.parse(await fetchJson(snapshotUrl)) as DashboardSnapshot;
    if (snapshot.snapshot_id !== manifest.snapshot_id || snapshot.checksum_sha256 !== manifest.checksum_sha256) {
      throw new Error('Dashboard manifest and snapshot do not match.');
    }
    const digest = await sha256(snapshot.sections);
    if (digest && digest !== snapshot.checksum_sha256) throw new Error('Dashboard snapshot checksum failed.');
    writeCachedSnapshot(key, snapshot);
    return snapshot;
  } catch (error) {
    if (error instanceof DashboardSnapshotUnavailableError) {
      const cached = readCachedSnapshot(key);
      if (cached) return cached;
    }
    throw error;
  }
}
