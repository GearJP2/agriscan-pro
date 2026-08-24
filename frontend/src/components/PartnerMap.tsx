import { useRef } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import { useTheme } from "next-themes";

import { institutionMapsQuery, partnerDirectory, partnerLocations } from "@/constants/partners";

const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

type PartnerMarkerProps = {
  flag: string;
  country: string;
  institutions: string[];
  lat: number;
  lng: number;
  dx?: number;
  dy?: number;
};

/** Pill marker whose popup opens on hover or click and stays open while the
 *  pointer is inside the popup, so every institution remains clickable. */
const PartnerMarker = ({ flag, country, institutions, lat, lng, dx, dy }: PartnerMarkerProps) => {
  const markerRef = useRef<L.Marker>(null);
  const popupHovered = useRef(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const openNow = () => {
    window.clearTimeout(closeTimer.current);
    markerRef.current?.openPopup();
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
    <Marker
      ref={markerRef}
      position={[lat, lng]}
      icon={L.divIcon({
        className: "",
        iconSize: [0, 0],
        html: `<span class="partner-pill" style="transform:${offset}" title="${country}">${country}</span>`,
      })}
      eventHandlers={{
        click: openNow,
        mouseover: openNow,
        mouseout: scheduleClose,
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
  );
};

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
          />
        );
      })}
    </MapContainer>
  );
};

export default PartnerMap;
