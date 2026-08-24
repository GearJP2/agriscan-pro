import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import type { Feature, FeatureCollection, GeoJsonProperties, GeometryObject } from "geojson";

import { institutionMapsQuery, partnerDirectory, partnerLocations } from "@/constants/partners";

const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const WORLD_GEOJSON_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";
const FOUR_COLOR_PALETTE = ["#D95D5D", "#4F86C6", "#E5B84B", "#62A86B"] as const;

const COUNTRY_COLOR_INDEX: Record<string, number> = {
  Thailand: 3,
  Myanmar: 2,
  China: 0,
  Vietnam: 1,
  Malaysia: 2,
  Singapore: 0,
  Indonesia: 1,
  Japan: 1,
  "South Korea": 2,
  "Hong Kong": 3,
  Nepal: 1,
  "United States": 0,
  Canada: 1,
  "United Kingdom": 0,
  Ireland: 1,
  France: 2,
  Belgium: 3,
  Italy: 1,
  Austria: 3,
  Paraguay: 0,
};

const COUNTRY_ALIASES: Record<string, string> = {
  unitedstatesofamerica: "United States",
  republicofkorea: "South Korea",
  korearepublicof: "South Korea",
  hongkongsar: "Hong Kong",
};

type Coordinate = [number, number];
type WorldFeature = Feature<GeometryObject, GeoJsonProperties>;
type WorldGeoJson = FeatureCollection<GeometryObject, GeoJsonProperties>;

const normalizeCountry = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const getPartnerCountry = (feature?: WorldFeature | null): string | null => {
  const properties = feature?.properties ?? {};
  const rawName = [properties.ADMIN, properties.NAME, properties.NAME_EN, properties.name]
    .find((value): value is string => typeof value === "string");
  if (!rawName) return null;

  const normalized = normalizeCountry(rawName);
  return COUNTRY_ALIASES[normalized]
    ?? partnerDirectory.find(([, country]) => normalizeCountry(country) === normalized)?.[1]
    ?? null;
};

const countryColor = (country: string) =>
  FOUR_COLOR_PALETTE[COUNTRY_COLOR_INDEX[country] ?? 0];

type CountryStyleState = "base" | "hover" | "selected";

const partnerCountryStyle = (feature?: WorldFeature, state: CountryStyleState = "base") => ({
  color: "#ffffff",
  fillColor: countryColor(getPartnerCountry(feature) ?? ""),
  fillOpacity: state === "selected" ? 0.86 : state === "hover" ? 0.72 : 0.5,
  opacity: state === "base" ? 0.9 : 1,
  weight: state === "selected" ? 2.6 : state === "hover" ? 1.8 : 0.8,
});

type PartnerMarkerProps = {
  flag: string;
  country: string;
  institutions: string[];
  lat: number;
  lng: number;
  dx?: number;
  dy?: number;
  isActive: boolean;
  onSelectCountry: () => void;
  onHoverCountry: (country: string | null) => void;
};

/** Pill marker whose popup opens on hover or click and stays open while the
 *  pointer is inside the popup, so every institution remains clickable. */
const PartnerMarker = ({
  flag,
  country,
  institutions,
  lat,
  lng,
  dx,
  dy,
  isActive,
  onSelectCountry,
  onHoverCountry,
}: PartnerMarkerProps) => {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);
  const popupHovered = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const [leaderEnd, setLeaderEnd] = useState<Coordinate | null>(null);

  const updateLeaderLine = useCallback(() => {
    if (dx === undefined && dy === undefined) {
      setLeaderEnd(null);
      return;
    }

    const zoom = map.getZoom();
    const labelPoint = map.project([lat, lng], zoom).add([dx ?? 0, dy ?? 0]);
    const labelPosition = map.unproject(labelPoint, zoom);
    setLeaderEnd([labelPosition.lat, labelPosition.lng]);
  }, [dx, dy, lat, lng, map]);

  useEffect(() => {
    updateLeaderLine();
    map.on("moveend zoomend resize", updateLeaderLine);
    return () => {
      map.off("moveend zoomend resize", updateLeaderLine);
    };
  }, [map, updateLeaderLine]);

  const openNow = () => {
    window.clearTimeout(closeTimer.current);
    markerRef.current?.openPopup();
  };

  const focusOnClick = () => {
    openNow();
    map.panTo([lat, lng], { animate: true, duration: 0.45 });
    onSelectCountry();
  };

  const scheduleClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      if (!popupHovered.current) markerRef.current?.closePopup();
    }, 180);
  };

  const offset =
    dx || dy
      ? `translate(calc(-50% + ${dx ?? 0}px), calc(-50% + ${dy ?? 0}px))`
      : "translate(-50%, -50%)";

  return (
    <>
      {leaderEnd && (
        <Polyline
          positions={[[lat, lng], leaderEnd]}
          pathOptions={{
            color: countryColor(country),
            dashArray: "4 3",
            opacity: isActive ? 1 : 0.8,
            weight: isActive ? 2.5 : 1.5,
          }}
        />
      )}
      <Marker
        ref={markerRef}
        position={[lat, lng]}
        icon={L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<span class="partner-pill${isActive ? " partner-pill-active" : ""}" style="--partner-color:${countryColor(country)};transform:${offset}" title="${country}">${country}</span>`,
        })}
        eventHandlers={{
          click: focusOnClick,
          mouseover: () => {
            openNow();
            onHoverCountry(country);
          },
          mouseout: () => {
            scheduleClose();
            onHoverCountry(null);
          },
        }}
      >
        <Popup autoPan={false} maxWidth={290} offset={[0, -4]}>
          <div
            className="partner-popup"
            onMouseEnter={() => {
              popupHovered.current = true;
              window.clearTimeout(closeTimer.current);
            }}
            onMouseLeave={scheduleClose}
          >
            <h3>
              {flag} {country}
            </h3>
            <ul>
              {institutions.map((name) => (
                <li key={name}>
                  <a href={mapsUrl(institutionMapsQuery(name, country))} target="_blank" rel="noopener noreferrer">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Popup>
      </Marker>
    </>
  );
};

const PartnerMap = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [worldGeoJson, setWorldGeoJson] = useState<WorldGeoJson | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const selectedCountryRef = useRef<string | null>(null);
  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";

  useEffect(() => {
    const controller = new AbortController();

    fetch(WORLD_GEOJSON_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`World map request failed: ${response.status}`);
        return response.json() as Promise<WorldGeoJson>;
      })
      .then((data) => {
        if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
          setWorldGeoJson(data);
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // The basemap and partner labels remain usable if the optional overlay is unavailable.
      });

    return () => controller.abort();
  }, []);

  const partnerGeoJson = useMemo<WorldGeoJson | null>(() => {
    if (!worldGeoJson) return null;
    return {
      ...worldGeoJson,
      features: worldGeoJson.features.filter((feature) => getPartnerCountry(feature) !== null),
    };
  }, [worldGeoJson]);

  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
  }, [selectedCountry]);

  useEffect(() => {
    geoJsonRef.current?.eachLayer((layer) => {
      const path = layer as L.Path & { feature?: WorldFeature };
      const country = getPartnerCountry(path.feature);
      if (!country) return;

      const state: CountryStyleState = country === selectedCountry
        ? "selected"
        : country === hoveredCountry
          ? "hover"
          : "base";
      path.setStyle(partnerCountryStyle(path.feature, state));

      if (state !== "base") path.bringToFront();
    });
  }, [hoveredCountry, partnerGeoJson, selectedCountry]);

  const onEachFeature = useCallback((feature: WorldFeature, layer: L.Layer) => {
    const country = getPartnerCountry(feature);
    if (!country) return;

    const path = layer as L.Path;
    path.on({
      mouseover: () => {
        setHoveredCountry(country);
        path.setStyle(partnerCountryStyle(feature, "hover"));
        path.bringToFront();
      },
      mouseout: () => {
        setHoveredCountry((current) => (current === country ? null : current));
        const state: CountryStyleState = selectedCountryRef.current === country ? "selected" : "base";
        path.setStyle(partnerCountryStyle(feature, state));
      },
      click: () => {
        setSelectedCountry(country);
        setHoveredCountry(null);
        path.setStyle(partnerCountryStyle(feature, "selected"));
        path.bringToFront();
      },
    });
  }, []);

  return (
    <MapContainer
      center={[24, 40]}
      zoom={2}
      minZoom={1}
      maxZoom={6}
      scrollWheelZoom
      worldCopyJump
      className="z-0 h-[440px] w-full"
    >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {partnerGeoJson && (
        <GeoJSON
          ref={geoJsonRef}
          data={partnerGeoJson}
          style={partnerCountryStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {partnerDirectory.map(([flag, country, institutions]) => {
        const location = partnerLocations[country];
        if (!location) return null;
        return (
          <PartnerMarker
            key={country}
            flag={flag}
            country={country}
            institutions={institutions}
            lat={location.lat}
            lng={location.lng}
            dx={location.dx}
            dy={location.dy}
            isActive={selectedCountry === country || hoveredCountry === country}
            onSelectCountry={() => {
              setSelectedCountry(country);
              setHoveredCountry(null);
            }}
            onHoverCountry={setHoveredCountry}
          />
        );
      })}
    </MapContainer>
  );
};

export default PartnerMap;
