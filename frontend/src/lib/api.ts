import axios from 'axios';
import { Sample, ProcessLog, RiskLevel } from '@/types/sample';

// Configure base URL for API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV
  ? 'http://localhost:8080/api'
  : 'https://agriscan-pro-copy-production.up.railway.app/api');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased from 10s to 30s for bulk imports
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
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
      return response.data;
    } catch (error: any) {
      console.error('Bulk create error response:', error.response?.data);
      console.error('Bulk create request data:', data);
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
