// src/api/axios.ts
import axios from "axios";

const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, // VERY IMPORTANT to send cookies
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only handle 401 for endpoints other than refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If user is already logged out, do nothing
      if (localStorage.getItem("loggedOut") === "true") {
        return Promise.reject(error);
      }

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
        const res = await axios.post(
          `${baseURL}/accounts/token/refresh/`,
          {},
          { withCredentials: true }
        );

        isRefreshing = false;
        processQueue(null);

        return api(originalRequest);
      } catch (err) {
        isRefreshing = false;
        processQueue(err, null);

        // Mark as logged out to prevent looping
        localStorage.setItem("loggedOut", "true");

        // Redirect to login once
        window.location.href = "/";

        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  }
);

export default api;