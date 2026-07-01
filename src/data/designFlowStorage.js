// Design flow storage — the survey → design handoff.
//
// When the survey is frozen via "Move to Design", we snapshot the site's
// measurements + photos as an immutable "Site Basis" and open the design
// pipeline (four stages). Everything BEFORE the freeze is as-is site truth;
// everything after is the to-be proposal designed on top of that frozen basis.
//
// Stored per-site under `designFlow_<siteID>`, mirroring the other storage
// modules (readJson/writeJson + a change event).

import { saveSite, getSite } from "./siteStorage";
import {
  readDims,
  getElementMeasurement,
  qtyFor,
  getSiteServiceTrack,
  getSiteLead,
  getProposalBaselineForSite,
} from "./surveyMeasureStorage";
import { listLibrary } from "./itemLibrary";
import { saveBoq, getBoq, createBoq, listBoqs, genShortId } from "./boqStorage";
import { tokens } from "../api/client";
import * as designFlowApi from "../api/designFlow";
import {
  freezeSurvey as apiFreezeSurvey,
  unfreezeSurvey as apiUnfreezeSurvey,
} from "../api/sites";

// ── Backend write-through (best-effort) ──────────────────────────────────────
//
// This module is the survey→design fat-object cache; every mutation keeps its
// optimistic local write and ADDITIONALLY mirrors to the API. A failed/absent
// backend must never break the local write, so every push is fire-and-forget
// and swallows its error. No-op when logged out.
const pushApi = (fn) => {
  if (!tokens.access()) return;
  try {
    Promise.resolve(fn()).catch((e) =>
      console.warn("designFlow API write-through failed:", e),
    );
  } catch (e) {
    console.warn("designFlow API write-through failed:", e);
  }
};

// Resolve a cached stage's backend id (attached during hydrateDesignFlow). When
// absent — flow created offline, or hydrate hasn't run / didn't match — callers
// SKIP the API call and stay local-only.
const backendStageId = (flow, stageKey) => {
  const s = getStage(flow, stageKey);
  return s?.backendId ?? s?.id ?? null;
};

// The design-flow / freeze endpoints key off the site's backend Mongo id, NOT
// the business siteID (ST-…). Resolve it from the cached site; null → the site
// isn't backend-synced yet, so skip the API call and stay local-only.
const backendSiteId = (siteID) => {
  const s = getSite(siteID);
  return s?.id ?? s?._id ?? null;
};

const designFlowKey = (siteID) => `designFlow_${siteID}`;
const designFlowArchiveKey = (siteID) => `designFlowArchive_${siteID}`;

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
    console.error("Failed to save design flow:", e);
  }
};

// The four design stages, in order. Each later runs the same
// submit → approve → revise loop (built in the Design workspace). They're
// created up front so the whole pipeline is visible the moment design starts.
//
// The pipeline is DATA, selected by the project's service track — the same
// stage-gate engine renders whichever list applies.

// Interiors — fit out an existing space.
export const INTERIORS_PIPELINE = [
  {
    key: "CONCEPT",
    label: "Concept Design",
    question: "Approve the look & direction",
    deliverableTypes: ["Mood Board", "Space Plan", "Reference"],
  },
  {
    key: "DEVELOPMENT",
    label: "Design Development",
    question: "Approve the 3D look & materials",
    deliverableTypes: ["3D Render", "Material List", "2D Detail"],
  },
  {
    key: "DRAWINGS",
    label: "Working Drawings",
    question: "Approve the construction detail",
    deliverableTypes: ["2D Drawing", "Section", "Document"],
  },
  {
    key: "BOQ",
    label: "BOQ & Costing",
    question: "Approve the price",
    deliverableTypes: [],
  },
];

// Architecture — build from land. Note the statutory-approval gate (sanctioned
// by an authority, not the client) and the tender/construction-admin tail.
export const ARCHITECTURE_PIPELINE = [
  {
    key: "SCHEMATIC",
    label: "Schematic Design",
    question: "Approve the direction & massing",
    deliverableTypes: ["Site Plan", "Massing", "Concept"],
    feeWeight: 20,
  },
  {
    key: "DESIGN_DEV",
    label: "Design Development",
    question: "Approve the developed design",
    deliverableTypes: ["Plans", "Sections", "Elevations", "MEP"],
    feeWeight: 20,
  },
  {
    key: "APPROVALS",
    label: "Statutory Approvals",
    question: "Submission for authority sanction",
    deliverableTypes: ["Sanction Drawing", "NOC", "Form"],
    feeWeight: 15,
  },
  {
    key: "CONSTRUCTION_DOCS",
    label: "Construction Documents",
    question: "Approve the buildable set",
    deliverableTypes: ["GFC Drawing", "Detail", "Spec"],
    feeWeight: 20,
  },
  {
    key: "TENDER",
    label: "Tender",
    question: "Approve contractor & price",
    deliverableTypes: ["Tender BOQ", "Bid Evaluation"],
    feeWeight: 5,
  },
  {
    key: "CONSTRUCTION_ADMIN",
    label: "Construction Administration",
    question: "Progress & payment certificates",
    deliverableTypes: ["Site Report", "Payment Cert", "RFI"],
    feeWeight: 20,
  },
];

export const getPipeline = (track) =>
  track === "Architecture" ? ARCHITECTURE_PIPELINE : INTERIORS_PIPELINE;

// Back-compat alias for interiors-only callers (e.g. the survey freeze preview).
export const DESIGN_STAGES = INTERIORS_PIPELINE;

// Contractual free revision rounds per stage; extra rounds get flagged billable.
const DEFAULT_ROUNDS_INCLUDED = 2;

// ── Internal design review (PDF §1–2) ────────────────────────────────────────
//
// Before a stage goes to the client, it clears an internal sign-off chain. The
// firm has no real auth yet, so the acting role is *chosen* at the moment of
// sign-off (logged, not authenticated) — same limitation as the schedule log.
// Principal Architect is the final internal authority (PDF: "Who is authorized
// to approve designs? Principal Architect").
export const INTERNAL_ROLES = [
  "Intern",
  "Junior Architect",
  "Senior Architect",
  "Principal Architect",
];

// The Design Review Checklist (PDF §2). Reviewed during internal review; the
// Principal can't finalise until every item is answered.
export const DESIGN_REVIEW_CHECKLIST = [
  "Client requirements have been addressed",
  "Design aligns with approved concept/theme",
  "Space planning is functional and efficient",
  "Circulation and movement paths are clear",
  "Furniture layout is practical",
  "Material selections are approved",
  "Colour palette is consistent",
  "Lighting design is adequate for the space",
  "Ceiling design coordinated with lighting & HVAC",
  "Dimensions have been checked",
  "Architectural, Structural & MEP drawings coordinated",
  "Accessibility requirements considered",
  "Safety requirements considered",
  "Material specifications are complete",
  "Drawings follow office standards",
  "Sheet numbers and titles are correct",
  "Renders match drawings and specifications",
];

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
};

export const getDesignFlow = (siteID) => readJson(designFlowKey(siteID), null);

export const isDesignStarted = (siteID) => !!getDesignFlow(siteID);

// ── Backend hydration ────────────────────────────────────────────────────────
//
// Pull the server's design flow into the local fat-object cache and, crucially,
// attach each server stage's `id` onto the matching local stage as `backendId`
// so subsequent mutations can address /design-stages/:id/*.
//
// SAFE-BY-DEFAULT: the server stage shape is UNVERIFIED. GET design-flow returns
// `{ flow, stages[] }` (stages ordered, each with its own id), but the exact
// field names inside each stage (reviewState? deliverables? internal{}?) are not
// confirmed against a live API. So we DO NOT trust the server to fully rebuild
// the fat object — instead we keep the existing local flow as the source of
// truth for shape, and only:
//   1. merge the server `flow` scalars in shallowly (non-destructively), and
//   2. map each server stage's id onto the local stage by KEY, else by ORDER.
// If we have no local flow yet, we best-effort build a minimal one from the
// server stages, but never throw. If the response is missing/empty/throws, the
// existing local flow is left completely untouched.
export async function hydrateDesignFlow(siteID) {
  if (!tokens.access() || !siteID) return getDesignFlow(siteID);

  const mongoId = backendSiteId(siteID);
  if (!mongoId) return getDesignFlow(siteID); // not backend-synced yet

  let resp;
  try {
    resp = await designFlowApi.getDesignFlow(mongoId);
  } catch (e) {
    console.warn("hydrateDesignFlow: fetch failed, keeping local flow", e);
    return getDesignFlow(siteID);
  }

  // Tolerate either { flow, stages } or a bare object; bail (keep local) on
  // anything we can't read as a stage list.
  const serverFlow = resp?.flow && typeof resp.flow === "object" ? resp.flow : null;
  const serverStages = Array.isArray(resp?.stages)
    ? resp.stages
    : Array.isArray(resp?.flow?.stages)
      ? resp.flow.stages
      : null;
  if (!serverStages || serverStages.length === 0) {
    // Nothing usable came back — never overwrite a working local flow.
    return getDesignFlow(siteID);
  }

  const local = getDesignFlow(siteID);

  // Helper: pull a stage KEY out of a server stage record under whichever field
  // the backend happens to use (key/stageKey/code). UNVERIFIED.
  const serverKeyOf = (s) => s?.key ?? s?.stageKey ?? s?.code ?? null;
  // Helper: pull the server stage id (id/stageId/_id). UNVERIFIED.
  const serverIdOf = (s) => s?.id ?? s?.stageId ?? s?._id ?? null;

  try {
    if (local && Array.isArray(local.stages)) {
      // Preferred path: we already have the correct local shape. Just attach
      // backend ids onto the existing stages — by key, falling back to order.
      const byKey = new Map();
      serverStages.forEach((s) => {
        const k = serverKeyOf(s);
        if (k != null) byKey.set(String(k), s);
      });

      local.stages = local.stages.map((stage, i) => {
        const match =
          (stage.key != null && byKey.get(String(stage.key))) ||
          serverStages[i] || // order fallback (pipelines are created in order)
          null;
        const bid = match ? serverIdOf(match) : null;
        return bid != null ? { ...stage, backendId: bid } : stage;
      });

      // Merge server flow scalars non-destructively: keep local keys, fill only
      // ones the local object is missing, and never clobber `stages`.
      if (serverFlow) {
        const { stages: _ignore, ...rest } = serverFlow;
        for (const [k, v] of Object.entries(rest)) {
          if (local[k] === undefined) local[k] = v;
        }
      }

      writeJson(designFlowKey(siteID), local);
      window.dispatchEvent(new Event("designFlowChanged"));
      return local;
    }

    // No local flow yet. Build a minimal fat object from the server so the
    // pipeline can render — best-effort, defensive about every field. We map a
    // server stage key to its local pipeline label/order where possible.
    const track = serverFlow?.track || "Interiors";
    const built = {
      ...(serverFlow || {}),
      track,
      stages: serverStages.map((s, i) => {
        const key = serverKeyOf(s) ?? `STAGE_${i + 1}`;
        return {
          key,
          backendId: serverIdOf(s),
          reviewState: s?.reviewState ?? (i === 0 ? "DRAFTING" : "LOCKED"),
          round: Number(s?.round) || 1,
          roundsIncluded: Number(s?.roundsIncluded) || DEFAULT_ROUNDS_INCLUDED,
          deliverables: Array.isArray(s?.deliverables) ? s.deliverables : [],
          approvals: Array.isArray(s?.approvals) ? s.approvals : [],
          submittedAt: s?.submittedAt ?? null,
          approvedAt: s?.approvedAt ?? null,
          ...(s?.internal ? { internal: s.internal } : {}),
          ...(Array.isArray(s?.comments) ? { comments: s.comments } : {}),
          ...(s?.boq ? { boq: s.boq } : {}),
        };
      }),
      history: Array.isArray(serverFlow?.history) ? serverFlow.history : [],
    };
    writeJson(designFlowKey(siteID), built);
    window.dispatchEvent(new Event("designFlowChanged"));
    return built;
  } catch (e) {
    // Any mapping surprise → fall back to whatever local state we had.
    console.warn("hydrateDesignFlow: mapping failed, keeping local flow", e);
    return getDesignFlow(siteID);
  }
}

// Freeze the survey and open the design pipeline. `areas` is areasForSite(site)
// and `surveyState` is getSurveyMeasureState(site) — both captured onto the
// basis so design always references the site truth as it was at handoff.
// Idempotent: if design was already started, returns the existing flow untouched.
export const startDesign = (site, { areas, surveyState, basis } = {}) => {
  const existing = getDesignFlow(site.siteID);
  if (existing) return existing;

  // The project's service track selects which pipeline the engine renders.
  const track = getSiteServiceTrack(site);
  const pipeline = getPipeline(track);

  // Architecture passes a feasibility-derived `basis` (buildable envelope);
  // Interiors builds the basis from the frozen survey.
  const siteBasis = basis
    ? { ...basis, frozenAt: basis.frozenAt || stamp() }
    : {
        measurements: readDims(site.siteID),
        areas: (areas || []).map((a) => ({
          area: a.area,
          elements: (a.elements || []).map((el) => ({
            scopeItemId: el.scopeItemId || null,
            masterId: el.masterId || null,
            name: el.name,
            unit: el.unit,
            rate: Number(el.rate) || 0,
            quotedQty: Number(el.qty) || 0, // assumed quantity from the quote
            // hasRate/amount carry through so buildBoq doesn't re-price a flat
            // lump-sum room line by a measured sqft figure (see
            // surveyMeasureStorage.areasForSite for why this distinction exists).
            hasRate: !!el.hasRate,
            amount: Number(el.amount) || 0,
            materials: el.materials || [],
            isCustom: !!el.isCustom,
          })),
        })),
        proposalBaseline: getProposalBaselineForSite(site),
        total: surveyState?.total ?? 0,
        measured: surveyState?.measured ?? 0,
        totalSqft: surveyState?.totalSqft ?? 0,
        frozenAt: stamp(),
      };

  const flow = {
    track,
    stage: `DESIGN_${pipeline[0].key}`,
    // Immutable snapshot at handoff — the design's source of truth.
    siteBasis,
    stages: pipeline.map((s, i) => ({
      key: s.key,
      // Only the first stage is open for drafting; the rest unlock on approval.
      reviewState: i === 0 ? "DRAFTING" : "LOCKED",
      round: 1,
      roundsIncluded: DEFAULT_ROUNDS_INCLUDED,
      deliverables: [],
      approvals: [],
      submittedAt: null,
      approvedAt: null,
    })),
    history: [
      {
        at: stamp(),
        action: basis
          ? "Feasibility approved → Design started"
          : "Survey frozen → Design started",
      },
    ],
  };

  // Carry the lead's design-fee proposal into the pipeline so the fee panel
  // shows what was actually quoted, not a generic default. Normalize to the
  // panel's area × rate model so editing still works.
  if (track === "Architecture") {
    const fp = getSiteLead(site)?.feeProposal;
    if (fp) {
      const area =
        fp.basis === "area" && Number(fp.builtUpArea) > 0
          ? Number(fp.builtUpArea)
          : parseArea(basis?.maxBuiltUp) || Number(fp.builtUpArea) || 1;
      const rate =
        fp.basis === "area"
          ? Number(fp.feeRatePerSqft) || 0
          : (Number(fp.total) || 0) / area;
      flow.fee = { builtUpArea: area, feeRatePerSqft: rate };
    }
  }

  writeJson(designFlowKey(site.siteID), flow);
  // Flip the site into the Design stage so every list/badge reflects it.
  saveSite({ siteID: site.siteID, status: "Design" });
  window.dispatchEvent(new Event("designFlowChanged"));

  // Best-effort backend mirror: the server requires a FROZEN survey before a
  // flow can open, so freeze first, then start the flow, then hydrate to attach
  // the server stage ids onto the local stages. All keyed off the site's Mongo
  // id. Any failure (incl. 409 "already frozen") is ignored — the pure-local
  // flow above is unaffected. (Bodies are UNVERIFIED against the live API.)
  pushApi(async () => {
    const mongoId = backendSiteId(site.siteID);
    if (!mongoId) return; // site not backend-synced — stay local-only
    const pb = siteBasis.proposalBaseline || {};
    const freezeBody = {
      presetKey: pb.presetKey,
      propertyType: pb.propertyType,
      quote: pb.quoteId || null,
      items: siteBasis.areas || [],
      baseline: {
        subtotal: pb.subtotal,
        gst: pb.gst,
        grandTotal: pb.grandTotal,
      },
    };
    try {
      await apiFreezeSurvey(mongoId, freezeBody);
    } catch (e) {
      // 409 = already frozen; any other failure is non-fatal here.
      console.warn("startDesign: freeze-survey skipped/failed", e);
    }
    await designFlowApi.startDesign(mongoId, { track });
    await hydrateDesignFlow(site.siteID);
  });

  return flow;
};

export const unfreezeSurvey = (siteID) => {
  const flow = getDesignFlow(siteID);
  if (!flow) return null;

  // Unlocking is destructive to the active pipeline, so retain a versioned
  // snapshot for audit/history before opening the survey for re-measurement.
  const archive = readJson(designFlowArchiveKey(siteID), []);
  writeJson(designFlowArchiveKey(siteID), [
    { ...flow, archivedAt: stamp(), archiveReason: "Survey unlocked" },
    ...archive,
  ]);
  const boqId = flow.boqId || getStage(flow, "BOQ")?.boq?.editorBoqId;
  const linkedBoq = boqId ? getBoq(boqId) : null;
  if (linkedBoq) {
    saveBoq({
      ...linkedBoq,
      status: "draft",
      surveyStale: true,
      surveyStaleAt: new Date().toISOString(),
    });
  }
  saveSite({ siteID, status: "Survey", progress: 25 });
  localStorage.removeItem(designFlowKey(siteID));

  window.dispatchEvent(new Event("designFlowChanged"));
  window.dispatchEvent(new Event("siteDataChanged"));

  // Best-effort backend mirror: archive the server flow and reopen the survey.
  pushApi(async () => {
    const mongoId = backendSiteId(siteID);
    if (mongoId) await apiUnfreezeSurvey(mongoId);
  });
  return null;
};

// ── Stage actions — the submit → approve → revise loop ───────────────────────
//
// Firm side: edit deliverables (DRAFTING / REVISION_REQUESTED) → submitStage.
// Client side (portal): approveStage (unlocks next) or requestRevision (round++).

const writeFlow = (siteID, flow) => {
  writeJson(designFlowKey(siteID), flow);
  window.dispatchEvent(new Event("designFlowChanged"));
  return flow;
};

export const labelForStage = (key) =>
  [...INTERIORS_PIPELINE, ...ARCHITECTURE_PIPELINE].find((s) => s.key === key)
    ?.label || key;

export const getStage = (flow, key) =>
  flow?.stages?.find((s) => s.key === key) || null;

// The stage currently in play = the first one not yet approved.
export const currentStage = (flow) =>
  flow?.stages?.find((s) => s.reviewState !== "APPROVED") || null;

// A stage is over its included rounds → extra revisions are chargeable.
export const isStageBillable = (stage) =>
  !!stage && stage.round > stage.roundsIncluded;

// Firm edits the deliverables list (only meaningful while it owns the stage).
export const setStageDeliverables = (siteID, stageKey, deliverables) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  stage.deliverables = deliverables;
  const result = writeFlow(siteID, flow);
  const stageId = backendStageId(flow, stageKey);
  if (stageId != null)
    pushApi(() => designFlowApi.setStageDeliverables(stageId, deliverables));
  return result;
};

// Firm sends the stage to the client for sign-off.
export const submitStage = (siteID, stageKey) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  stage.reviewState = "AWAITING_CLIENT";
  stage.submittedAt = stamp();
  flow.history.unshift({
    at: stamp(),
    action: `${labelForStage(stageKey)} submitted to client (R${stage.round})`,
  });
  return writeFlow(siteID, flow);
};

// Client approves the stage → unlock the next one (or complete the pipeline).
export const approveStage = (siteID, stageKey, { by = "Client", comment = "" } = {}) => {
  const flow = getDesignFlow(siteID);
  const idx = flow?.stages?.findIndex((s) => s.key === stageKey) ?? -1;
  if (idx < 0) return flow;
  const stage = flow.stages[idx];
  stage.reviewState = "APPROVED";
  stage.approvedAt = stamp();
  stage.approvals.unshift({
    round: stage.round,
    decision: "APPROVED",
    by,
    comment,
    at: stamp(),
  });

  const next = flow.stages[idx + 1];
  if (next && next.reviewState === "LOCKED") {
    next.reviewState = "DRAFTING";
    flow.stage = `DESIGN_${next.key}`;
  } else if (!next) {
    flow.stage = "DESIGN_COMPLETE";
  }
  flow.history.unshift({
    at: stamp(),
    action: `Client approved ${labelForStage(stageKey)}`,
  });
  return writeFlow(siteID, flow);
};

// Client requests changes → bump the round, hand back to the firm.
export const requestRevision = (siteID, stageKey, { by = "Client", comment = "" } = {}) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  stage.approvals.unshift({
    round: stage.round,
    decision: "REVISION",
    by,
    comment,
    at: stamp(),
  });
  stage.round += 1;
  stage.reviewState = "REVISION_REQUESTED";
  const billable = isStageBillable(stage);
  flow.history.unshift({
    at: stamp(),
    action: `Client requested changes on ${labelForStage(stageKey)} (R${stage.round})${
      billable ? " — billable revision" : ""
    }`,
  });
  return writeFlow(siteID, flow);
};

// ── Internal review gate — Intern → … → Principal, before the client ─────────
//
// Replaces the old "straight to client" submit. The firm submits a drafted
// stage for internal review; each role signs off in turn; the Principal's final
// approval is what actually sends it to the client. Any reviewer can return it
// to the design team, which restarts the chain.

const blankChecklist = () =>
  DESIGN_REVIEW_CHECKLIST.map(() => ({ value: null, comment: "" }));

// Lazily attach the internal-review scaffold so flows created before this
// feature still work the moment they're reviewed.
const ensureInternal = (stage) => {
  if (!stage.internal) {
    stage.internal = { step: 0, signoffs: [], checklist: blankChecklist() };
  }
  if (!Array.isArray(stage.internal.checklist)) {
    stage.internal.checklist = blankChecklist();
  }
  if (!Array.isArray(stage.internal.signoffs)) stage.internal.signoffs = [];
  if (typeof stage.internal.step !== "number") stage.internal.step = 0;
  if (!Array.isArray(stage.comments)) stage.comments = [];
  return stage.internal;
};

// Every checklist item answered (Yes/No chosen).
export const checklistComplete = (stage) => {
  const cl = stage?.internal?.checklist;
  if (!Array.isArray(cl)) return false;
  return DESIGN_REVIEW_CHECKLIST.every((_, i) => cl[i] && cl[i].value);
};

// Open (un-closed) design comments still outstanding on a stage.
export const openCommentsCount = (stage) =>
  (stage?.comments || []).filter((c) => c.status !== "Closed").length;

// PDF final sign-off: all comments closed + checklist done before authorisation.
export const canFinalizeInternal = (stage) =>
  checklistComplete(stage) && openCommentsCount(stage) === 0;

// Firm submits a drafted stage into the internal review chain (R = round).
export const submitForInternalReview = (siteID, stageKey) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  ensureInternal(stage);
  stage.internal.step = 0;
  stage.internalKickback = null;
  stage.reviewState = "INTERNAL_REVIEW";
  stage.submittedForReviewAt = stamp();
  flow.history.unshift({
    at: stamp(),
    action: `${labelForStage(stageKey)} submitted for internal review (R${stage.round})`,
  });
  const result = writeFlow(siteID, flow);
  const stageId = backendStageId(flow, stageKey);
  if (stageId != null)
    pushApi(() => designFlowApi.submitInternalReview(stageId));
  return result;
};

// A reviewer signs off. The non-final roles just advance the chain; the
// Principal's sign-off (the last role) is what submits the stage to the client.
export const internalApprove = (
  siteID,
  stageKey,
  { role = INTERNAL_ROLES[0], comment = "" } = {},
) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  ensureInternal(stage);
  const isFinal = stage.internal.step >= INTERNAL_ROLES.length - 1;
  // The final authorisation is gated on the checklist + comment register.
  if (isFinal && !canFinalizeInternal(stage)) return flow;

  stage.internal.signoffs.unshift({
    role,
    decision: "APPROVED",
    comment,
    round: stage.round,
    at: stamp(),
  });

  if (isFinal) {
    stage.reviewState = "AWAITING_CLIENT";
    stage.submittedAt = stamp();
    flow.history.unshift({
      at: stamp(),
      action: `Internal approval complete (${role}) → ${labelForStage(stageKey)} submitted to client`,
    });
  } else {
    stage.internal.step += 1;
    flow.history.unshift({
      at: stamp(),
      action: `${role} approved ${labelForStage(stageKey)} (internal)`,
    });
  }
  const result = writeFlow(siteID, flow);
  const stageId = backendStageId(flow, stageKey);
  if (stageId != null)
    pushApi(() => designFlowApi.internalApprove(stageId, { role, comment }));
  return result;
};

// A reviewer returns the stage to the design team — restarts the chain.
export const internalRequestChanges = (
  siteID,
  stageKey,
  { role = INTERNAL_ROLES[0], comment = "" } = {},
) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  ensureInternal(stage);
  stage.internal.signoffs.unshift({
    role,
    decision: "CHANGES",
    comment,
    round: stage.round,
    at: stamp(),
  });
  stage.internal.step = 0;
  stage.reviewState = "DRAFTING";
  stage.internalKickback = { role, comment, at: stamp() };
  flow.history.unshift({
    at: stamp(),
    action: `${role} returned ${labelForStage(stageKey)} to design team (internal)${
      comment ? ` — “${comment}”` : ""
    }`,
  });
  const result = writeFlow(siteID, flow);
  const stageId = backendStageId(flow, stageKey);
  if (stageId != null)
    pushApi(() => designFlowApi.internalReturn(stageId, { role, comment }));
  return result;
};

// Tick / comment a single Design Review Checklist row.
export const setChecklistItem = (siteID, stageKey, index, patch) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  ensureInternal(stage);
  const merged = {
    ...stage.internal.checklist[index],
    ...patch,
  };
  stage.internal.checklist[index] = merged;
  const result = writeFlow(siteID, flow);
  const stageId = backendStageId(flow, stageKey);
  if (stageId != null)
    // Send the full merged row (value + comment) so a partial patch (e.g.
    // value-only) still leaves the server row consistent with local.
    pushApi(() =>
      designFlowApi.setChecklistItem(stageId, index, {
        value: merged.value ?? null,
        comment: merged.comment ?? "",
      }),
    );
  return result;
};

// ── Design Comment register (PDF §2: DC-001 …) ───────────────────────────────
// Numbered sequentially across the whole flow so DC-### is unique per project.
const nextCommentNo = (flow) => {
  const count = (flow.stages || []).reduce(
    (n, s) => n + (s.comments?.length || 0),
    0,
  );
  return `DC-${String(count + 1).padStart(3, "0")}`;
};

export const addDesignComment = (
  siteID,
  stageKey,
  { drawingRef = "", comment = "", raisedBy = "" } = {},
) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  ensureInternal(stage);
  const localId = `dc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  stage.comments.unshift({
    id: localId,
    no: nextCommentNo(flow),
    drawingRef,
    comment,
    raisedBy,
    status: "Open", // Open | In Progress | Closed
    at: stamp(),
  });
  flow.history.unshift({
    at: stamp(),
    action: `Design comment raised on ${labelForStage(stageKey)}${
      raisedBy ? ` by ${raisedBy}` : ""
    }`,
  });
  const result = writeFlow(siteID, flow);

  // Best-effort: register the comment server-side and, when it returns a
  // server id, stamp it onto the cached comment as `backendId` so a later
  // status update (Close/reopen) can address /design-comments/:id. Server
  // response shape is UNVERIFIED — we read id/_id/commentId tolerantly and
  // skip the back-link if none is present.
  const stageId = backendStageId(flow, stageKey);
  if (stageId != null)
    pushApi(async () => {
      const created = await designFlowApi.addStageComment(stageId, {
        drawingRef,
        comment,
        raisedBy,
      });
      const serverId =
        created?.id ?? created?._id ?? created?.commentId ?? created?.comment?.id;
      if (serverId != null) {
        // Re-read the latest flow so we don't clobber concurrent edits.
        const fresh = getDesignFlow(siteID);
        const st = getStage(fresh, stageKey);
        const c = (st?.comments || []).find((x) => x.id === localId);
        if (c) {
          c.backendId = serverId;
          writeFlow(siteID, fresh);
        }
      }
    });

  return result;
};

// Closing a comment requires a resolution note (PDF audit trail) — captured
// here and timestamped. Reopening clears it.
export const setDesignCommentStatus = (
  siteID,
  stageKey,
  commentId,
  status,
  resolution = "",
) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  const c = (stage.comments || []).find((x) => x.id === commentId);
  if (c) {
    c.status = status;
    if (status === "Closed") {
      c.resolution = resolution;
      c.closedAt = stamp();
      flow.history.unshift({
        at: stamp(),
        action: `${c.no} closed on ${labelForStage(stageKey)} — “${resolution}”`,
      });
    } else {
      c.resolution = "";
      c.closedAt = null;
    }
  }
  const result = writeFlow(siteID, flow);

  // Best-effort: mirror the status change. The register endpoint is keyed by
  // the COMMENT's server id, captured as `backendId` when the comment was
  // created (a local-only `dc_*` comment has none → skip). resolution is sent
  // so a Close carries its mandatory note.
  const commentBackendId = c?.backendId ?? null;
  if (commentBackendId != null)
    pushApi(() =>
      designFlowApi.updateDesignComment(commentBackendId, {
        status,
        resolution: status === "Closed" ? resolution : "",
      }),
    );
  return result;
};

export const removeDesignComment = (siteID, stageKey, commentId) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  stage.comments = (stage.comments || []).filter((x) => x.id !== commentId);
  return writeFlow(siteID, flow);
};

// ── BOQ stage — the one place "design from measurements" is truly automatic ──
//
// The visual stages (concept/dev/drawings) are human-designed and uploaded. The
// BOQ is pure arithmetic: frozen survey quantity × rate. We price each measured
// work using its frozen quoted rate, falling back to the Item Master rate by
// name so the bill still populates when the proposal carried no per-unit rate.

const GST_PERCENT = 18;
const TOLERANCE_AMOUNT = 15000;

const masterRateFor = (name) => {
  const n = (name || "").trim().toLowerCase();
  if (!n) return 0;
  const lib = listLibrary();
  const hit =
    lib.find((it) => (it.description || "").trim().toLowerCase() === n) ||
    lib.find((it) => (it.description || "").toLowerCase().includes(n));
  return hit ? Number(hit.rate) || 0 : 0;
};

// Pure: compute the bill from the frozen Site Basis as Quoted vs Measured.
// Quoted preserves each Proposal Master line's stored amount; Measured applies
// the surveyed quantity and active material rate. Site-added custom works have
// no original quoted amount and therefore contribute only to Measured.
export const buildBoq = (flow) => {
  const basis = flow?.siteBasis;
  if (!basis) return null;
  const measurements = basis.measurements || {};
  const areas = (basis.areas || []).map((a) => {
    const rows = a.elements.map((el) => {
      const d = getElementMeasurement(measurements, a.area, el);
      const quotedQty = Number(el.quotedQty) || 0;
      const measuredQty = qtyFor(el.unit, d);
      // A flat lump-sum room line (no real per-unit rate) has nothing to
      // re-price by a measured sqft figure — carry its quoted amount through
      // unchanged instead of multiplying sqft × a rupee total.
      const hasRate = el.hasRate || (!el.amount && Number(el.rate) > 0);
      const quotedRate = hasRate ? Number(el.rate) || masterRateFor(el.name) : 0;
      const selectedMaterial = d.selectedMaterial?.grade
        ? d.selectedMaterial
        : null;
      const rate = hasRate
        ? Number(selectedMaterial?.rate) || quotedRate
        : 0;
      const proposalAmount = Number(el.amount) || 0;
      const quotedAmount = el.isCustom
        ? 0
        : proposalAmount || (hasRate ? quotedQty * quotedRate : 0);
      const measuredAmount = hasRate ? measuredQty * rate : Number(el.amount) || 0;
      return {
        scopeItemId: el.scopeItemId || null,
        masterId: el.masterId || null,
        name: el.name,
        unit: el.unit,
        rate,
        quotedRate,
        quotedQty,
        measuredQty,
        quotedAmount,
        measuredAmount,
        variance: measuredAmount - quotedAmount,
        selectedMaterial,
        materials: selectedMaterial
          ? (selectedMaterial.materials || []).length
            ? selectedMaterial.materials.map((material) => ({
                id: material.materialId || material.id,
                name: material.name || "Material",
                spec: material.spec || "",
              }))
            : [{
                id: selectedMaterial.id,
                name: selectedMaterial.name,
                spec: selectedMaterial.specifications || selectedMaterial.spec || "",
                rate: Number(selectedMaterial.rate) || 0,
                unit: selectedMaterial.unit || el.unit,
              }]
          : el.materials || [],
        isCustom: !!el.isCustom,
      };
    });
    return {
      area: a.area,
      rows,
      quotedSubtotal: rows.reduce((s, r) => s + r.quotedAmount, 0),
      measuredSubtotal: rows.reduce((s, r) => s + r.measuredAmount, 0),
    };
  });

  const quotedSubtotal =
    Number(basis.proposalBaseline?.subtotal) ||
    areas.reduce((s, a) => s + a.quotedSubtotal, 0);
  const measuredSubtotal = areas.reduce((s, a) => s + a.measuredSubtotal, 0);
  const gst = (measuredSubtotal * GST_PERCENT) / 100;
  const quotedGst =
    Number(basis.proposalBaseline?.gst) ||
    (quotedSubtotal * GST_PERCENT) / 100;
  const quotedTotal =
    Number(basis.proposalBaseline?.grandTotal) || quotedSubtotal + quotedGst;
  const measuredTotal = measuredSubtotal + gst;
  // The survey gate and BOQ use the same GST-inclusive commercial values.
  const variance = measuredTotal - quotedTotal;
  const variancePct = quotedTotal ? (variance / quotedTotal) * 100 : 0;

  return {
    areas,
    gstPercent: GST_PERCENT,
    quotedSubtotal,
    measuredSubtotal,
    quotedGst,
    quotedTotal,
    gst,
    // `total` = the final (measured) amount the client pays.
    total: measuredTotal,
    variance,
    variancePct,
    toleranceAmount: TOLERANCE_AMOUNT,
    withinTolerance: variance <= TOLERANCE_AMOUNT,
    hasQuote: quotedSubtotal > 0,
  };
};

// Firm action: generate the bill and attach it to the BOQ stage so it can be
// submitted for client approval like any other stage deliverable.
export const generateStageBoq = (siteID) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, "BOQ");
  if (!stage) return flow;
  const boq = buildBoq(flow);
  stage.boq = { ...boq, generatedAt: stamp() };
  const totalLabel = Math.round(boq.total).toLocaleString("en-IN");
  stage.deliverables = [
    { id: "boq", type: "BOQ", name: `Bill of Quantities — ₹${totalLabel}` },
  ];
  flow.history.unshift({
    at: stamp(),
    action: `BOQ auto-generated from survey (₹${totalLabel})`,
  });

  // Sync with main BOQ system
  try {
    const site = getSite(siteID);
    const clientID = site?.clientID || "";
    const clientName = site?.clientName || "";
    const boqId = `BOQ-${siteID}`;
    const existingBoqSummary = listBoqs().find((b) => b.id === boqId);
    let targetBoq = existingBoqSummary ? getBoq(existingBoqSummary.id) : null;

    if (!targetBoq) {
      targetBoq = createBoq({
        title: `BOQ for ${clientName}`,
        parentType: "client",
        parentId: clientID,
        client: { name: clientName },
        project: { siteID },
      });
      targetBoq.id = boqId;
    }

    // A regenerated survey bill always returns to commercial review. Preserve
    // the record ID, but never leave revised quantities marked as approved.
    if (targetBoq.status && targetBoq.status !== "draft") {
      targetBoq.revision = (Number(targetBoq.revision) || 1) + 1;
    }
    targetBoq.status = "draft";

    targetBoq.siteID = siteID;
    targetBoq.proposalBaseline = { ...(flow.siteBasis?.proposalBaseline || {}) };
    targetBoq.quotedSubtotal = boq.quotedSubtotal;
    targetBoq.quotedTotal = boq.quotedTotal;
    targetBoq.measuredSubtotal = boq.measuredSubtotal;
    targetBoq.measuredTotal = boq.total;
    targetBoq.surveyVariance = boq.variance;
    targetBoq.surveyToleranceAmount = boq.toleranceAmount;
    targetBoq.surveyWithinTolerance = boq.withinTolerance;
    targetBoq.surveyFrozenAt = flow.siteBasis?.frozenAt || null;

    const generatedSectionNames = new Set(boq.areas.map((area) => area.area));
    const generatedSections = boq.areas.map((area) => {
      const existingSection = targetBoq.sections?.find((s) => s.name === area.area);
      const matchedItemIds = new Set();
      const generatedItems = area.rows.map((row) => {
        const existingItem = existingSection?.items?.find(
          (it) =>
            (row.scopeItemId && it.scopeItemId === row.scopeItemId) ||
            it.description === row.name,
        );
        if (existingItem) matchedItemIds.add(existingItem.id);
        const d = getElementMeasurement(
          flow.siteBasis?.measurements,
          area.area,
          row,
        );
        const hasDimensions = [d.length, d.breadth ?? d.width, d.height].some(
          (value) => Number(value) > 0,
        );
        const canReproduceSurveyQty =
          row.unit === "sqft" ||
          row.unit === "sqm" ||
          ((row.unit === "rmt" || row.unit === "mm") &&
            !Number(d.breadth ?? d.width) &&
            !Number(d.height));
        return {
          ...existingItem,
          id: existingItem?.id || genShortId(),
          scopeItemId: row.scopeItemId,
          masterId: row.masterId || existingItem?.masterId || null,
          description: row.name,
          spec:
            row.selectedMaterial?.specifications ||
            row.selectedMaterial?.spec ||
            existingItem?.spec ||
            "",
          hsn: row.selectedMaterial?.hsn || existingItem?.hsn || "",
          qty: row.measuredQty,
          unit: row.unit,
          rate: row.rate,
          gstPercent:
            row.selectedMaterial?.gstPercent ?? existingItem?.gstPercent ?? 18,
          discount: existingItem?.discount || { type: "percent", value: 0 },
          dimensions: {
            enabled: hasDimensions && canReproduceSurveyQty,
            length: Number(d.length) || 0,
            breadth: Number(d.breadth ?? d.width) || 0,
            height: Number(d.height) || 0,
            nos: Number(d.nos) || 1,
          },
          materials: row.materials || [],
          quotedQty: row.quotedQty,
          quotedRate: row.quotedRate,
          quotedAmount: row.quotedAmount,
          measuredQty: row.measuredQty,
          measuredRate: row.rate,
          measuredAmount: row.measuredAmount,
          surveyVariance: row.variance,
          source: row.isCustom ? "site-custom" : "survey",
          siteSurveySource: true,
          siteMeasuredQty: row.measuredQty,
          siteID,
          isSiteCustomItem: !!row.isCustom,
          isVariation: !!row.isCustom,
        };
      });
      return {
        id: existingSection?.id || genShortId(),
        name: area.area,
        category: area.area,
        scopeItemId:
          area.rows.find((row) => row.scopeItemId)?.scopeItemId ||
          existingSection?.scopeItemId ||
          null,
        items: [
          ...generatedItems,
          ...(existingSection?.items || []).filter(
            (item) => !matchedItemIds.has(item.id) && !item.siteSurveySource,
          ),
        ],
      };
    });

    targetBoq.sections = [
      ...generatedSections,
      ...(targetBoq.sections || []).filter(
        (section) => !generatedSectionNames.has(section.name),
      ),
    ];

    const savedBoq = saveBoq(targetBoq);
    savedBoq.surveyStale = false;
    savedBoq.surveyStaleAt = null;
    saveBoq(savedBoq);
    stage.boq.editorBoqId = savedBoq.id;
    flow.boqId = savedBoq.id;
  } catch (err) {
    console.error("Failed to sync survey BOQ to main BOQ database:", err);
    stage.boq.syncError =
      "BOQ was calculated, but it could not be saved to the main BOQ editor.";
  }

  const result = writeFlow(siteID, flow);

  // The local boqStorage sync above is the Phase-3 (no-API) fallback and stays.
  // ADDITIONALLY ask the server to auto-build the bill on its own BOQ stage,
  // best-effort. Keyed by the BOQ stage's backend id; skip if not hydrated.
  const boqStageId = backendStageId(flow, "BOQ");
  if (boqStageId != null)
    pushApi(() => designFlowApi.generateStageBoq(boqStageId));
  return result;
};

// ── Sample design images (demo) ──────────────────────────────────────────────
//
// Inline SVG data URIs so a creative stage can be populated for a demo without
// real file uploads. Stored as `src` on the deliverable (rendered directly,
// bypassing IndexedDB). The visual stages still can't be auto-*designed* — these
// are just stand-in mockups so the pipeline isn't empty when showing it off.

const svgUri = (inner) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">${inner}</svg>`,
  );

const moodBoard = (label, hue) =>
  svgUri(
    `<rect width="320" height="200" fill="hsl(${hue},30%,96%)"/>` +
      [0, 1, 2, 3, 4]
        .map(
          (i) =>
            `<rect x="${14 + i * 60}" y="22" width="50" height="80" rx="6" fill="hsl(${
              (hue + i * 24) % 360
            },55%,${60 - i * 4}%)"/>`,
        )
        .join("") +
      `<rect x="14" y="116" width="292" height="40" rx="6" fill="hsl(${hue},35%,82%)"/>` +
      `<text x="20" y="186" font-family="sans-serif" font-size="13" font-weight="bold" fill="hsl(${hue},40%,30%)">${label}</text>`,
  );

const floorPlan = (label) =>
  svgUri(
    `<rect width="320" height="200" fill="#f8fafc"/>` +
      `<rect x="24" y="24" width="272" height="152" fill="none" stroke="#334155" stroke-width="3"/>` +
      `<line x1="160" y1="24" x2="160" y2="176" stroke="#334155" stroke-width="2"/>` +
      `<line x1="24" y1="110" x2="160" y2="110" stroke="#334155" stroke-width="2"/>` +
      `<text x="58" y="74" font-family="sans-serif" font-size="10" fill="#64748b">LIVING</text>` +
      `<text x="58" y="150" font-family="sans-serif" font-size="10" fill="#64748b">KITCHEN</text>` +
      `<text x="198" y="104" font-family="sans-serif" font-size="10" fill="#64748b">BEDROOM</text>` +
      `<text x="24" y="194" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">${label}</text>`,
  );

const render3d = (label, hue) =>
  svgUri(
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="hsl(${hue},40%,90%)"/>` +
      `<stop offset="1" stop-color="hsl(${hue},35%,72%)"/></linearGradient></defs>` +
      `<rect width="320" height="200" fill="url(#g)"/>` +
      `<rect x="0" y="150" width="320" height="50" fill="hsl(${hue},25%,60%)"/>` +
      `<rect x="40" y="110" width="120" height="44" rx="8" fill="hsl(${hue},30%,45%)"/>` +
      `<rect x="180" y="90" width="60" height="64" rx="4" fill="hsl(${hue},30%,52%)"/>` +
      `<circle cx="270" cy="58" r="16" fill="hsl(${hue},60%,80%)"/>` +
      `<text x="20" y="188" font-family="sans-serif" font-size="13" font-weight="bold" fill="hsl(${hue},40%,25%)">${label}</text>`,
  );

// A document/form/certificate mock — for approvals, specs, site reports, certs.
const docPage = (label) =>
  svgUri(
    `<rect width="320" height="200" fill="#ffffff"/>` +
      `<rect x="0.5" y="0.5" width="319" height="199" fill="none" stroke="#e2e8f0" stroke-width="2"/>` +
      `<rect x="20" y="20" width="170" height="12" rx="3" fill="#cbd5e1"/>` +
      [0, 1, 2, 3, 4, 5]
        .map(
          (i) =>
            `<rect x="20" y="${52 + i * 18}" width="${280 - (i % 2) * 70}" height="7" rx="3" fill="#e2e8f0"/>`,
        )
        .join("") +
      `<rect x="20" y="166" width="110" height="22" rx="4" fill="#dbeafe"/>` +
      `<text x="27" y="181" font-family="sans-serif" font-size="10.5" font-weight="bold" fill="#1e3a8a">${label}</text>`,
  );

const SAMPLE_BY_STAGE = {
  CONCEPT: [
    { type: "Mood Board", name: "Living — Warm Minimal.svg", make: () => moodBoard("Mood Board · Warm Minimal", 28) },
    { type: "Mood Board", name: "Bedroom — Calm Neutrals.svg", make: () => moodBoard("Mood Board · Calm Neutrals", 210) },
  ],
  DEVELOPMENT: [
    { type: "3D Render", name: "Living Room — View 1.svg", make: () => render3d("3D Render · Living", 28) },
    { type: "3D Render", name: "Kitchen — View 1.svg", make: () => render3d("3D Render · Kitchen", 150) },
    { type: "Material List", name: "Finishes Schedule.svg", make: () => moodBoard("Finishes & Materials", 200) },
  ],
  DRAWINGS: [
    { type: "2D Drawing", name: "Furniture Layout Plan.svg", make: () => floorPlan("Furniture Layout — GFC") },
    { type: "2D Drawing", name: "False Ceiling Plan.svg", make: () => floorPlan("False Ceiling — GFC") },
  ],

  // ── Architecture stages ────────────────────────────────────────────────────
  SCHEMATIC: [
    { type: "Site Plan", name: "Site Plan.svg", make: () => floorPlan("Site Plan — Schematic") },
    { type: "Massing", name: "Massing Study.svg", make: () => render3d("Massing Study", 210) },
    { type: "Concept", name: "Concept Board.svg", make: () => moodBoard("Concept Direction", 200) },
  ],
  DESIGN_DEV: [
    { type: "Plans", name: "Floor Plan.svg", make: () => floorPlan("Floor Plan — DD") },
    { type: "Sections", name: "Section A-A.svg", make: () => floorPlan("Section A-A") },
    { type: "Elevations", name: "Front Elevation.svg", make: () => render3d("Front Elevation", 30) },
  ],
  APPROVALS: [
    { type: "Sanction Drawing", name: "Sanction Plan.svg", make: () => floorPlan("Sanction Drawing") },
    { type: "Form", name: "Building Permit Form.svg", make: () => docPage("Building Permit Form") },
    { type: "NOC", name: "Fire NOC.svg", make: () => docPage("Fire NOC") },
  ],
  CONSTRUCTION_DOCS: [
    { type: "GFC Drawing", name: "GFC Plan.svg", make: () => floorPlan("GFC Plan") },
    { type: "Detail", name: "Joinery Detail.svg", make: () => floorPlan("Joinery Detail") },
    { type: "Spec", name: "Material Spec.svg", make: () => docPage("Material Spec") },
  ],
  CONSTRUCTION_ADMIN: [
    { type: "Site Report", name: "Site Progress Report.svg", make: () => docPage("Site Progress Report") },
    { type: "Payment Cert", name: "Payment Certificate.svg", make: () => docPage("Payment Certificate") },
  ],
};

export const stageHasSamples = (stageKey) => !!SAMPLE_BY_STAGE[stageKey];

// Append sample mockups to a stage (firm demo action). De-dupes by name.
export const addSampleDeliverables = (siteID, stageKey) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  const existing = new Set((stage.deliverables || []).map((d) => d.name));
  const fresh = (SAMPLE_BY_STAGE[stageKey] || [])
    .filter((s) => !existing.has(s.name))
    .map((s) => ({
      id: `${stageKey}_${s.name}`.replace(/\W+/g, "_"),
      type: s.type,
      name: s.name,
      src: s.make(),
      mime: "image/svg+xml",
    }));
  stage.deliverables = [...(stage.deliverables || []), ...fresh];
  return writeFlow(siteID, flow);
};

// ── Architecture money — design fee (firm revenue) + tender (build cost) ──────
//
// Interiors has ONE number (the BOQ it self-executes). Architecture has TWO:
// the firm's staged DESIGN FEE, and the contractor's CONSTRUCTION COST (tender).

const DEFAULT_FEE_RATE = 150; // ₹/sqft of built-up area (design fee)
const DEFAULT_CONSTRUCTION_RATE = 1800; // ₹/sqft (contractor build cost)

const parseArea = (s) => {
  const m = String(s ?? "").match(/[\d,.]+/);
  return m ? Number(m[0].replace(/,/g, "")) || 0 : 0;
};

// Design fee config — defaults from the feasibility basis, overridable.
export const getArchFee = (flow) => ({
  builtUpArea: flow?.fee?.builtUpArea ?? parseArea(flow?.siteBasis?.maxBuiltUp),
  feeRatePerSqft: flow?.fee?.feeRatePerSqft ?? DEFAULT_FEE_RATE,
});

export const setArchFee = (siteID, patch) => {
  const flow = getDesignFlow(siteID);
  if (!flow) return flow;
  flow.fee = { ...getArchFee(flow), ...patch };
  return writeFlow(siteID, flow);
};

// Staged fee breakdown — each stage bills its weight; approved stages = invoiced.
export const computeArchFee = (flow) => {
  const { builtUpArea, feeRatePerSqft } = getArchFee(flow);
  const total = builtUpArea * feeRatePerSqft;
  const stages = ARCHITECTURE_PIPELINE.map((d) => {
    const rec = getStage(flow, d.key);
    return {
      key: d.key,
      label: d.label,
      weight: d.feeWeight || 0,
      amount: (total * (d.feeWeight || 0)) / 100,
      invoiced: rec?.reviewState === "APPROVED",
    };
  });
  const invoicedTotal = stages
    .filter((s) => s.invoiced)
    .reduce((sum, s) => sum + s.amount, 0);
  return { builtUpArea, feeRatePerSqft, total, stages, invoicedTotal };
};

// Tender — the contractor's construction cost (separate from the design fee).
export const getTender = (flow) => {
  const stage = getStage(flow, "TENDER");
  return (
    stage?.tender || {
      builtUpArea: parseArea(flow?.siteBasis?.maxBuiltUp),
      constructionRate: DEFAULT_CONSTRUCTION_RATE,
      bids: [],
      awarded: null,
    }
  );
};

export const setTender = (siteID, patch) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, "TENDER");
  if (!stage) return flow;
  stage.tender = { ...getTender(flow), ...patch };
  return writeFlow(siteID, flow);
};

export const tenderEstimate = (tender) =>
  (Number(tender?.builtUpArea) || 0) * (Number(tender?.constructionRate) || 0);
