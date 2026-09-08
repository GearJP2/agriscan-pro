import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardFilters, DashboardContractResponse, EnvironmentalCorrelationResponse } from '@/types/dashboard';
import DashboardFilterBar from './DashboardFilterBar';
import KPICards from './KPICards';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
  Bell,
  ChevronDown
} from 'lucide-react';
import { analyticsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALL_TIME_QUARTER,
  CUSTOM_RANGE_QUARTER,
  buildSurveillanceAnalyticsFromSections,
  getQuarterDateRange,
} from '@/lib/sampleAnalytics';
import { getSnapshotFreshness, loadDashboardSnapshot } from '@/lib/dashboardSnapshot';

import { useDeferredMount } from '@/hooks/useDeferredMount';

// Lazy-load the map (it pulls in Leaflet + GeoJSON which is heavy)
const RegionalRiskMap = lazy(() => import('./RegionalRiskMap'));

function ChartSkeleton() {
  return (
    <div className="w-full h-[300px] bg-white/70 dark:bg-slate-900/50 rounded-gfs-card border border-gfs-maroon/15 animate-pulse flex items-center justify-center shadow-gfs-card">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-gfs-maroon/60 dark:text-gfs-gold" />
        <span className="text-xs text-gfs-text-muted font-semibold">Preparing Analytics...</span>
      </div>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="rounded-gfs-card bg-white/70 dark:bg-slate-900/50 border border-gfs-maroon/15 shadow-gfs-card h-full min-h-[480px] flex items-center justify-center">
      <div className="space-y-3 w-3/4">
        <div className="h-4 bg-gfs-thumb/50 dark:bg-slate-800 rounded animate-pulse w-1/3" />
        <div className="h-72 bg-gfs-thumb/50 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-3 bg-gfs-thumb/50 dark:bg-slate-800 rounded animate-pulse w-16" />
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

function isEnvironmentalCorrelationResponse(
  value: Record<string, unknown>,
): boolean {
  return typeof value.source === 'string'
    && typeof value.location === 'object'
    && value.location !== null
    && typeof value.summary === 'object'
    && value.summary !== null
    && Array.isArray(value.points);
}

export default function SurveillanceDashboard() {
  const { isAuthenticated, role } = useAuth();
  const canSimulateThresholds = isAuthenticated
    && ['researcher', 'head_researcher', 'admin'].includes(role);
  const isDeferredMounted = useDeferredMount(400);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const selectedProvince = filters.provinces[0] || null;
  const [mapSelectedProvince, setMapSelectedProvince] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>('risk');
  const [manualApiFallback, setManualApiFallback] = useState(false);
  const [isAnalyticsExpanded, setIsAnalyticsExpanded] = useState(true);

  // State for Threshold Simulator overrides
  const [thresholdOverrides, setThresholdOverrides] = useState<Record<string, Record<string, number>>>({});
  const isSimulating = Object.keys(thresholdOverrides).length > 0;

  const staticEnabled = import.meta.env.VITE_STATIC_DASHBOARD_ENABLED === 'true';
  const snapshotBaseUrl = import.meta.env.VITE_DASHBOARD_SNAPSHOT_URL || '/dashboard-data';
  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ['dashboard-snapshot-v1', snapshotBaseUrl],
    queryFn: () => loadDashboardSnapshot(snapshotBaseUrl),
    enabled: staticEnabled,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const apiFilters = useMemo(() => ({
    region: filters.regions,
    province: filters.provinces,
    vegetation_variety: filters.commodities,
    date_from: filters.dateRange.from,
    date_to: filters.dateRange.to,
  }), [filters]);
  const hasAdvancedFilters = filters.regions.length > 0
    || filters.provinces.length > 0
    || filters.commodities.length > 0
    || filters.quarter !== ALL_TIME_QUARTER;
  const { data: dynamicData, isError: isDynamicError } = useQuery<DashboardContractResponse>({
    queryKey: ['dashboard-aggregate', apiFilters, isSimulating ? thresholdOverrides : 'baseline'],
    queryFn: () => isSimulating
      ? analyticsAPI.simulateDashboard(thresholdOverrides, apiFilters)
      : analyticsAPI.getDashboard(apiFilters),
    enabled: isAuthenticated && (hasAdvancedFilters || isSimulating),
    retry: 1,
    refetchOnWindowFocus: false,
  });
  const {
    data: fallbackData,
    isLoading: isFallbackLoading,
    isError: isFallbackError,
    refetch: refetchFallback,
  } = useQuery<DashboardContractResponse>({
    queryKey: ['dashboard-aggregate-fallback'],
    queryFn: () => analyticsAPI.getDashboard(),
    enabled: isAuthenticated && (!staticEnabled || manualApiFallback),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const environmentalProvince = mapSelectedProvince || selectedProvince;

  const { data: environmentalData, isLoading: isEnvironmentalLoading, isError: isEnvironmentalError } = useQuery<EnvironmentalCorrelationResponse>({
    queryKey: ['surveillance-environmental-correlation', filters.regions, filters.provinces, filters.commodities, filters.dateRange, environmentalProvince],
    queryFn: () => {
      const apiFilters: Record<string, string | string[]> = {};
      if (filters.regions.length > 0) apiFilters.region = filters.regions;
      if (environmentalProvince) {
        apiFilters.province = environmentalProvince;
      } else if (filters.provinces.length > 0) {
        apiFilters.province = filters.provinces;
      }
      if (filters.commodities.length > 0) apiFilters.vegetation_variety = filters.commodities;
      if (filters.dateRange.from) apiFilters.date_from = filters.dateRange.from;
      if (filters.dateRange.to) apiFilters.date_to = filters.dateRange.to;

      return analyticsAPI.getEnvironmentalCorrelation(apiFilters);
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const baselineSections = snapshot?.sections ?? fallbackData?.sections;
  const activeSections = dynamicData?.sections ?? baselineSections;
  const filterOptions = useMemo(() => ({
    commodities: baselineSections?.filter_options.commodities ?? [],
    regions: baselineSections?.filter_options.regions ?? [],
    quarters: [ALL_TIME_QUARTER, CUSTOM_RANGE_QUARTER],
    dateRange: baselineSections?.filter_options.date_range ?? { from: '', to: '' },
  }), [baselineSections]);

  useEffect(() => {
    if (!filters.dateRange.from || !filters.dateRange.to) {
      setFilters((current) => ({
        ...current,
        dateRange: filterOptions.dateRange,
        quarter: ALL_TIME_QUARTER,
      }));
    }
  }, [filters.dateRange.from, filters.dateRange.to, filterOptions.dateRange]);

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

  const analytics = useMemo(() => activeSections
    ? buildSurveillanceAnalyticsFromSections(activeSections)
    : null, [activeSections]);
  const overviewData = activeSections?.overview;
  const regionalRankingData = activeSections?.regional;
  const coContamData = activeSections?.co_contamination;
  const snapshotEnvironmental = snapshot?.sections.environmental ?? fallbackData?.sections.environmental;
  const snapshotEnvironmentalData = snapshotEnvironmental
    && snapshotEnvironmental.status !== 'unavailable'
    && isEnvironmentalCorrelationResponse(snapshotEnvironmental.data)
    ? snapshotEnvironmental.data as unknown as EnvironmentalCorrelationResponse
    : undefined;
  const displayedEnvironmentalData = environmentalData ?? snapshotEnvironmentalData;

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

  if ((error && staticEnabled && !fallbackData) || (!isLoading && !isFallbackLoading && !activeSections)) {
    return (
      <div className="min-h-screen bg-gfs-canvas text-gfs-text-primary coe-gfs">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="rounded-gfs-card border border-gfs-maroon/20 bg-white dark:bg-slate-900/90 p-12 text-center shadow-gfs-card">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-gfs-maroon dark:text-gfs-gold" />
            <h2 className="text-xl font-bold text-gfs-maroon dark:text-white">Unable to load dashboard data</h2>
            <p className="mt-2 text-sm text-gfs-text-muted">
              Public dashboard data is temporarily unavailable.
              {isAuthenticated ? ' You can load the authenticated aggregate view manually.' : ''}
            </p>
            {isAuthenticated && (
              <button
                type="button"
                className="mt-6 btn-pill btn-pill-primary disabled:opacity-60"
                onClick={() => {
                  if (manualApiFallback) void refetchFallback();
                  else setManualApiFallback(true);
                }}
                disabled={isFallbackLoading}
              >
                {isFallbackLoading ? 'Loading aggregate data…' : isFallbackError ? 'Retry API' : 'Load from API'}
              </button>
            )}
            {isAuthenticated && isFallbackError && (
              <p className="mt-3 text-sm text-gfs-maroon-dark font-medium">The aggregate API is also unavailable. Please try again later.</p>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (isLoading || isFallbackLoading || (!filters.dateRange.from && Boolean(filterOptions.dateRange.from))) {
    return (
      <div className="min-h-screen bg-gfs-canvas coe-gfs">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex min-h-[50vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gfs-maroon dark:text-gfs-gold" />
          </div>
        </main>
      </div>
    );
  }

  if (!activeSections || activeSections.overview.kpis.total_samples === 0) {
    return (
      <div className="min-h-screen bg-gfs-canvas coe-gfs">
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="rounded-gfs-card border border-dashed border-gfs-maroon/20 bg-white dark:bg-slate-900/80 p-12 text-center text-gfs-text-muted shadow-gfs-card">
            No aggregate dashboard data is available yet.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gfs-canvas text-gfs-text-primary coe-gfs transition-colors duration-300 font-sans">

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-12 space-y-8">
        {isAuthenticated ? (
          <DashboardFilterBar
            filters={filters}
            onChange={handleFilterChange}
            commodityOptions={filterOptions.commodities}
            regionOptions={filterOptions.regions}
            quarterOptions={filterOptions.quarters}
          />
        ) : (
          <div className="rounded-gfs-card border border-gfs-maroon/15 bg-white dark:bg-slate-900/80 p-4 text-sm text-gfs-text-muted shadow-gfs-card">
            Sign in to use advanced filters, threshold simulation, and province environmental data.
          </div>
        )}

        {isDynamicError && (
          <div role="alert" className="rounded-gfs-card border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 p-4 text-sm font-medium shadow-sm">
            The selected dashboard view could not be refreshed. The last available baseline remains visible.
          </div>
        )}

        {/* Deferred Content Area */}
        {!isDeferredMounted || !analytics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-32 bg-white/60 dark:bg-slate-900/50 rounded-gfs-card border border-gfs-maroon/15 animate-pulse shadow-gfs-card" />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
              <MapSkeleton />
              <div className="h-[480px] bg-white/60 dark:bg-slate-900/50 rounded-gfs-card border border-gfs-maroon/15 animate-pulse shadow-gfs-card" />
            </div>
            <ChartSkeleton />
          </div>
        ) : activeSections.overview.kpis.total_samples === 0 ? (
          <div className="rounded-gfs-card border border-dashed border-gfs-maroon/20 bg-white dark:bg-slate-900/80 p-12 text-center text-gfs-text-muted shadow-gfs-card">
            No sample data matched the selected filters.
          </div>
        ) : (
          <>
            {/* Section 1: Public Health Risk Summary (Strategic Insights) */}
            <PublicHealthSummary 
              summary={analytics.publicHealthSummary}
              isGenerating={false}
              isLlmGenerated={false}
            />

            {/* Section 2: KPI Summary - Unified in 1 Card */}
            <Card className="bg-white dark:bg-slate-900/80 border border-gfs-maroon/15 dark:border-white/10 rounded-gfs-card shadow-gfs-card font-sans mb-12 mt-12 overflow-hidden">
              <CardHeader className="p-5 md:p-6 pb-5 border-b border-gfs-maroon/10 dark:border-white/10 bg-white dark:bg-slate-900">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {selectedProvince ? (
                      <div className="flex items-center gap-2 self-stretch">
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gfs-maroon text-white dark:bg-gfs-gold dark:text-gfs-maroon rounded-full shadow-sm text-xs font-bold tracking-normal animate-in zoom-in duration-300">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedProvince}
                        </div>
                        <div className="w-px h-6 bg-gfs-maroon/15 dark:bg-white/10 mx-1" />
                      </div>
                    ) : (
                      <div className="h-6 w-1.5 bg-gfs-gold rounded-full" />
                    )}

                    <div className="space-y-0.5">
                      <h2 className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white flex items-center gap-2">
                        KPI Summary
                        {selectedProvince && (
                          <span className="text-xs font-semibold text-gfs-text-muted normal-case">
                            (Selective View)
                          </span>
                        )}
                      </h2>
                      <p className="text-xs text-gfs-text-muted font-medium">
                        {selectedProvince
                          ? `Drilling down into ${selectedProvince} local surveillance data`
                          : `Aggregated data across ${filters.regions.length > 0 ? filters.regions.join(', ') : 'all regions'}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs font-bold text-gfs-text-muted">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider text-gfs-text-muted/70">Data Refresh</span>
                      <span className="text-gfs-text-primary dark:text-white font-bold">Real-time</span>
                    </div>
                    <div className="h-8 w-px bg-gfs-maroon/15 dark:bg-white/10" />
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase tracking-wider text-gfs-text-muted/70">Reporting Scope</span>
                      <span className="text-gfs-maroon dark:text-gfs-gold font-bold">{selectedProvince ? 'Province Level' : 'Regional/National'}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
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
              </CardContent>
            </Card>

            {/* Section 3: Environmental Analysis */}
            <div className="mt-12">
              <EnvironmentalKinetics
                data={displayedEnvironmentalData}
                isLoading={isEnvironmentalLoading && !snapshotEnvironmentalData}
                isError={isEnvironmentalError && !snapshotEnvironmentalData}
              />
            </div>

            {/* Section 4: Regional Risk Atlas (Operational Context) */}
            <section aria-label="Regional Risk Analysis" className="mb-4 mt-12">
              <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
                <Suspense fallback={<MapSkeleton />}>
                  <RegionalRiskMap
                    selectedProvince={mapSelectedProvince || selectedProvince}
                    onSelectProvince={(p) => {
                      if (!isAuthenticated) return;
                      if (mapViewMode === 'risk' || mapViewMode === 'samples') {
                        handleProvinceFilterSelect(p);
                        return;
                      }

                      setMapSelectedProvince(prev => prev === p ? null : p);
                    }}
                    provinceRiskData={regionalRankingData?.provinces ?? analytics.provinceRiskData}
                    viewMode={mapViewMode}
                    onViewModeChange={setMapViewMode}
                    environmentalData={displayedEnvironmentalData}
                    isEnvironmentalLoading={isEnvironmentalLoading && !snapshotEnvironmentalData}
                  />
                </Suspense>
                <div className="flex flex-col gap-4">
                    {canSimulateThresholds && (
                      <DynamicThresholdControl
                      onOverridesChange={setThresholdOverrides}
                      commodityOptions={filterOptions.commodities}
                    />
                    )}
                  <RegionalRiskRanking
                    selectedProvince={selectedProvince}
                    onSelectProvince={handleProvinceFilterSelect}
                    provinces={regionalRankingData?.provinces ?? analytics.provinceRiskData}
                    viewMode={mapViewMode === 'samples' ? 'samples' : 'risk'}
                  />
                </div>
              </div>
            </section>

            {/* Section 5: Analytics & Trends (Unified Master Card) */}
            <Card className="border border-gfs-maroon/15 dark:border-white/10 bg-white dark:bg-slate-900/80 transition-all duration-500 rounded-gfs-card shadow-gfs-card mt-12 overflow-hidden font-sans">
              <CardHeader className="pb-4 px-6 pt-5 bg-white dark:bg-slate-900 border-b border-gfs-maroon/10 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 font-sans">
                    <div className="h-6 w-1.5 bg-gfs-gold rounded-full shrink-0" />
                    <div>
                      <CardTitle className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white">
                        Analytics &amp; Trends
                      </CardTitle>
                      <p className="text-xs font-medium text-gfs-text-muted">
                        Mycotoxin prevalence, commodity risk exposure &amp; co-contamination patterns
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAnalyticsExpanded((expanded) => !expanded)}
                    aria-expanded={isAnalyticsExpanded}
                    aria-controls="dashboard-analytics-content"
                    className="p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon hover:text-white transition-all active:scale-95 border border-gfs-maroon/20"
                    title={isAnalyticsExpanded ? "Collapse Section" : "Expand Section"}
                  >
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-500", !isAnalyticsExpanded && "rotate-180")} />
                  </button>
                </div>
              </CardHeader>

              {isAnalyticsExpanded && (
                <CardContent id="dashboard-analytics-content" className="px-6 pb-8 pt-6 space-y-10 animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
                  {/* Part 1: Mycotoxin & Commodity Analysis */}
                  <MycotoxinAnalysis
                    mycotoxinBarData={analytics.mycotoxinBarData}
                    thresholdByCommodity={analytics.thresholdByCommodity}
                    heatmapData={analytics.heatmapData}
                    heatmapRegions={analytics.heatmapRegions}
                    heatmapCommodities={analytics.heatmapCommodities}
                    embedded
                  />

                  {/* Part 2: Co-contamination Analysis */}
                  <div className="border-t border-gfs-maroon/10 pt-8">
                    {coContamData ? (
                      <CoContaminationAnalysis
                        coContamSummary={analytics.coContamSummary}
                        coOccurrenceList={coContamData.intersections}
                        toxinsPerSample={Object.entries(coContamData.toxins_per_sample).map(([count, pct]) => ({ count, pct: Number(pct) }))}
                        networkData={analytics.networkData}
                        embedded
                      />
                    ) : (
                      <ChartSkeleton />
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          </>
        )}

        {/* Footer */}
        <footer className="border-t border-gfs-maroon/15 pt-6 pb-8 text-center">
          <p className="text-xs text-gfs-text-muted font-medium">
            AgriscanPro Mycotoxin Risk Surveillance Dashboard · {overviewData?.kpis.total_samples.toLocaleString() ?? 0} samples in view · Last updated {snapshot ? new Date(snapshot.generated_at).toLocaleString() : 'from API'}
            {snapshot && getSnapshotFreshness(snapshot) === 'stale' ? ' · Data may be delayed' : ''}
          </p>
        </footer>
      </main>
    </div>
  );
}
