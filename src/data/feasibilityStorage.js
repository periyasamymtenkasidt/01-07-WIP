// Feasibility & Due Diligence — the architecture-only Phase 0 front-end.
//
// For Interiors the front-end is a measured Survey; for Architecture it's this:
// you can't design or price until the land is verified. Three work-streams
// (Legal, Planning, Site Survey) each reach a status, then a Go/No-Go gate opens
// the architecture design pipeline (the buildable envelope becomes the basis).
//
// Stored per-site under `feasibility_<siteID>`, mirroring the other modules.

import { getSite } from "./siteStorage";
import { tokens } from "../api/client";
import {
  getFeasibility as apiGetFeasibility,
  putFeasibility,
  feasibilityDecision,
} from "../api/sites";

const feasibilityKey = (siteID) => `feasibility_${siteID}`;

// Backend write-through helper. Best-effort, fire-and-forget: a failed call must
// never break the optimistic local write, so we swallow every error.
const pushFeas = (fn) => {
  try {
    Promise.resolve(fn()).catch((e) =>
      console.warn("feasibilityStorage: write-through failed", e),
    );
  } catch (e) {
    console.warn("feasibilityStorage: write-through threw", e);
  }
};

// Resolve the backend Mongo id for a site from its cached record; the API
// addresses feasibility by the site's Mongo `id`. Skip the API if local-only.
const backendSiteId = (siteID) => getSite(siteID)?.id || null;

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
    console.error("Failed to save feasibility:", e);
  }
};

export const SECTION_STATUSES = ["Pending", "Cleared", "Issue"];

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
};

const blankFeasibility = () => ({
  legal: { status: "Pending", ownership: "", ecRef: "", notes: "" },
  planning: {
    status: "Pending",
    landUse: "",
    fsi: "",
    maxBuiltUp: "",
    heightLimit: "",
    authority: "",
    notes: "",
  },
  survey: {
    status: "Pending",
    plotDimensions: "",
    soilSBC: "",
    orientation: "",
    notes: "",
  },
  documents: [], // [{ id, name, fileId, mime, fromVisit? }]
  decision: "", // "" | "Go" | "No-Go"
  decidedAt: null,
  seededFromVisit: false,
  history: [],
});

export const getFeasibility = (siteID) =>
  readJson(feasibilityKey(siteID), blankFeasibility());

const write = (siteID, feas) => {
  writeJson(feasibilityKey(siteID), feas);
  window.dispatchEvent(new Event("feasibilityChanged"));
  // Backend write-through: PUT the whole feasibility record (single persist
  // point for every field/status/document writer). Resolve the Mongo id from
  // the cached site; skip if local-only. Best-effort — never blocks the UI.
  const id = backendSiteId(siteID);
  if (id) pushFeas(() => putFeasibility(id, feas));
  return feas;
};

// One-time carry-over from the lead's preliminary visit: pre-fill the planning/
// survey fields and bring the visit's documents into feasibility so nothing is
// re-entered. Only fills empties; only runs once.
export const seedFeasibilityFromVisit = (siteID, visit) => {
  const feas = getFeasibility(siteID);
  if (feas.seededFromVisit || !visit?.done) return feas;

  if (visit.approxFSI && !feas.planning.fsi) feas.planning.fsi = visit.approxFSI;
  if (visit.plotRead && !feas.survey.plotDimensions)
    feas.survey.plotDimensions = visit.plotRead;
  const siteNote = [
    visit.access && `Access: ${visit.access}`,
    visit.condition && `Condition: ${visit.condition}`,
    visit.notes,
  ]
    .filter(Boolean)
    .join(" · ");
  if (siteNote && !feas.survey.notes) feas.survey.notes = siteNote;
  if (Array.isArray(visit.documents) && visit.documents.length) {
    feas.documents = [
      ...(feas.documents || []),
      ...visit.documents.map((d) => ({ ...d, fromVisit: true })),
    ];
  }
  feas.seededFromVisit = true;
  return write(siteID, feas);
};

export const addFeasibilityDocument = (siteID, doc) => {
  const feas = getFeasibility(siteID);
  feas.documents = [...(feas.documents || []), doc];
  return write(siteID, feas);
};

export const removeFeasibilityDocument = (siteID, docId) => {
  const feas = getFeasibility(siteID);
  feas.documents = (feas.documents || []).filter((d) => d.id !== docId);
  return write(siteID, feas);
};

// Patch a single field within a section (legal/planning/survey).
export const setFeasibilityField = (siteID, section, field, value) => {
  const feas = getFeasibility(siteID);
  feas[section] = { ...feas[section], [field]: value };
  return write(siteID, feas);
};

export const setSectionStatus = (siteID, section, status) =>
  setFeasibilityField(siteID, section, "status", status);

// All three streams cleared → eligible for a Go decision.
export const isFeasibilityComplete = (feas) =>
  ["legal", "planning", "survey"].every((s) => feas?.[s]?.status === "Cleared");

export const setDecision = (siteID, decision, note = "") => {
  const feas = getFeasibility(siteID);
  feas.decision = decision;
  feas.decidedAt = stamp();
  feas.history = [
    { at: stamp(), action: `Feasibility decision: ${decision}` },
    ...(feas.history || []),
  ];
  // write() handles the PUT write-through; record the Go/No-Go via the dedicated
  // decision endpoint too (resolve the Mongo id; skip if local-only).
  const id = backendSiteId(siteID);
  if (id) pushFeas(() => feasibilityDecision(id, { decision, note }));
  return write(siteID, feas);
};

// Backend hydration: pull the server's feasibility record into the local cache
// under `feasibility_<siteID>` so getFeasibility() reads it. No-op when logged
// out or local-only; on any error or empty/invalid response it leaves the
// existing localStorage untouched.
export async function hydrateFeasibility(siteID) {
  if (!tokens.access()) return;
  const id = backendSiteId(siteID);
  if (!id) return;
  let data;
  try {
    data = await apiGetFeasibility(id);
  } catch (e) {
    console.warn("hydrateFeasibility: failed to fetch feasibility", e);
    return;
  }
  // Tolerate a bare record or { feasibility: {...} } wrapper. Require the
  // section shape so we never overwrite good local data with an empty body.
  const feas = data?.feasibility || data;
  if (!feas || typeof feas !== "object" || !feas.legal) return;
  writeJson(feasibilityKey(siteID), feas);
  window.dispatchEvent(new Event("feasibilityChanged"));
}

// The buildable envelope handed to startDesign as the architecture "basis"
// (the analogue of the frozen survey measurements for interiors).
export const buildArchBasis = (siteID) => {
  const f = getFeasibility(siteID);
  return {
    kind: "architecture",
    landUse: f.planning.landUse,
    fsi: f.planning.fsi,
    maxBuiltUp: f.planning.maxBuiltUp,
    heightLimit: f.planning.heightLimit,
    authority: f.planning.authority,
    legalStatus: f.legal.status,
    plotDimensions: f.survey.plotDimensions,
    soilSBC: f.survey.soilSBC,
    frozenAt: stamp(),
  };
};
