/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DASHBOARD_SNAPSHOT_URL?: string;
  readonly VITE_STATIC_DASHBOARD_ENABLED?: string;
  readonly VITE_CARTO_API_KEY?: string;
}
