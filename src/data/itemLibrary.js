// Item Master / Rate Library. A catalog of reusable BOQ line items.
// Stored under `item_library` in localStorage; ships with a curated set
// of common interior fit-out items so the library is useful from day one.

// Schedule Master days mapping commented out — reserved for future use.
// import { getRoomDefaultDays } from "./scheduleConfig";

import { getItems, putItems } from "../api/masters";
import { tokens } from "../api/client";

const STORAGE_KEY = "item_library";

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore */
  }
};

const genId = () =>
  `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ── Default catalog ────────────────────────────────────────────────────────
// Categories use the same color keys as BOQ sections so insertion preserves
// visual grouping. Rates are mid-market reference figures — firms typically
// fine-tune these per project.
// Category-FREE work items. Each is a reusable work with its own unit, rate,
// days and materials. The room is chosen later in Proposal Master (Add Scope),
// not on the item. Material names line up with the Material Master so the rate
// build-up can price each work from live material rates.
export const DEFAULT_LIBRARY = [
  {
    description: "False Ceiling — gypsum board with cove groove",
    hsn: "9405", unit: "sqft", rate: 95, days: 4, gstPercent: 18,
    materials: [
      { name: "Gypsum Board", spec: "Saint-Gobain 12.5mm" },
      { name: "GI Framework", spec: "Channels + sections" },
      { name: "Putty & Paint", spec: "Asian / Dulux" },
    ],
    tags: ["ceiling", "gypsum"],
  },
  {
    description: "TV Unit — paneling with storage",
    hsn: "9403", unit: "sqft", rate: 1300, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Laminate", spec: "Greenply / Century" },
      { name: "Hardware", spec: "Hettich soft-close" },
    ],
    tags: ["tv unit", "living"],
  },
  {
    description: "Accent Wall Paneling — veneer / laminate",
    hsn: "4412", unit: "sqft", rate: 480, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 12mm base" },
      { name: "Veneer", spec: "Natural / Recon" },
      { name: "Putty & Paint", spec: "Asian / Dulux" },
    ],
    tags: ["accent", "wall", "panel"],
  },
  {
    description: "Cove / Profile Lighting",
    hsn: "9405", unit: "rmt", rate: 320, days: 2, gstPercent: 18,
    materials: [{ name: "LED Lighting", spec: "Philips / Wipro 24V" }],
    tags: ["lighting", "cove", "led"],
  },
  {
    description: "Crockery Unit — glass shutters + lighting",
    hsn: "9403", unit: "sqft", rate: 1400, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Toughened Glass", spec: "5mm clear" },
      { name: "LED Lighting", spec: "LED strip" },
      { name: "Hardware", spec: "Hafele" },
    ],
    tags: ["crockery", "dining"],
  },
  {
    description: "Modular Kitchen Base Unit",
    hsn: "9403", unit: "rmt", rate: 6500, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich soft-close" },
    ],
    tags: ["kitchen", "base", "modular"],
  },
  {
    description: "Modular Kitchen Wall Unit",
    hsn: "9403", unit: "rmt", rate: 4800, days: 5, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hafele lift-up" },
    ],
    tags: ["kitchen", "wall", "modular"],
  },
  {
    description: "Kitchen Counter — granite / quartz",
    hsn: "6802", unit: "rmt", rate: 1200, days: 2, gstPercent: 18,
    materials: [{ name: "Granite", spec: "20mm polished" }],
    tags: ["kitchen", "counter", "granite"],
  },
  {
    description: "Wardrobe — laminate, soft-close",
    hsn: "9403", unit: "sqft", rate: 1250, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich soft-close" },
      { name: "Mirror", spec: "5mm" },
    ],
    tags: ["wardrobe", "bedroom"],
  },
  {
    description: "Wardrobe — premium veneer finish",
    hsn: "9403", unit: "sqft", rate: 1750, days: 6, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWP 19mm" },
      { name: "Veneer", spec: "Natural + PU coat" },
      { name: "Hardware", spec: "Hafele soft-close" },
    ],
    tags: ["wardrobe", "premium", "bedroom"],
  },
  {
    description: "Bed Back Panel — upholstered",
    hsn: "9403", unit: "sqft", rate: 650, days: 4, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm base" },
      { name: "Upholstery", spec: "Foam + fabric" },
      { name: "Laminate", spec: "1mm" },
    ],
    tags: ["bed", "back panel", "bedroom"],
  },
  {
    description: "Dresser Unit — with mirror",
    hsn: "9403", unit: "sqft", rate: 900, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Mirror", spec: "5mm" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["dresser", "bedroom"],
  },
  {
    description: "Study / Work Desk — built-in",
    hsn: "9403", unit: "rmt", rate: 3500, days: 4, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "BWR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["desk", "study", "office"],
  },
  {
    description: "Shoe Rack — with bench top",
    hsn: "9403", unit: "sqft", rate: 950, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm matte" },
      { name: "Hardware", spec: "Hettich" },
    ],
    tags: ["shoe rack", "foyer"],
  },
  {
    description: "Bathroom Vanity — marine ply + counter",
    hsn: "9403", unit: "rmt", rate: 3200, days: 3, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "Marine ply" },
      { name: "Laminate", spec: "1mm" },
      { name: "Granite", spec: "20mm counter" },
    ],
    tags: ["vanity", "bath"],
  },
  {
    description: "Shower Glass Partition — 8mm toughened",
    hsn: "7610", unit: "sqft", rate: 580, days: 2, gstPercent: 18,
    materials: [{ name: "Toughened Glass", spec: "8mm + SS fittings" }],
    tags: ["shower", "partition", "bath"],
  },
  {
    description: "Foyer Console — with mirror",
    hsn: "9403", unit: "sqft", rate: 1100, days: 2, gstPercent: 18,
    materials: [
      { name: "Plywood", spec: "MR 18mm" },
      { name: "Laminate", spec: "1mm" },
      { name: "Mirror", spec: "Antique 6mm" },
    ],
    tags: ["console", "foyer"],
  },
  {
    description: "Wall Mirror Panel",
    hsn: "7009", unit: "sqft", rate: 650, days: 1, gstPercent: 18,
    materials: [{ name: "Mirror", spec: "Saint-Gobain 5mm" }],
    tags: ["mirror", "wall"],
  },
  {
    description: "Site Supervision & Project Management",
    hsn: "9954", unit: "ls", rate: 50000, days: 0, gstPercent: 18,
    materials: [],
    tags: ["service", "pm"],
  },
  {
    description: "Design & 3D Visualization",
    hsn: "9983", unit: "ls", rate: 35000, days: 0, gstPercent: 18,
    materials: [],
    tags: ["service", "design"],
  },
].map((it) => ({
  ...it,
  id: genId(),
  usage: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

// ── Category migration ─────────────────────────────────────────────────────
// `category` used to be a colour key; it's now a room/category NAME (from
// Master → Schedule). Map the old colour keys to room names on read so saved
// libraries self-heal. Names that are already room names pass through.
const LEGACY_CATEGORY_MAP = {
  orange: "Kitchen",
  blue: "Living Room",
  purple: "Master Bedroom",
  teal: "Bathrooms",
  amber: "Foyer",
  indigo: "Study",
  slate: "Utility",
  gray: "",
};

const normalizeCategory = (cat) =>
  cat in LEGACY_CATEGORY_MAP ? LEGACY_CATEGORY_MAP[cat] : cat || "";

// Normalize category, and seed a per-item `days` (schedule duration). The
// item's own value is used directly. The Schedule Master fallback (room
// category → default days) is commented out — reserved for future use.
const normalizeItem = (it) => {
  const category = normalizeCategory(it.category);
  // const defaultDays = getRoomDefaultDays(category);
  // const days =
  //   defaultDays !== "" && defaultDays != null ? defaultDays : (it.days ?? "");
  const days = it.days ?? "";
  let recipes = it.recipes;
  // Older rate build-ups initialized all three standard grades as exact
  // clones, so changing grade could never change the quote. Migrate only that
  // legacy default signature; genuinely configured recipes are untouched.
  if (recipes?.economy && recipes?.premium && recipes?.luxury) {
    const economy = JSON.stringify(recipes.economy);
    const premium = JSON.stringify(recipes.premium);
    const luxury = JSON.stringify(recipes.luxury);
    const legacyDefaults =
      economy === premium &&
      premium === luxury &&
      Number(recipes.premium.overheadPct) === 10 &&
      Number(recipes.premium.marginPct) === 20;
    if (legacyDefaults) {
      recipes = {
        ...recipes,
        economy: { ...recipes.economy, overheadPct: 5, marginPct: 10 },
        premium: { ...recipes.premium, overheadPct: 10, marginPct: 20 },
        luxury: { ...recipes.luxury, overheadPct: 15, marginPct: 30 },
      };
    }
  }
  return { ...it, category, days, recipes };
};

// ── Read / Write ──────────────────────────────────────────────────────────
export const listLibrary = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // A non-empty stored list is authoritative. An EMPTY array is treated as
      // "not seeded yet" and falls through to re-seed the defaults — otherwise a
      // one-time blank (an empty backend sync, a bulk delete, a migration) would
      // leave the library permanently empty, so "Pick from Library" shows nothing.
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeItem);
      }
    }
  } catch {
    // fall through
  }
  // First read (or recovered-from-empty) — seed defaults so the library is usable.
  const seeded = DEFAULT_LIBRARY.map(normalizeItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
};

export const saveLibrary = (items) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("itemLibraryChanged"));
  }
  // Backend write-through: push the whole collection in the background.
  pushMaster(() => putItems(items));
};

// Backend hydration: pull the server copy into the local cache, then fire the
// existing change event so listeners refresh. No-op when logged out; on any
// error or empty/invalid response it leaves the seeded localStorage untouched.
// Writes localStorage directly (not via saveLibrary) to avoid an echo PUT.
export async function hydrateItemLibrary() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getItems();
  } catch (e) {
    console.warn("hydrateItemLibrary: failed to fetch items", e);
    return;
  }
  // Tolerate bare array or { items: [...] } wrapper.
  const items = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items) || items.length === 0) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("itemLibraryChanged"));
  }
}

export const addLibraryItem = (item) => {
  const items = listLibrary();
  const next = {
    ...item,
    id: item.id || genId(),
    usage: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [next, ...items];
  saveLibrary(updated);
  return next;
};

export const updateLibraryItem = (id, changes) => {
  const items = listLibrary();
  const updated = items.map((it) =>
    it.id === id ? { ...it, ...changes, updatedAt: new Date().toISOString() } : it,
  );
  saveLibrary(updated);
};

export const deleteLibraryItem = (id) => {
  const items = listLibrary().filter((it) => it.id !== id);
  saveLibrary(items);
};

export const incrementUsage = (id) => {
  const items = listLibrary();
  const updated = items.map((it) =>
    it.id === id ? { ...it, usage: (it.usage || 0) + 1 } : it,
  );
  saveLibrary(updated);
};

export const resetLibrary = () => {
  localStorage.removeItem(STORAGE_KEY);
  return listLibrary();
};

// Convert a library record into a BOQ line-item shape so the editor can
// drop it straight into a section without rewiring fields. The `masterId`
// keeps a back-reference to the catalog item so the BOQ row can show a
// "Linked to Library" badge and offer compact rendering. Template
// dimensions (L/W/H/qty) flow through so the BOQ row starts pre-filled.
export const libraryToItem = (lib) => {
  const L = Number(lib.length) || 0;
  const B = Number(lib.breadth) || 0;
  const H = Number(lib.height) || 0;
  return {
    masterId: lib.id,
    description: lib.description || "",
    spec: lib.spec || "",
    hsn: lib.hsn || "",
    qty: Number(lib.qty) || 1,
    unit: lib.unit || "nos",
    rate: Number(lib.rate) || 0,
    gstPercent: Number(lib.gstPercent) || 18,
    discount: { type: "percent", value: 0 },
    dimensions: {
      enabled: L > 0 || B > 0 || H > 0,
      length: L,
      breadth: B,
      height: H,
      nos: 1,
    },
    materials: lib.materials ? JSON.parse(JSON.stringify(lib.materials)) : [],
  };
};

export const blankLibraryItem = () => ({
  description: "",
  spec: "",
  category: "",
  days: "",
  hsn: "",
  unit: "sqft",
  length: 0,
  breadth: 0,
  height: 0,
  qty: 0,
  rate: 0,
  gstPercent: 18,
  // Estimating coefficient: the assumed quantity for a package = carpet area ×
  // areaFactor (e.g. flooring 1.0, false ceiling 0.65, wall paint 3.5). For
  // count (nos) works it's used as the default count. Defaults to 1.
  areaFactor: 1,
  materials: [],
  tags: [],
});

// Area = L × W for area units, just L for length units. Used as a display
// helper in the form (read-only) and as a fallback when the user hasn't
// entered a separate Qty.
const AREA_UNITS = new Set(["sqft", "sqm"]);
const LENGTH_UNITS = new Set(["rmt", "mm"]);

export const computeLibraryItemArea = (item) => {
  const L = Number(item.length) || 0;
  const B = Number(item.breadth) || 0;
  if (L > 0 && B > 0) return L * B;
  if (AREA_UNITS.has(item.unit) && L > 0 && B > 0) return L * B;
  if (LENGTH_UNITS.has(item.unit) && L > 0) return L;
  return 0;
};

// Effective qty for amount calculation. User-entered qty takes priority so
// it can capture wastage / counts that differ from the raw L×W area
// (e.g. 224 sqft area but 246.4 sqft ordered with 10% wastage). Falls back
// to area when qty isn't entered.
export const computeLibraryItemQty = (item) => {
  const userQty = Number(item.qty) || 0;
  if (userQty > 0) return userQty;
  return computeLibraryItemArea(item);
};

export const computeLibraryItemAmount = (item) =>
  computeLibraryItemQty(item) * (Number(item.rate) || 0);
