// Preset templates and helpers for the Quick Quote / Send Proposal flows.
// The hardcoded DEFAULT_PRESETS below are the factory baseline — actual reads
// go through getMaster()/getPresets() which honour user overrides saved in
// localStorage from the Settings → Proposal Master page.

import { getRoomDefaultDays } from "./scheduleConfig";
import { toSingleSize } from "../utils/sizeRangeValidation";
import { normalizeScopeItem } from "../utils/scopeNaming";
import { DEFAULT_LIBRARY, listLibrary } from "./itemLibrary";
import {
  parseBaseArea,
  getNormalizedAllocations,
  estimateScopeItems,
} from "./scopeEstimator";

import {
  computeRecipe,
  materialsById as buildMaterialsById,
  recipeToMaterials,
} from "./rateBuildup";
import { listMaterials } from "./materialLibrary";
import { getQuotePresets, putQuotePresets } from "../api/masters";
import { tokens } from "../api/client";

export const GST_RATE = 18;

const COMMON_INCLUSIONS = [];

const COMMON_EXCLUSIONS = [];

// ── Seed scope-of-work rows from the Item Master ───────────────────────────
// Factory presets used to carry one hand-typed, lump-sum row per room (e.g.
// "False ceiling, accent wall, TV unit, lighting" = ₹80,000 flat). That data
// had no link back to the Item Master and no real quantity — just a flat ₹
// figure — so grade switching / rate build-ups / size-range changes couldn't
// touch it.
//
// `scopeRow` instead looks up a real catalog item by its exact `description`
// and builds a proper line item — masterId, unit, rate and materials all
// sourced from the Item Master, the same shape a user gets from "Add Scope" →
// pick from library. Its quantity is NOT hand-typed either. The Smart
// Estimator divides each room's allocated sqft evenly among its area-based
// scope rows; `areaFactor` remains available for non-area units.
// `buildScope` runs the same room-allocation split the live "Auto
// Calculations" toggle uses (`scopeEstimator.js`) to turn that factor into a
// real qty/amount from the preset's size range, so every preset ships with
// Smart Estimator already on.
//
// The rate defaults to the **economy** grade's recipe-computed rate so the
// scope card always shows a live rate-build-up value rather than the static
// catalog number.  When the user switches grades or saves a rate build-up,
// `mapScopeItemsToGrade` recomputes the rate from the selected grade's recipe.

// Lazy lookup: uses `listLibrary()` which returns items with seeded grade
// recipes (via `normalizeItem`), so `economyRateFor` can compute a real
// recipe-based rate instead of falling back to the static catalog number.
// A fresh Map is built on every call so it always reflects the latest
// Item Master state (e.g. after a rate build-up save).
const getLibByName = () => {
  const map = new Map();
  for (const it of listLibrary()) {
    map.set(it.description, it);
  }
  return map;
};

// Compute the economy grade rate from the item's recipes. Falls back to the
// static catalog rate when no recipe exists.
const economyRateFor = (lib) => {
  const matLookup = buildMaterialsById(listMaterials());
  const recipe = lib.recipes?.economy;
  if (!recipe) return Number(lib.rate) || 0;
  const result = computeRecipe(recipe, matLookup);
  return Math.round(result.rate || 0) || Number(lib.rate) || 0;
};

// Build materials from the economy recipe so the scope row carries real
// recipe-linked materials instead of the generic catalog specs.
const economyMaterialsFor = (lib) => {
  const matLookup = buildMaterialsById(listMaterials());
  const recipe = lib.recipes?.economy;
  if (!recipe) return (lib.materials || []).map((m) => ({ ...m }));
  return recipeToMaterials(recipe, matLookup);
};
const scopeRow = (area, itemDescription, areaFactor = 1) => {
  const libByName = getLibByName();
  let lib = libByName.get(itemDescription);
  if (!lib) {
    lib = DEFAULT_LIBRARY.find((it) => it.description === itemDescription);
  }
  if (!lib) {
    return {
      area,
      heading: area,
      itemName: itemDescription,
      description: "Custom specification",
      masterId: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      unit: "nos",
      areaFactor,
      rate: 1000,
      days: 2,
      defaultGrade: "economy",
      grade: "economy",
      materials: [],
    };
  }
  return {
    area,
    heading: area,
    itemName: lib.description,
    description: lib.spec || "",
    masterId: lib.id,
    unit: lib.unit,
    areaFactor,
    rate: economyRateFor(lib),
    days: lib.days || 0,
    recipes: lib.recipes || undefined,
    defaultGrade: lib.defaultGrade || "economy",
    grade: "economy",
    materials: economyMaterialsFor(lib),
  };
};

// `rows` is a list of [itemDescription, areaFactor] tuples for one room.
const room = (area, rows) => rows.map(([desc, factor]) => scopeRow(area, desc, factor));

// Split `sizeRange`'s sqft across `rawItems`' rooms (default Smart Estimator
// allocation %) and derive each row's qty/amount from its room's share.
// Returns the estimator fields (`totalArea`, `roomAllocations`) alongside the
// computed `scopeItems` so the preset's Smart Estimator panel shows the exact
// split that produced those quantities, instead of recomputing blind later.
const seedConfig = (sizeRange, rawItems) => {
  const totalArea = parseBaseArea(sizeRange) || 1000;
  const roomAllocations = getNormalizedAllocations(rawItems, {});
  return {
    totalArea,
    roomAllocations,
    scopeItems: estimateScopeItems(rawItems, totalArea, roomAllocations),
  };
};

// Extra scope works seeded from the expanded static Item Master, appended to
// every residential preset so the Proposal Master scope-of-work reflects the
// item master catalog. They merge into each preset's existing rooms (every
// preset has Living Room / Kitchen / Master Bedroom), so no orphan rooms.
const EXTRA_RESIDENTIAL_SCOPE = [
  ...room("Living Room", [
    ["POP Cornice & Molding", 0.5],
    ["Wall Cladding — natural stone veneer", 0.1],
  ]),
  ...room("Kitchen", [["Kitchen Tall Unit — pantry storage", 0.2]]),
  ...room("Master Bedroom", [
    ["Loft / Overhead Storage Unit", 0.15],
    ["Wallpaper — premium textured", 0.2],
  ]),
];

// Per-room item lists as [itemDescription, areaFactor] tuples. Area-based
// works share the room sqft evenly; the factor remains useful for count and
// length units. `buildScope` turns these into real qty/amount once a size
// range is known.
const ONE_BHK_RAW = [
  ...room("Living Room", [
    ["False Ceiling — gypsum board with cove groove", 0.65],
    ["TV Unit — paneling with storage", 0.12],
    ["Accent Wall Paneling — veneer / laminate", 0.15],
    ["Cove / Profile Lighting", 0.5],
  ]),
  ...room("Kitchen", [
    ["Modular Kitchen Base Unit", 0.35],
    ["Modular Kitchen Wall Unit", 0.28],
    ["Kitchen Counter — granite / quartz", 0.35],
  ]),
  ...room("Master Bedroom", [
    ["Wardrobe — laminate, soft-close", 0.18],
    ["Bed Back Panel — upholstered", 0.1],
  ]),
  ...room("Bathrooms", [
    ["Bathroom Vanity — marine ply + counter", 0.18],
    ["Shower Glass Partition — 8mm toughened", 0.35],
    ["Wall Mirror Panel", 0.1],
  ]),
  ...EXTRA_RESIDENTIAL_SCOPE,
];

const TWO_BHK_RAW = [
  ...room("Living Room", [
    ["False Ceiling — gypsum board with cove groove", 0.65],
    ["TV Unit — paneling with storage", 0.12],
    ["Accent Wall Paneling — veneer / laminate", 0.15],
    ["Crockery Unit — glass shutters + lighting", 0.15],
    ["Cove / Profile Lighting", 0.5],
  ]),
  ...room("Kitchen", [
    ["Modular Kitchen Base Unit", 0.35],
    ["Modular Kitchen Wall Unit", 0.28],
    ["Kitchen Counter — granite / quartz", 0.35],
  ]),
  ...room("Master Bedroom", [
    ["Wardrobe — laminate, soft-close", 0.18],
    ["Bed Back Panel — upholstered", 0.1],
    ["Dresser Unit — with mirror", 0.08],
  ]),
  ...room("Bedroom 2", [
    ["Wardrobe — laminate, soft-close", 0.18],
    ["Study / Work Desk — built-in", 0.25],
  ]),
  ...room("Bathrooms", [
    ["Bathroom Vanity — marine ply + counter", 0.18],
    ["Shower Glass Partition — 8mm toughened", 0.35],
    ["Wall Mirror Panel", 0.1],
  ]),
  ...room("Foyer", [
    ["Shoe Rack — with bench top", 0.2],
    ["Foyer Console — with mirror", 0.18],
  ]),
  ...EXTRA_RESIDENTIAL_SCOPE,
];

const THREE_BHK_RAW = [
  ...room("Living Room", [
    ["False Ceiling — gypsum board with cove groove", 0.65],
    ["TV Unit — paneling with storage", 0.12],
    ["Accent Wall Paneling — veneer / laminate", 0.15],
    ["Crockery Unit — glass shutters + lighting", 0.15],
    ["Cove / Profile Lighting", 0.5],
  ]),
  ...room("Kitchen", [
    ["Modular Kitchen Base Unit", 0.35],
    ["Modular Kitchen Wall Unit", 0.28],
    ["Kitchen Counter — granite / quartz", 0.35],
  ]),
  ...room("Master Bedroom", [
    ["Wardrobe — premium veneer finish", 0.22],
    ["Bed Back Panel — upholstered", 0.1],
    ["Dresser Unit — with mirror", 0.08],
    ["Study / Work Desk — built-in", 0.25],
  ]),
  ...room("Bedroom 2", [
    ["Wardrobe — laminate, soft-close", 0.18],
    ["Bed Back Panel — upholstered", 0.1],
    ["Study / Work Desk — built-in", 0.25],
  ]),
  ...room("Bedroom 3", [
    ["Wardrobe — laminate, soft-close", 0.18],
    ["Study / Work Desk — built-in", 0.25],
  ]),
  ...room("Bathrooms", [
    ["Bathroom Vanity — marine ply + counter", 0.18],
    ["Shower Glass Partition — 8mm toughened", 0.35],
    ["Wall Mirror Panel", 0.1],
  ]),
  ...room("Foyer", [
    ["Shoe Rack — with bench top", 0.2],
    ["Foyer Console — with mirror", 0.18],
    ["Wall Mirror Panel", 0.1],
  ]),
  ...EXTRA_RESIDENTIAL_SCOPE,
];

const VILLA_RAW = [
  ...room("Living Room", [
    ["False Ceiling — gypsum board with cove groove", 0.65],
    ["TV Unit — paneling with storage", 0.12],
    ["Accent Wall Paneling — veneer / laminate", 0.15],
    ["Cove / Profile Lighting", 0.5],
  ]),
  ...room("Dining", [
    ["Crockery Unit — glass shutters + lighting", 0.15],
    ["Accent Wall Paneling — veneer / laminate", 0.15],
    ["Cove / Profile Lighting", 0.5],
  ]),
  ...room("Kitchen", [
    ["Modular Kitchen Base Unit", 0.35],
    ["Modular Kitchen Wall Unit", 0.28],
    ["Kitchen Counter — granite / quartz", 0.35],
  ]),
  ...room("Master Bedroom", [
    ["Wardrobe — premium veneer finish", 0.22],
    ["Bed Back Panel — upholstered", 0.1],
    ["Dresser Unit — with mirror", 0.08],
    ["TV Unit — paneling with storage", 0.06],
  ]),
  ...room("Bedroom 2", [
    ["Wardrobe — laminate, soft-close", 0.18],
    ["Bed Back Panel — upholstered", 0.1],
    ["Study / Work Desk — built-in", 0.25],
  ]),
  ...room("Study", [
    ["Study / Work Desk — built-in", 0.25],
    ["Wardrobe — laminate, soft-close", 0.1],
  ]),
  ...room("Bathrooms", [
    ["Bathroom Vanity — marine ply + counter", 0.18],
    ["Shower Glass Partition — 8mm toughened", 0.35],
    ["Wall Mirror Panel", 0.1],
  ]),
  ...room("Staircase", [
    ["Accent Wall Paneling — veneer / laminate", 0.15],
    ["Cove / Profile Lighting", 0.5],
  ]),
  ...EXTRA_RESIDENTIAL_SCOPE,
];

export const DEFAULT_PRESETS = {
  "1BHK": {
    label: "1 BHK Apartment",
    propertyType: "Apartment",
    propertyTypes: ["Apartment", "Studio Apartment"],
    sizeRange: "525",
    enableFormulaEstimator: true,
    ...seedConfig("525", ONE_BHK_RAW),
    inclusions: COMMON_INCLUSIONS,
    exclusions: COMMON_EXCLUSIONS,
  },
  "2BHK": {
    label: "2 BHK Apartment",
    propertyType: "Apartment",
    propertyTypes: ["Apartment", "Penthouse", "Duplex"],
    sizeRange: "950",
    enableFormulaEstimator: true,
    ...seedConfig("950", TWO_BHK_RAW),
    inclusions: COMMON_INCLUSIONS,
    exclusions: COMMON_EXCLUSIONS,
  },
  "3BHK": {
    label: "3 BHK Apartment",
    propertyType: "Apartment",
    propertyTypes: ["Apartment", "Penthouse", "Duplex", "Independent House"],
    sizeRange: "1400",
    enableFormulaEstimator: true,
    ...seedConfig("1400", THREE_BHK_RAW),
    inclusions: COMMON_INCLUSIONS,
    exclusions: COMMON_EXCLUSIONS,
  },
  "Villa": {
    label: "Villa / Independent House",
    propertyType: "Independent House",
    propertyTypes: [
      "Luxury Villa",
      "Independent House",
      "Farm House",
      "Beach House",
    ],
    sizeRange: "2400",
    enableFormulaEstimator: true,
    ...seedConfig("2400", VILLA_RAW),
    inclusions: COMMON_INCLUSIONS,
    exclusions: COMMON_EXCLUSIONS,
  },
};

// ── Master read/write ─────────────────────────────────────────────────────
// Settings → Proposal Master writes here. Every consumer (QuoteModal, inquiry
// forms, etc.) reads through getPresets()/getPreset() so master edits flow
// into new proposals immediately, while existing saved quotes keep their
// own snapshot.

const MASTER_KEY = "quoteMaster";

// ── Configurations-based normalisation ────────────────────────────────────
// Each preset now stores a `configurations` array. Each entry in that array
// represents one property-type-specific configuration with its own scope,
// inclusions, exclusions and sizeRange.
//
// Old flat format (pre-migration):
//   { propertyType, propertyTypes, propertyTypeMultipliers, sizeRange,
//     scopeItems, inclusions, exclusions }
//
// New format:
//   { label, configurations: [
//       { propertyType, sizeRange, scopeItems, inclusions, exclusions },
//       ...
//     ]
//   }
//
// `normalizePreset` auto-migrates old flat presets into the new shape so
// existing localStorage data keeps working seamlessly.

// Legacy scope `area` names → canonical Master → Schedule categories. Lets old
// saved presets self-heal to the controlled vocabulary on read, without losing
// any custom presets or quote wording.
const LEGACY_AREA_MAP = {
  "Living + Dining": "Living Room",
  "Foyer & Living": "Living Room",
  "Formal & Family Dining": "Dining",
  "Kitchen + Utility": "Kitchen",
  "Second Bedroom": "Bedroom 2",
  "Third Bedroom / Kids": "Bedroom 3",
  "Bedrooms (×2)": "Bedroom 2",
  "Master Bedroom Suite": "Master Bedroom",
  "Home Office / Study": "Study",
  Bathroom: "Bathrooms",
  "Bathrooms (×2)": "Bathrooms",
  "Bathrooms (×3)": "Bathrooms",
  "Bathrooms (×4)": "Bathrooms",
  "Foyer & Passage": "Foyer",
  "Staircase & Common Areas": "Staircase",
};

// Remap a scope item to the canonical category, clone materials, and backfill
// `days` from the category allotment only when the field was never set.
const mapScopeItem = (s) => {
  if (!s) return s;
  const area = LEGACY_AREA_MAP[s.area] || s.area;
  const next = {
    ...s,
    area,
    materials: s.materials ? s.materials.map((m) => ({ ...m })) : [],
  };
  if (next.days === undefined) next.days = getRoomDefaultDays(area);
  return normalizeScopeItem(next);
};

const normalizePreset = (p) => {
  if (!p) return p;
  let next = { ...p };

  // Already migrated — just ensure every config has all fields.
  if (Array.isArray(next.configurations) && next.configurations.length > 0) {
    next.configurations = next.configurations.map((c) => ({
      ...c,
      propertyType: c.propertyType || "",
      sizeRange: toSingleSize(c.sizeRange ?? next.sizeRange ?? ""),
      scopeItems: (c.scopeItems || []).map(mapScopeItem),
      inclusions: c.inclusions || [],
      exclusions: c.exclusions || [],
    }));
    // Remove legacy top-level fields after migration
    delete next.propertyType;
    delete next.propertyTypes;
    delete next.propertyTypeMultipliers;
    // Keep label at preset level
    next.label = next.label || "";
    return next;
  }

  // ── Migrate old flat format → configurations[] ──────────────────────
  const types = Array.isArray(next.propertyTypes) && next.propertyTypes.length > 0
    ? next.propertyTypes
    : next.propertyType
      ? [next.propertyType]
      : ["Apartment"];

  const sharedScope = next.scopeItems || [];
  const sharedInclusions = next.inclusions || [];
  const sharedExclusions = next.exclusions || [];
  const sharedSize = next.sizeRange || "";

  next.configurations = types.map((t) => ({
    propertyType: t,
    grade: next.grade || "economy",
    enableFormulaEstimator: next.enableFormulaEstimator ?? false,
    totalArea: next.totalArea,
    roomAllocations: next.roomAllocations || {},
    sizeRange: toSingleSize(sharedSize),
    scopeItems: sharedScope.map(mapScopeItem),
    inclusions: [...sharedInclusions],
    exclusions: [...sharedExclusions],
  }));

  // Clean up legacy top-level fields
  delete next.propertyType;
  delete next.propertyTypes;
  delete next.propertyTypeMultipliers;
  delete next.sizeRange;
  delete next.scopeItems;
  delete next.inclusions;
  delete next.exclusions;
  next.label = next.label || "";
  return next;
};

const normalizeMaster = (master) => {
  const out = {};
  for (const k of Object.keys(master || {})) {
    out[k] = normalizePreset(master[k]);
  }
  return out;
};

// ── One-time migration: drop legacy static scope, reseed from Item Master ──
// Presets saved before the Item Master seed (see DEFAULT_PRESETS above) carry
// scope rows with no `masterId` — one hand-typed, lump-sum line per room that
// can never be touched by grade switching or rate build-ups. Any config whose
// scope is entirely unlinked like that is still on factory data the user
// never customized, so it's safe to delete and replace wholesale with the
// matching Item-Master-linked seed. A config gets left alone the moment a
// single row carries a `masterId` (added via library / grade mapping), since
// that signals real, user-driven scope work has happened on it.
const SCOPE_SEED_VERSION_KEY = "quoteMasterScopeSeedVersion";
// v1: seeded scope from the Item Master with hand-picked fixed quantities.
// v2: quantities now come from the Smart Estimator's room-allocation split
// instead of a fixed number, so bump the version to re-run the reseed once
// more for v1 users.
// v3: expanded the Item Master catalog and seeded the extra works (POP cornice,
// wall cladding, tall unit, loft storage, wallpaper) into every preset — bump
// again so factory presets pick up the new scope-of-work.
const SCOPE_SEED_VERSION = "3";
let normalizedDefaultsCache = null;
const getNormalizedDefaults = () => {
  if (!normalizedDefaultsCache) {
    normalizedDefaultsCache = normalizeMaster(DEFAULT_PRESETS);
  }
  return normalizedDefaultsCache;
};

const reseedStaticScopeFromItemMaster = (master) => {
  if (localStorage.getItem(SCOPE_SEED_VERSION_KEY) === SCOPE_SEED_VERSION) {
    return master;
  }
  const defaults = getNormalizedDefaults();
  const next = { ...master };
  for (const key of Object.keys(next)) {
    const defaultPreset = defaults[key];
    if (!defaultPreset) continue; // user-created preset — nothing to reseed from
    const configs = (next[key].configurations || []).map((cfg) => {
      const isLegacyStatic =
        (cfg.scopeItems || []).length > 0 &&
        cfg.scopeItems.every((s) => !s.masterId);
      if (!isLegacyStatic) return cfg;
      const seedCfg =
        defaultPreset.configurations.find((c) => c.propertyType === cfg.propertyType) ||
        defaultPreset.configurations[0];
      return {
        ...cfg,
        enableFormulaEstimator: seedCfg?.enableFormulaEstimator ?? cfg.enableFormulaEstimator,
        totalArea: seedCfg?.totalArea ?? cfg.totalArea,
        roomAllocations: seedCfg?.roomAllocations ?? cfg.roomAllocations,
        scopeItems: (seedCfg?.scopeItems || []).map((s) => ({
          ...s,
          materials: (s.materials || []).map((m) => ({ ...m })),
        })),
      };
    });
    next[key] = { ...next[key], configurations: configs };
  }
  localStorage.setItem(SCOPE_SEED_VERSION_KEY, SCOPE_SEED_VERSION);
  return next;
};

export const getMaster = () => {
  try {
    const raw = localStorage.getItem(MASTER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const normalized = reseedStaticScopeFromItemMaster(normalizeMaster(parsed));
        localStorage.setItem(MASTER_KEY, JSON.stringify(normalized));
        return normalized;
      }
    }
  } catch {
    // fall through to defaults
  }
  const normalizedDefault = normalizeMaster(DEFAULT_PRESETS);
  localStorage.setItem(MASTER_KEY, JSON.stringify(normalizedDefault));
  localStorage.setItem(SCOPE_SEED_VERSION_KEY, SCOPE_SEED_VERSION);
  return normalizedDefault;
};

export const saveMaster = (master) => {
  localStorage.setItem(MASTER_KEY, JSON.stringify(master));
  // Backend write-through: push in the background; a failed PUT must never
  // break the optimistic local write, so swallow every error.
  try {
    Promise.resolve(putQuotePresets({ presets: master })).catch(() => {});
  } catch {
    /* ignore */
  }
};

export const resetMaster = () => {
  localStorage.removeItem(MASTER_KEY);
};

// Backend hydration: pull the server copy into the local cache after login.
// No-op when logged out; on any error or empty/invalid response it leaves the
// seeded localStorage untouched. Writes localStorage directly (not via
// saveMaster) to avoid an echo PUT back to the server.
export async function hydrateQuotePresets() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getQuotePresets();
  } catch (e) {
    console.warn("hydrateQuotePresets: failed to fetch quote presets", e);
    return;
  }
  // Tolerate a bare presets object or a { presets: {...} } wrapper.
  const presets = data?.presets ?? data;
  if (!presets || typeof presets !== "object" || Array.isArray(presets)) return;
  if (Object.keys(presets).length === 0) return;
  const normalized = normalizeMaster(presets);
  localStorage.setItem(MASTER_KEY, JSON.stringify(normalized));
}

export const getPresets = () => getMaster();
export const getPresetKeys = () => Object.keys(getMaster());
export const getPreset = (key) => getMaster()[key];

// ── Configuration helpers ─────────────────────────────────────────────────
// Return the list of property types available under a given preset key.
export const getPropertyTypesForPreset = (key) => {
  const preset = getPreset(key);
  if (!preset) return [];
  return (preset.configurations || []).map((c) => c.propertyType);
};

// Return the specific configuration for a preset + property type combo.
// Falls back to the first configuration if the type isn't found.
export const getConfigForType = (key, propertyType) => {
  const preset = getPreset(key);
  if (!preset) return null;
  const configs = preset.configurations || [];
  return configs.find((c) => c.propertyType === propertyType) || configs[0] || null;
};

// Total scope duration (working days) for a preset + property type — the sum
// of every room's `days`. Used to seed a default possession/completion date.
export const getPresetTotalDays = (key, propertyType) => {
  const cfg = getConfigForType(key, propertyType);
  return (cfg?.scopeItems || []).reduce((s, it) => s + (Number(it.days) || 0), 0);
};

// Backwards-compat alias — some callers import QUOTE_PRESETS directly. New
// code should prefer getPresets()/getPreset().
export const QUOTE_PRESETS = DEFAULT_PRESETS;
export const PRESET_KEYS = Object.keys(DEFAULT_PRESETS);

export const sumScope = (items) =>
  items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

export const computeTotals = (items, gstRate = GST_RATE) => {
  const subtotal = sumScope(items);
  const gst = Math.round((subtotal * gstRate) / 100);
  return { subtotal, gst, grandTotal: subtotal + gst };
};

// Derive a tiered list of investment ranges from a preset's baseline
// (in rupees). Bands move outward from the baseline so the user can
// place themselves on the Budget → Bespoke continuum without typing
// any numbers. Returned strings are stable so they survive as the
// saved value on the lead record.
const fmtLakhs = (lakhs) => {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)}Cr`;
  if (lakhs >= 1) return `₹${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)}L`;
  // Below ₹1 lakh — show thousands / rupees instead of rounding to "₹0L".
  const rupees = Math.round(lakhs * 100000);
  return rupees >= 1000
    ? `₹${Math.round(rupees / 1000)}K`
    : `₹${rupees.toLocaleString("en-IN")}`;
};

export const generateInvestmentBands = (baselineRupees) => {
  if (!baselineRupees || baselineRupees <= 0) return [];
  const B = baselineRupees / 100000;
  return [
    `${fmtLakhs(B * 0.8)} – ${fmtLakhs(B * 1.0)}`,
    `${fmtLakhs(B * 1.0)} – ${fmtLakhs(B * 1.3)}`,
    `${fmtLakhs(B * 1.3)} – ${fmtLakhs(B * 1.7)}`,
    `${fmtLakhs(B * 1.7)} – ${fmtLakhs(B * 2.2)}`,
    `${fmtLakhs(B * 2.2)}+`,
  ];
};

// All quote IDs across all parents share the same yearly counter so the IDs
// stay globally unique. The counter is the count of `quotes_*` localStorage
// records that already exist.
const countAllQuotes = () => {
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("quotes_")) continue;
    try {
      n += JSON.parse(localStorage.getItem(key) || "[]").length;
    } catch {
      // ignore corrupt entries
    }
  }
  return n;
};

export const generateQuoteId = () =>
  `QT-${new Date().getFullYear()}-${String(countAllQuotes() + 1).padStart(3, "0")}`;

const storageKey = (parentId) => `quotes_${parentId}`;

// Every Send/Resend writes a brand-new full quote snapshot (own scope items,
// materials, recipes…). Without a cap these histories grow without bound and
// eventually blow the browser's ~5MB localStorage quota, which surfaces to
// the user as "Could not send the quote" on a perfectly valid send. Keep
// only the most recent entries per parent/lead.
const MAX_QUOTES_PER_PARENT = 15;
const MAX_DOCUMENTS_PER_LEAD = 15;

// If a write fails because storage is already full (most likely from
// previously-unbounded quote/document history), prune every quotes_*/
// leadDocuments_* key down to a handful of entries and retry once instead of
// failing the send outright.
const setItemWithQuotaGuard = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (err?.name !== "QuotaExceededError") throw err;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !(k.startsWith("quotes_") || k.startsWith("leadDocuments_"))) continue;
      try {
        const list = JSON.parse(localStorage.getItem(k) || "[]");
        if (Array.isArray(list) && list.length > 3) {
          localStorage.setItem(k, JSON.stringify(list.slice(0, 3)));
        }
      } catch {
        localStorage.removeItem(k);
      }
    }
    localStorage.setItem(key, value);
  }
};

export const getQuotesForParent = (parentId) => {
  if (!parentId) return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey(parentId)) || "[]");
  } catch {
    return [];
  }
};

export const saveQuote = (parentId, quote) => {
  const list = getQuotesForParent(parentId);
  const next = [
    quote,
    ...list.filter((q) => q.quoteId !== quote.quoteId),
  ].slice(0, MAX_QUOTES_PER_PARENT);
  setItemWithQuotaGuard(storageKey(parentId), JSON.stringify(next));
  return next;
};

// Documents are auto-saved snapshots of any quote that gets emailed. They
// power the "Documents" card on the Lead detail view so the user has a
// permanent record of what was sent.
const documentsKey = (leadId) => `leadDocuments_${leadId}`;

export const getDocumentsForLead = (leadId) => {
  if (!leadId) return [];
  try {
    return JSON.parse(localStorage.getItem(documentsKey(leadId)) || "[]");
  } catch {
    return [];
  }
};

export const saveQuoteDocument = (leadId, quote) => {
  if (!leadId) return [];
  const list = getDocumentsForLead(leadId);
  const rev = list.length + 1;
  const sentAt = quote.sentAt || new Date().toISOString();
  const dateStr = new Date(sentAt).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(/ /g, "-");
  const recipientSlug = (quote.recipientName || "Quote").replace(/\s+/g, "_");
  const entry = {
    docId: `${quote.quoteId}-${Date.now()}`,
    quoteId: quote.quoteId,
    fileName: `${quote.quoteId}_v${rev}_${recipientSlug}_${dateStr}.pdf`,
    sentTo: quote.recipientEmail,
    sentAt,
    grandTotal: quote.grandTotal,
    snapshot: quote,
  };
  const next = [entry, ...list].slice(0, MAX_DOCUMENTS_PER_LEAD);
  setItemWithQuotaGuard(documentsKey(leadId), JSON.stringify(next));
  return next;
};

// Find the most recent quote for a lead — used to pre-fill the Resend flow.
export const getLatestQuoteForParent = (parentId) => {
  const list = getQuotesForParent(parentId);
  return list[0] || null;
};
