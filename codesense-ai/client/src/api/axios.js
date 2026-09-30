import axios from "axios";

let rawUrl = import.meta.env.VITE_API_URL || "";
if (rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://") && !rawUrl.startsWith("/")) {
  rawUrl = `https://${rawUrl}`;
}
const baseURL = rawUrl ? `${rawUrl.replace(/\/$/, "")}/api` : "/api";

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("codesense_token") || localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

