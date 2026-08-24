import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";

import { partnerDirectory, partnerLocations } from "@/constants/partners";

const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

const PartnerMap = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={[24, 40]}
      zoom={2}
      minZoom={1}
      maxZoom={6}
      scrollWheelZoom={false}
      worldCopyJump
      className="z-0 h-[440px] w-full"
    >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      {partnerDirectory.map(([, country, , query]) => {
        const location = partnerLocations[country];
        if (!location) return null;
        const offset = location.dx || location.dy
          ? `translate(calc(-50% + ${location.dx ?? 0}px), calc(-50% + ${location.dy ?? 0}px))`
          : "translate(-50%, -50%)";
        return (
          <Marker
            key={country}
            position={[location.lat, location.lng]}
            icon={L.divIcon({
              className: "",
              iconSize: [0, 0],
              html: `<span class="partner-pill" style="transform:${offset}" title="${country}">${country}</span>`,
            })}
            eventHandlers={{
              click: () => window.open(mapsUrl(query), "_blank", "noopener,noreferrer"),
            }}
          />
        );
      })}
    </MapContainer>
  );
};

export default PartnerMap;
