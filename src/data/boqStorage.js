// BOQ (Bill of Quantities) storage layer. All BOQs live in localStorage under
// `boq_<id>` keys with a master index at `boq_index`. The index is the list
// view on `/boq`; individual BOQ records hold the full sections + items.

import { getConfigForType } from "./QuotePresets";
import { PAYMENT_MILESTONES } from "./MilestoneConfig";
import { getOrgProfile } from "./orgProfile";

const INDEX_KEY = "boq_index";
const ITEM_KEY = (id) => `boq_${id}`;
const BOQ_SCHEMA_VERSION = 3;

export const BOQ_TYPES = [
  { value: "client", label: "Client BOQ" },
  { value: "internal_cost", label: "Internal Cost BOQ" },
  { value: "tender", label: "Tender BOQ" },
  { value: "procurement", label: "Procurement BOQ" },
  { value: "variation", label: "Variation BOQ" },
];

export const ITEM_TYPES = [
  "Supply only",
  "Labour only",
  "Supply & Installation",
];

export const BILLING_TYPES = [
  "Fixed",
  "Actual measurement",
  "Provisional",
];

export const SCOPE_TYPES = [
  "Base scope",
  "Optional",
  "Add-on",
  "Variation",
];

export const EXECUTION_BY = [
  "In-house",
  "Vendor",
  "Subcontractor",
];

const defaultProjectHierarchy = () => ({
  blockTower: "",
  block: "",
  tower: "",
  floor: "",
  roomArea: "",
  workCategory: "",
  subCategory: "",
});

const defaultItemDetails = () => ({
  drawingRefNo: "",
  drawingRevision: "",
  specificationCode: "",
  brandMakeModel: "",
  finishColorGrade: "",
  itemType: "Supply & Installation",
  billingType: "Actual measurement",
  scopeType: "Base scope",
  executionBy: "In-house",
  remarks: "",
});

const defaultCommercialControls = () => ({
  retentionPercent: 0,
  mobilizationAdvance: 0,
  freightTransport: 0,
  loadingUnloading: 0,
  roundOff: 0,
  priceEscalationClause: "",
  taxInclusive: false,
});

// ── ID generation ──────────────────────────────────────────────────────────
export const generateBoqId = () => {
  const year = new Date().getFullYear();
  const existing = listBoqs();
  return `BOQ-${year}-${String(existing.length + 1).padStart(3, "0")}`;
};

const genShortId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// ── Stable BOQ model defaults ─────────────────────────────────────────────
// These defaults are deliberately stored in the persistence layer so every
// entry point (manual BOQ, site-generated BOQ, duplicate, import, migration)
// lands on the same shape before UI-specific editors are added.
export const blankMeasurementRow = () => ({
  id: genShortId(),
  location: "",
  description: "",
  nos: 1,
  length: 0,
  breadth: 0,
  height: 0,
  deduction: 0,
  qty: 0,
  netQuantity: 0,
  unit: "",
  drawingPhotoRef: "",
  measuredBy: "",
  checkedBy: "",
  measurementDate: "",
  remarks: "",
});

export const blankRateAnalysisRow = () => ({
  id: genShortId(),
  // Link to a Material Master entry when picked from the catalog; empty for
  // free-text rows. Lets the row re-price from the master and trace to procurement.
  materialId: "",
  description: "",
  unit: "",
  quantity: 0,
  wastagePercent: 0,
  quantityWithWastage: 0,
  rate: 0,
  amount: 0,
  gstPercent: 0,
  source: "manual",
  remarks: "",
});

export const blankRateAnalysis = (unit = "") => ({
  enabled: false,
  source: "manual",
  raQuantity: 0,
  unit,
  materialItems: [],
  contractItems: [],
  consumables: 0,
  labourRate: 0,
  overheadPercent: 0,
  pcePercent: 0,
  marginPercent: 0,
  subtotalMaterials: 0,
  subtotalContracts: 0,
  subtotalConsumables: 0,
  materialRatePerUnit: 0,
  contractRatePerUnit: 0,
  directCost: 0,
  costPerUnit: 0,
  overheadAmount: 0,
  pceAmount: 0,
  rateBeforeMargin: 0,
  marginAmount: 0,
  finalRate: 0,
  roundedFinalRate: 0,
  useFinalRate: false,
  remarks: "",
  updatedAt: "",
});

// ── Proposal → rate-analysis mapping ───────────────────────────────────────
// The proposal/recipe materials carried onto a BOQ item (`item.materials`,
// shape from rateBuildup.recipeToMaterials) mapped onto rate-analysis material
// rows, so the rate build-up starts pre-filled from the proposal instead of
// blank. Field names differ between the two shapes, hence the explicit map.
export const materialsToRateAnalysisRows = (materials = []) =>
  (Array.isArray(materials) ? materials : []).map((m) => ({
    ...blankRateAnalysisRow(),
    materialId: m.materialId || m.id || "",
    description: m.name || m.description || "",
    unit: m.unit || "",
    quantity: Number(m.qty ?? m.quantity) || 0,
    wastagePercent: Number(m.wastagePct ?? m.wastagePercent) || 0,
    rate: Number(m.rate) || 0,
    gstPercent: Number(m.gstPercent) || 0,
    source: "proposal",
  }));

// Build a rate-analysis for a freshly generated/seeded item, pre-filled from
// the item's proposal materials. Idempotent: if the item already has
// rate-analysis material rows (the estimator has worked on it), it is returned
// untouched, so regenerating a BOQ never clobbers manual rate work. The
// build-up is shown (`enabled`) but does NOT drive the item rate
// (`useFinalRate: false`) — the proposal figure stands until an estimator opts
// in. Recipe materials are per 1 unit of work, so `raQuantity` seeds to 1.
export const seedRateAnalysisFromMaterials = (
  existing,
  materials = [],
  unit = "",
  { force = false } = {},
) => {
  // Idempotent by default: keep the estimator's rows. `force` (used on BOQ
  // (re)generation) re-seeds straight from the proposal so quantities and rates
  // always reflect the current proposal basis.
  if (!force && existing?.materialItems?.length > 0) return existing;
  const rows = materialsToRateAnalysisRows(materials);
  if (rows.length === 0) return existing || blankRateAnalysis(unit);
  return {
    ...blankRateAnalysis(unit),
    ...(existing || {}),
    enabled: true,
    useFinalRate: false,
    raQuantity: 1,
    materialItems: rows,
    source: "proposal",
    // One-time marker so normalizeItem never re-seeds an item the estimator
    // later cleared out. Once seeded, it stays the user's to edit.
    materialsSeeded: true,
  };
};

export const blankVendorComparison = () => ({
  id: genShortId(),
  vendorId: "",
  vendorName: "",
  quotedRate: 0,
  gstPercent: 0,
  leadTimeDays: 0,
  warranty: "",
  remarks: "",
  selected: false,
  selectionReason: "",
  quotedAt: "",
});

export const blankBoqComment = () => ({
  id: genShortId(),
  type: "internal", // internal | client
  scope: "boq", // boq | section | item
  sectionId: "",
  itemId: "",
  comment: "",
  raisedBy: "",
  raisedAt: new Date().toISOString(),
  status: "open", // open | closed
  response: "",
  closedBy: "",
  closedAt: "",
  revisionImpact: "",
});

export const DEFAULT_APPROVAL_STAGES = {
  preparation: {
    label: "Preparation",
    status: "pending",
    assignedTo: "",
    completedBy: "",
    completedAt: "",
    remarks: "",
  },
  measurementReview: {
    label: "Measurement Review",
    status: "pending",
    assignedTo: "",
    completedBy: "",
    completedAt: "",
    remarks: "",
  },
  rateReview: {
    label: "Rate Review",
    status: "pending",
    assignedTo: "",
    completedBy: "",
    completedAt: "",
    remarks: "",
  },
  taxReview: {
    label: "Tax Review",
    status: "pending",
    assignedTo: "",
    completedBy: "",
    completedAt: "",
    remarks: "",
  },
  clientApproval: {
    label: "Client Approval",
    status: "pending",
    assignedTo: "",
    completedBy: "",
    completedAt: "",
    remarks: "",
  },
};

export const DEFAULT_APPROVAL_STAGE_ORDER = [
  "preparation",
  "measurementReview",
  "rateReview",
  "taxReview",
  "clientApproval",
];

export const DEFAULT_BOQ_APPROVAL = {
  preparedBy: "",
  reviewedBy: "",
  approvedBy: "",
  clientAcceptedBy: "",
  preparedAt: "",
  sentAt: "",
  reviewedAt: "",
  approvedAt: "",
  clientAcceptedAt: "",
  checklist: {
    measurementsChecked: false,
    ratesChecked: false,
    taxChecked: false,
    termsChecked: false,
  },
  stageOrder: DEFAULT_APPROVAL_STAGE_ORDER,
  stages: DEFAULT_APPROVAL_STAGES,
  requiredStageKeys: DEFAULT_APPROVAL_STAGE_ORDER,
  strictGate: false,
  remarks: "",
};

export const blankRevisionComparison = () => ({
  previousRevision: null,
  currentRevision: null,
  createdAt: "",
  summary: {
    sectionsAdded: 0,
    sectionsRemoved: 0,
    itemsAdded: 0,
    itemsRemoved: 0,
    itemsChanged: 0,
    quantityDelta: 0,
    amountDelta: 0,
  },
  changes: [],
  reason: "",
});

const withIds = (rows, factory) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...factory(),
    ...row,
    id: row?.id || genShortId(),
  }));

const mergeApproval = (approval = {}) => ({
  ...DEFAULT_BOQ_APPROVAL,
  ...approval,
  checklist: {
    ...DEFAULT_BOQ_APPROVAL.checklist,
    ...(approval?.checklist || {}),
  },
  stageOrder: Array.isArray(approval?.stageOrder)
    ? approval.stageOrder
    : DEFAULT_APPROVAL_STAGE_ORDER,
  stages: DEFAULT_APPROVAL_STAGE_ORDER.reduce(
    (acc, key) => ({
      ...acc,
      [key]: {
        ...DEFAULT_APPROVAL_STAGES[key],
        ...(approval?.stages?.[key] || {}),
      },
    }),
    {},
  ),
  requiredStageKeys: Array.isArray(approval?.requiredStageKeys)
    ? approval.requiredStageKeys
    : DEFAULT_APPROVAL_STAGE_ORDER,
  strictGate: !!approval?.strictGate,
});

// ── Compute helpers ───────────────────────────────────────────────────────

// Units that use dimensional measurement (L for length, L x B/H for area).
// Items with these units can use the inline "measurement sheet" calculator.
export const DIMENSIONAL_UNITS = {
  mtr: { kind: "length", suffix: "m" },
  sqft: { kind: "area", suffix: "ft" },
  sqm: { kind: "area", suffix: "m" },
  rmt: { kind: "length", suffix: "m" },
  rft: { kind: "length", suffix: "ft" },
  cft: { kind: "volume", suffix: "ft" },
  cum: { kind: "volume", suffix: "m" },
  mm: { kind: "length", suffix: "mm" },
};

export const computeQtyFromDimensions = (dim, unit) => {
  if (!dim || !dim.enabled) return null;
  const info = DIMENSIONAL_UNITS[unit];
  const L = Number(dim.length) || 0;
  // Back-compat: older items used `width` instead of `breadth`.
  const B = Number(dim.breadth ?? dim.width) || 0;
  const H = Number(dim.height) || 0;

  if (info?.kind === "length") {
    return L;
  }
  // Area / volume: multiply only the dimensions the user actually filled in.
  // Empty / zero = "not applicable" (skipped, not treated as 0).
  const factors = [L, B, H].filter((v) => v > 0);
  if (factors.length === 0) return 0;
  return factors.reduce((p, v) => p * v, 1);
};

export const computeQtyFromMeasurementRows = (rows = [], unit = "") => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  let total = 0;
  let hasValue = false;

  for (const row of rows) {
    const explicitQty = Number(row.netQuantity ?? row.qty) || 0;
    const nos = Number(row.nos) || 1;
    const L = Number(row.length) || 0;
    const B = Number(row.breadth ?? row.width) || 0;
    const H = Number(row.height) || 0;
    const deduction = Number(row.deduction) || 0;

    let qty = explicitQty;
    if (qty <= 0) {
      if (DIMENSIONAL_UNITS[unit]?.kind === "length") {
        qty = L;
      } else {
        const factors = [L, B, H].filter((v) => v > 0);
        qty = factors.length > 0 ? factors.reduce((p, v) => p * v, 1) : 0;
      }
      qty *= nos;
    }

    const netQty = Math.max(0, qty - deduction);
    if (netQty > 0) hasValue = true;
    total += netQty;
  }

  return hasValue ? total : null;
};

export const computeRateAnalysis = (rateAnalysis = {}, unit = "") => {
  const ra = { ...blankRateAnalysis(unit), ...(rateAnalysis || {}) };
  const lineTotal = (rows = []) =>
    rows.reduce((sum, row) => {
      const quantity = Number(row.quantity) || 0;
      const wastage = Number(row.wastagePercent) || 0;
      const qww =
        Number(row.quantityWithWastage) || quantity * (1 + wastage / 100);
      const amount = Number(row.amount) || qww * (Number(row.rate) || 0);
      return sum + amount;
    }, 0);

  const subtotalMaterials = lineTotal(ra.materialItems);
  const subtotalContracts = lineTotal(ra.contractItems);
  const subtotalConsumables = Number(ra.consumables) || 0;
  const labourRate = Number(ra.labourRate) || 0;
  const directCost =
    subtotalMaterials + subtotalContracts + subtotalConsumables + labourRate;
  const raQuantity = Number(ra.raQuantity) || 0;
  // Per-block rate contribution, mirroring the sheet's "Rate per unit" column
  // for the Material (A) and Labour/Contract (B) blocks.
  const materialRatePerUnit = raQuantity > 0 ? subtotalMaterials / raQuantity : 0;
  const contractRatePerUnit = raQuantity > 0 ? subtotalContracts / raQuantity : 0;
  const costPerUnit = raQuantity > 0 ? directCost / raQuantity : directCost;
  const overheadAmount = (costPerUnit * (Number(ra.overheadPercent) || 0)) / 100;
  const pceAmount =
    ((costPerUnit + overheadAmount) * (Number(ra.pcePercent) || 0)) / 100;
  const rateBeforeMargin = costPerUnit + overheadAmount + pceAmount;
  const marginPercent = Number(ra.marginPercent) || 0;
  // Margin is always taken as a share of the selling price, exactly as on the
  // rate-analysis sheet: final = basic cost ÷ (1 − margin%). A margin of 100%+
  // is undefined, so it falls back to the basic cost.
  const finalRate =
    marginPercent < 100
      ? rateBeforeMargin / (1 - marginPercent / 100)
      : rateBeforeMargin;
  const marginAmount = finalRate - rateBeforeMargin;
  const roundedFinalRate = Math.round(finalRate);

  return {
    ...ra,
    unit: ra.unit || unit || "",
    subtotalMaterials,
    subtotalContracts,
    subtotalConsumables,
    materialRatePerUnit,
    contractRatePerUnit,
    labourRate,
    directCost,
    costPerUnit,
    overheadAmount,
    pceAmount,
    rateBeforeMargin,
    marginAmount,
    finalRate,
    roundedFinalRate,
  };
};

export const computeItemQty = (item) => {
  const measuredQty = computeQtyFromMeasurementRows(
    item?.measurementRows,
    item?.unit,
  );
  if (measuredQty != null) return measuredQty;
  if (item?.dimensions?.enabled) {
    const v = computeQtyFromDimensions(item.dimensions, item.unit);
    return v == null ? Number(item.qty) || 0 : v;
  }
  return Number(item?.qty) || 0;
};

export const computeItemAmount = (item) => {
  const qty = computeItemQty(item);
  const ra = computeRateAnalysis(item?.rateAnalysis, item?.unit);
  const baseRate =
    item?.rateAnalysis?.enabled && item?.rateAnalysis?.useFinalRate
      ? Number(ra.roundedFinalRate) || 0
      : Number(item.rate) || 0;
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
  const commercial = {
    ...defaultCommercialControls(),
    ...(boq.commercial || {}),
  };
  const freightTransport = Number(commercial.freightTransport) || 0;
  const loadingUnloading = Number(commercial.loadingUnloading) || 0;
  const commercialAdditions = freightTransport + loadingUnloading;

  // Item Master rates already include labour in the item rate build-up. Only
  // BOQ-level contingency remains here to avoid double-counting labour.
  const laborPercent = 0;
  const contingencyPercent = Number(boq.contingencyPercent) || 0;
  const laborAmt = 0;
  const contingencyAmt = (afterBoqDiscount * contingencyPercent) / 100;
  const baseForGst =
    afterBoqDiscount + laborAmt + contingencyAmt + commercialAdditions;

  // Re-apportion GST proportional to the final taxable base (post-discount,
  // post-contingency). Cleaner than recomputing per item — keeps
  // the rate breakdown intact while honouring every BOQ-level markup.
  const scale = taxable > 0 ? baseForGst / taxable : 0;
  const scaledGstByRate = {};
  let totalGst = 0;
  for (const [rate, amt] of Object.entries(gstByRate)) {
    const s = amt * scale;
    scaledGstByRate[rate] = s;
    totalGst += s;
  }

  const grandTotalBeforeRoundOff = baseForGst + totalGst;
  const roundOff = Number(commercial.roundOff) || 0;
  const grandTotal = grandTotalBeforeRoundOff + roundOff;
  const retentionAmt = (grandTotal * (Number(commercial.retentionPercent) || 0)) / 100;
  const mobilizationAdvanceAmt = Number(commercial.mobilizationAdvance) || 0;
  const netPayableAfterAdvance = Math.max(0, grandTotal - mobilizationAdvanceAmt);
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
    commercialAdditions,
    freightTransport,
    loadingUnloading,
    baseForGst,
    gstByRate: scaledGstByRate,
    totalGst,
    grandTotalBeforeRoundOff,
    roundOff,
    grandTotal,
    retentionPercent: Number(commercial.retentionPercent) || 0,
    retentionAmt,
    mobilizationAdvanceAmt,
    netPayableAfterAdvance,
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
    const list = JSON.parse(localStorage.getItem(INDEX_KEY) || "[]");
    return list.map((b) => {
      if (b.status === "procurement") {
        return { ...b, status: "issued_for_procurement" };
      }
      return b;
    });
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

const normalizeRateAnalysis = (rateAnalysis = {}, unit = "") => ({
  ...blankRateAnalysis(unit),
  ...rateAnalysis,
  unit: rateAnalysis?.unit || unit || "",
  materialItems: withIds(rateAnalysis?.materialItems, blankRateAnalysisRow),
  contractItems: withIds(rateAnalysis?.contractItems, blankRateAnalysisRow),
});

// Resolve an item's rate analysis on read, auto-seeding its material rows from
// the proposal materials carried on the item (`item.materials`) the first time
// it is normalized. This is what makes proposal materials show up in Rate
// Analysis for BOQs that were generated before the seed existed — no
// regeneration needed. Idempotent via the `materialsSeeded` flag, and it never
// runs once the estimator has added their own material rows.
const resolveSeededRateAnalysis = (item = {}) => {
  const unit = item.unit || "nos";
  let ra = normalizeRateAnalysis(item.rateAnalysis, unit);
  const materials = Array.isArray(item.materials) ? item.materials : [];
  if (!ra.materialsSeeded && (ra.materialItems || []).length === 0 && materials.length > 0) {
    ra = normalizeRateAnalysis(
      seedRateAnalysisFromMaterials(ra, materials, unit),
      unit,
    );
  }
  return computeRateAnalysis(ra, unit);
};

const normalizeItem = (item = {}) => ({
  ...blankItem(),
  ...item,
  id: item.id || genShortId(),
  hierarchy: {
    ...defaultProjectHierarchy(),
    ...(item.hierarchy || {}),
  },
  details: {
    ...defaultItemDetails(),
    ...(item.details || {}),
    brandMakeModel:
      item.details?.brandMakeModel || item.brandMakeModel || item.spec || "",
    finishColorGrade:
      item.details?.finishColorGrade || item.finishColorGrade || "",
  },
  discount: {
    type: item.discount?.type || "percent",
    value: Number(item.discount?.value) || 0,
  },
  dimensions: {
    enabled: !!item.dimensions?.enabled,
    length: Number(item.dimensions?.length) || 0,
    breadth: Number(item.dimensions?.breadth ?? item.dimensions?.width) || 0,
    height: Number(item.dimensions?.height) || 0,
  },
  materials: Array.isArray(item.materials) ? item.materials : [],
  measurementRows: withIds(item.measurementRows, blankMeasurementRow),
  rateAnalysis: resolveSeededRateAnalysis(item),
  vendorComparisons: withIds(item.vendorComparisons, blankVendorComparison),
});

const normalizeSection = (section = {}) => ({
  ...blankSection(section.name || "New Section"),
  ...section,
  id: section.id || genShortId(),
  category:
    section.category in LEGACY_SECTION_CATEGORY
      ? LEGACY_SECTION_CATEGORY[section.category]
      : section.category || "",
  vendorComparisons: withIds(section.vendorComparisons, blankVendorComparison),
  items: (section.items || []).map(normalizeItem),
});

export const normalizeBoq = (boq = {}) => {
  const migrated = migrateSectionCategory(boq) || {};
  const revisionComparison = {
    ...blankRevisionComparison(),
    ...(migrated.revisionComparison || {}),
    summary: {
      ...blankRevisionComparison().summary,
      ...(migrated.revisionComparison?.summary || {}),
    },
    changes: Array.isArray(migrated.revisionComparison?.changes)
      ? migrated.revisionComparison.changes
      : [],
  };

  return {
    ...migrated,
    schemaVersion: BOQ_SCHEMA_VERSION,
    boqType: migrated.boqType || "client",
    hierarchy: {
      ...defaultProjectHierarchy(),
      ...(migrated.hierarchy || {}),
    },
    sections: (migrated.sections || []).map(normalizeSection),
    commercial: {
      ...defaultCommercialControls(),
      ...(migrated.commercial || {}),
    },
    comments: withIds(migrated.comments, blankBoqComment),
    approval: mergeApproval(migrated.approval),
    auditTrail: Array.isArray(migrated.auditTrail) ? migrated.auditTrail : [],
    revisionHistory: Array.isArray(migrated.revisionHistory)
      ? migrated.revisionHistory
      : [],
    revisionComparison,
    procurement: {
      issued: false,
      issuedAt: "",
      issuedBy: "",
      contractId: "",
      ...(migrated.procurement || {}),
    },
  };
};

export const getBoq = (id) => {
  if (!id) return null;
  try {
    const raw = localStorage.getItem(ITEM_KEY(id));
    if (!raw) return null;
    const parsed = normalizeBoq(JSON.parse(raw));
    if (parsed.status === "procurement") {
      parsed.status = "issued_for_procurement";
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveBoq = (boq) => {
  const next = {
    ...normalizeBoq(boq),
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
    boqType: next.boqType,
    parentType: next.parentType,
    parentId: next.parentId,
    clientName: next.client?.name || "",
    procurementIssued: !!next.procurement?.issued,
    procurementIssuedAt: next.procurement?.issuedAt || "",
    contractId: next.procurement?.contractId || "",
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
    orgSnapshot: null,
    approval: DEFAULT_BOQ_APPROVAL,
    comments: [],
    auditTrail: [],
    revisionComparison: blankRevisionComparison(),
    procurement: {
      issued: false,
      issuedAt: "",
      issuedBy: "",
      contractId: "",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // Regenerate inner IDs so the copy has its own row identity
  next.sections = (next.sections || []).map((s) => ({
    ...s,
    id: genShortId(),
    items: (s.items || []).map((it) => ({
      ...it,
      id: genShortId(),
      measurementRows: withIds(it.measurementRows, blankMeasurementRow),
      vendorComparisons: withIds(it.vendorComparisons, blankVendorComparison),
    })),
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
  hierarchy: defaultProjectHierarchy(),
  details: defaultItemDetails(),
  qty: 1,
  unit: "nos",
  rate: 0,
  gstPercent: 18,
  discount: { type: "percent", value: 0 },
  dimensions: { enabled: false, length: 0, breadth: 0, height: 0 },
  materials: [],
  measurementRows: [],
  rateAnalysis: blankRateAnalysis("nos"),
  vendorComparisons: [],
});

export const blankSection = (name = "New Section") => ({
  id: genShortId(),
  name,
  category: "",
  vendorComparisons: [],
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
            // Map the proposal's quantity, unit and rate when the scope row
            // carries a real per-unit rate; otherwise fall back to a lump-sum
            // line (qty 1 × amount).
            qty: Number(scope.qty) > 0 ? Number(scope.qty) : 1,
            unit: Number(scope.rate) > 0 ? scope.unit || "nos" : "ls",
            rate:
              Number(scope.rate) > 0
                ? Number(scope.rate)
                : Number(scope.amount) || 0,
            materials: scope.materials || [],
            // Pre-fill the rate build-up from the proposal's materials.
            rateAnalysis: seedRateAnalysisFromMaterials(
              null,
              scope.materials || [],
              Number(scope.rate) > 0 ? scope.unit || "nos" : "ls",
            ),
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
    boqType: "client",
    status: "draft",
    revision: 1,
    client,
    project,
    hierarchy: defaultProjectHierarchy(),
    sections,
    discount: { type: "percent", value: 0 },
    // Markup applied to the internal cost to produce the client-facing quote.
    // BOQ = cost; quote = cost × (1 + margin). Persisted so the spread (gross
    // margin) is never lost (Rail 💰). See computeQuoteFromBoq.
    marginPercent: 0,
    // Optional BOQ-level contingency on the post-discount taxable base. Labour
    // lives inside Item Master rates, so it is not added again at BOQ level.
    contingencyPercent: 0,
    commercial: defaultCommercialControls(),
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
    comments: [],
    approval: DEFAULT_BOQ_APPROVAL,
    auditTrail: [],
    revisionComparison: blankRevisionComparison(),
    procurement: {
      issued: false,
      issuedAt: "",
      issuedBy: "",
      contractId: "",
    },
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
  const cost = totals.baseForGst; // ex-GST internal cost, incl. contingency
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
