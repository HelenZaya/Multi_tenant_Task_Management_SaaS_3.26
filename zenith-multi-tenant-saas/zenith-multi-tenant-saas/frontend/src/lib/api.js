import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && localStorage.getItem("refreshToken")) {
      original._retry = true;
      refreshPromise ??= axios.post(`${API_URL}/auth/refresh`, {
        refreshToken: localStorage.getItem("refreshToken"),
      });
      try {
        const { data } = await refreshPromise;
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } finally {
        refreshPromise = null;
      }
    }
    return Promise.reject(error);
  }
);
