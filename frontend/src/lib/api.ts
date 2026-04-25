import axios, { AxiosError, AxiosHeaders } from "axios";
import type { Sample, ProcessLog, RiskLevel } from "@/types/sample";
import {
  clearAccessToken,
  clearSessionHint,
  getAccessToken,
  setAccessToken,
  setSessionHint,
} from "@/lib/tokenStorage";
import { logger } from "@/lib/logger";

// API base URL — set VITE_API_BASE_URL to override (e.g. "http://localhost:8080/api").
// In production builds the frontend is served behind the same CloudFront origin,
// so a relative "/api" path is the correct default.
const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:8080/api" : "/api");

const baseClientConfig = {
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
} as const;

export const publicApiClient = axios.create(baseClientConfig);
export const apiClient = axios.create(baseClientConfig);

type RefreshSessionResponse = {
  access: string;
};

const requestSessionRefresh = async (): Promise<RefreshSessionResponse> => {
  const response = await publicApiClient.post<RefreshSessionResponse>(
    "/accounts/login/refresh/",
    {},
  );

  return response.data;
};

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (token) {
      config.headers = AxiosHeaders.from(config.headers);
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    return config;
  },
  (error) => Promise.reject(error),
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (token) {
      promise.resolve(token);
    } else {
      promise.reject(error);
    }
  });

  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    logger.debug("api.request_success", {
      url: response.config.url,
      status: response.status,
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config as
      | (NonNullable<AxiosError["config"]> & { _retry?: boolean })
      | undefined;
    logger.warn("api.request_failed", {
      url: originalRequest?.url,
      status: error.response?.status,
    });

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("accounts/login/refresh/")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers = AxiosHeaders.from(
                originalRequest.headers,
              );
              originalRequest.headers.set("Authorization", `Bearer ${token}`);
              resolve(apiClient(originalRequest));
            },
            reject: (refreshError: unknown) => reject(refreshError),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const data = await requestSessionRefresh();
        setAccessToken(data.access);
        setSessionHint();

        originalRequest.headers = AxiosHeaders.from(originalRequest.headers);
        originalRequest.headers.set("Authorization", `Bearer ${data.access}`);

        processQueue(null, data.access);
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAccessToken();
        clearSessionHint();
        window.location.href = "/";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export const sampleAPI = {
  async getSamples(
    page?: number,
    pageSize?: number,
    filters?: {
      search?: string;
      status?: string[];
      region?: string;
      province?: string;
      vegetation?: string;
      riskLevel?: RiskLevel[];
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const params = new URLSearchParams();

    if (page) params.append("page", page.toString());
    if (pageSize) params.append("page_size", pageSize.toString());

    if (filters) {
      if (filters.search) params.append("search", filters.search);
      if (filters.status?.length)
        params.append("status", filters.status.join(","));
      if (filters.region) params.append("region", filters.region);
      if (filters.province) params.append("province", filters.province);
      if (filters.vegetation) params.append("vegetation", filters.vegetation);
      if (filters.riskLevel?.length)
        params.append("risk_level", filters.riskLevel.join(","));
      if (filters.dateFrom) params.append("date_from", filters.dateFrom);
      if (filters.dateTo) params.append("date_to", filters.dateTo);
    }

    const response = await apiClient.get(`/samples/?${params.toString()}`);
    return response.data;
  },

  async getAllSamples(filters?: {
    search?: string;
    status?: string[];
    region?: string;
    province?: string;
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

      const pageResults: Sample[] = Array.isArray(data?.results)
        ? data.results
        : [];
      allSamples.push(...pageResults);

      if (!data?.next || pageResults.length === 0) {
        break;
      }

      page += 1;
    }

    return allSamples;
  },

  async getSample(id: number | string) {
    const response = await apiClient.get(`/samples/${id}/`);
    return response.data;
  },

  async getSampleBySampleId(sampleId: string) {
    const response = await apiClient.get(`/samples/?search=${sampleId}`);
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    }
    throw new Error("Sample not found");
  },

  async getStatistics() {
    const response = await apiClient.get("/samples/statistics/");
    return response.data;
  },

  async getRecentAlerts() {
    const response = await apiClient.get("/samples/recent_alerts/");
    return response.data;
  },

  async createSample(data: Partial<Sample>) {
    const response = await apiClient.post("/samples/", data);
    return response.data;
  },

  async getSampleDetail(sampleId: string) {
    const response = await apiClient.get(`/samples/${sampleId}/`);
    return response.data;
  },

  async updateSample(id: number | string, data: Partial<Sample>) {
    const response = await apiClient.patch(`/samples/${id}/`, data);
    return response.data;
  },

  async deleteSample(id: number | string) {
    const response = await apiClient.delete(`/samples/${id}/`);
    return response.data;
  },

  async bulkDeleteSamples(sampleIds: string[]) {
    const response = await apiClient.post("/samples/bulk_delete/", {
      sample_ids: sampleIds,
    });
    return response.data;
  },

  async addProcessLog(sampleId: number | string, logData: Partial<ProcessLog>) {
    const response = await apiClient.post(
      `/samples/${sampleId}/add_process_log/`,
      logData,
    );
    return response.data;
  },

  async addMycotoxinResult(
    sampleId: number | string,
    resultData: Record<string, unknown>,
  ) {
    const response = await apiClient.post(
      `/samples/${sampleId}/add_mycotoxin_result/`,
      resultData,
    );
    return response.data;
  },

  async bulkImportResults(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post(
      "/samples/bulk_import_results/",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );

    return response.data;
  },

  async bulkCreateSamples(data: Partial<Sample>[]) {
    try {
      const response = await apiClient.post("/samples/bulk_create/", data);
      logger.info("api.bulk_create.success", { count: data.length });
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;

      logger.error("api.bulk_create.failed", error, {
        count: data.length,
        status: axiosError.response?.status,
      });
      throw error;
    }
  },

  async getRegions() {
    const response = await apiClient.get("/samples/?distinct=region");
    return response.data;
  },

  async getVegetationVarieties() {
    const response = await apiClient.get(
      "/samples/?distinct=vegetation_variety",
    );
    return response.data;
  },
};

export const userAPI = {
  async getUsers() {
    const response = await apiClient.get("/accounts/users/");
    return response.data;
  },

  async updateUser(
    id: string | number,
    data: { role?: string; is_active?: boolean },
  ) {
    const response = await apiClient.patch(`/accounts/users/${id}/`, data);
    return response.data;
  },

  async updateProfile(data: {
    name?: string;
    email?: string;
    current_password?: string;
  }) {
    const response = await apiClient.patch("/accounts/profile/", data);
    return response.data;
  },

  async requestPasswordResetOTP(email: string) {
    const response = await apiClient.post("/accounts/password-reset/request/", {
      email,
    });
    return response.data;
  },

  async confirmPasswordResetOTP(data: Record<string, unknown>) {
    const response = await apiClient.post(
      "/accounts/password-reset/confirm/",
      data,
    );
    return response.data;
  },

  async confirmEmailChange(token: string) {
    const response = await apiClient.post("/accounts/email-change/confirm/", {
      token,
    });
    return response.data;
  },
};



export const analyticsAPI = {
  async getOverview(filters?: Record<string, string | string[]>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, Array.isArray(value) ? value.join(",") : value);
      });
    }
    const response = await apiClient.get(`/samples/analytics/overview/?${params.toString()}`);
    return response.data;
  },

  async getCoContamination(filters?: Record<string, string | string[]>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, Array.isArray(value) ? value.join(",") : value);
      });
    }
    const response = await apiClient.get(`/samples/analytics/co-contamination/?${params.toString()}`);
    return response.data;
  },

  async simulateThreshold(overrides: Record<string, Record<string, number>>, filters?: Record<string, string | string[]>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, Array.isArray(value) ? value.join(",") : value);
      });
    }
    const response = await apiClient.post(`/samples/analytics/threshold-simulation/?${params.toString()}`, { overrides });
    return response.data;
  },

  async getEnvironmentalCorrelation(filters?: Record<string, string | string[]>) {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, Array.isArray(value) ? value.join(",") : value);
      });
    }
    const response = await apiClient.get(`/samples/analytics/environmental-correlation/?${params.toString()}`);
    return response.data;
  }
};

export default apiClient;
