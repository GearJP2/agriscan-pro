import axios from 'axios';
import { Sample, ProcessLog, RiskLevel } from '@/types/sample';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  migrateFromLocalStorage,
} from '@/lib/tokenStorage';
import { logger } from '@/lib/logger';

// Migrate any tokens left in localStorage by the previous implementation
migrateFromLocalStorage();

// Configure base URL for API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
  ? 'http://localhost:8080/api'
  : 'https://agriscan-pro-production.up.railway.app/api');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased from 10s to 30s for bulk imports
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests (reads from secure in-memory storage)
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ---------- Automatic silent token refresh ----------
// Prevents multiple concurrent refresh requests.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    logger.debug('api.request_success', { url: response.config.url, status: response.status });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    logger.warn('api.request_failed', { url: originalRequest?.url, status: error.response?.status });

    // If we get a 401 and this is NOT the refresh request itself, try to refresh
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('login/refresh')
    ) {
      if (isRefreshing) {
        // Another refresh is in-flight; queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject: (err: unknown) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const currentRefreshToken = getRefreshToken();
      if (!currentRefreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        // Call the Django token refresh endpoint
        const { data } = await axios.post(`${API_BASE_URL}/accounts/login/refresh/`, {
          refresh: currentRefreshToken,
        });

        // Store new tokens (the backend now rotates refresh tokens too)
        setTokens(data.access, data.refresh || currentRefreshToken);

        // Retry the original request with the new access token
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        processQueue(null, data.access);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For non-401 errors or if refresh failed, reject normally
    return Promise.reject(error);
  }
);

/**
 * Sample API Service
 * Handles all API calls related to samples
 */
export const sampleAPI = {
  /**
   * Get paginated list of samples with optional filtering
   */
  async getSamples(
    page?: number,
    pageSize?: number,
    filters?: {
      search?: string;
      status?: string[];
      region?: string;
      vegetation?: string;
      riskLevel?: RiskLevel[];
      dateFrom?: string;
      dateTo?: string;
    }
  ) {
    const params = new URLSearchParams();
    if (page) params.append('page', page.toString());
    if (pageSize) params.append('page_size', pageSize.toString());
    if (filters) {
      if (filters.search) params.append('search', filters.search);
      if (filters.status?.length) params.append('status', filters.status.join(','));
      if (filters.region) params.append('region', filters.region);
      if (filters.vegetation) params.append('vegetation', filters.vegetation);
      if (filters.riskLevel?.length) params.append('risk_level', filters.riskLevel.join(','));
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
    }

    const response = await apiClient.get(`/samples/?${params.toString()}`);
    return response.data;
  },

  /**
   * Get all samples by following paginated results.
   */
  async getAllSamples(filters?: {
    search?: string;
    status?: string[];
    region?: string;
    vegetation?: string;
    riskLevel?: RiskLevel[];
    dateFrom?: string;
    dateTo?: string;
  }) {
    const allSamples: Sample[] = [];
    let page = 1;

    while (true) {
      const data = await this.getSamples(page, 200, filters);

      if (Array.isArray(data)) {
        allSamples.push(...data);
        break;
      }

      const pageResults: Sample[] = Array.isArray(data?.results) ? data.results : [];
      allSamples.push(...pageResults);

      if (!data?.next || pageResults.length === 0) {
        break;
      }

      page += 1;
    }

    return allSamples;
  },

  /**
   * Get a single sample by ID
   */
  async getSample(id: number | string) {
    const response = await apiClient.get(`/samples/${id}/`);
    return response.data;
  },

  /**
   * Get sample by sample_id (string)
   */
  async getSampleBySampleId(sampleId: string) {
    const response = await apiClient.get(`/samples/?search=${sampleId}`);
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
    throw new Error('Sample not found');
  },

  /**
   * Get dashboard statistics
   */
  async getStatistics() {
    const response = await apiClient.get('/samples/statistics/');
    return response.data;
  },

  /**
   * Get recent flagged/alert samples
   */
  async getRecentAlerts() {
    const response = await apiClient.get('/samples/recent_alerts/');
    return response.data;
  },

  /**
   * Create a new sample
   */
  async createSample(data: Partial<Sample>) {
    const response = await apiClient.post('/samples/', data);
    return response.data;
  },

  /**
   * Get a single sample by sample_id
   */
  async getSampleDetail(sampleId: string) {
    const response = await apiClient.get(`/samples/${sampleId}/`);
    return response.data;
  },

  /**
   * Update an existing sample
   */
  async updateSample(id: number | string, data: Partial<Sample>) {
    const response = await apiClient.patch(`/samples/${id}/`, data);
    return response.data;
  },

  /**
   * Delete a sample
   */
  async deleteSample(id: number | string) {
    const response = await apiClient.delete(`/samples/${id}/`);
    return response.data;
  },

  /**
   * Bulk delete samples (admin only)
   */
  async bulkDeleteSamples(sampleIds: string[]) {
    const response = await apiClient.post('/samples/bulk_delete/', { sample_ids: sampleIds });
    return response.data;
  },

  /**
   * Add a process log entry to a sample
   */
  async addProcessLog(sampleId: number | string, logData: Partial<ProcessLog>) {
    const response = await apiClient.post(`/samples/${sampleId}/add_process_log/`, logData);
    return response.data;
  },

  /**
   * Add mycotoxin test result to a sample
   */
  async addMycotoxinResult(sampleId: number | string, resultData: any) {
    const response = await apiClient.post(`/samples/${sampleId}/add_mycotoxin_result/`, resultData);
    return response.data;
  },

  /**
   * Bulk create samples
   */
  async bulkCreateSamples(data: Partial<Sample>[]) {
    try {
      const response = await apiClient.post('/samples/bulk_create/', data);
      logger.info('api.bulk_create.success', { count: data.length });
      return response.data;
    } catch (error: any) {
      logger.error('api.bulk_create.failed', error, { count: data.length, status: error.response?.status });
      throw error;
    }
  },

  /**
   * Get all distinct regions for filtering
   */
  async getRegions() {
    const response = await apiClient.get('/samples/?distinct=region');
    return response.data;
  },

  /**
   * Get all distinct vegetation varieties for filtering
   */
  async getVegetationVarieties() {
    const response = await apiClient.get('/samples/?distinct=vegetation_variety');
    return response.data;
  },
};

export default apiClient;
