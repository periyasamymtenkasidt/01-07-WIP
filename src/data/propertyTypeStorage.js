// ── Global Property-Type Registry ─────────────────────────────────────────────
// Stores the master list of property types in localStorage so that additions
// made from Proposal Master are instantly available across all modules (Inquiry
// forms, Proposal forms, Convert-to-Client, etc.).
//
// The initial seed is the legacy PROPERTY_TYPES constant from helperData.  Any
// new types added via the "Add Type" modal in Proposal Master are appended here
// and persisted.  Consumers should call `getGlobalPropertyTypes()` instead of
// importing the old constant.

import { getPropertyTypes, putPropertyTypes } from "../api/masters";
import { tokens } from "../api/client";

const STORAGE_KEY = "globalPropertyTypes";

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore */
  }
};

// Canonical seed — matches the original export from helperData.jsx.
const SEED_TYPES = [
  "Luxury Villa",
  "Apartment",
  "Penthouse",
  "Independent House",
  "Duplex",
  "Studio Apartment",
  "Farm House",
  "Beach House",
];

/**
 * Return the full ordered list of property types.
 * First call in a session bootstraps from the seed if localStorage is empty.
 */
export const getGlobalPropertyTypes = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // corrupt — fall through
  }
  // Bootstrap
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_TYPES));
  return [...SEED_TYPES];
};

/**
 * Persist the full list (used after add/remove operations).
 */
export const saveGlobalPropertyTypes = (types) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
  // Backend write-through: push the whole list in the background.
  pushMaster(() => putPropertyTypes(types));
};

// Backend hydration: pull the server copy into the local cache. No-op when
// logged out; on any error or empty/invalid response it leaves the seeded
// localStorage untouched. This module has no change event, so none is fired.
// Writes localStorage directly (not via saveGlobalPropertyTypes) to avoid an
// echo PUT.
export async function hydratePropertyTypes() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getPropertyTypes();
  } catch (e) {
    console.warn("hydratePropertyTypes: failed to fetch property types", e);
    return;
  }
  // Tolerate bare array or { types: [...] } wrapper.
  const types = Array.isArray(data) ? data : data?.types;
  if (!Array.isArray(types) || types.length === 0) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

/**
 * Add one or more new types (case-insensitive duplicate check, trims spaces).
 * Returns the updated list.
 */
export const addPropertyTypes = (newTypes) => {
  const current = getGlobalPropertyTypes();
  const lowerSet = new Set(current.map((t) => t.trim().toLowerCase()));
  const added = [];
  for (const raw of newTypes) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (lowerSet.has(trimmed.toLowerCase())) continue;
    current.push(trimmed);
    lowerSet.add(trimmed.toLowerCase());
    added.push(trimmed);
  }
  if (added.length > 0) saveGlobalPropertyTypes(current);
  return { list: current, added };
};

/**
 * Remove a single property type globally.
 * Returns `{ success, list }`. Caller should do active-record check before
 * calling this.
 */
export const removePropertyTypeGlobally = (typeToRemove) => {
  const current = getGlobalPropertyTypes();
  const lower = typeToRemove.trim().toLowerCase();
  const next = current.filter((t) => t.trim().toLowerCase() !== lower);
  saveGlobalPropertyTypes(next);
  return { success: true, list: next };
};

/**
 * Check whether a property type is referenced by any active record in
 * localStorage (leads, quotes, clients).  Returns `true` if at least one
 * record uses it — deletion should be blocked.
 */
export const isPropertyTypeInUse = (propertyType) => {
  const lower = propertyType.trim().toLowerCase();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Skip non-data keys
    if (
      key === STORAGE_KEY ||
      key === "quoteMaster" ||
      key === "scheduleConfig" ||
      key === "termsConditions" ||
      key === "itemLibrary"
    )
      continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);

      // Array of records (leads, quotes, clients)
      if (Array.isArray(parsed)) {
        for (const rec of parsed) {
          if (
            typeof rec === "object" &&
            rec !== null &&
            (rec.propertyType || "").trim().toLowerCase() === lower
          ) {
            return true;
          }
          // Quotes store propertyType inside snapshots
          if (rec?.snapshot?.propertyType?.trim().toLowerCase() === lower)
            return true;
        }
      }
      // Single object record
      if (
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        parsed !== null
      ) {
        if ((parsed.propertyType || "").trim().toLowerCase() === lower)
          return true;
      }
    } catch {
      // skip corrupt
    }
  }
  return false;
};
