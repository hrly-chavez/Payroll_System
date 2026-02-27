// src/api/axios.ts
import axios from "axios";
import { message } from "antd";

const baseURL =
  process.env.REACT_APP_API_BASE_URL ||
  `http://${window.location.hostname}:8000/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, //  VERY IMPORTANT (send cookies)
});

// No more attaching Authorization header
api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete (config.headers as any)["Content-Type"];
    } else {
      (config.headers as any)["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect if NOT already on login page
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;