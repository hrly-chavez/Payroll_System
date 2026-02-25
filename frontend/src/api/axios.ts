//src/api/axios.ts
import axios from "axios";
import { message } from "antd";


const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL,
  // do NOT force Content-Type here
});
/**
 * Attach access token automatically
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // If sending FormData, let the browser set the correct multipart boundary
    if (config.data instanceof FormData) {
      delete (config.headers as any)["Content-Type"];
    } else {
      // for normal JSON requests
      (config.headers as any)["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Handle expired token (optional but recommended)
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("role");
      localStorage.removeItem("user_name");

      // Show message only
      message.error("Your session has expired. Please login again.");
    }

    return Promise.reject(error);
  }
);

export default api;
