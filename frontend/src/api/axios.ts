//src/api/axios.ts
import axios from "axios";

const baseURL = process.env.REACT_APP_API_BASE_URL || "/api";

console.log("BASE URL:", baseURL);

const api = axios.create({
  baseURL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    //  Endpoints that should NEVER trigger refresh
    const skipRefreshEndpoints = [
      "/accounts/login/",
      "/accounts/token/refresh/",
      "/accounts/logout/",
    ];

    const shouldSkipRefresh = skipRefreshEndpoints.some((url) =>
      originalRequest.url?.includes(url)
    );

    //  If request is login/refresh/logout → DO NOT refresh
    if (shouldSkipRefresh) {
      return Promise.reject(error);
    }

    //  Only handle 401 errors
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      isRefreshing = true;

      try {
        await api.post("/accounts/token/refresh/");

        isRefreshing = false;
        processQueue();

        return api(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError);

        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("role");
        localStorage.removeItem("user_name");

        window.location.href = "/";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;