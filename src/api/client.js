// Core API client — talks to the Digital Atelier backend (see FRONTEND_API.md).
//
// Single source of truth for: the base URL, the auth tokens, the response
// envelope ({ status, data } / { status:false, message }), and the
// 401 → refresh → retry-once flow. Every resource module in `src/api/` is built
// on top of `api()` / `apiList()` here.
//
// Tokens live in localStorage to match the rest of the app's storage layer. The
// access-token key is deliberately the same one `src/auth/auth.js` already reads
// (`auth_token`), so `isAuthenticated()` keeps working unchanged.

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

const ACCESS_KEY = "auth_token"; // shared with src/auth/auth.js
const REFRESH_KEY = "refresh_token";
const AUDIENCE_KEY = "auth_audience"; // "staff" | "client"

export { API_BASE };

// Token store. Staff and client portal both flow through here, distinguished by
// `audience` so the rest of the app can tell which session is active.
export const tokens = {
  access: () => localStorage.getItem(ACCESS_KEY) || "",
  refresh: () => localStorage.getItem(REFRESH_KEY) || "",
  audience: () => localStorage.getItem(AUDIENCE_KEY) || "staff",
  set: ({ accessToken, refreshToken, audience } = {}) => {
    if (accessToken != null) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken != null) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (audience != null) localStorage.setItem(AUDIENCE_KEY, audience);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(AUDIENCE_KEY);
  },
};

// Error that carries the HTTP status so callers/UI can branch on it
// (401 → login, 403 → hide action, 404 → not-found, 409/422 → explain — see
// FRONTEND_API.md §11). `body` is the parsed JSON envelope when present.
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// ── Single-flight token refresh ──────────────────────────────────────────────
// When the access token expires, many in-flight requests can 401 at once. We
// refresh exactly once and let them all await the same promise.
let refreshing = null;

async function doRefresh() {
  const refreshToken = tokens.refresh();
  if (!refreshToken) throw new ApiError("Session expired", 401);
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.status === false || !json.data?.accessToken) {
    tokens.clear();
    throw new ApiError(json.message || "Session expired", 401, json);
  }
  tokens.set({ accessToken: json.data.accessToken });
  return json.data.accessToken;
}

function refreshOnce() {
  if (!refreshing) refreshing = doRefresh().finally(() => (refreshing = null));
  return refreshing;
}

// ── Core request ─────────────────────────────────────────────────────────────
//
// Unwraps the success envelope and throws an ApiError on transport/business
// failure. Pass `auth:false` for the public auth endpoints, `raw:true` to get
// the Response back untouched (file streaming), and a `FormData` body for
// multipart uploads (the browser sets the boundary — we must NOT set
// Content-Type ourselves).
export async function api(
  path,
  { method = "GET", body, auth = true, raw = false, signal, headers: extraHeaders } = {},
) {
  const exec = async () => {
    const headers = {};
    const isForm = body instanceof FormData;
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    const token = tokens.access();
    if (auth && token) headers.Authorization = `Bearer ${token}`;
    // Caller-supplied headers (e.g. `x-admin-key` on firm provisioning) win over
    // the defaults above.
    if (extraHeaders) Object.assign(headers, extraHeaders);
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  };

  let res = await exec();

  // Expired access token → refresh once, then retry the original request once.
  if (res.status === 401 && auth && tokens.refresh()) {
    try {
      await refreshOnce();
      res = await exec();
    } catch {
      // refresh failed — fall through to the error handling below
    }
  }

  if (raw) return res;

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false || json?.error) {
    if (res.status === 401) tokens.clear();
    throw new ApiError(messageOf(json, res.status), res.status, json);
  }
  // Tolerant unwrap: documented success is { status:true, data }, but the
  // backend isn't fully uniform — fall back to the raw body if there's no
  // `data` envelope so a route that returns the object directly still works.
  return json && typeof json === "object" && "data" in json ? json.data : json;
}

// The backend isn't uniform about error shape: auth routes return
// { status:false, message }, while protected routes return
// { error: { message } }. Read whichever is present so the UI shows the real
// reason, not a generic "Request failed".
function messageOf(json, status) {
  return (
    json?.message ||
    json?.error?.message ||
    (typeof json?.error === "string" ? json.error : null) ||
    `Request failed (${status})`
  );
}

// List helper — appends defined query params and returns the paged object
// { data, page, limit, total, pages } (see FRONTEND_API.md §1 "Paginated lists").
export function apiList(path, params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    ),
  ).toString();
  return api(qs ? `${path}?${qs}` : path);
}
