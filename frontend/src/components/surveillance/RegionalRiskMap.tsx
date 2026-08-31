import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, X, Layers, Database, ZoomIn, ZoomOut, Table as TableIcon, CloudSun, Droplets, Thermometer, Waves } from 'lucide-react';
import type { EnvironmentalCorrelationResponse, ProvinceRisk } from '@/types/dashboard';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getMapTileConfig } from '@/lib/mapTiles';

interface ProvinceFeatureProperties {
  NAME_1?: string;
  name?: string;
  [key: string]: unknown;
}

type ProvinceFeature = Feature<Geometry, ProvinceFeatureProperties>;
type ThailandGeoJson = FeatureCollection<Geometry, ProvinceFeatureProperties>;

// Normalize province names for matching across English and Thai data sources.
const normalizeName = (s: string) =>
  s.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const namesMatch = (left: string, right: string) => {
  const normalizedLeft = normalizeName(left);
  const normalizedRight = normalizeName(right);
  return Boolean(
    normalizedLeft
    && normalizedRight
    && (
      normalizedLeft === normalizedRight
      || normalizedLeft.includes(normalizedRight)
      || normalizedRight.includes(normalizedLeft)
    ),
  );
};

const getProvinceName = (feature?: ProvinceFeature | null) => {
  const name = feature?.properties?.NAME_1 ?? feature?.properties?.name;
  return typeof name === 'string' ? name : '';
};

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);

// Risk level color mapping aligned with CoE-GFS
const RISK_COLORS: Record<string, string> = {
  low: '#10b981',
  medium: '#FFC72C',
  high: '#ea580c',
  critical: '#7a1f1f',
};

// Sequential Blue scale for Sample counts
const SAMPLE_COLORS = ['#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#172554'];
const ENVIRONMENT_COLORS = ['#ecfeff', '#a5f3fc', '#22d3ee', '#0891b2', '#164e63'];

export type MapViewMode = 'risk' | 'samples' | 'temperature' | 'humidity' | 'rainfall' | 'soilTemperature';

const NASA_MODES: MapViewMode[] = ['temperature', 'humidity', 'rainfall', 'soilTemperature'];

const VIEW_LABELS: Record<MapViewMode, string> = {
  risk: 'Positive samples (%)',
  samples: 'Positive sample count',
  temperature: 'Air temperature (C)',
  humidity: 'Relative humidity (%)',
  rainfall: 'Rainfall (mm/hour)',
  soilTemperature: 'Earth skin temperature (C)',
};

const isMapViewMode = (value: string): value is MapViewMode =>
  Object.prototype.hasOwnProperty.call(VIEW_LABELS, value);

// Highlight a specific province by zooming to it
function HighlightProvince({ province, geoData }: { province: string | null; geoData: ThailandGeoJson | null }) {
  const map = useMap();

  useEffect(() => {
    if (!province || !geoData) return;
    const feature = geoData.features.find((candidate) => namesMatch(getProvinceName(candidate), province));
    if (feature) {
      const layer = L.geoJSON(feature);
      const bounds = layer.getBounds();
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    }
  }, [province, geoData, map]);

  return null;
}

// Custom Horizontal Zoom Component
function MapZoomButtons() {
  const map = useMap();
  return (
    <div className="flex items-center gap-px bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-full border border-gfs-maroon/20 shadow-sm overflow-hidden">
      <button 
        type="button"
        onClick={() => map.zoomIn()}
        aria-label="Zoom in"
        className="w-9 h-9 flex items-center justify-center hover:bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold transition-colors border-r border-gfs-maroon/15"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button 
        type="button"
        onClick={() => map.zoomOut()}
        aria-label="Zoom out"
        className="w-9 h-9 flex items-center justify-center hover:bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
    </div>
  );
}

// Fix Tile loading when container size changes with high precision
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;

    if (typeof ResizeObserver === 'undefined') {
      map.invalidateSize();
      return;
    }
    
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });

    observer.observe(container);
    
    // Initial call to be sure
    map.invalidateSize();

    return () => {
      observer.disconnect();
    };
  }, [map]);
  return null;
}

interface Props {
  selectedProvince: string | null;
  onSelectProvince: (province: string) => void;
  provinceRiskData: ProvinceRisk[];
  viewMode: MapViewMode;
  onViewModeChange: (mode: MapViewMode) => void;
  environmentalData?: EnvironmentalCorrelationResponse;
  isEnvironmentalLoading?: boolean;
}

export default function RegionalRiskMap({
  selectedProvince,
  onSelectProvince,
  provinceRiskData,
  viewMode,
  onViewModeChange,
  environmentalData,
  isEnvironmentalLoading = false,
}: Props) {
  const [geoData, setGeoData] = useState<ThailandGeoJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const geoJsonFullscreenRef = useRef<L.GeoJSON | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const riskLookup = useMemo(() => {
    const map = new Map<string, ProvinceRisk>();
    provinceRiskData.forEach((province) => map.set(province.name, province));
    return map;
  }, [provinceRiskData]);

  const maxPositiveSamples = useMemo(() => {
    return Math.max(
      ...provinceRiskData.map((province) => (
        province.positiveCount ?? Math.round((province.sampleCount * province.aboveThresholdPct) / 100)
      )),
      1,
    );
  }, [provinceRiskData]);

  const tileConfig = useMemo(
    () => getMapTileConfig(isDark ? 'dark' : 'light'),
    [isDark],
  );

  // Fetch Thailand GeoJSON on mount
  useEffect(() => {
    const url = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';

    const controller = new AbortController();
    const loadGeoData = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`GeoJSON request failed: ${response.status}`);

        const data: unknown = await response.json();
        if (!data || typeof data !== 'object' || !('features' in data) || !Array.isArray(data.features)) {
          throw new Error('GeoJSON response has an invalid shape');
        }

        if (!controller.signal.aborted) {
          setGeoData(data as ThailandGeoJson);
          setError(false);
          setLoading(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    void loadGeoData();
    return () => controller.abort();
  }, []);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  const findProvinceRisk = useCallback((featureName: string): ProvinceRisk | undefined => {
    if (riskLookup.has(featureName)) return riskLookup.get(featureName);
    for (const [name, data] of riskLookup) {
      if (namesMatch(featureName, name)) return data;
    }
    return undefined;
  }, [riskLookup]);

  const isNasaMode = NASA_MODES.includes(viewMode);
  const environmentalMetric = useMemo(() => {
    if (!environmentalData) return null;
    const metrics = {
      temperature: { value: environmentalData.summary.temperatureC, unit: 'C', label: 'Air temperature' },
      humidity: { value: environmentalData.summary.relativeHumidityPct, unit: '%', label: 'Relative humidity' },
      rainfall: { value: environmentalData.summary.precipitationMmHour, unit: 'mm/hour', label: 'Rainfall' },
      soilTemperature: { value: environmentalData.summary.soilTemperatureC, unit: 'C', label: 'Earth skin temperature' },
    };
    return viewMode in metrics ? metrics[viewMode as keyof typeof metrics] : null;
  }, [environmentalData, viewMode]);

  const borderColor = isDark ? '#1f2937' : '#e5e7eb';

  const style = useCallback((feature?: ProvinceFeature) => {
    const getRiskColor = (pct: number) => {
      const riskPct = Math.min(100, Math.max(0, pct));
      if (riskPct === 0) return isDark ? '#374151' : '#d1d5db';
      if (riskPct < 5) return RISK_COLORS.low;
      if (riskPct < 15) return RISK_COLORS.medium;
      if (riskPct < 25) return RISK_COLORS.high;
      return RISK_COLORS.critical;
    };
    const getSampleColor = (count: number) => {
      if (count <= 0) return isDark ? '#334155' : '#e2e8f0';
      const ratio = count / maxPositiveSamples;
      const idx = Math.min(
        Math.max(Math.ceil(ratio * SAMPLE_COLORS.length) - 1, 0),
        SAMPLE_COLORS.length - 1,
      );
      return SAMPLE_COLORS[idx];
    };
    const name = getProvinceName(feature);
    const risk = findProvinceRisk(name);
    const isSelected = Boolean(selectedProvince && namesMatch(name, selectedProvince));
    
    let fillColor = isDark ? '#374151' : '#d1d5db';
    if (risk) {
      if (viewMode === 'risk' || isNasaMode) {
        fillColor = getRiskColor(risk.aboveThresholdPct);
      } else {
        const positiveCount = risk.positiveCount ?? Math.round((risk.sampleCount * risk.aboveThresholdPct) / 100);
        fillColor = getSampleColor(positiveCount);
      }
    }

    if (isNasaMode && isSelected && environmentalMetric?.value != null) {
      fillColor = ENVIRONMENT_COLORS[3];
    }

    return {
      fillColor,
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#FFC72C' : borderColor,
      fillOpacity: isSelected ? 0.9 : 0.7,
    };
  }, [findProvinceRisk, selectedProvince, isDark, borderColor, viewMode, maxPositiveSamples, isNasaMode, environmentalMetric]);

  const onEachFeature = useCallback((feature: ProvinceFeature, layer: L.Layer) => {
    const name = getProvinceName(feature);
    const risk = findProvinceRisk(name);

    if (risk) {
      const positiveCount = risk.positiveCount ?? Math.round((risk.sampleCount * risk.aboveThresholdPct) / 100);
      const countLabel = viewMode === 'samples' ? 'Positive Samples' : 'Above Threshold';
      const displayedCount = viewMode === 'samples'
        ? positiveCount
        : Math.round((risk.sampleCount * risk.aboveThresholdPct) / 100);
      const nasaLine = isNasaMode
        ? selectedProvince && namesMatch(name, selectedProvince) && environmentalMetric?.value != null
          ? `<div class="mt-1 flex justify-between gap-4 text-xs"><span>${escapeHtml(environmentalMetric.label)}:</span> <span class="font-mono text-gfs-maroon dark:text-gfs-gold font-bold">${escapeHtml(environmentalMetric.value)} ${escapeHtml(environmentalMetric.unit)}</span></div>`
          : '<div class="mt-1 text-[10px] text-gfs-text-muted">Click to load NASA statistics</div>'
        : '';
      layer.bindTooltip(
        `<div class="text-xs p-1 font-sans">
          <div class="font-bold text-gfs-maroon dark:text-gfs-gold border-b border-gfs-maroon/15 pb-1 mb-1 text-sm">${escapeHtml(risk.name)}</div>
          <div class="flex justify-between gap-4 text-gfs-text-secondary"><span>Total Samples:</span> <span class="font-mono font-bold">${escapeHtml(risk.sampleCount)}</span></div>
          <div class="flex justify-between gap-4 text-gfs-text-secondary"><span>${escapeHtml(countLabel)}:</span> <span class="font-mono text-gfs-maroon dark:text-gfs-gold font-bold">${escapeHtml(displayedCount)}</span></div>
          <div class="flex justify-between gap-4 text-gfs-text-secondary"><span>Risk Rate:</span> <span class="font-mono text-gfs-maroon-dark dark:text-red-400 font-bold">${escapeHtml(risk.aboveThresholdPct)}%</span></div>
          <div class="mt-1 text-[10px] text-gfs-text-muted font-medium">Dominant: ${escapeHtml(risk.dominantToxin)}</div>
          ${nasaLine}
        </div>`,
        { sticky: true, className: `p-2 rounded-xl border border-gfs-maroon/20 shadow-lg bg-white text-slate-900 ${isDark ? 'leaflet-tooltip-dark' : ''}` }
      );
    } else if (isNasaMode) {
      const selected = Boolean(selectedProvince && namesMatch(name, selectedProvince));
      const metricLine = selected && environmentalMetric?.value != null
        ? `<div class="font-mono font-bold text-gfs-maroon dark:text-gfs-gold">${escapeHtml(environmentalMetric.value)} ${escapeHtml(environmentalMetric.unit)}</div>`
        : '<div class="text-xs text-gfs-text-muted">Click to load NASA statistics</div>';
      layer.bindTooltip(
        `<div class="text-xs p-1 font-sans"><div class="font-bold text-gfs-maroon dark:text-gfs-gold text-sm">${escapeHtml(name)}</div>${metricLine}</div>`,
        { sticky: true, className: `p-2 rounded-xl border border-gfs-maroon/20 shadow-lg bg-white text-slate-900 ${isDark ? 'leaflet-tooltip-dark' : ''}` }
      );
    }

    (layer as L.Path).on({
      mouseover: (e) => {
        const path = e.target as L.Path;
        path.setStyle({ weight: 2, fillOpacity: 0.95 });
        path.bringToFront();
      },
      mouseout: (e) => {
        (e.target as L.Path).setStyle(style(feature));
      },
      click: () => {
        if (isNasaMode) onSelectProvince(name);
        else if (risk) onSelectProvince(risk.name);
      },
    });
  }, [findProvinceRisk, onSelectProvince, isDark, isNasaMode, selectedProvince, environmentalMetric, viewMode, style]);

  const mapContent = (ref: React.MutableRefObject<L.GeoJSON | null>) => (
    <MapContainer
      center={[13.7, 100.5]}
      zoom={6}
      minZoom={3}
      maxZoom={10}
      style={{ height: '100%', width: '100%', background: isDark ? '#020617' : '#f8fafc' }}
      zoomControl={false}
      attributionControl
    >
      <TileLayer key={tileConfig.url} url={tileConfig.url} attribution={tileConfig.attribution} noWrap />
      
      {/* Custom Horizontal Zoom Control */}
      <div className="absolute bottom-6 left-6 z-[1000] pointer-events-auto">
        <MapZoomButtons />
      </div>

      <MapResizer />

      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70 text-sm font-semibold text-gfs-maroon backdrop-blur-sm dark:bg-slate-950/70 dark:text-gfs-gold" role="status">
          Loading regional map…
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 px-6 text-center text-sm font-semibold text-gfs-maroon dark:bg-slate-950/80 dark:text-gfs-gold" role="alert">
          Regional map data is temporarily unavailable.
        </div>
      )}

      {geoData && !loading && !error && (
        <GeoJSON
          ref={(instance) => { ref.current = instance; }}
          key={`${selectedProvince || 'default'}-${isDark}-${viewMode}`}
          data={geoData}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}
      <HighlightProvince province={selectedProvince} geoData={geoData} />
      
      {/* Absolute Overlays inside map area */}
      <div className="absolute top-4 right-4 z-[1000] pointer-events-auto">
        <Select value={viewMode} onValueChange={(value) => {
          if (isMapViewMode(value)) onViewModeChange(value);
        }}>
          <SelectTrigger className="w-[230px] h-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gfs-maroon/20 text-gfs-maroon dark:text-gfs-gold font-bold text-xs rounded-full shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-900 border border-gfs-maroon/20 rounded-gfs-card shadow-gfs-modal z-[1100]">
            <SelectItem value="risk"><span className="flex items-center gap-2"><Layers className="w-4 h-4 text-gfs-maroon dark:text-gfs-gold" />{VIEW_LABELS.risk}</span></SelectItem>
            <SelectItem value="samples"><span className="flex items-center gap-2"><TableIcon className="w-4 h-4 text-gfs-maroon dark:text-gfs-gold" />{VIEW_LABELS.samples}</span></SelectItem>
            <SelectItem value="temperature"><span className="flex items-center gap-2"><Thermometer className="w-4 h-4 text-gfs-maroon dark:text-gfs-gold" />{VIEW_LABELS.temperature}</span></SelectItem>
            <SelectItem value="humidity"><span className="flex items-center gap-2"><Droplets className="w-4 h-4 text-gfs-maroon dark:text-gfs-gold" />{VIEW_LABELS.humidity}</span></SelectItem>
            <SelectItem value="rainfall"><span className="flex items-center gap-2"><Waves className="w-4 h-4 text-gfs-maroon dark:text-gfs-gold" />{VIEW_LABELS.rainfall}</span></SelectItem>
            <SelectItem value="soilTemperature"><span className="flex items-center gap-2"><CloudSun className="w-4 h-4 text-gfs-maroon dark:text-gfs-gold" />{VIEW_LABELS.soilTemperature}</span></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isNasaMode && (
        <div className="absolute top-16 right-4 z-[1000] w-[230px] bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-gfs-maroon/20 rounded-gfs-card p-3 shadow-gfs-card pointer-events-none">
          <div className="text-[10px] font-bold text-gfs-text-muted">NASA POWER · {environmentalData?.location.label || selectedProvince || 'Select a province'}</div>
          <div className="mt-1 text-2xl font-extrabold text-gfs-maroon dark:text-gfs-gold">
            {isEnvironmentalLoading ? 'Loading...' : environmentalMetric?.value != null ? `${environmentalMetric.value} ${environmentalMetric.unit}` : '--'}
          </div>
          <div className="text-xs text-gfs-text-secondary font-medium">{environmentalMetric?.label || VIEW_LABELS[viewMode]}</div>
        </div>
      )}
    </MapContainer>
  );

  const legend = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="text-[10px] font-bold text-gfs-text-muted tracking-normal uppercase">{isNasaMode ? 'Risk severity + selected NASA statistic' : viewMode === 'risk' ? 'Risk Severity' : 'Sample Intensity'}</div>
      <div className="flex items-center gap-4">
        {isNasaMode ? (
          <>
            {Object.entries(RISK_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-gfs-text-secondary capitalize font-bold">{level}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: ENVIRONMENT_COLORS[3] }} />
              <span className="text-[10px] text-gfs-text-secondary font-bold">Selected NASA value</span>
            </div>
          </>
        ) : viewMode === 'risk' ? (
          Object.entries(RISK_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-gfs-text-secondary capitalize font-bold">{level}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 border border-gfs-maroon/20 mr-1" style={{ backgroundColor: isDark ? '#475569' : '#f0e8dc' }} />
            <span className="text-[10px] text-gfs-text-muted mr-2">0</span>
            <span className="text-[10px] text-gfs-text-muted mr-1">1</span>
            <div className="flex gap-px h-2.5 items-center rounded-sm overflow-hidden">
              {SAMPLE_COLORS.map(c => <div key={c} className="w-4 h-full" style={{ backgroundColor: c }} />)}
            </div>
            <span className="text-[10px] text-gfs-text-muted ml-1 font-bold">{maxPositiveSamples} positive</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card className="h-full flex flex-col border border-gfs-maroon/15 dark:border-white/10 relative isolate z-0 overflow-hidden bg-white dark:bg-slate-900/80 rounded-gfs-card shadow-gfs-card">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gfs-gold/10 rounded-full blur-3xl -z-10" />
        <CardHeader className="pb-3 px-6 pt-5 bg-white dark:bg-slate-900 border-b border-gfs-maroon/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 font-sans">
              <div className="h-6 w-1.5 bg-gfs-gold rounded-full shrink-0" />
              <div>
                <CardTitle className="text-xl font-bold tracking-tight text-gfs-maroon dark:text-white">Regional Risk Atlas</CardTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gfs-text-muted font-medium">Surveillance Metadata</span>
                  <span className="text-xs text-gfs-maroon/40 font-black">•</span>
                  <span className="text-xs text-gfs-maroon dark:text-gfs-gold font-bold">
                    {isNasaMode
                      ? `Selected province · ${VIEW_LABELS[viewMode]}`
                      : viewMode === 'risk'
                        ? "Color mapped to % risk rate per province"
                        : "Color mapped to absolute count of risk samples"}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              aria-label="Open regional risk atlas fullscreen"
              className="p-2 rounded-xl bg-gfs-canvas dark:bg-white/10 text-gfs-maroon dark:text-gfs-gold border border-gfs-maroon/20 hover:bg-gfs-maroon hover:text-white transition-all active:scale-90"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col px-6 pb-6 pt-4">
          <div className="flex-1 rounded-gfs-card overflow-hidden relative isolate z-0 min-h-[420px] border border-gfs-maroon/15 shadow-inner" role="region" aria-label="Thailand regional risk choropleth map">
            {mapContent(geoJsonRef)}
          </div>
          <div className="mt-4 pt-4 border-t border-gfs-maroon/10">
            {legend}
          </div>
        </CardContent>
      </Card>

      {fullscreen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col animate-in fade-in zoom-in duration-300 font-sans"
          style={{ background: isDark ? '#0f1418' : '#fdf7ef' }}
        >
          {/* Fullscreen header */}
          <div className={`flex items-center justify-between px-6 py-3.5 ${isDark ? 'bg-slate-950/90' : 'bg-white/95'} backdrop-blur-xl border-b border-gfs-maroon/15`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gfs-maroon/10 text-gfs-maroon dark:bg-gfs-gold/15 dark:text-gfs-gold rounded-xl">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-lg text-gfs-maroon dark:text-white block leading-tight">Regional Risk Atlas</span>
                <span className="text-xs font-medium text-gfs-text-muted">Fullscreen Simulation Mode</span>
              </div>
            </div>
            <div className="flex items-center gap-8">
              {legend}
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label="Close regional risk atlas fullscreen"
                className="p-2 rounded-xl bg-gfs-maroon/10 text-gfs-maroon dark:text-gfs-gold hover:bg-gfs-maroon hover:text-white transition-all active:scale-90"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Fullscreen map */}
          <div className="flex-1 relative">
            {mapContent(geoJsonFullscreenRef)}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
