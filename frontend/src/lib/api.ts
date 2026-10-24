import axios from "axios";

function resolveApiBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  if (!raw) return "http://localhost:5001/api";
  let normalized = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) {
    const isLocal = /^(localhost|127\.0\.0\.1|192\.168\.)/i.test(normalized);
    normalized = `${isLocal ? "http" : "https"}://${normalized}`;
  }
  if (!normalized.endsWith("/api")) {
    normalized = `${normalized}/api`;
  }
  return normalized;
}

export const API_URL = resolveApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const url = String(originalRequest?.url || "");
    const isAuthEndpoint =
      url.includes("/auth/login") ||
      url.includes("/auth/setup") ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/change-password");

    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken,
        });
        localStorage.setItem("accessToken", data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string })?.message || err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

export async function downloadAuthenticatedBlob(endpoint: string, fallbackFilename: string) {
  const response = await api.get(endpoint, { responseType: "blob" });
  const disposition = String(response.headers["content-disposition"] || "");
  const match = /filename="?([^"]+)"?/i.exec(disposition);
  const filename = match?.[1] || fallbackFilename;

  const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

export default api;
