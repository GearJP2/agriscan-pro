import { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { provinceRiskData } from '@/data/mockDashboardData';
import type { ProvinceRisk } from '@/types/dashboard';

// Risk level color mapping
const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#991b1b',
};

// Build lookup from province name to risk data
const riskLookup = new Map<string, ProvinceRisk>();
provinceRiskData.forEach((p) => riskLookup.set(p.name, p));

// Highlight a specific province by zooming to it
function HighlightProvince({ province, geoData }: { province: string | null; geoData: any }) {
  const map = useMap();

  useEffect(() => {
    if (!province || !geoData) return;
    const features = geoData.features || [];
    const feature = features.find((f: any) => {
      const name = f.properties?.NAME_1 || f.properties?.name || '';
      return name === province || name.includes(province) || province.includes(name);
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
}

export default function RegionalRiskMap({ selectedProvince, onSelectProvince }: Props) {
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

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
    // Direct match
    if (riskLookup.has(featureName)) return riskLookup.get(featureName);
    // Partial match
    for (const [name, data] of riskLookup) {
      if (featureName.includes(name) || name.includes(featureName)) return data;
    }
    // Fallback: return a low-risk default
    return undefined;
  }, []);

  const style = useCallback((feature: any) => {
    const name = feature?.properties?.NAME_1 || feature?.properties?.name || '';
    const risk = findProvinceRisk(name);
    const fillColor = risk ? RISK_COLORS[risk.riskLevel] : '#374151';
    const isSelected = selectedProvince && (name === selectedProvince || name.includes(selectedProvince));

    return {
      fillColor,
      weight: isSelected ? 3 : 1,
      opacity: 1,
      color: isSelected ? '#fbbf24' : '#1f2937',
      fillOpacity: isSelected ? 0.9 : 0.7,
    };
  }, [findProvinceRisk, selectedProvince]);

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
        { sticky: true, className: 'leaflet-tooltip-dark' }
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
  }, [findProvinceRisk, onSelectProvince]);

  if (loading) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 h-full flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gray-400">Loading map data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 h-full flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">
          <p className="text-center">Unable to load map data.</p>
          <p className="text-xs text-gray-500 mt-1">Check network connection and refresh.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">Regional Risk Map</h3>

      <div className="flex-1 rounded-lg overflow-hidden relative min-h-[400px]" aria-label="Thailand regional risk choropleth map">
        <MapContainer
          center={[13.7, 100.5]}
          zoom={6}
          style={{ height: '100%', width: '100%', background: '#030712' }}
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            attribution=""
          />
          {geoData && (
            <GeoJSON
              ref={(ref) => { geoJsonRef.current = ref as L.GeoJSON; }}
              key={selectedProvince || 'default'}
              data={geoData}
              style={style}
              onEachFeature={onEachFeature}
            />
          )}
          <HighlightProvince province={selectedProvince} geoData={geoData} />
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-800">
        {Object.entries(RISK_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400 capitalize">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
