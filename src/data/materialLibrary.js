// Material Master Storage
// Manages the catalog of raw materials, HSN codes, and base pricing.
// Persisted in localStorage under `material_library`.

import { getMaterials, putMaterials } from "../api/masters";
import { tokens } from "../api/client";

const STORAGE_KEY = "material_library";

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore */
  }
};

// Interior-finish materials — the price source for the work rate build-ups.
// Names line up with the Item Master work materials so recipes auto-seed.
export const DEFAULT_MATERIALS = [
  { name: "Plywood", specifications: "BWP / MR 18–19mm (Greenply / Century)", rate: 85, unit: "sqft", hsn: "4412", gstPercent: 18 },
  { name: "Laminate", specifications: "1mm decorative (Greenply / Century)", rate: 45, unit: "sqft", hsn: "4823", gstPercent: 18 },
  { name: "Veneer", specifications: "Natural / reconstituted veneer", rate: 140, unit: "sqft", hsn: "4408", gstPercent: 18 },
  { name: "Gypsum Board", specifications: "Saint-Gobain 12.5mm", rate: 60, unit: "sqft", hsn: "6809", gstPercent: 18 },
  { name: "GI Framework", specifications: "GI channels + sections for false ceiling", rate: 40, unit: "sqft", hsn: "7308", gstPercent: 18 },
  { name: "Putty & Paint", specifications: "Putty + 2 coats emulsion (Asian / Dulux)", rate: 18, unit: "sqft", hsn: "3209", gstPercent: 18 },
  { name: "Hardware", specifications: "Soft-close hinges / channels (Hettich / Hafele)", rate: 450, unit: "nos", hsn: "8302", gstPercent: 18 },
  { name: "LED Lighting", specifications: "Profile / strip LED 24V (Philips / Wipro)", rate: 120, unit: "rmt", hsn: "9405", gstPercent: 18 },
  { name: "Granite", specifications: "20mm polished granite / quartz slab", rate: 220, unit: "sqft", hsn: "6802", gstPercent: 18 },
  { name: "Toughened Glass", specifications: "8mm toughened + SS fittings", rate: 95, unit: "sqft", hsn: "7005", gstPercent: 18 },
  { name: "Mirror", specifications: "Saint-Gobain 5mm mirror", rate: 85, unit: "sqft", hsn: "7009", gstPercent: 18 },
  { name: "Upholstery", specifications: "32-density foam + premium fabric", rate: 160, unit: "sqft", hsn: "9404", gstPercent: 18 }
].map((item, idx) => ({
  ...item,
  id: `mat_default_${idx}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
}));

export const listMaterials = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to parse material library", e);
  }
  
  // Seed defaults on first load
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_MATERIALS));
  return DEFAULT_MATERIALS;
};

export const saveMaterials = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // Backend write-through: push the whole collection in the background.
  pushMaster(() => putMaterials(items));
};

// Backend hydration: pull the server copy into the local cache. No-op when
// logged out; on any error or empty/invalid response it leaves the seeded
// localStorage untouched. This module has no change event, so none is fired.
// Writes localStorage directly (not via saveMaterials) to avoid an echo PUT.
export async function hydrateMaterialLibrary() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getMaterials();
  } catch (e) {
    console.warn("hydrateMaterialLibrary: failed to fetch materials", e);
    return;
  }
  // Tolerate bare array or { materials: [...] } wrapper.
  const items = Array.isArray(data) ? data : data?.materials;
  if (!Array.isArray(items) || items.length === 0) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const resetMaterials = () => {
  localStorage.removeItem(STORAGE_KEY);
  return listMaterials();
};
