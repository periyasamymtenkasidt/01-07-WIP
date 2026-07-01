// Preset templates and helpers for the Quick Quote / Send Proposal flows.
// The hardcoded DEFAULT_PRESETS below are the factory baseline — actual reads
// go through getMaster()/getPresets() which honour user overrides saved in
// localStorage from the Settings → Proposal Master page.

import { getRoomDefaultDays } from "./scheduleConfig";
import { cleanSizeRange } from "../utils/sizeRangeValidation";
import { normalizeScopeItem } from "../utils/scopeNaming";
import { DEFAULT_LIBRARY } from "./itemLibrary";
import { getQuotePresets, putQuotePresets } from "../api/masters";
import { tokens } from "../api/client";
import { createLeadQuote, sendQuote } from "../api/quotes";

// Best-effort backend write-through: never throws, never blocks the local save.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore — local cache is the source of truth until sync succeeds */
  }
};

// Per-lead quote write-through (distinct from the master/preset push above).
// Fire-and-forget; the local quote snapshot is the source of truth until the
// backend confirms. Logs but never throws so a Send never fails on a sync error.
const pushQuote = (fn) => {
  try {
    Promise.resolve(fn()).catch((err) =>
      console.warn("pushQuote: backend sync failed —", err?.message || err),
    );
  } catch {
    /* ignore — never break the local quote write */
  }
};

// Resolve the Mongo backend lead id from the local leads cache. Quotes are
// addressed in-app by the lead's proposalId, but the API needs the lead's `id`.
// Returns "" for mock / offline leads so callers skip the API. Never throws.
const backendLeadId = (proposalId) => {
  try {
    const stored = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
    const found = Array.isArray(stored)
      ? stored.find((l) => l.proposalId === proposalId)
      : null;
    return (found && (found.id || found._id)) || "";
  } catch {
    return "";
  }
};

export const GST_RATE = 18;

const COMMON_INCLUSIONS = [];

const COMMON_EXCLUSIONS = [];

// ── Scope of Work, sourced from the Item Master ────────────────────────────
// Every preset's scope of work is composed from the SAME catalog the BOQ and
// rate build-up use (DEFAULT_LIBRARY in itemLibrary.js). Each row carries the
// item's real unit, ₹/unit rate, HSN, lead-time and material specs, and links
// back to its catalog item by name (itemName === library description) so grade
// re-mapping and rate build-ups resolve cleanly. The only per-preset input is
// the room each work sits in and an assumed package quantity.
const LIB_BY_NAME = DEFAULT_LIBRARY.reduce((map, it) => {
  map[it.description] = it;
  return map;
}, {});

// Build one scope row from an Item Master work: room + assumed package qty.
// rate, unit, days, HSN and materials come straight from the catalog;
// amount = qty × rate. The description is a spec line derived from the item's
// own materials so the quote shows what each work is made of.
const work = (room, name, qty) => {
  const lib = LIB_BY_NAME[name];
  if (!lib) {
    throw new Error(`Proposal Master: unknown Item Master work "${name}"`);
  }
  const materials = (lib.materials || []).map((m) => ({ ...m }));
  const description = materials.length
    ? materials.map((m) => `${m.name}: ${m.spec}`).join(" · ")
    : name;
  return {
    area: room,
    itemName: name,
    description,
    unit: lib.unit,
    rate: lib.rate,
    qty,
    amount: Math.round(qty * lib.rate),
    days: lib.days,
    hsn: lib.hsn,
    gstPercent: lib.gstPercent,
    materials,
  };
};

export const DEFAULT_PRESETS = {
  "1BHK": {
    label: "1 BHK Apartment",
    propertyType: "Apartment",
    propertyTypes: ["Apartment", "Studio Apartment"],
    sizeRange: "450-600",
    scopeItems: [
      work("Living Room", "False Ceiling — gypsum board with cove groove", 350),
      work("Living Room", "TV Unit — paneling with storage", 28),
      work("Living Room", "Cove / Profile Lighting", 30),
      work("Kitchen", "Modular Kitchen Base Unit", 13),
      work("Kitchen", "Modular Kitchen Wall Unit", 11),
      work("Kitchen", "Kitchen Counter — granite / quartz", 12),
      work("Master Bedroom", "Wardrobe — laminate, soft-close", 48),
      work("Master Bedroom", "Bed Back Panel — upholstered", 30),
      work("Master Bedroom", "Dresser Unit — with mirror", 12),
      work("Bathrooms", "Bathroom Vanity — marine ply + counter", 4),
      work("Bathrooms", "Shower Glass Partition — 8mm toughened", 21),
      work("Bathrooms", "Wall Mirror Panel", 8),
    ],
    inclusions: COMMON_INCLUSIONS,
    exclusions: COMMON_EXCLUSIONS,
  },
  "2BHK": {
    label: "2 BHK Apartment",
    propertyType: "Apartment",
    propertyTypes: ["Apartment", "Penthouse", "Duplex"],
    sizeRange: "800-1100",
    scopeItems: [
      work("Living Room", "False Ceiling — gypsum board with cove groove", 450),
      work("Living Room", "TV Unit — paneling with storage", 35),
      work("Living Room", "Crockery Unit — glass shutters + lighting", 18),
      work("Living Room", "Cove / Profile Lighting", 50),
      work("Kitchen", "Modular Kitchen Base Unit", 15),
      work("Kitchen", "Modular Kitchen Wall Unit", 12),
      work("Kitchen", "Kitchen Counter — granite / quartz", 20),
      work("Master Bedroom", "Wardrobe — premium veneer finish", 42),
      work("Master Bedroom", "Bed Back Panel — upholstered", 32),
      work("Master Bedroom", "Dresser Unit — with mirror", 17),
      work("Bedroom 2", "Wardrobe — laminate, soft-close", 50),
      work("Bedroom 2", "Bed Back Panel — upholstered", 30),
      work("Bedroom 2", "Study / Work Desk — built-in", 4),
      work("Bathrooms", "Bathroom Vanity — marine ply + counter", 8),
      work("Bathrooms", "Shower Glass Partition — 8mm toughened", 30),
      work("Bathrooms", "Wall Mirror Panel", 18),
      work("Foyer", "Shoe Rack — with bench top", 18),
      work("Foyer", "Foyer Console — with mirror", 12),
    ],
    inclusions: COMMON_INCLUSIONS,
    exclusions: COMMON_EXCLUSIONS,
  },
  "3BHK": {
    label: "3 BHK Apartment",
    propertyType: "Apartment",
    propertyTypes: ["Apartment", "Penthouse", "Duplex", "Independent House"],
    sizeRange: "1200-1600",
    scopeItems: [
      work("Living Room", "False Ceiling — gypsum board with cove groove", 560),
      work("Living Room", "TV Unit — paneling with storage", 42),
      work("Living Room", "Crockery Unit — glass shutters + lighting", 24),
      work("Living Room", "Accent Wall Paneling — veneer / laminate", 55),
      work("Living Room", "Cove / Profile Lighting", 38),
      work("Kitchen", "Modular Kitchen Base Unit", 18),
      work("Kitchen", "Modular Kitchen Wall Unit", 15),
      work("Kitchen", "Kitchen Counter — granite / quartz", 26),
      work("Master Bedroom", "Wardrobe — premium veneer finish", 56),
      work("Master Bedroom", "Bed Back Panel — upholstered", 34),
      work("Master Bedroom", "Dresser Unit — with mirror", 22),
      work("Bedroom 2", "Wardrobe — laminate, soft-close", 60),
      work("Bedroom 2", "Bed Back Panel — upholstered", 32),
      work("Bedroom 2", "Study / Work Desk — built-in", 3),
      work("Bedroom 3", "Wardrobe — laminate, soft-close", 52),
      work("Bedroom 3", "Bed Back Panel — upholstered", 30),
      work("Bedroom 3", "Study / Work Desk — built-in", 3),
      work("Bathrooms", "Bathroom Vanity — marine ply + counter", 12),
      work("Bathrooms", "Shower Glass Partition — 8mm toughened", 40),
      work("Bathrooms", "Wall Mirror Panel", 21),
      work("Foyer", "Shoe Rack — with bench top", 20),
      work("Foyer", "Foyer Console — with mirror", 15),
    ],
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
    sizeRange: "2400+",
    scopeItems: [
      work("Living Room", "False Ceiling — gypsum board with cove groove", 800),
      work("Living Room", "TV Unit — paneling with storage", 55),
      work("Living Room", "Accent Wall Paneling — veneer / laminate", 90),
      work("Living Room", "Crockery Unit — glass shutters + lighting", 30),
      work("Living Room", "Cove / Profile Lighting", 145),
      work("Dining", "Crockery Unit — glass shutters + lighting", 60),
      work("Dining", "Accent Wall Paneling — veneer / laminate", 80),
      work("Dining", "Cove / Profile Lighting", 88),
      work("Kitchen", "Modular Kitchen Base Unit", 28),
      work("Kitchen", "Modular Kitchen Wall Unit", 20),
      work("Kitchen", "Kitchen Counter — granite / quartz", 35),
      work("Master Bedroom", "Wardrobe — premium veneer finish", 90),
      work("Master Bedroom", "Bed Back Panel — upholstered", 45),
      work("Master Bedroom", "Dresser Unit — with mirror", 37),
      work("Bedroom 2", "Wardrobe — laminate, soft-close", 120),
      work("Bedroom 2", "Bed Back Panel — upholstered", 64),
      work("Bedroom 2", "Dresser Unit — with mirror", 54),
      work("Study", "Study / Work Desk — built-in", 20),
      work("Study", "Wardrobe — laminate, soft-close", 16),
      work("Bathrooms", "Bathroom Vanity — marine ply + counter", 16),
      work("Bathrooms", "Shower Glass Partition — 8mm toughened", 70),
      work("Bathrooms", "Wall Mirror Panel", 43),
      work("Staircase", "Accent Wall Paneling — veneer / laminate", 120),
      work("Staircase", "Cove / Profile Lighting", 70),
    ],
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

// Bump this whenever DEFAULT_PRESETS' baseline scope of work changes so a
// stored master from an older seed is replaced with the new factory defaults
// on the next read. The current value marks the scope of work being sourced
// from the Item Master (DEFAULT_LIBRARY). User edits made AFTER a re-seed are
// preserved — only masters from an older/absent seed are overwritten once.
const SEED_VERSION_KEY = "quoteMasterSeedVersion";
const SEED_VERSION = "2026.06-itemmaster";

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
      sizeRange: cleanSizeRange(c.sizeRange ?? next.sizeRange ?? ""),
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
    sizeRange: cleanSizeRange(sharedSize),
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

export const getMaster = () => {
  // Only trust a stored master if it was seeded by the CURRENT version. An
  // older (or unversioned) master holds the pre-Item-Master scope of work and
  // must be re-seeded from DEFAULT_PRESETS below.
  let seedCurrent = false;
  try {
    seedCurrent = localStorage.getItem(SEED_VERSION_KEY) === SEED_VERSION;
  } catch {
    seedCurrent = false;
  }
  if (seedCurrent) {
    try {
      const raw = localStorage.getItem(MASTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          const normalized = normalizeMaster(parsed);
          localStorage.setItem(MASTER_KEY, JSON.stringify(normalized));
          return normalized;
        }
      }
    } catch {
      // fall through to defaults
    }
  }
  const normalizedDefault = normalizeMaster(DEFAULT_PRESETS);
  localStorage.setItem(MASTER_KEY, JSON.stringify(normalizedDefault));
  try {
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  } catch {
    // version stamp is best-effort
  }
  return normalizedDefault;
};

export const saveMaster = (master) => {
  localStorage.setItem(MASTER_KEY, JSON.stringify(master));
  // Stamp the current seed so user edits made after a re-seed are kept on the
  // next read rather than being overwritten by the factory defaults.
  try {
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  } catch {
    // best-effort
  }
  // Mirror to the backend (PUT /masters/quote-presets, needs MANAGE_MASTERS).
  pushMaster(() => putQuotePresets(master));
};

// Pull the server's quote-preset master into the local cache (write-through
// backing). Safe-by-default: no-op when logged out, never overwrites good seed
// data with an empty/garbage server response, and falls back silently on error.
export async function hydrateQuotePresets() {
  if (!tokens.access()) return;
  try {
    const data = await getQuotePresets();
    const master = data?.presets || data;
    if (!master || typeof master !== "object" || Array.isArray(master)) return;
    if (Object.keys(master).length === 0) return;
    const normalized = normalizeMaster(master);
    localStorage.setItem(MASTER_KEY, JSON.stringify(normalized));
    localStorage.setItem(SEED_VERSION_KEY, SEED_VERSION);
  } catch (e) {
    console.warn("hydrateQuotePresets: keeping local presets —", e?.message || e);
  }
}

export const resetMaster = () => {
  localStorage.removeItem(MASTER_KEY);
  try {
    localStorage.removeItem(SEED_VERSION_KEY);
  } catch {
    // best-effort
  }
};

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

  // Best-effort backend write-through: create the quote against the lead. The
  // server computes totals from scopeItems, so we send the inputs only. Skip
  // when we can't resolve the backend lead id (mock / offline lead).
  const leadId = backendLeadId(parentId);
  if (leadId) {
    pushQuote(() =>
      createLeadQuote(leadId, {
        recipientName: quote.recipientName,
        recipientEmail: quote.recipientEmail,
        presetKey: quote.presetKey,
        propertyType: quote.propertyType,
        grade: quote.grade,
        scopeItems: quote.scopeItems,
        inclusions: quote.inclusions,
        exclusions: quote.exclusions,
      }),
    );
  }

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
  const entry = {
    docId: `${quote.quoteId}-${Date.now()}`,
    quoteId: quote.quoteId,
    fileName: `${quote.quoteId}_${(quote.recipientName || "Quote")
      .replace(/\s+/g, "_")}.pdf`,
    sentTo: quote.recipientEmail,
    sentAt: quote.sentAt || new Date().toISOString(),
    grandTotal: quote.grandTotal,
    snapshot: quote,
  };
  const next = [entry, ...list].slice(0, MAX_DOCUMENTS_PER_LEAD);
  setItemWithQuotaGuard(documentsKey(leadId), JSON.stringify(next));

  // Best-effort backend write-through: a document is recorded when a quote is
  // emailed, so this is the "send" point. The API addresses quotes by their
  // Mongo id (POST /quotes/:id/send), not the display quoteId — only call when
  // the snapshot carries that backend id; otherwise skip (the create flow in
  // saveQuote will have synced it separately).
  const backendQuoteId = quote?.id || quote?._id;
  if (backendQuoteId) {
    pushQuote(() => sendQuote(backendQuoteId));
  }

  return next;
};

// Find the most recent quote for a lead — used to pre-fill the Resend flow.
export const getLatestQuoteForParent = (parentId) => {
  const list = getQuotesForParent(parentId);
  return list[0] || null;
};
