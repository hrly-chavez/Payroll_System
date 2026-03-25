import axios from "axios";

const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, // VERY IMPORTANT: send cookies
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: any) => void; reject: (err: any) => void }[] = [];

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

    // Only handle 401 for endpoints other than refresh
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("token/refresh")) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        // ✅ Use the SAME api instance for refresh
        await api.post("/accounts/token/refresh/"); // cookie is sent automatically

        isRefreshing = false;
        processQueue(); // retry queued requests

        return api(originalRequest); // retry original request
      } catch (err) {
        isRefreshing = false;
        processQueue(err);

        localStorage.setItem("loggedOut", "true");
        window.location.href = "/";

        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;