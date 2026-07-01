// BOQ (Bill of Quantities) storage layer. All BOQs live in localStorage under
// `boq_<id>` keys with a master index at `boq_index`. The index is the list
// view on `/boq`; individual BOQ records hold the full sections + items.

import { getConfigForType } from "./QuotePresets";
import { PAYMENT_MILESTONES } from "./MilestoneConfig";
import { getOrgProfile } from "./orgProfile";

const INDEX_KEY = "boq_index";
const ITEM_KEY = (id) => `boq_${id}`;

// ── ID generation ──────────────────────────────────────────────────────────
export const generateBoqId = () => {
  const year = new Date().getFullYear();
  const existing = listBoqs();
  return `BOQ-${year}-${String(existing.length + 1).padStart(3, "0")}`;
};

const genShortId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ── Compute helpers ───────────────────────────────────────────────────────

// Units that use dimensional measurement (L × W × Nos for area, L × Nos for length).
// Items with these units can use the inline "measurement sheet" calculator.
export const DIMENSIONAL_UNITS = {
  sqft: { kind: "area", suffix: "ft" },
  sqm: { kind: "area", suffix: "m" },
  rmt: { kind: "length", suffix: "m" },
  mm: { kind: "length", suffix: "mm" },
};

export const computeQtyFromDimensions = (dim, unit) => {
  if (!dim || !dim.enabled) return null;
  const info = DIMENSIONAL_UNITS[unit];
  const nos = Number(dim.nos) || 1;
  const L = Number(dim.length) || 0;
  // Back-compat: older items used `width` instead of `breadth`.
  const B = Number(dim.breadth ?? dim.width) || 0;
  const H = Number(dim.height) || 0;

  if (info?.kind === "length") {
    return L * nos;
  }
  // Area / volume: multiply only the dimensions the user actually filled in.
  // Empty / zero = "not applicable" (skipped, not treated as 0).
  const factors = [L, B, H].filter((v) => v > 0);
  if (factors.length === 0) return 0;
  return factors.reduce((p, v) => p * v, 1) * nos;
};

export const computeItemQty = (item) => {
  if (item?.dimensions?.enabled) {
    const v = computeQtyFromDimensions(item.dimensions, item.unit);
    return v == null ? Number(item.qty) || 0 : v;
  }
  return Number(item?.qty) || 0;
};

export const computeItemAmount = (item) => {
  const qty = computeItemQty(item);
  const baseRate = Number(item.rate) || 0;
  const gross = qty * baseRate;
  const disc = item.discount || { type: "percent", value: 0 };
  const discAmt =
    disc.type === "percent"
      ? (gross * (Number(disc.value) || 0)) / 100
      : Number(disc.value) || 0;
  const net = Math.max(0, gross - discAmt);
  const gst = (net * (Number(item.gstPercent) || 0)) / 100;
  return { gross, discAmt, net, gst, total: net + gst };
};

export const computeBoqTotals = (boq) => {
  let subtotal = 0;
  let lineDiscounts = 0;
  let taxable = 0;
  const gstByRate = {};

  for (const section of boq.sections || []) {
    for (const item of section.items || []) {
      const r = computeItemAmount(item);
      subtotal += r.gross;
      lineDiscounts += r.discAmt;
      taxable += r.net;
      const rate = Number(item.gstPercent) || 0;
      gstByRate[rate] = (gstByRate[rate] || 0) + r.gst;
    }
  }

  // BOQ-level discount applies on the taxable amount.
  const bd = boq.discount || { type: "percent", value: 0 };
  const boqDiscountAmt =
    bd.type === "percent"
      ? (taxable * (Number(bd.value) || 0)) / 100
      : Number(bd.value) || 0;
  const afterBoqDiscount = Math.max(0, taxable - boqDiscountAmt);

  // Labour and contingency are markups on the discounted taxable base — both
  // are part of the taxable supply, so GST below covers them too, not just
  // the material cost.
  const laborPercent = Number(boq.laborPercent) || 0;
  const contingencyPercent = Number(boq.contingencyPercent) || 0;
  const laborAmt = (afterBoqDiscount * laborPercent) / 100;
  const contingencyAmt = (afterBoqDiscount * contingencyPercent) / 100;
  const baseForGst = afterBoqDiscount + laborAmt + contingencyAmt;

  // Re-apportion GST proportional to the final taxable base (post-discount,
  // post-labour, post-contingency). Cleaner than recomputing per item — keeps
  // the rate breakdown intact while honouring every BOQ-level markup.
  const scale = taxable > 0 ? baseForGst / taxable : 0;
  const scaledGstByRate = {};
  let totalGst = 0;
  for (const [rate, amt] of Object.entries(gstByRate)) {
    const s = amt * scale;
    scaledGstByRate[rate] = s;
    totalGst += s;
  }

  const grandTotal = baseForGst + totalGst;
  return {
    subtotal,
    lineDiscounts,
    taxable,
    boqDiscountAmt,
    afterBoqDiscount,
    laborPercent,
    laborAmt,
    contingencyPercent,
    contingencyAmt,
    baseForGst,
    gstByRate: scaledGstByRate,
    totalGst,
    grandTotal,
  };
};

// ── GST place-of-supply ─────────────────────────────────────────────────────
// Standard GST state codes (first 2 digits of any GSTIN). Used both to read
// the supplier/client state out of a GSTIN and to guess a state from free
// text (client state field / project address) when no GSTIN is on file.
export const GST_STATE_CODES = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const STATE_NAME_TO_CODE = Object.entries(GST_STATE_CODES).reduce(
  (acc, [code, name]) => {
    acc[name.toLowerCase()] = code;
    return acc;
  },
  {},
);

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z][Z][0-9A-Z]$/;

export const isValidGstin = (gstin) =>
  GSTIN_RE.test((gstin || "").trim().toUpperCase());

const stateCodeFromGstin = (gstin) => {
  const g = (gstin || "").trim();
  return /^\d{2}/.test(g) ? g.slice(0, 2) : null;
};

// Loose match against free text (e.g. a project address like "12 MG Road,
// Chennai, Tamil Nadu - 600001") — exact match first, then substring.
const stateCodeFromText = (text) => {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (STATE_NAME_TO_CODE[t]) return STATE_NAME_TO_CODE[t];
  const hit = Object.keys(STATE_NAME_TO_CODE).find((name) => t.includes(name));
  return hit ? STATE_NAME_TO_CODE[hit] : null;
};

// Resolve whether a BOQ is inter-state (IGST) or intra-state (CGST+SGST).
// Supplier state comes from the org's GSTIN (snapshot if sent, else live
// profile), falling back to the profile's configured state code. Place of
// supply comes from the client's GSTIN (B2B) or, failing that, the client's
// stated state / project address (B2C). If neither resolves, this defaults
// to intra-state but sets `assumed: true` so the UI can ask the user to
// confirm the client's state instead of silently guessing.
export const resolveGstTreatment = (boq) => {
  const org = boq?.orgSnapshot || getOrgProfile();
  const supplierStateCode =
    stateCodeFromGstin(org?.gstin) || org?.stateCode || null;

  const clientGstin = boq?.client?.gstin;
  let placeOfSupplyStateCode = stateCodeFromGstin(clientGstin);
  let assumed = false;

  if (!placeOfSupplyStateCode) {
    placeOfSupplyStateCode =
      stateCodeFromText(boq?.client?.state) ||
      stateCodeFromText(boq?.project?.address) ||
      stateCodeFromText(boq?.client?.address);
  }

  if (!placeOfSupplyStateCode) {
    // Can't determine the client's state — assume intra-state (the common
    // case) but flag it so the UI can prompt for confirmation.
    placeOfSupplyStateCode = supplierStateCode;
    assumed = true;
  }

  const interState =
    !!supplierStateCode &&
    !!placeOfSupplyStateCode &&
    supplierStateCode !== placeOfSupplyStateCode;

  return { interState, supplierStateCode, placeOfSupplyStateCode, assumed };
};

// ── Send-readiness validation ───────────────────────────────────────────────
// Blocks = must fix before the BOQ can be marked Sent. Warnings = the user
// can override and send anyway.
export const validateBoqForSend = (boq) => {
  const blocks = [];
  const warnings = [];
  const allItems = (boq?.sections || []).flatMap((s) => s.items || []);

  if (allItems.length === 0) {
    blocks.push("Add at least one line item before sending.");
  }

  const zeroRateItems = allItems.filter(
    (it) => (Number(it.rate) || 0) <= 0 && computeItemQty(it) > 0,
  );
  if (zeroRateItems.length > 0) {
    blocks.push(
      `${zeroRateItems.length} line item${zeroRateItems.length === 1 ? "" : "s"} ${zeroRateItems.length === 1 ? "has" : "have"} a quantity but no rate (₹0).`,
    );
  }

  const milestoneTotal = (boq?.paymentTerms || []).reduce(
    (s, m) => s + (Number(m.percent) || 0),
    0,
  );
  if ((boq?.paymentTerms || []).length > 0 && milestoneTotal !== 100) {
    blocks.push(
      `Payment milestones total ${milestoneTotal}% — they must add up to exactly 100%.`,
    );
  }

  if (!boq?.client?.id && !boq?.client?.name) {
    warnings.push("No client linked to this BOQ.");
  }

  const org = boq?.orgSnapshot || getOrgProfile();
  if (org?.gstin && !isValidGstin(org.gstin)) {
    warnings.push(
      "Your organization's GSTIN doesn't look like a valid 15-character GSTIN — check Settings → Organization Profile.",
    );
  }
  if (boq?.client?.gstin && !isValidGstin(boq.client.gstin)) {
    warnings.push("The client's GSTIN doesn't look like a valid 15-character GSTIN.");
  }

  const missingHsn = allItems.filter(
    (it) => !it.hsn && (Number(it.rate) || 0) > 0,
  );
  if (missingHsn.length > 0) {
    warnings.push(
      `${missingHsn.length} line item${missingHsn.length === 1 ? "" : "s"} ${missingHsn.length === 1 ? "is" : "are"} missing an HSN code.`,
    );
  }

  if (resolveGstTreatment(boq).assumed) {
    warnings.push(
      "GST treatment assumed as intra-state — confirm the client's state to get CGST+SGST vs IGST right.",
    );
  }

  return { blocks, warnings };
};

// ── CRUD ──────────────────────────────────────────────────────────────────
export const listBoqs = () => {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
  } catch {
    return [];
  }
};

// Legacy section `category` colour keys → canonical room names (Master →
// Schedule). Keeps existing saved BOQs visually correct after the switch.
const LEGACY_SECTION_CATEGORY = {
  blue: "Living Room",
  orange: "Kitchen",
  purple: "Master Bedroom",
  teal: "Bathrooms",
  amber: "Foyer",
  indigo: "Study",
  slate: "Utility",
  gray: "",
};

const migrateSectionCategory = (boq) => {
  if (!boq?.sections) return boq;
  return {
    ...boq,
    sections: boq.sections.map((s) => ({
      ...s,
      category:
        s.category in LEGACY_SECTION_CATEGORY
          ? LEGACY_SECTION_CATEGORY[s.category]
          : s.category || "",
    })),
  };
};

export const getBoq = (id) => {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(ITEM_KEY(id));
    return raw ? migrateSectionCategory(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const saveBoq = (boq) => {
  const next = {
    ...boq,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(ITEM_KEY(next.id), JSON.stringify(next));
  // Update index
  const idx = listBoqs();
  const existing = idx.find((b) => b.id === next.id);
  const totals = computeBoqTotals(next);
  const summary = {
    id: next.id,
    title: next.title,
    status: next.status,
    parentType: next.parentType,
    parentId: next.parentId,
    clientName: next.client?.name || "",
    grandTotal: totals.grandTotal,
    itemCount: (next.sections || []).reduce(
      (s, sec) => s + (sec.items?.length || 0),
      0,
    ),
    updatedAt: next.updatedAt,
    createdAt: next.createdAt,
  };
  const nextIdx = existing
    ? idx.map((b) => (b.id === next.id ? summary : b))
    : [summary, ...idx];
  localStorage.setItem(INDEX_KEY, JSON.stringify(nextIdx));
  return next;
};

export const deleteBoq = (id) => {
  localStorage.removeItem(ITEM_KEY(id));
  const idx = listBoqs().filter((b) => b.id !== id);
  localStorage.setItem(INDEX_KEY, JSON.stringify(idx));
};

export const duplicateBoq = (id) => {
  const src = getBoq(id);
  if (!src) return null;
  const next = {
    ...JSON.parse(JSON.stringify(src)),
    id: generateBoqId(),
    title: `${src.title || "Untitled BOQ"} (Copy)`,
    status: "draft",
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // Regenerate inner IDs so the copy has its own row identity
  next.sections = (next.sections || []).map((s) => ({
    ...s,
    id: genShortId(),
    items: (s.items || []).map((it) => ({ ...it, id: genShortId() })),
  }));
  saveBoq(next);
  return next;
};

// ── Factory ───────────────────────────────────────────────────────────────
export const blankItem = () => ({
  id: genShortId(),
  description: "",
  // Brand / model / finish — kept distinct from the free-text description so
  // procurement can match against what was actually specified to the client.
  spec: "",
  hsn: "",
  qty: 1,
  unit: "nos",
  rate: 0,
  gstPercent: 18,
  discount: { type: "percent", value: 0 },
  dimensions: { enabled: false, length: 0, breadth: 0, height: 0, nos: 1 },
  materials: [],
});

export const blankSection = (name = "New Section") => ({
  id: genShortId(),
  name,
  category: "",
  items: [],
});

export const createBoq = ({
  title = "Untitled BOQ",
  parentType = "standalone",
  parentId = null,
  client = {},
  project = {},
  basedOnPreset = null,
} = {}) => {
  const id = generateBoqId();
  let sections = [];

  // Seed from a ProposalMaster preset if requested. Each scope row becomes
  // a section with one default line item the user can refine.
  if (basedOnPreset) {
    const cfg = getConfigForType(basedOnPreset);
    if (cfg) {
      sections = (cfg.scopeItems || []).map((scope) => ({
        id: genShortId(),
        name: scope.area || "Untitled",
        // Section category = the room (scope area) so it groups/colours by room.
        category: scope.area || "",
        // Carry the scope identity (Rail 🟦) so this BOQ section ties back to the
        // same room in the quote, schedule, work packages and contract snapshot.
        scopeItemId: scope.id || null,
        items: [
          {
            ...blankItem(),
            description: scope.description || scope.area || "",
            qty: 1,
            unit: "ls",
            rate: Number(scope.amount) || 0,
            materials: scope.materials || [],
          },
        ],
      }));
    }
  }

  return {
    id,
    title,
    parentType,
    parentId,
    basedOnPreset,
    status: "draft",
    revision: 1,
    client,
    project,
    sections,
    discount: { type: "percent", value: 0 },
    // Markup applied to the internal cost to produce the client-facing quote.
    // BOQ = cost; quote = cost × (1 + margin). Persisted so the spread (gross
    // margin) is never lost (Rail 💰). See computeQuoteFromBoq.
    marginPercent: 0,
    // Both are % markups on the post-discount taxable base — see
    // computeBoqTotals. Standard line items in a professional interior BOQ,
    // separate from the per-item material rate.
    laborPercent: 0,
    contingencyPercent: 0,
    // Standard 5-stage milestone schedule shared across the org
    // (see src/data/MilestoneConfig.js). Users can still tweak per BOQ.
    paymentTerms: PAYMENT_MILESTONES.map((m) => ({
      id: m.id,
      label: m.name,
      percent: m.pct,
    })),
    validity: "30 days from issue",
    warrantyText: "",
    notes: "",
    inclusions: [],
    exclusions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// Derive the client-facing priced quote from a BOQ. The BOQ is the internal
// COST build-up; the quote is the PRICE = cost × (1 + margin). The margin lives
// on the BOQ (`marginPercent`) so the cost↔price spread is captured, not lost —
// this is the missing step between BOQ and the client Quotation (Rail 💰).
export const computeQuoteFromBoq = (boq) => {
  const totals = computeBoqTotals(boq);
  const marginPercent = Number(boq?.marginPercent) || 0;
  const cost = totals.baseForGst; // ex-GST internal cost, incl. labour + contingency
  const price = cost * (1 + marginPercent / 100); // ex-GST client price
  return {
    ...totals,
    cost,
    marginPercent,
    marginAmount: price - cost,
    price,
  };
};

// ID generator exposed for callers that want to create sub-items.
export { genShortId };
