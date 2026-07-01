// Per-firm localStorage namespacing — the seam that makes ALL app data
// org-scoped after sign-in, in one place instead of touching ~30 data stores.
//
// WHY: the app keeps its working data in localStorage (clients, leads, BOQs,
// quotes, schedules…). Without scoping, switching the firm you log into would
// show the previous firm's data. The backend already isolates each tenant by the
// firmId baked into the JWT; this mirrors that isolation for the local cache /
// offline-fallback layer so org A and org B never see each other's records.
//
// HOW: we wrap the Storage prototype so that, once a firm is active, every app
// key K is transparently stored under `firm:<ns>:K`. `<ns>` is the active firm's
// id (or slug) read from `last_org`, which login sets from the org picked on the
// sign-in screen. When NO firm is active (pre-login) it's a pure pass-through, so
// boot-time behaviour is unchanged.
//
// Cross-firm / auth / session keys are NEVER scoped (see DENY) — tokens and the
// org registry must be shared across firms, and the namespace itself is derived
// from `last_org`, so scoping it would be circular.
//
// The wrapper also remaps `key(i)` / `length` to a de-namespaced VIEW of just the
// active firm's keys, so the handful of stores that scan localStorage by key
// prefix (e.g. `leadActivity_*`, `quotes_*`) keep working and never observe
// another firm's entries.

const NS = "firm:"; // physical-key namespace prefix

// Keys that must stay global (shared across firms) — auth/session + the org
// registry the namespace is derived from. Everything else is firm-scoped.
const DENY = new Set([
  "auth_token",
  "refresh_token",
  "auth_audience",
  "client_auth_token",
  "active_client_id",
  "last_org",
  "org_directory",
  "org_accounts",
]);

export function installFirmScope() {
  if (typeof window === "undefined" || !window.localStorage) return;
  const proto = Object.getPrototypeOf(window.localStorage) || Storage.prototype;
  if (proto.__firmScoped) return; // idempotent
  proto.__firmScoped = true;

  const ls = window.localStorage;
  const origGet = proto.getItem;
  const origSet = proto.setItem;
  const origRemove = proto.removeItem;
  const origKey = proto.key;
  const lengthDesc = Object.getOwnPropertyDescriptor(proto, "length");
  const rawLength = () => lengthDesc.get.call(ls);

  // Active firm namespace, read straight from the (never-scoped) `last_org`
  // record so this stays free of recursion. Empty string ⇒ no firm ⇒ pass-through.
  const activeNs = () => {
    try {
      const raw = origGet.call(ls, "last_org");
      if (!raw) return "";
      const o = JSON.parse(raw);
      return String(o?.firmId || o?.slug || "").trim();
    } catch {
      return "";
    }
  };

  // Logical key → physical key. Pass-through when no firm is active, for DENY
  // keys, or for already-namespaced keys (defensive).
  const physical = (key) => {
    if (key == null) return key;
    const ns = activeNs();
    if (!ns || DENY.has(key) || key.startsWith(NS)) return key;
    return `${NS}${ns}:${key}`;
  };

  // The de-namespaced view of the current firm's keys (+ all unscoped keys).
  // Other firms' `firm:<other>:*` entries are hidden.
  const logicalKeys = () => {
    const ns = activeNs();
    const mine = ns ? `${NS}${ns}:` : null;
    const out = [];
    const n = rawLength();
    for (let i = 0; i < n; i++) {
      const k = origKey.call(ls, i);
      if (k == null) continue;
      if (k.startsWith(NS)) {
        if (mine && k.startsWith(mine)) out.push(k.slice(mine.length));
        // else: belongs to another firm (or no firm active) → hidden
      } else {
        out.push(k);
      }
    }
    return out;
  };

  // Only remap window.localStorage; leave sessionStorage (same prototype) alone.
  const scoped = function () {
    return this === ls;
  };

  proto.getItem = function (key) {
    return scoped.call(this)
      ? origGet.call(this, physical(key))
      : origGet.call(this, key);
  };
  proto.setItem = function (key, value) {
    return scoped.call(this)
      ? origSet.call(this, physical(key), value)
      : origSet.call(this, key, value);
  };
  proto.removeItem = function (key) {
    return scoped.call(this)
      ? origRemove.call(this, physical(key))
      : origRemove.call(this, key);
  };
  proto.key = function (i) {
    if (!scoped.call(this)) return origKey.call(this, i);
    const keys = logicalKeys();
    return i >= 0 && i < keys.length ? keys[i] : null;
  };
  Object.defineProperty(proto, "length", {
    configurable: true,
    get() {
      return scoped.call(this) ? logicalKeys().length : lengthDesc.get.call(this);
    },
  });
}

// Install on import so it beats any app code that touches localStorage.
installFirmScope();
