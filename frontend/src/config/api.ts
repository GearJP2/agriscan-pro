// Central API configuration
// In development: reads from .env.local or falls back to localhost
// In production (Cloudflare Pages): set VITE_API_BASE_URL in environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export default API_BASE_URL;
