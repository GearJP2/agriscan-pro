import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardFilters } from '@/types/dashboard';
import Header from '@/components/Header';
import DashboardFilterBar from './DashboardFilterBar';
import KPICards from './KPICards';
import RegionalRiskRanking from './RegionalRiskRanking';
import PublicHealthSummary from './PublicHealthSummary';
import MycotoxinAnalysis from './MycotoxinAnalysis';
import CoContaminationAnalysis from './CoContaminationAnalysis';
import { Loader2, AlertTriangle } from 'lucide-react';
import { sampleAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ALL_TIME_QUARTER,
  CUSTOM_RANGE_QUARTER,
  buildFilterOptions,
  buildSurveillanceAnalytics,
  getQuarterDateRange,
} from '@/lib/sampleAnalytics';

// Lazy-load the map (it pulls in Leaflet + GeoJSON which is heavy)
const RegionalRiskMap = lazy(() => import('./RegionalRiskMap'));

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
  quarter: ALL_TIME_QUARTER,
};

export default function SurveillanceDashboard() {
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const { data: samples = [], isLoading, error } = useQuery({
    queryKey: ['surveillance-dashboard-samples'],
    queryFn: () => sampleAPI.getAllSamples(),
    enabled: isAuthenticated,
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

  const analytics = useMemo(() => buildSurveillanceAnalytics(samples, filters), [samples, filters]);

  const handleFilterChange = (nextFilters: DashboardFilters) => {
    const currentQuarterRange = getQuarterDateRange(nextFilters.quarter);
    const matchesQuarter = currentQuarterRange
      && currentQuarterRange.from === nextFilters.dateRange.from
      && currentQuarterRange.to === nextFilters.dateRange.to;

    setFilters({
      ...nextFilters,
      quarter: matchesQuarter || nextFilters.quarter === ALL_TIME_QUARTER ? nextFilters.quarter : CUSTOM_RANGE_QUARTER,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background dashboard-wrapper">
        <Header />
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
      <div className="min-h-screen bg-background dashboard-wrapper">
        <Header />
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
      <div className="min-h-screen bg-background dashboard-wrapper">
        <Header />
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
      <div className="min-h-screen bg-background dashboard-wrapper">
        <Header />
        <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No samples are available yet. Add records in the sample list to populate this dashboard.
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background dashboard-wrapper">
      <Header />

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DashboardFilterBar
          filters={filters}
          onChange={handleFilterChange}
          commodityOptions={filterOptions.commodities}
          regionOptions={filterOptions.regions}
          quarterOptions={filterOptions.quarters}
        />

        {/* Active filter indicator */}
        {(filters.commodities.length > 0 || filters.regions.length > 0) && (
          <div className="text-xs text-warning bg-warning/10 rounded-lg px-4 py-2 border border-warning/20">
            Filters active: {filters.commodities.length > 0 && `Commodities: ${filters.commodities.join(', ')}`}
            {filters.commodities.length > 0 && filters.regions.length > 0 && ' · '}
            {filters.regions.length > 0 && `Regions: ${filters.regions.join(', ')}`}
          </div>
        )}

        {analytics.filteredSamples.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center text-muted-foreground">
            No sample data matched the selected filters.
          </div>
        ) : (
          <>
            {/* Section 1: KPI Cards */}
            <KPICards cards={analytics.kpiData.cards} />

            {/* Section 2: Regional Risk Map + Ranking */}
            <section aria-label="Regional Risk Analysis">
              <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
                <Suspense fallback={<MapSkeleton />}>
                  <RegionalRiskMap
                    selectedProvince={selectedProvince}
                    onSelectProvince={setSelectedProvince}
                    provinceRiskData={analytics.provinceRiskData}
                  />
                </Suspense>
                <RegionalRiskRanking
                  selectedProvince={selectedProvince}
                  onSelectProvince={setSelectedProvince}
                  provinces={analytics.topProvinces}
                  toxinColors={analytics.toxinColors}
                />
              </div>
            </section>

            {/* Section 3: Public Health Risk Summary */}
            <PublicHealthSummary summary={analytics.publicHealthSummary} />

            {/* Section 4: Mycotoxin & Commodity Analysis */}
            <MycotoxinAnalysis
              mycotoxinBarData={analytics.mycotoxinBarData}
              commodityShare={analytics.commodityShare}
              thresholdByCommodity={analytics.thresholdByCommodity}
              heatmapData={analytics.heatmapData}
              heatmapRegions={analytics.heatmapRegions}
              heatmapCommodities={analytics.heatmapCommodities}
              affectedSampleCount={analytics.filteredSamples.filter((sample) => sample.mycotoxin_results?.length).length}
            />

            {/* Section 5: Co-contamination Analysis */}
            <CoContaminationAnalysis
              coContamSummary={analytics.coContamSummary}
              coOccurrenceList={analytics.coOccurrenceList}
              toxinsPerSample={analytics.toxinsPerSample}
              networkData={analytics.networkData}
              toxinColors={analytics.toxinColors}
            />
          </>
        )}

        {/* Footer */}
        <footer className="border-t border-border pt-4 pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            AgriscanPro Mycotoxin Risk Surveillance Dashboard · {analytics.filteredSamples.length.toLocaleString()} samples in view · {filters.quarter === CUSTOM_RANGE_QUARTER ? `${filters.dateRange.from} to ${filters.dateRange.to}` : filters.quarter}
          </p>
        </footer>
      </main>
    </div>
  );
}
