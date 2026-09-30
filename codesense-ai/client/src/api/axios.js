import axios from "axios";
import { getApiBaseUrl } from "../lib/apiUrl.js";

const apiHost = getApiBaseUrl();
const baseURL = apiHost ? `${apiHost}/api` : "/api";

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("codesense_token") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
