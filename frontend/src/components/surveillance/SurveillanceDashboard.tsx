import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardFilters, AnalyticsOverviewResponse, CoContaminationResponse, EnvironmentalCorrelationResponse } from '@/types/dashboard';
import DashboardFilterBar from './DashboardFilterBar';
import KPICards from './KPICards';
import RegionalRiskRanking from './RegionalRiskRanking';
import PublicHealthSummary from './PublicHealthSummary';
import MycotoxinAnalysis from './MycotoxinAnalysis';
import CoContaminationAnalysis from './CoContaminationAnalysis';
import DynamicThresholdControl from './DynamicThresholdControl';
import EnvironmentalKinetics from './EnvironmentalKinetics';
import type { MapViewMode } from './RegionalRiskMap';
import {
  Loader2,
  AlertTriangle,
  Database,
  Zap,
  MapPin,
  Wheat,
  Bell
} from 'lucide-react';
import { sampleAPI, analyticsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALL_TIME_QUARTER,
  CUSTOM_RANGE_QUARTER,
  buildFilterOptions,
  buildSurveillanceAnalytics,
  getQuarterDateRange,
} from '@/lib/sampleAnalytics';
import { generatePublicHealthRiskDrivers } from '@/lib/llmSummary';

import { useDeferredMount } from '@/hooks/useDeferredMount';
import { hasAboveThresholdResults } from '@/lib/mycotoxinRisk';

// Lazy-load the map (it pulls in Leaflet + GeoJSON which is heavy)
const RegionalRiskMap = lazy(() => import('./RegionalRiskMap'));

function ChartSkeleton() {
  return (
    <div className="w-full h-[300px] bg-card/50 rounded-xl border border-border/50 animate-pulse flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground/50 font-medium">Preparing Analytics...</span>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="rounded-xl bg-card border border-border h-full min-h-[480px] flex items-center justify-center">
      <div className="space-y-3 w-3/4">
        <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
        <div className="h-72 bg-muted rounded-lg animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 bg-muted rounded animate-pulse w-16" />
          ))}
        </div>
      </div>
    </div>
  );
}

const DEFAULT_FILTERS: DashboardFilters = {
  dateRange: { from: '', to: '' },
  commodities: [],
  regions: [],
  provinces: [],
  quarter: ALL_TIME_QUARTER,
};

export default function SurveillanceDashboard() {
  const { isAuthenticated } = useAuth();
  const isDeferredMounted = useDeferredMount(400);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const selectedProvince = filters.provinces[0] || null;
  const [mapSelectedProvince, setMapSelectedProvince] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('risk');

  // State for Threshold Simulator overrides
  const [thresholdOverrides, setThresholdOverrides] = useState<Record<string, Record<string, number>>>({});
  const isSimulating = Object.keys(thresholdOverrides).length > 0;

  // 1. Legacy full samples call for un-migrated components (Heatmap, PublicHealthSummary)
  const { data: samples = [], isLoading, error } = useQuery({
    queryKey: ['surveillance-dashboard-samples'],
    queryFn: () => sampleAPI.getAllSamples(),
    enabled: isAuthenticated,
  });

  // 2. Dashboard Analytics V2: Overview / Simulated Overview
  // We separate the "Specific" overview (filtered by province) from the "Regional" overview (ranking/map)
  const rankingFilters = useMemo(() => ({
    ...filters,
    provinces: [] // Don't filter the ranking list/map by specific province selection
  }), [filters.regions, filters.commodities, filters.dateRange, filters.quarter]);

  const { data: overviewData } = useQuery<AnalyticsOverviewResponse>({
    // Cache keys separate real from simulated data automatically
    queryKey: ['surveillance-overview', filters, isSimulating ? thresholdOverrides : 'baseline'],
    queryFn: async () => {
      // Map filters matching the backend expected snake_case layout where necessary
      const apiFilters = {
        region: filters.regions,
        province: filters.provinces,
        vegetation_variety: filters.commodities,
        date_from: filters.dateRange.from,
        date_to: filters.dateRange.to
      };

      if (isSimulating) {
        return analyticsAPI.simulateThreshold(thresholdOverrides, apiFilters);
      }
      return analyticsAPI.getOverview(apiFilters);
    },
    enabled: isAuthenticated,
  });

  const { data: regionalRankingData } = useQuery<AnalyticsOverviewResponse>({
    queryKey: ['surveillance-regional-ranking', rankingFilters, isSimulating ? thresholdOverrides : 'baseline'],
    queryFn: async () => {
      const apiFilters = {
        region: rankingFilters.regions,
        province: [],
        vegetation_variety: rankingFilters.commodities,
        date_from: rankingFilters.dateRange.from,
        date_to: rankingFilters.dateRange.to
      };

      if (isSimulating) {
        return analyticsAPI.simulateThreshold(thresholdOverrides, apiFilters);
      }
      return analyticsAPI.getOverview(apiFilters);
    },
    enabled: isAuthenticated,
  });

  // 3. Dashboard Analytics V2: Co-contamination (UpSet Plot)
  const { data: coContamData } = useQuery<CoContaminationResponse>({
    queryKey: ['surveillance-cocontamination', filters],
    queryFn: () => {
      const apiFilters = {
        region: filters.regions,
        province: filters.provinces,
        vegetation_variety: filters.commodities,
        date_from: filters.dateRange.from,
        date_to: filters.dateRange.to
      };
      return analyticsAPI.getCoContamination(apiFilters);
    },
    enabled: isAuthenticated,
  });

  const environmentalProvince = mapSelectedProvince || selectedProvince;

  const { data: environmentalData, isLoading: isEnvironmentalLoading, isError: isEnvironmentalError } = useQuery<EnvironmentalCorrelationResponse>({
    queryKey: ['surveillance-environmental-correlation', filters, environmentalProvince],
    queryFn: () => {
      const apiFilters = {
        region: filters.regions,
        province: environmentalProvince ? [environmentalProvince] : filters.provinces,
        vegetation_variety: filters.commodities,
        date_from: filters.dateRange.from,
        date_to: filters.dateRange.to
      };
      return analyticsAPI.getEnvironmentalCorrelation(apiFilters);
    },
    enabled: isAuthenticated && Boolean(filters.dateRange.from && filters.dateRange.to),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  const filterOptions = useMemo(() => buildFilterOptions(samples), [samples]);

  useEffect(() => {
    if (samples.length === 0) return;
    if (!filters.dateRange.from || !filters.dateRange.to) {
      setFilters((current) => ({
        ...current,
        dateRange: filterOptions.dateRange,
        quarter: ALL_TIME_QUARTER,
      }));
    }
  }, [samples, filters.dateRange.from, filters.dateRange.to, filterOptions.dateRange]);

  useEffect(() => {
    if (filters.quarter === ALL_TIME_QUARTER) {
      setFilters((current) => {
        if (current.dateRange.from === filterOptions.dateRange.from && current.dateRange.to === filterOptions.dateRange.to) {
          return current;
        }

        return {
          ...current,
          dateRange: filterOptions.dateRange,
        };
      });
      return;
    }

    if (filters.quarter === CUSTOM_RANGE_QUARTER) {
      return;
    }

    const quarterRange = getQuarterDateRange(filters.quarter);
    if (!quarterRange) return;

    setFilters((current) => {
      if (current.dateRange.from === quarterRange.from && current.dateRange.to === quarterRange.to) {
        return current;
      }

      return {
        ...current,
        dateRange: quarterRange,
      };
    });
  }, [filters.quarter, filterOptions.dateRange]);

  const analytics = useMemo(() => {
    if (!isDeferredMounted || samples.length === 0) return null;
    return buildSurveillanceAnalytics(samples, filters, thresholdOverrides);
  }, [samples, filters, isDeferredMounted, thresholdOverrides]);

  const localPublicHealthSummary = useMemo(() => {
    if (!analytics) return null;
    return isSimulating && overviewData?.public_health_summary
      ? overviewData.public_health_summary
      : analytics.publicHealthSummary;
  }, [analytics, isSimulating, overviewData?.public_health_summary]);

  const { data: llmPublicHealthSummary, isFetching: isGeneratingPublicHealthSummary } = useQuery({
    queryKey: [
      'surveillance-public-health-llm-summary',
      filters,
      overviewData?.kpis,
      localPublicHealthSummary,
    ],
    queryFn: () => generatePublicHealthRiskDrivers({
      summary: localPublicHealthSummary!,
      filters,
      kpis: overviewData?.kpis,
    }),
    enabled: isAuthenticated && Boolean(localPublicHealthSummary),
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const rankingAnalytics = useMemo(() => {
    if (!isDeferredMounted || samples.length === 0) return null;
    return buildSurveillanceAnalytics(samples, rankingFilters, thresholdOverrides);
  }, [samples, rankingFilters, isDeferredMounted, thresholdOverrides]);

  const handleFilterChange = (nextFilters: DashboardFilters) => {
    const currentQuarterRange = getQuarterDateRange(nextFilters.quarter);
    const matchesQuarter = currentQuarterRange
      && currentQuarterRange.from === nextFilters.dateRange.from
      && currentQuarterRange.to === nextFilters.dateRange.to;
    setMapSelectedProvince(nextFilters.provinces[0] || null);

    setFilters({
      ...nextFilters,
      quarter: matchesQuarter || nextFilters.quarter === ALL_TIME_QUARTER ? nextFilters.quarter : CUSTOM_RANGE_QUARTER,
    });
  };

  const handleProvinceFilterSelect = (province: string) => {
    const nextProvince = filters.provinces.includes(province) ? null : province;
    setMapSelectedProvince(nextProvince);
    setFilters((prev) => ({
      ...prev,
      provinces: nextProvince ? [nextProvince] : [],
    }));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            Sign in to load live dashboard data from the sample list.
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-danger" />
            <h2 className="text-xl font-semibold text-foreground">Unable to load dashboard data</h2>
            <p className="mt-2 text-sm text-muted-foreground">The dashboard could not fetch samples from the system.</p>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading || (!filters.dateRange.from && samples.length > 0)) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </div>
    );
  }

  if (samples.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No samples are available yet. Add records in the sample list to populate this dashboard.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dashboard-wrapper font-['Plus_Jakarta_Sans']">

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-12 space-y-8">
        <DashboardFilterBar
          filters={filters}
          onChange={handleFilterChange}
          commodityOptions={filterOptions.commodities}
          regionOptions={filterOptions.regions}
          quarterOptions={filterOptions.quarters}
        />

        {/* Deferred Content Area */}
        {!isDeferredMounted || !analytics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 bg-card/50 rounded-xl border border-border/50 animate-pulse" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
              <MapSkeleton />
              <div className="h-[480px] bg-card/50 rounded-xl border border-border/50 animate-pulse" />
            </div>
            <ChartSkeleton />
          </div>
        ) : analytics.filteredSamples.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No sample data matched the selected filters.
          </div>
        ) : (
          <>
            {/* Section 1: Public Health Risk Summary (Strategic Insights) */}
            <div className="flex items-center gap-3 mb-4 mt-2">
              <div className="h-5 w-1.5 bg-rose-500/40 rounded-full" />
              <h2 className="text-sm font-black tracking-normal text-slate-500 dark:text-white/60">Public Health Risk Summary</h2>
            </div>
            <PublicHealthSummary 
              summary={llmPublicHealthSummary ?? localPublicHealthSummary ?? analytics.publicHealthSummary}
              isGenerating={isGeneratingPublicHealthSummary && !llmPublicHealthSummary}
              isLlmGenerated={Boolean(llmPublicHealthSummary)}
            />

            {/* Section 2: KPI Summary - Re-engineered for Province-Specific Context */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-12 bg-slate-50 dark:bg-card/30 p-5 rounded-2xl border border-border/50">
              <div className="flex items-center gap-3">
                {selectedProvince ? (
                  <div className="flex items-center gap-2 self-stretch">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg shadow-sm text-[10px] font-black tracking-normal animate-in zoom-in duration-300">
                      <MapPin className="w-3.5 h-3.5" />
                      {selectedProvince}
                    </div>
                    <div className="w-px h-6 bg-border mx-1" />
                  </div>
                ) : (
                  <div className="h-6 w-1.5 bg-primary/40 rounded-full" />
                )}
                
                <div className="space-y-0.5">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    KPI Summary
                    {selectedProvince && (
                      <span className="text-xs font-medium text-muted-foreground normal-case opacity-60">
                        (Selective View)
                      </span>
                    )}
                  </h2>
                  <p className="text-[10px] text-muted-foreground tracking-normal font-black opacity-60">
                    {selectedProvince 
                      ? `Drilling down into ${selectedProvince} local surveillance data`
                      : `Aggregated data across ${filters.regions.length > 0 ? filters.regions.join(', ') : 'all regions'}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-[10px] font-black tracking-normal text-muted-foreground/80">
                <div className="flex flex-col items-end">
                  <span className="opacity-50">Data Refresh</span>
                  <span className="text-slate-900 dark:text-white">Real-time</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col items-end">
                  <span className="opacity-50">Reporting Scope</span>
                  <span className="text-primary">{selectedProvince ? 'Province Level' : 'Regional/National'}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div className="flex-1">
                {overviewData ? (
                  <KPICards
                    cards={[
                      { label: 'Total Samples Reported', value: overviewData.kpis.total_samples, delta: 0, deltaDirection: 'up', isImprovement: true, context: 'Total selected', icon: Database },
                      { label: 'Positive Samples', value: `${overviewData.kpis.positive_pct}%`, delta: 0, deltaDirection: 'down', isImprovement: false, context: 'vs previous', icon: Zap },
                      { label: isSimulating ? 'Simulated High Risk' : 'Above Safety Threshold (EU)', value: `${overviewData.kpis.above_threshold_pct}%`, delta: 0, deltaDirection: 'down', isImprovement: false, context: 'Critical limit', icon: AlertTriangle },
                      { label: 'High Risk Regions', value: overviewData.kpis.high_risk_regions, delta: 0, deltaDirection: 'up', isImprovement: false, context: 'Province count', icon: MapPin },
                      { label: 'Highest Risk Commodity', value: overviewData.kpis.highest_risk_commodity, delta: 0, deltaDirection: null, isImprovement: null, context: 'Ranked by share', icon: Wheat },
                      { label: 'Active Alerts', value: overviewData.kpis.active_alerts, delta: 0, deltaDirection: 'down', isImprovement: true, context: 'Flagged samples', accent: 'red', icon: Bell },
                    ]}
                  />
                ) : (
                  <KPICards cards={analytics.kpiData.cards.map((card, i) => {
                    const icons = [Database, Zap, AlertTriangle, MapPin, Wheat, Bell];
                    return { ...card, icon: icons[i] || Database };
                  })} />
                )}
              </div>
            </div>

            {/* Section 3: Regional Risk Atlas (Operational Context) */}
            <div className="flex items-center gap-3 mb-4 mt-8">
              <div className="h-5 w-1.5 bg-primary/40 rounded-full" />
              <h2 className="text-sm font-black tracking-normal text-slate-500 dark:text-white/60">Regional Risk Atlas</h2>
            </div>
            <section aria-label="Regional Risk Analysis" className="mb-4">
              <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
                <Suspense fallback={<MapSkeleton />}>
                  <RegionalRiskMap
                    selectedProvince={mapSelectedProvince || selectedProvince}
                    onSelectProvince={(p) => {
                      if (mapViewMode === 'risk' || mapViewMode === 'samples') {
                        handleProvinceFilterSelect(p);
                        return;
                      }

                      setMapSelectedProvince(prev => prev === p ? null : p);
                    }}
                    provinceRiskData={regionalRankingData ? regionalRankingData.provinces : (rankingAnalytics?.provinceRiskData || [])}
                    viewMode={mapViewMode}
                    onViewModeChange={setMapViewMode}
                    environmentalData={environmentalData}
                    isEnvironmentalLoading={isEnvironmentalLoading}
                  />
                </Suspense>
                <div className="flex flex-col gap-4">
                  <DynamicThresholdControl
                    onOverridesChange={setThresholdOverrides}
                    commodityOptions={filterOptions.commodities}
                  />
                  <RegionalRiskRanking
                    selectedProvince={selectedProvince}
                    onSelectProvince={handleProvinceFilterSelect}
                    provinces={regionalRankingData ? regionalRankingData.provinces : (rankingAnalytics?.provinceRiskData || [])}
                    viewMode={mapViewMode === 'samples' ? 'samples' : 'risk'}
                  />
                </div>
              </div>
            </section>

            {/* Section 4: Mycotoxin & Commodity Analysis */}
            <div className="flex items-center gap-3 mb-4 mt-12">
              <div className="h-5 w-1.5 bg-primary/40 rounded-full" />
              <h2 className="text-sm font-black tracking-normal text-slate-500 dark:text-white/60">Analytics & Trends</h2>
            </div>
            <MycotoxinAnalysis
              mycotoxinBarData={analytics.mycotoxinBarData}
              commodityShare={analytics.commodityShare}
              thresholdByCommodity={analytics.thresholdByCommodity}
              heatmapData={analytics.heatmapData}
              heatmapRegions={analytics.heatmapRegions}
              heatmapCommodities={analytics.heatmapCommodities}
              affectedSampleCount={
                isSimulating 
                  ? overviewData?.kpis?.total_samples || 0
                  : analytics.filteredSamples.filter((sample) => hasAboveThresholdResults(sample)).length
              }
            />

            <div className="mt-6 grid grid-cols-1 gap-6">
              {coContamData ? (
                <CoContaminationAnalysis
                  coContamSummary={analytics.coContamSummary}
                  coOccurrenceList={coContamData.intersections}
                  intersections={coContamData.intersections}
                  toxinsPerSample={Object.entries(coContamData.toxins_per_sample).map(([count, pct]) => ({ count, pct: Number(pct) }))}
                  toxinColors={analytics.toxinColors}
                />
              ) : (
                <ChartSkeleton />
              )}
            </div>

            {/* Section 5: Environmental Analysis */}
            <div className="flex items-center gap-3 mb-4 mt-12">
              <div className="h-5 w-1.5 bg-primary/40 rounded-full" />
              <h2 className="text-sm font-black tracking-normal text-slate-500 dark:text-white/60">Environmental Analysis</h2>
            </div>
            <EnvironmentalKinetics
              data={environmentalData}
              isLoading={isEnvironmentalLoading}
              isError={isEnvironmentalError}
            />
          </>
        )}

        {/* Footer */}
        <footer className="border-t border-border pt-4 pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            AgriscanPro Mycotoxin Risk Surveillance Dashboard · {analytics?.filteredSamples.length.toLocaleString() ?? 0} samples in view · {filters.quarter === CUSTOM_RANGE_QUARTER ? `${filters.dateRange.from} to ${filters.dateRange.to}` : filters.quarter}
          </p>
        </footer>
      </main>
    </div>
  );
}
