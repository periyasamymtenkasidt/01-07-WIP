// Design flow storage — the survey → design handoff.
//
// When the survey is frozen via "Move to Design", we snapshot the site's
// measurements + photos as an immutable "Site Basis" and open the design
// pipeline. Everything BEFORE the freeze is as-is site truth;
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
import {
  saveBoq,
  getBoq,
  createBoq,
  listBoqs,
  genShortId,
  seedRateAnalysisFromMaterials,
} from "./boqStorage";
import { getDesignFlow as getDesignFlowApi } from "../api/designFlow";
import { tokens } from "../api/client";

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

// The design stages, in order. Each later runs the same
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

// ── Internal design review ──────────────────────────────────────────────────
// The ordered internal sign-off chain (requirements PDF §1). Sign-off happens
// step by step: only the Principal Architect (final step) can authorise a stage
// for the client. The sequence is enforced here; identity binding comes with a
// backend + auth (see CLAUDE.md / BACKEND_SPEC §7.4).
export const INTERNAL_ROLES = [
  "Intern",
  "Junior Architect",
  "Senior Architect",
  "Principal Architect",
];

// Design Review Checklist (requirements PDF §2). Each row is answered yes/no
// during internal review; the Principal cannot finalise until every row is
// answered and every design comment is closed.
export const DESIGN_REVIEW_CHECKLIST = [
  "Client requirements captured and addressed",
  "Space planning is efficient and functional",
  "Circulation and movement flow are clear",
  "Furniture layout is appropriate and to scale",
  "Materials and finishes are specified",
  "Colour scheme is coordinated",
  "Lighting design is adequate and coordinated",
  "Ceiling / HVAC coordination is resolved",
  "Dimensions are complete and consistent",
  "Architectural / Structural / MEP coordination is complete",
  "Accessibility requirements are met",
  "Safety requirements are met",
  "Specifications are complete and correct",
  "Office / drafting standards are followed",
  "Sheet numbering and titles are correct",
  "Renders match the drawings",
  "Design is within the approved budget",
];

// Contractual free revision rounds per stage; extra rounds get flagged billable.
const DEFAULT_ROUNDS_INCLUDED = 2;

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
};

const createBoqAuditEntry = ({
  boq,
  action,
  label,
  actor,
  details = "",
  at = new Date().toISOString(),
}) => ({
  id: genShortId(),
  action,
  label,
  actor: actor || "System",
  details,
  at,
  status: boq?.status || "draft",
  revision: boq?.revision || 1,
});

// Backfill pipeline stages added after a flow was created so existing design
// flows gain them without a manual migration.
// A newly inserted stage unlocks (DRAFTING) once every earlier stage is
// approved, else stays LOCKED. Flows that already produced a BOQ are
// grandfathered (the new stage is marked APPROVED) so finished projects
// aren't retro-blocked. Order always follows the pipeline.
const backfillStages = (flow) => {
  if (!flow?.track) return flow;
  const pipeline = getPipeline(flow.track);
  const existing = new Map((flow.stages || []).map((s) => [s.key, s]));
  let prevApproved = true;
  const stages = pipeline.map((pd) => {
    const cur = existing.get(pd.key);
    if (cur) {
      prevApproved = prevApproved && cur.reviewState === "APPROVED";
      return cur;
    }
    const grandfathered = !!flow.boqId;
    const reviewState = grandfathered
      ? "APPROVED"
      : prevApproved
        ? "DRAFTING"
        : "LOCKED";
    const st = {
      key: pd.key,
      reviewState,
      round: 1,
      roundsIncluded: DEFAULT_ROUNDS_INCLUDED,
      deliverables: [],
      approvals: [],
      submittedAt: null,
      approvedAt: reviewState === "APPROVED" ? stamp() : null,
    };
    prevApproved = prevApproved && reviewState === "APPROVED";
    return st;
  });
  const unchanged =
    stages.length === (flow.stages || []).length &&
    stages.every((s, i) => flow.stages[i]?.key === s.key);
  return unchanged ? flow : { ...flow, stages };
};

export const getDesignFlow = (siteID) => {
  const flow = readJson(designFlowKey(siteID), null);
  if (!flow) return null;
  const filled = backfillStages(flow);
  if (filled !== flow) writeJson(designFlowKey(siteID), filled);
  return filled;
};

export const isDesignStarted = (siteID) => !!getDesignFlow(siteID);

// Backend hydration: pull the server copy of a site's design flow into the
// local cache, then fire the change event so the pipeline refreshes. No-op when
// logged out; on any error or empty response it leaves the local flow untouched
// so a missing/slow backend never wipes a working local pipeline. The server
// returns { flow, stages[] } — fold the stages into the flow to match the shape
// the synchronous getters read.
export async function hydrateDesignFlow(siteID) {
  if (!siteID || !tokens.access()) return;
  let data;
  try {
    data = await getDesignFlowApi(siteID);
  } catch (e) {
    console.warn("hydrateDesignFlow: failed to fetch design flow", e);
    return;
  }
  if (!data) return;
  const flow = data.flow
    ? { ...data.flow, stages: data.stages || data.flow.stages || [] }
    : data;
  if (!flow || !Array.isArray(flow.stages)) return;
  writeJson(designFlowKey(siteID), flow);
  window.dispatchEvent(new Event("designFlowChanged"));
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
  return writeFlow(siteID, flow);
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

// ── Internal design review — the DRAFTING → INTERNAL_REVIEW → client loop ────
//
// Firm side runs an ordered sign-off (Intern → … → Principal) plus a review
// checklist and a design-comments register before a stage ever reaches the
// client. Only the Principal (final step) can authorise, and only once the
// checklist is complete and every comment is closed.

// Ensure the stage carries an internal-review record with a checklist slot per
// item (preserving any answers already given).
const ensureInternal = (stage) => {
  const internal = stage.internal || { step: 0, signoffs: [], checklist: [] };
  internal.step = internal.step || 0;
  internal.signoffs = internal.signoffs || [];
  internal.checklist = DESIGN_REVIEW_CHECKLIST.map(
    (_, i) => internal.checklist?.[i] || { value: null, comment: "" },
  );
  stage.internal = internal;
  return internal;
};

// Every checklist row answered (yes/no).
export const checklistComplete = (stage) => {
  const checklist = stage?.internal?.checklist || [];
  return (
    DESIGN_REVIEW_CHECKLIST.length > 0 &&
    DESIGN_REVIEW_CHECKLIST.every((_, i) => {
      const v = checklist[i]?.value;
      return v === "yes" || v === "no";
    })
  );
};

// Design comments still needing resolution (anything not Closed).
export const openCommentsCount = (stage) =>
  (stage?.comments || []).filter((c) => c.status !== "Closed").length;

// The Principal can only authorise when the checklist is done and no comment
// is left open.
export const canFinalizeInternal = (stage) =>
  checklistComplete(stage) && openCommentsCount(stage) === 0;

// Firm submits a drafted stage into internal review (never straight to client).
export const submitForInternalReview = (siteID, stageKey) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  ensureInternal(stage);
  stage.reviewState = "INTERNAL_REVIEW";
  stage.submittedAt = stamp();
  flow.history.unshift({
    at: stamp(),
    action: `${labelForStage(stageKey)} submitted for internal review (R${stage.round})`,
  });
  return writeFlow(siteID, flow);
};

// Tick / annotate a single checklist row.
export const setChecklistItem = (siteID, stageKey, index, patch) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  const internal = ensureInternal(stage);
  const current = internal.checklist[index] || { value: null, comment: "" };
  internal.checklist[index] = { ...current, ...patch };
  return writeFlow(siteID, flow);
};

// One reviewer signs off. Non-final steps advance the chain; the final step
// (Principal) authorises and hands the stage to the client — but only when the
// checklist is complete and every comment is closed.
export const internalApprove = (siteID, stageKey, { role, comment = "" } = {}) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  const internal = ensureInternal(stage);
  const step = internal.step || 0;
  const isFinal = step >= INTERNAL_ROLES.length - 1;
  if (isFinal && !canFinalizeInternal(stage)) return flow;
  const actingRole = role || INTERNAL_ROLES[step];
  internal.signoffs.unshift({
    role: actingRole,
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
      action: `${labelForStage(stageKey)} internally authorised by ${actingRole} → sent to client`,
    });
  } else {
    internal.step = step + 1;
    flow.history.unshift({
      at: stamp(),
      action: `${labelForStage(stageKey)} approved by ${actingRole} (internal review)`,
    });
  }
  return writeFlow(siteID, flow);
};

// Any reviewer can kick the stage back to the team — resets the chain to step 0
// so a full re-review is required on resubmit.
export const internalRequestChanges = (siteID, stageKey, { role, comment = "" } = {}) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  const internal = ensureInternal(stage);
  const step = internal.step || 0;
  const actingRole = role || INTERNAL_ROLES[step];
  internal.signoffs.unshift({
    role: actingRole,
    decision: "CHANGES",
    comment,
    round: stage.round,
    at: stamp(),
  });
  internal.step = 0;
  internal.kickback = { role: actingRole, comment, at: stamp() };
  stage.reviewState = "DRAFTING";
  flow.history.unshift({
    at: stamp(),
    action: `${labelForStage(stageKey)} returned to team by ${actingRole} (internal review)`,
  });
  return writeFlow(siteID, flow);
};

// ── Design comments register (DC-###) ────────────────────────────────────────
const nextCommentNo = (comments) =>
  `DC-${String((comments?.length || 0) + 1).padStart(3, "0")}`;

export const addDesignComment = (
  siteID,
  stageKey,
  { drawingRef = "", comment = "", raisedBy = "" } = {},
) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage || !comment.trim()) return flow;
  stage.comments = stage.comments || [];
  stage.comments.push({
    id: genShortId(),
    no: nextCommentNo(stage.comments),
    drawingRef: drawingRef.trim(),
    comment: comment.trim(),
    raisedBy: raisedBy || "",
    status: "Open",
    resolution: "",
    at: stamp(),
  });
  return writeFlow(siteID, flow);
};

// Move a comment through Open → In Progress → Closed (or reopen). Closing
// requires a non-empty resolution; any other status clears it.
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
  const comment = (stage.comments || []).find((c) => c.id === commentId);
  if (!comment) return flow;
  if (status === "Closed") {
    if (!resolution.trim()) return flow; // resolution required to close
    comment.status = "Closed";
    comment.resolution = resolution.trim();
  } else {
    comment.status = status;
    comment.resolution = "";
  }
  return writeFlow(siteID, flow);
};

export const removeDesignComment = (siteID, stageKey, commentId) => {
  const flow = getDesignFlow(siteID);
  const stage = getStage(flow, stageKey);
  if (!stage) return flow;
  stage.comments = (stage.comments || []).filter((c) => c.id !== commentId);
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
        // Full proposal materials (per-unit qty, rate, wastage, GST) kept
        // alongside the display `materials` so the BOQ rate analysis can map
        // real quantities from the proposal, not just material names.
        proposalMaterials: el.materials || [],
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
      const now = new Date().toISOString();
      const previousRevision = Number(targetBoq.revision) || 1;
      const previousStatus = targetBoq.status;
      targetBoq.revisedFrom = {
        status: previousStatus,
        revision: previousRevision,
        at: now,
        approval: targetBoq.approval || null,
        procurement: targetBoq.procurement || null,
      };
      targetBoq.revisionHistory = [
        ...(targetBoq.revisionHistory || []),
        {
          revision: previousRevision,
          status: previousStatus,
          at: now,
          sections: JSON.parse(JSON.stringify(targetBoq.sections || [])),
          approval: targetBoq.approval || null,
        },
      ];
      targetBoq.auditTrail = [
        ...(targetBoq.auditTrail || []),
        createBoqAuditEntry({
          boq: targetBoq,
          action: "survey_regenerated_revision",
          label: "Survey Regenerated Revision",
          actor: "Design Flow",
          details: `Revision ${previousRevision + 1} opened from ${previousStatus} after survey regeneration.`,
          at: now,
        }),
      ];
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
          // Auto-map the proposal's materials + per-unit quantities into the
          // rate build-up. Forced on (re)generation so it reflects the proposal.
          rateAnalysis: seedRateAnalysisFromMaterials(
            existingItem?.rateAnalysis,
            row.proposalMaterials || row.materials || [],
            row.unit,
            { force: true },
          ),
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

  return writeFlow(siteID, flow);
};

// ── Standalone BOQ generation from survey ────────────────────────────────────
//
// Generates (or regenerates) a main BOQ from the frozen site survey without
// requiring the BOQ pipeline stage. Used by:
//   • DesignPipeline → "Create BOQ" card after DRAWINGS approved
//   • BOQList → "From Survey" new-BOQ entry point
//
// Returns the saved BOQ's id on success, null on failure.
export const generateBoqFromSurvey = (siteID) => {
  const flow = getDesignFlow(siteID);
  if (!flow?.siteBasis) return null;

  const boq = buildBoq(flow);
  if (!boq) return null;

  try {
    const site = getSite(siteID);
    const clientID = site?.clientID || "";
    const clientName = site?.clientName || "";
    const boqId = `BOQ-${siteID}`;
    const existingBoqSummary = listBoqs().find((b) => b.id === boqId);
    let targetBoq = existingBoqSummary ? getBoq(existingBoqSummary.id) : null;

    if (!targetBoq) {
      targetBoq = createBoq({
        title: `BOQ — ${clientName}`,
        parentType: "client",
        parentId: clientID,
        client: { name: clientName, id: clientID },
        project: { siteID, name: site?.fullAddress || "" },
      });
      targetBoq.id = boqId;
    }

    // If previously issued/approved, open a new revision rather than overwriting.
    if (targetBoq.status && targetBoq.status !== "draft") {
      const now = new Date().toISOString();
      const prevRev = Number(targetBoq.revision) || 1;
      targetBoq.revisedFrom = {
        status: targetBoq.status,
        revision: prevRev,
        at: now,
        approval: targetBoq.approval || null,
        procurement: targetBoq.procurement || null,
      };
      targetBoq.revisionHistory = [
        ...(targetBoq.revisionHistory || []),
        {
          revision: prevRev,
          status: targetBoq.status,
          at: now,
          sections: JSON.parse(JSON.stringify(targetBoq.sections || [])),
          approval: targetBoq.approval || null,
        },
      ];
      targetBoq.auditTrail = [
        ...(targetBoq.auditTrail || []),
        createBoqAuditEntry({
          boq: targetBoq,
          action: "survey_regenerated_revision",
          label: "Survey Regenerated",
          actor: "Design Flow",
          details: `Revision ${prevRev + 1} opened from ${targetBoq.status} after survey regeneration.`,
          at: now,
        }),
      ];
      targetBoq.revision = prevRev + 1;
    }

    targetBoq.status = "draft";
    targetBoq.siteID = siteID;
    targetBoq.proposalBaseline = { ...(flow.siteBasis?.proposalBaseline || {}) };
    targetBoq.quotedTotal = boq.quotedTotal;
    targetBoq.surveyFrozenAt = flow.siteBasis?.frozenAt || null;
    targetBoq.surveyVariance = boq.variance;

    // Build sections + items from survey areas, merging any existing manual work.
    const surveyAreaNames = new Set(boq.areas.map((a) => a.area));
    const generatedSections = boq.areas.map((area) => {
      const existingSection = (targetBoq.sections || []).find((s) => s.name === area.area);
      const matchedIds = new Set();
      const items = area.rows.map((row) => {
        const existing = (existingSection?.items || []).find(
          (it) =>
            (row.scopeItemId && it.scopeItemId === row.scopeItemId) ||
            it.description === row.name,
        );
        if (existing) matchedIds.add(existing.id);
        const d = getElementMeasurement(
          flow.siteBasis?.measurements,
          area.area,
          row,
        );
        const hasDims = [d.length, d.breadth ?? d.width, d.height].some(
          (v) => Number(v) > 0,
        );
        return {
          ...existing,
          id: existing?.id || genShortId(),
          scopeItemId: row.scopeItemId || existing?.scopeItemId || null,
          masterId: row.masterId || existing?.masterId || null,
          description: row.name,
          spec: row.selectedMaterial?.specifications || row.selectedMaterial?.spec || existing?.spec || "",
          hsn: row.selectedMaterial?.hsn || existing?.hsn || "",
          qty: row.measuredQty,
          unit: row.unit,
          rate: row.rate,
          gstPercent: row.selectedMaterial?.gstPercent ?? existing?.gstPercent ?? 18,
          discount: existing?.discount || { type: "percent", value: 0 },
          materials: row.materials || existing?.materials || [],
          // Auto-map the proposal's materials + per-unit quantities into the
          // rate build-up. Forced on (re)generation so it reflects the proposal.
          rateAnalysis: seedRateAnalysisFromMaterials(
            existing?.rateAnalysis,
            row.proposalMaterials || row.materials || existing?.materials || [],
            row.unit,
            { force: true },
          ),
          dimensions: {
            enabled: hasDims,
            length: Number(d.length) || 0,
            breadth: Number(d.breadth ?? d.width) || 0,
            height: Number(d.height) || 0,
            nos: Number(d.nos) || 1,
          },
          siteSurveySource: true,
          siteID,
          quotedQty: row.quotedQty,
          quotedAmount: row.quotedAmount,
          measuredQty: row.measuredQty,
          surveyVariance: row.variance,
        };
      });
      return {
        id: existingSection?.id || genShortId(),
        name: area.area,
        category: area.area,
        items: [
          ...items,
          ...(existingSection?.items || []).filter(
            (it) => !matchedIds.has(it.id) && !it.siteSurveySource,
          ),
        ],
      };
    });

    targetBoq.sections = [
      ...generatedSections,
      ...(targetBoq.sections || []).filter((s) => !surveyAreaNames.has(s.name)),
    ];

    const saved = saveBoq(targetBoq);
    flow.boqId = saved.id;
    writeJson(designFlowKey(siteID), flow);
    window.dispatchEvent(new Event("designFlowChanged"));
    return saved.id;
  } catch (err) {
    console.error("generateBoqFromSurvey failed:", err);
    return null;
  }
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
