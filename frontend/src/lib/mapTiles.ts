export type MapTheme = 'light' | 'dark';

export interface MapTileConfig {
  url: string;
  attribution: string;
}

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">OpenStreetMap contributors</a>';
const CARTO_ATTRIBUTION = `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions" rel="noreferrer">CARTO</a>`;
const cartoApiKey = import.meta.env.VITE_CARTO_API_KEY?.trim();

export function getMapTileConfig(theme: MapTheme): MapTileConfig {
  if (!cartoApiKey) {
    return {
      url: OSM_TILE_URL,
      attribution: OSM_ATTRIBUTION,
    };
  }

  const style = theme === 'dark' ? 'dark_nolabels' : 'light_nolabels';
  return {
    url: `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(cartoApiKey)}`,
    attribution: CARTO_ATTRIBUTION,
  };
}
