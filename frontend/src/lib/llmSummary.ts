import type { DashboardFilters, HealthSummary } from '@/types/dashboard';
import { analyticsAPI } from '@/lib/api';
import { isBrowserLlmFallbackEnabled } from '@/lib/llmFallbackGate';

const DEFAULT_LLM_SUMMARY_ENDPOINT = 'https://text.pollinations.ai/openai';
const DEFAULT_LLM_TEXT_ENDPOINT = 'https://text.pollinations.ai';
const DEFAULT_LLM_SUMMARY_MODEL = 'openai';

export interface PublicHealthSummaryContext {
  summary: HealthSummary;
  filters: DashboardFilters;
  kpis?: {
    total_samples: number;
    positive_pct: number;
    detected_pct: number;
    above_threshold_pct: number;
    high_risk_regions: number;
    highest_risk_commodity: string;
    active_alerts: number;
  };
}

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
    text?: string;
  }>;
}

function compactFilters(filters: DashboardFilters) {
  return {
    dateRange: filters.dateRange,
    commodities: filters.commodities.length > 0 ? filters.commodities : ['All commodities'],
    regions: filters.regions.length > 0 ? filters.regions : ['All regions'],
    provinces: filters.provinces.length > 0 ? filters.provinces : ['All provinces'],
  };
}

function parseRiskDrivers(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const source = jsonMatch?.[0] ?? content;

  try {
    const parsed = JSON.parse(source) as { riskDrivers?: unknown };
    if (Array.isArray(parsed.riskDrivers)) {
      return parsed.riskDrivers
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 4);
    }
  } catch {
    // Fall through to line parsing for providers that add prose around JSON.
  }

  return content
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildPrompt(context: PublicHealthSummaryContext) {
  return [
    'You write concise public health surveillance summaries for mycotoxin risk dashboards.',
    'Return only valid JSON with a riskDrivers array of exactly 4 short strings.',
    'Do not invent precise statistics beyond the provided aggregate data.',
    `Aggregate dashboard data: ${JSON.stringify(buildSummaryPayload(context))}`,
  ].join('\n');
}

function buildSummaryPayload(context: PublicHealthSummaryContext) {
  return {
    filters: compactFilters(context.filters),
    kpis: context.kpis,
    affectedCommodities: context.summary.affectedCommodities,
    impactedPopulations: context.summary.impactedPopulations,
    baselineRiskDrivers: context.summary.riskDrivers,
  };
}

async function requestOpenAICompatibleSummary(endpoint: string, model: string, prompt: string) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You write concise public health surveillance summaries for mycotoxin risk dashboards. Return only valid JSON with a riskDrivers array of exactly 4 short strings. Do not invent precise statistics beyond the provided data.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 320,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM summary request failed with ${response.status}`);
  }

  const data = (await response.json()) as OpenAICompatibleResponse;
  const content = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? '';
  return parseRiskDrivers(content);
}

async function requestPlainTextSummary(model: string, prompt: string) {
  const url = new URL(`${DEFAULT_LLM_TEXT_ENDPOINT}/${encodeURIComponent(prompt)}`);
  url.searchParams.set('model', model);
  url.searchParams.set('json', 'true');

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`LLM text summary request failed with ${response.status}`);
  }

  return parseRiskDrivers(await response.text());
}

export async function generatePublicHealthRiskDrivers(context: PublicHealthSummaryContext) {
  const endpoint = import.meta.env.VITE_LLM_SUMMARY_ENDPOINT || DEFAULT_LLM_SUMMARY_ENDPOINT;
  const model = import.meta.env.VITE_LLM_SUMMARY_MODEL || DEFAULT_LLM_SUMMARY_MODEL;
  const browserFallbackEnabled = isBrowserLlmFallbackEnabled({
    DEV: Boolean(import.meta.env.DEV),
    VITE_ENABLE_BROWSER_LLM_FALLBACK: import.meta.env.VITE_ENABLE_BROWSER_LLM_FALLBACK,
  });
  const prompt = buildPrompt(context);

  let riskDrivers: string[] = [];

  try {
    const backendSummary = await analyticsAPI.generatePublicHealthSummary(buildSummaryPayload(context));
    riskDrivers = backendSummary.riskDrivers;
  } catch (error) {
    console.warn('public_health_summary.backend_failed', error);

    if (!browserFallbackEnabled) {
      throw error;
    }

    try {
      riskDrivers = await requestOpenAICompatibleSummary(endpoint, model, prompt);
    } catch (browserFallbackError) {
      console.warn('public_health_summary.llm_openai_compatible_failed', browserFallbackError);
      riskDrivers = await requestPlainTextSummary(model, prompt);
    }
  }

  if (riskDrivers.length === 0) {
    throw new Error('LLM summary response did not include risk drivers');
  }

  return {
    ...context.summary,
    riskDrivers,
  };
}
