import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, X, Layers, Database, ZoomIn, ZoomOut, Table as TableIcon } from 'lucide-react';
import type { ProvinceRisk } from '@/types/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Normalize province names for matching: lowercase + strip spaces
const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, '');

// Risk level color mapping
const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#991b1b',
};

// Sequential Blue scale for Sample counts
const SAMPLE_COLORS = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'];

// Highlight a specific province by zooming to it
function HighlightProvince({ province, geoData }: { province: string | null; geoData: any }) {
  const map = useMap();

  useEffect(() => {
    if (!province || !geoData) return;
    const features = geoData.features || [];
    const feature = features.find((f: any) => {
      const name = f.properties?.NAME_1 || f.properties?.name || '';
      return normalizeName(name) === normalizeName(province) || normalizeName(name).includes(normalizeName(province)) || normalizeName(province).includes(normalizeName(name));
    });
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
    <div className="flex items-center gap-px">
      <button 
        onClick={() => map.zoomIn()}
        className="w-10 h-10 flex items-center justify-center hover:bg-muted text-foreground transition-colors rounded-l-lg border-r border-border/50"
        title="Zoom In"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 flex items-center justify-center hover:bg-muted text-foreground transition-colors rounded-r-lg"
        title="Zoom Out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
    </div>
  );
}

// Fix Tile loading when container size changes with high precision
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    
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
  viewMode: 'risk' | 'samples';
  onViewModeChange: (mode: 'risk' | 'samples') => void;
}

export default function RegionalRiskMap({ selectedProvince, onSelectProvince, provinceRiskData, viewMode, onViewModeChange }: Props) {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const geoJsonFullscreenRef = useRef<L.GeoJSON | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const riskLookup = useMemo(() => {
    const map = new Map<string, ProvinceRisk>();
    provinceRiskData.forEach((province) => map.set(province.name, province));
    return map;
  }, [provinceRiskData]);

  const maxSamples = useMemo(() => {
    return Math.max(...provinceRiskData.map(p => p.sampleCount), 1);
  }, [provinceRiskData]);

  // Pick tile layer based on theme
  const tileUrl = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';

  // Fetch Thailand GeoJSON on mount
  useEffect(() => {
    const url = 'https://raw.githubusercontent.com/apisit/thailand.json/master/thailand.json';
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  // Close fullscreen on Escape
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const findProvinceRisk = useCallback((featureName: string): ProvinceRisk | undefined => {
    if (riskLookup.has(featureName)) return riskLookup.get(featureName);
    const normFeature = normalizeName(featureName);
    for (const [name, data] of riskLookup) {
      const normName = normalizeName(name);
      if (normFeature === normName || normFeature.includes(normName) || normName.includes(normFeature)) return data;
    }
    return undefined;
  }, [riskLookup]);

  const getRiskColor = (pct: number) => {
    if (pct === 0) return isDark ? '#374151' : '#d1d5db';
    if (pct < 5) return RISK_COLORS.low;
    if (pct < 15) return RISK_COLORS.medium;
    if (pct < 25) return RISK_COLORS.high;
    return RISK_COLORS.critical;
  };

  const getSampleColor = (count: number) => {
    if (count === 0) return isDark ? '#374151' : '#d1d5db';
    // Scaling based on local distribution of positive samples
    const maxRiskSamples = provinceRiskData.reduce((acc, p) => Math.max(acc, Math.round((p.sampleCount * p.aboveThresholdPct) / 100)), 0);
    const ratio = count / (maxRiskSamples || 1);
    const idx = Math.min(Math.floor(ratio * SAMPLE_COLORS.length), SAMPLE_COLORS.length - 1);
    return SAMPLE_COLORS[idx];
  };

  const borderColor = isDark ? '#1f2937' : '#e5e7eb';

  const style = useCallback((feature: any) => {
    const name = feature?.properties?.NAME_1 || feature?.properties?.name || '';
    const risk = findProvinceRisk(name);
    
    let fillColor = isDark ? '#374151' : '#d1d5db';
    if (risk) {
      if (viewMode === 'risk') {
        fillColor = getRiskColor(risk.aboveThresholdPct);
      } else {
        const positiveCount = Math.round((risk.sampleCount * risk.aboveThresholdPct) / 100);
        fillColor = getSampleColor(positiveCount);
      }
    }

    const normName = normalizeName(name);
    const normSelected = selectedProvince ? normalizeName(selectedProvince) : null;
    const isSelected = normSelected && (normName === normSelected || normName.includes(normSelected) || normSelected.includes(normName));

    return {
      fillColor,
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#fbbf24' : borderColor,
      fillOpacity: isSelected ? 0.9 : 0.7,
    };
  }, [findProvinceRisk, selectedProvince, isDark, borderColor, viewMode, provinceRiskData]);

  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const name = feature?.properties?.NAME_1 || feature?.properties?.name || '';
    const risk = findProvinceRisk(name);

    if (risk) {
      const positiveCount = Math.round((risk.sampleCount * risk.aboveThresholdPct) / 100);
      layer.bindTooltip(
        `<div class="text-sm p-1">
          <div class="font-bold border-b border-border/50 pb-1 mb-1">${risk.name}</div>
          <div class="flex justify-between gap-4"><span>Total Samples:</span> <span class="font-mono text-muted-foreground">${risk.sampleCount}</span></div>
          <div class="flex justify-between gap-4"><span>Positive Detection:</span> <span class="font-mono text-primary font-bold">${positiveCount}</span></div>
          <div class="flex justify-between gap-4"><span>Risk Rate:</span> <span class="font-mono text-destructive font-bold">${risk.aboveThresholdPct}%</span></div>
          <div class="mt-1 text-[10px] text-muted-foreground"> Dominant: ${risk.dominantToxin}</div>
        </div>`,
        { sticky: true, className: `p-0 border-2 border-border dark:border-white/10 ${isDark ? 'leaflet-tooltip-dark' : ''}` }
      );
    }

    (layer as L.Path).on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ weight: 2, fillOpacity: 0.95 });
        l.bringToFront();
      },
      mouseout: (e) => {
        if (geoJsonRef.current) geoJsonRef.current.resetStyle(e.target);
      },
      click: () => {
        if (risk) onSelectProvince(risk.name);
      },
    });
  }, [findProvinceRisk, onSelectProvince, isDark]);

  const mapContent = (ref: React.MutableRefObject<L.GeoJSON | null>) => (
    <MapContainer
      center={[13.7, 100.5]}
      zoom={6}
      minZoom={3}
      maxZoom={10}
      style={{ height: '100%', width: '100%', background: isDark ? '#020617' : '#f8fafc' }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer key={tileUrl} url={tileUrl} attribution="" noWrap />
      
      {/* Custom Horizontal Zoom Control */}
      <div className="absolute bottom-6 left-6 z-[1000] flex items-center gap-1 bg-background/80 backdrop-blur-md border border-border/50 p-1 rounded-xl">
        <MapZoomButtons />
      </div>

      <MapResizer />

      {geoData && (
        <GeoJSON
          ref={(r) => { ref.current = r as L.GeoJSON; }}
          key={`${selectedProvince || 'default'}-${isDark}-${viewMode}`}
          data={geoData}
          style={style}
          onEachFeature={onEachFeature}
        />
      )}
      <HighlightProvince province={selectedProvince} geoData={geoData} />
      
      {/* Absolute Overlays inside map area */}
      <div className="absolute top-4 right-4 z-[1000]">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'risk' | 'samples')}>
          <TabsList className="bg-background/80 backdrop-blur-md border border-border/50 h-10 p-1 rounded-lg">
            <TabsTrigger value="risk" className="text-xs px-4 h-8 border border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all font-black uppercase tracking-widest">
              <Layers className="w-4 h-4 mr-1.5" /> Risk
            </TabsTrigger>
            <TabsTrigger value="samples" className="text-xs px-4 h-8 border border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary transition-all font-black uppercase tracking-widest">
              <TableIcon className="w-4 h-4 mr-1.5" /> Samples
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </MapContainer>
  );

  const legend = (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{viewMode === 'risk' ? 'Risk Severity' : 'Sample Intensity'}</div>
      <div className="flex items-center gap-4">
        {viewMode === 'risk' ? (
          Object.entries(RISK_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground capitalize font-medium">{level}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Low</span>
            <div className="flex gap-px h-2.5 items-center">
              {SAMPLE_COLORS.map(c => <div key={c} className="w-4 h-full" style={{ backgroundColor: c }} />)}
            </div>
            <span className="text-[10px] text-muted-foreground ml-1">High ({maxSamples})</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <Card className="glass-card h-full flex flex-col border-2 border-border dark:border-border/50 relative overflow-hidden bg-card dark:bg-card rounded-2xl shadow-none">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -z-10" />
        <CardHeader className="pb-3 px-6 pt-5 bg-card dark:bg-card border-b border-slate-900/5">
          <div className="flex items-center justify-between">
            <div className="font-sans">
              <CardTitle className="text-xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Regional Risk Atlas</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.15em]">Surveillance Metadata</span>
                <span className="text-[10px] text-primary/60 font-black">•</span>
                <span className="text-[10px] text-primary/80 font-black italic">
                  {viewMode === 'risk' 
                    ? "Color mapped to % risk rate per province" 
                    : "Color mapped to absolute count of risk samples"}
                </span>
              </div>
            </div>
            <button
              onClick={() => setFullscreen(true)}
              className="p-2 rounded-xl bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-90"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col px-6 pb-6">
          <div className="flex-1 rounded-2xl overflow-hidden relative min-h-[420px] border border-border/50" aria-label="Thailand regional risk choropleth map">
            {mapContent(geoJsonRef)}
          </div>
          <div className="mt-4 pt-4 border-t border-primary/5">
            {legend}
          </div>
        </CardContent>
      </Card>

      {fullscreen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex flex-col animate-in fade-in zoom-in duration-300"
          style={{ background: isDark ? '#020617' : '#f8fafc' }}
        >
          {/* Fullscreen header */}
          <div className={`flex items-center justify-between px-6 py-3 ${isDark ? 'bg-slate-950/80' : 'bg-white/80'} backdrop-blur-xl border-b border-border`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg"><Database className="w-5 h-5 text-primary" /></div>
              <div>
                <span className="font-bold text-lg block leading-tight">Regional Risk Atlas</span>
                <span className="text-[10px] uppercase font-bold tracking-tighter text-muted-foreground">Fullscreen Simulation Mode</span>
              </div>
            </div>
            <div className="flex items-center gap-8">
              {legend}
              <button
                onClick={() => setFullscreen(false)}
                className="p-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-all active:scale-90"
                title="Close (Esc)"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          {/* Fullscreen map */}
          <div className="flex-1 relative">
            {mapContent(geoJsonFullscreenRef)}
            <MapResizer />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
