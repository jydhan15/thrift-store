const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1";
export const peso = (c) => "₱" + (c / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 });
export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }), ...headers }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return { success: true };
  const j = await res.json().catch(() => ({ success: false, error: { message: "Network error" } }));
  if (!j.success) { const e = new Error(j.error?.message || "Error"); e.code = j.error?.code; e.details = j.error?.details; throw e; }
  return j;
}
