import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProvinceRisk } from '@/types/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';

// Normalize province names for matching: lowercase + strip spaces
// Handles "Maha Sarakham" (GeoJSON) vs "Mahasarakham" (database)
const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, '');

// Risk level color mapping
const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#991b1b',
};

// Highlight a specific province by zooming to it
function HighlightProvince({ province, geoData }: { province: string | null; geoData: any }) {
  const map = useMap();

  useEffect(() => {
    if (!province || !geoData) return;
    const features = geoData.features || [];
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');
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

interface Props {
  selectedProvince: string | null;
  onSelectProvince: (province: string) => void;
  provinceRiskData: ProvinceRisk[];
}

export default function RegionalRiskMap({ selectedProvince, onSelectProvince, provinceRiskData }: Props) {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const riskLookup = useMemo(() => {
    const map = new Map<string, ProvinceRisk>();
    provinceRiskData.forEach((province) => map.set(province.name, province));
    return map;
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

  // Match GeoJSON feature to our province risk data using fuzzy name matching
  const findProvinceRisk = useCallback((featureName: string): ProvinceRisk | undefined => {
    if (riskLookup.has(featureName)) return riskLookup.get(featureName);
    const normFeature = normalizeName(featureName);
    for (const [name, data] of riskLookup) {
      const normName = normalizeName(name);
      if (normFeature === normName || normFeature.includes(normName) || normName.includes(normFeature)) return data;
    }
    return undefined;
  }, [riskLookup]);

  const borderColor = isDark ? '#1f2937' : '#e5e7eb';

  const style = useCallback((feature: any) => {
    const name = feature?.properties?.NAME_1 || feature?.properties?.name || '';
    const risk = findProvinceRisk(name);
    const fillColor = risk ? RISK_COLORS[risk.riskLevel] : (isDark ? '#374151' : '#d1d5db');
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
  }, [findProvinceRisk, selectedProvince, isDark, borderColor]);

  const onEachFeature = useCallback((feature: any, layer: L.Layer) => {
    const name = feature?.properties?.NAME_1 || feature?.properties?.name || '';
    const risk = findProvinceRisk(name);

    if (risk) {
      layer.bindTooltip(
        `<div class="text-sm">
          <strong>${risk.name}</strong><br/>
          Samples: ${risk.sampleCount}<br/>
          Above threshold: ${risk.aboveThresholdPct}%<br/>
          Dominant toxin: ${risk.dominantToxin}<br/>
          Dominant commodity: ${risk.dominantCommodity}
        </div>`,
        { sticky: true, className: isDark ? 'leaflet-tooltip-dark' : '' }
      );
    }

    (layer as L.Path).on({
      mouseover: (e) => {
        const l = e.target;
        l.setStyle({ weight: 2, fillOpacity: 0.9 });
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

  if (loading) {
    return (
      <Card className="glass-card h-full flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading map data...</div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="glass-card h-full flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">
          <p className="text-center">Unable to load map data.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Check network connection and refresh.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass-card h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Regional Risk Map</CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 rounded-lg overflow-hidden relative min-h-[400px]" aria-label="Thailand regional risk choropleth map">
          <MapContainer
            center={[13.7, 100.5]}
            zoom={6}
            style={{ height: '100%', width: '100%', background: isDark ? '#030712' : '#f8fafc' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              key={tileUrl}
              url={tileUrl}
              attribution=""
            />
            {geoData && (
              <GeoJSON
                ref={(ref) => { geoJsonRef.current = ref as L.GeoJSON; }}
                key={`${selectedProvince || 'default'}-${isDark}`}
                data={geoData}
                style={style}
                onEachFeature={onEachFeature}
              />
            )}
            <HighlightProvince province={selectedProvince} geoData={geoData} />
          </MapContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          {Object.entries(RISK_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-xs text-muted-foreground capitalize">{level}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
