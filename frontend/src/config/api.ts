// Central API configuration
// Set VITE_API_BASE_URL environment variable to the full API root (including "/api")
// Examples:
//   Local:     VITE_API_BASE_URL=http://localhost:8080/api
//   Railway:   VITE_API_BASE_URL=https://your-app.up.railway.app/api
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
    ? 'http://localhost:8080/api'
    : 'https://agriscan-pro-copy-production.up.railway.app/api');

export default API_BASE_URL;
