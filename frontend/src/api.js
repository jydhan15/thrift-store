// Single place for the API base URL. In production the Vercel app must point at the
// deployed Render API; the fallback keeps a bare production build usable too.
const DEFAULT_PROD = "https://thrift-store-api-0dcb.onrender.com/api/v1";
// A local `npm run preview` is still a production build, so import.meta.env.PROD
// alone would send it to Render. Use the computer running the page instead.
const host = typeof window === "undefined" ? "localhost" : window.location.hostname;
const privateHost = host === "localhost" || host === "127.0.0.1" || host === "::1" ||
  /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host);
const localApi = "http://" + (host === "::1" ? "localhost" : host) + ":4000/api/v1";
const raw = import.meta.env.VITE_API_URL || (privateHost ? localApi : import.meta.env.PROD ? DEFAULT_PROD : localApi);
export const BASE = raw.replace(/\/+$/, "");

export const peso = (c) => "₱" + ((Number(c) || 0) / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 });

// crypto.randomUUID only exists on HTTPS/localhost. Phones testing over http://192.168.x.x need a fallback.
export const uuid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 3) | 8).toString(16);
      });

export async function api(path, { method = "GET", body, headers = {}, timeout = 90000 } = {}) {
  const token = localStorage.getItem("token");
  const controller = new AbortController();
  // The API runs on a free instance and can take up to a minute to wake up.
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token && { Authorization: "Bearer " + token }),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("The server is taking too long to respond. It may be waking up — please try again.");
    throw new Error("Can't reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return { success: true };
  const j = await res.json().catch(() => ({ success: false, error: { message: "Unexpected server response" } }));

  // Expired token: let the shell clear session state and send the user to login.
  if (res.status === 401 && token && !path.startsWith("/auth")) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:expired"));
  }

  if (!j.success) {
    const e = new Error(j.error?.message || "Something went wrong");
    e.code = j.error?.code;
    e.details = j.error?.details;
    e.status = res.status;
    throw e;
  }
  return j;
}
