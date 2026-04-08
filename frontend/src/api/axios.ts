import axios from "axios";

const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000/api`;

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

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("token/refresh")
    ) {
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
      } catch (err) {
        isRefreshing = false;
        processQueue(err);

        // ❗ DO NOT redirect here
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;