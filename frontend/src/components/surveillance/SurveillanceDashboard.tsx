import { useState, Suspense, lazy } from 'react';
import type { DashboardFilters } from '@/types/dashboard';
import Header from '@/components/Header';
import DashboardFilterBar from './DashboardFilterBar';
import KPICards from './KPICards';
import RegionalRiskRanking from './RegionalRiskRanking';
import PublicHealthSummary from './PublicHealthSummary';
import MycotoxinAnalysis from './MycotoxinAnalysis';
import CoContaminationAnalysis from './CoContaminationAnalysis';

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
  dateRange: { from: '2024-10-01', to: '2024-12-31' },
  commodities: [],
  regions: [],
  quarter: 'Q4 2024',
};

export default function SurveillanceDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DashboardFilterBar filters={filters} onChange={setFilters} />

        {/* Active filter indicator */}
        {(filters.commodities.length > 0 || filters.regions.length > 0) && (
          <div className="text-xs text-warning bg-warning/10 rounded-lg px-4 py-2 border border-warning/20">
            Filters active: {filters.commodities.length > 0 && `Commodities: ${filters.commodities.join(', ')}`}
            {filters.commodities.length > 0 && filters.regions.length > 0 && ' · '}
            {filters.regions.length > 0 && `Regions: ${filters.regions.join(', ')}`}
          </div>
        )}

        {/* Section 1: KPI Cards */}
        <KPICards filters={filters} />

        {/* Section 2: Regional Risk Map + Ranking */}
        <section aria-label="Regional Risk Analysis">
          <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-4">
            <Suspense fallback={<MapSkeleton />}>
              <RegionalRiskMap
                selectedProvince={selectedProvince}
                onSelectProvince={setSelectedProvince}
              />
            </Suspense>
            <RegionalRiskRanking
              selectedProvince={selectedProvince}
              onSelectProvince={setSelectedProvince}
            />
          </div>
        </section>

        {/* Section 3: Public Health Risk Summary */}
        <PublicHealthSummary />

        {/* Section 4: Mycotoxin & Commodity Analysis */}
        <MycotoxinAnalysis />

        {/* Section 5: Co-contamination Analysis */}
        <CoContaminationAnalysis />

        {/* Footer */}
        <footer className="border-t border-border pt-4 pb-8 text-center">
          <p className="text-xs text-muted-foreground">
            AgriscanPro Mycotoxin Risk Surveillance Dashboard · Data as of {filters.quarter} · For research use only
          </p>
        </footer>
      </main>
    </div>
  );
}
