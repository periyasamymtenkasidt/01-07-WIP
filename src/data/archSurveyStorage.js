// Architecture site survey measurements — the AS-IS existing-site take-off
// captured during the architecture survey. This is REFERENCE data only: final
// BOQ quantities are prepared later from approved design / GFC drawings, not
// from here.
//
// Stored per-site under `archSurvey_<siteID>`, mirroring the other storage
// modules (readJson/writeJson + a change event) so future consumers (design
// take-off, BOQ seed) can subscribe.

import {
  createBoq,
  saveBoq,
  getBoq,
  listBoqs,
  blankItem,
  blankSection,
} from "./boqStorage";
import { getClient } from "./clientStorage";

const KEY = (siteID) => `archSurvey_${siteID}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save arch survey:", e);
  }
};

export const genRowId = () =>
  `asm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

// Measurement units and how each computes a quantity from the L/B/H fields.
//   • area   — product of the non-zero dimensions among L, B, H
//   • length — the length only
//   • volume — product of the non-zero dimensions (L × B × H)
//   • count  — the Nos count itself (dimensions ignored)
export const UNIT_OPTIONS = [
  { code: "sqft", label: "sqft", kind: "area" },
  { code: "sqm", label: "sqm", kind: "area" },
  { code: "rmt", label: "rmt", kind: "length" },
  { code: "rft", label: "rft", kind: "length" },
  { code: "cft", label: "cft", kind: "volume" },
  { code: "cum", label: "cum", kind: "volume" },
  { code: "nos", label: "nos", kind: "count" },
];

export const unitKind = (unit) =>
  UNIT_OPTIONS.find((u) => u.code === unit)?.kind || "area";

// A blank measurement row with the survey-sheet columns from the design spec.
export const blankRow = () => ({
  id: genRowId(),
  blockTower: "",
  floor: "",
  roomArea: "",
  workCategory: "",
  subCategory: "",
  itemDescription: "",
  nos: "1",
  length: "",
  breadth: "",
  height: "",
  deduction: "",
  unit: "sqft",
  drawingRef: "",
  measuredBy: "",
  checkedBy: "",
  measurementDate: "",
  remarks: "",
});

// Net measured quantity for one row: Nos × (dimensional base) − deduction, per
// the unit's kind. Count units use Nos directly. Never negative.
export const computeNetQty = (row) => {
  const nos = Number(row.nos) || 0;
  const L = Number(row.length) || 0;
  const B = Number(row.breadth) || 0;
  const H = Number(row.height) || 0;
  const deduction = Number(row.deduction) || 0;
  const kind = unitKind(row.unit);

  if (kind === "count") return Math.max(0, nos - deduction);

  let base;
  if (kind === "length") {
    base = L;
  } else {
    // area / volume — multiply only the dimensions actually entered.
    const factors = [L, B, H].filter((v) => v > 0);
    base = factors.length ? factors.reduce((p, v) => p * v, 1) : 0;
  }
  // A blank Nos counts as a single instance so a plain L×B row still measures.
  const multiplier = nos > 0 ? nos : 1;
  return Math.max(0, multiplier * base - deduction);
};

// The required fields a row still needs before it can be a design take-off
// reference. An empty array means the row is ready.
export const rowMissing = (row) => {
  const missing = [];
  if (!String(row.workCategory || "").trim()) missing.push("Work Category");
  if (!String(row.itemDescription || "").trim())
    missing.push("Item Description");
  if (computeNetQty(row) <= 0) missing.push("Net Quantity");
  return missing;
};

export const isRowReady = (row) => rowMissing(row).length === 0;

// Roll-up used by the header stats and the Measurement Review panel.
export const summarize = (rows = []) => {
  const total = rows.length;
  let ready = 0;
  const unitTotals = {}; // unit code → summed net qty
  const catMap = {}; // work category → { unit → summed net qty }

  for (const row of rows) {
    if (isRowReady(row)) ready += 1;
    const qty = computeNetQty(row);
    if (qty > 0) {
      unitTotals[row.unit] = (unitTotals[row.unit] || 0) + qty;
      const cat = String(row.workCategory || "").trim() || "Uncategorized";
      catMap[cat] = catMap[cat] || {};
      catMap[cat][row.unit] = (catMap[cat][row.unit] || 0) + qty;
    }
  }

  const categoryTotals = Object.entries(catMap)
    .map(([category, units]) => ({ category, units }))
    .sort((a, b) => a.category.localeCompare(b.category));

  return {
    total,
    ready,
    needsCorrection: total - ready,
    unitTotals,
    categoryTotals,
  };
};

// Trim a quantity for display: up to 3 decimals, no trailing zeros.
export const fmtQty = (n) => {
  const v = Number(n) || 0;
  return v.toFixed(3).replace(/\.?0+$/, (m) => (m.includes(".") ? "" : m));
};

// "120 sqft · 45 rmt" from a { unit: qty } map, or "-" when empty.
export const formatUnitTotals = (unitTotals = {}) => {
  const parts = Object.entries(unitTotals)
    .filter(([, q]) => q > 0)
    .map(([unit, q]) => `${fmtQty(q)} ${unit}`);
  return parts.length ? parts.join(" · ") : "-";
};

const emptyState = () => ({ rows: [], savedAt: null });

export const getArchSurvey = (siteID) => {
  if (!siteID) return emptyState();
  const data = readJson(KEY(siteID), emptyState());
  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    savedAt: data.savedAt || null,
  };
};

export const saveArchSurvey = (siteID, rows) => {
  const next = { rows: rows || [], savedAt: new Date().toISOString() };
  writeJson(KEY(siteID), next);
  window.dispatchEvent(new Event("archSurveyChanged"));
  return next;
};

// ── Tender BOQ generation ────────────────────────────────────────────────────
//
// Generate (or refresh) the Tender BOQ in the MAIN BOQ module from the ready
// survey rows. The BOQ module stays the single source of truth for quantities,
// rates, GST, the tender lifecycle and bid comparison — this only seeds it. The
// stable id `BOQ-TENDER-<siteID>` lets a re-generate update the same draft
// instead of spawning duplicates; an already-issued (non-draft) tender BOQ is
// left untouched and just opened. Returns the BOQ id, or null when there are no
// ready rows to generate from.
export const generateTenderBoqFromArchSurvey = (site) => {
  const siteID = site?.siteID;
  if (!siteID) return null;
  const readyRows = getArchSurvey(siteID).rows.filter(isRowReady);
  if (readyRows.length === 0) return null;

  const boqId = `BOQ-TENDER-${siteID}`;
  const summary = listBoqs().find((b) => b.id === boqId);
  let boq = summary ? getBoq(summary.id) : null;

  // Don't overwrite an issued/approved tender BOQ — just hand its id back.
  if (boq && boq.status && boq.status !== "draft") return boq.id;

  if (!boq) {
    const linkedClient = site.clientID ? getClient(site.clientID) : null;
    boq = createBoq({
      title: `Tender BOQ — ${site.clientName || site.fullAddress || siteID}`,
      boqType: "tender",
      parentType: "client",
      parentId: site.clientID || "",
      client: { name: site.clientName || "", id: site.clientID || "" },
      project: {
        siteID,
        name: site.fullAddress || "",
        propertyType: site?.siteType || linkedClient?.propertyType || linkedClient?.location || "",
        sizeRange: linkedClient?.sizeRange || "",
      },
    });
    boq.id = boqId;
  }

  // Group ready rows by work category → section; each row → a BOQ line item.
  const groups = {};
  const order = [];
  for (const r of readyRows) {
    const key = String(r.workCategory || "").trim() || "General";
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(r);
  }

  boq.sections = order.map((cat) => {
    const section = blankSection(cat);
    section.category = cat;
    section.items = groups[cat].map((r) => {
      const L = Number(r.length) || 0;
      const B = Number(r.breadth) || 0;
      const H = Number(r.height) || 0;
      return {
        ...blankItem(),
        description: r.itemDescription,
        unit: r.unit,
        qty: computeNetQty(r),
        rate: 0,
        gstPercent: 18,
        dimensions: {
          enabled: L > 0 || B > 0 || H > 0,
          length: L,
          breadth: B,
          height: H,
          nos: Number(r.nos) || 1,
        },
        hierarchy: {
          blockTower: r.blockTower || "",
          floor: r.floor || "",
          roomArea: r.roomArea || "",
          workCategory: r.workCategory || "",
          subCategory: r.subCategory || "",
        },
        details: {
          drawingRefNo: r.drawingRef || "",
          remarks: r.remarks || "",
        },
        source: "arch-survey",
        siteID,
      };
    });
    return section;
  });

  boq.status = "draft";
  boq.siteID = siteID;
  return saveBoq(boq).id;
};

// ── Design Take-off (Tender stage) ──────────────────────────────────────────
// Take-off rows are prepared from approved construction drawings and refined
// against the AS-IS site survey. Only "approved" rows feed the Tender BOQ.

export const TAKEOFF_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "checked", label: "Checked" },
  { value: "approved", label: "Approved" },
];

export const blankTakeoffRow = () => ({
  id: genRowId(),
  blockTower: "",
  floor: "",
  roomArea: "",
  workCategory: "",
  subCategory: "",
  itemDescription: "",
  drawingRef: "",
  drawingRevision: "",
  specificationCode: "",
  nos: "1",
  length: "",
  breadth: "",
  height: "",
  deduction: "",
  unit: "sqft",
  measuredBy: "",
  measurementDate: "",
  status: "draft",
  checkedBy: "",
  approvedBy: "",
  approvalTrace: "",
  remarks: "",
  source: "manual",
});

export const summarizeTakeoff = (rows = []) => {
  let draft = 0,
    checked = 0,
    approved = 0;
  const unitTotals = {};
  for (const row of rows) {
    if (row.status === "draft") draft++;
    else if (row.status === "checked") checked++;
    else if (row.status === "approved") approved++;
    if (row.status === "approved") {
      const qty = computeNetQty(row);
      if (qty > 0) unitTotals[row.unit] = (unitTotals[row.unit] || 0) + qty;
    }
  }
  return { total: rows.length, draft, checked, approved, unitTotals };
};

const TAKEOFF_KEY = (siteID) => `designTakeoff_${siteID}`;

export const getTakeoff = (siteID) => {
  if (!siteID) return { rows: [], savedAt: null };
  const data = readJson(TAKEOFF_KEY(siteID), { rows: [], savedAt: null });
  return {
    rows: Array.isArray(data.rows) ? data.rows : [],
    savedAt: data.savedAt || null,
  };
};

export const saveTakeoff = (siteID, rows) => {
  const next = { rows: rows || [], savedAt: new Date().toISOString() };
  writeJson(TAKEOFF_KEY(siteID), next);
  window.dispatchEvent(new Event("designTakeoffChanged"));
  return next;
};

export const importSurveyAsTakeoff = (surveyRows = []) =>
  surveyRows.map((r) => ({
    ...blankTakeoffRow(),
    id: genRowId(),
    blockTower: r.blockTower || "",
    floor: r.floor || "",
    roomArea: r.roomArea || "",
    workCategory: r.workCategory || "",
    subCategory: r.subCategory || "",
    itemDescription: r.itemDescription || "",
    drawingRef: r.drawingRef || "",
    nos: r.nos || "1",
    length: r.length || "",
    breadth: r.breadth || "",
    height: r.height || "",
    deduction: r.deduction || "",
    unit: r.unit || "sqft",
    measuredBy: r.measuredBy || "",
    measurementDate: r.measurementDate || "",
    checkedBy: r.checkedBy || "",
    source: "site-survey",
    status: "draft",
  }));

export const generateTenderBoqFromTakeoff = (site, rows) => {
  const siteID = site?.siteID;
  if (!siteID) return null;
  const approvedRows = (rows || []).filter((r) => r.status === "approved");
  if (approvedRows.length === 0) return null;

  const boqId = `BOQ-TENDER-${siteID}`;
  const existing = listBoqs().find((b) => b.id === boqId);
  let boq = existing ? getBoq(existing.id) : null;

  if (boq && boq.status && boq.status !== "draft") return boq.id;

  if (!boq) {
    const linkedClient = site.clientID ? getClient(site.clientID) : null;
    boq = createBoq({
      title: `Tender BOQ — ${site.clientName || site.fullAddress || siteID}`,
      boqType: "tender",
      parentType: "client",
      parentId: site.clientID || "",
      client: { name: site.clientName || "", id: site.clientID || "" },
      project: {
        siteID,
        name: site.fullAddress || "",
        propertyType: site?.siteType || linkedClient?.propertyType || linkedClient?.location || "",
        sizeRange: linkedClient?.sizeRange || "",
      },
    });
    boq.id = boqId;
  }

  const groups = {};
  const order = [];
  for (const r of approvedRows) {
    const key = String(r.workCategory || "").trim() || "General";
    if (!groups[key]) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(r);
  }

  boq.sections = order.map((cat) => {
    const section = blankSection(cat);
    section.category = cat;
    section.items = groups[cat].map((r) => {
      const L = Number(r.length) || 0;
      const B = Number(r.breadth) || 0;
      const H = Number(r.height) || 0;
      return {
        ...blankItem(),
        description: r.itemDescription,
        unit: r.unit,
        qty: computeNetQty(r),
        rate: 0,
        gstPercent: 18,
        dimensions: {
          enabled: L > 0 || B > 0 || H > 0,
          length: L,
          breadth: B,
          height: H,
          nos: Number(r.nos) || 1,
        },
        hierarchy: {
          blockTower: r.blockTower || "",
          floor: r.floor || "",
          roomArea: r.roomArea || "",
          workCategory: r.workCategory || "",
          subCategory: r.subCategory || "",
        },
        details: {
          drawingRefNo: r.drawingRef || "",
          drawingRevision: r.drawingRevision || "",
          specificationCode: r.specificationCode || "",
          remarks: r.remarks || "",
        },
        source: "design-takeoff",
        siteID,
      };
    });
    return section;
  });

  boq.status = "draft";
  boq.siteID = siteID;
  return saveBoq(boq).id;
};
