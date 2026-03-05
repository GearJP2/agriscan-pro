// Central API configuration
// In development: reads from .env.local or falls back to localhost
// In production (Cloudflare Pages): falls back to Railway production URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
    ? 'http://localhost:8000'
    : 'https://agriscan-pro-copy-production.up.railway.app');

export default API_BASE_URL;
