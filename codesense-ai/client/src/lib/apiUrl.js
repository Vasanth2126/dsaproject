export function getApiBaseUrl() {
  let url = (import.meta.env.VITE_API_URL || "").trim();

  // If no VITE_API_URL is provided, auto-detect when running on Render
  if (!url && typeof window !== "undefined" && window.location.hostname.includes("onrender.com")) {
    const host = window.location.hostname;
    if (host.includes("-client")) {
      url = `https://${host.replace("-client", "-api")}`;
    }
  }

  if (!url) return "";

  // If Render gives a bare service name without dots (e.g. "codesense-api-gekh")
  if (!url.includes(".") && !url.includes("localhost") && !url.startsWith("/")) {
    url = `${url}.onrender.com`;
  }

  // Ensure protocol
  if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("/")) {
    url = `https://${url}`;
  }

  return url.replace(/\/$/, "");
}
