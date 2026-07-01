// Single source of truth for the lead pipeline.
// Linear path is the happy flow shown in the stepper.
// Off-ramps are terminal/parallel states rendered separately.

import { addLeadActivity, getLeadActivities } from "../api/leads";

// Resolve the Mongo backend id for a lead from the local cache. Activities are
// keyed in-app by proposalId, but the API needs the lead's `id`. Returns "" for
// mock / offline leads (no cached id) so callers skip the API. Never throws.
const backendIdForProposal = (proposalId) => {
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

export const PIPELINE_STEPS = [
  "Inquiry",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Won",
];

export const OFF_RAMP_STATUSES = ["On Hold", "Lost"];

export const ALL_STATUSES = [...PIPELINE_STEPS, ...OFF_RAMP_STATUSES];

// Standard "lost reasons" for analytics.
export const LOST_REASONS = [
  "Price / Budget",
  "Chose Competitor",
  "Timing — Postponed",
  "No Decision",
  "Scope Mismatch",
  "Unresponsive",
  "Other",
];

// Tailwind classes for the small pill badge used in tables and headers.
export const STATUS_BADGE = {
  Inquiry: "bg-purple-100 text-purple-600",
  Qualified: "bg-green-100 text-green-600",
  Proposal: "bg-blue-100 text-blue-600",
  Negotiation: "bg-amber-100 text-amber-700",
  Won: "bg-emerald-100 text-emerald-700",
  "On Hold": "bg-gray-100 text-gray-600",
  Lost: "bg-red-100 text-red-600",
  Completed: "bg-emerald-100 text-emerald-700",
};

// Lower-case lookup so callers don't have to worry about casing.
export const getBadgeClass = (status) => {
  if (!status) return "bg-gray-100 text-gray-500";
  const match = Object.keys(STATUS_BADGE).find(
    (k) => k.toLowerCase() === status.toLowerCase(),
  );
  return match ? STATUS_BADGE[match] : "bg-gray-100 text-gray-500";
};

export const isPipelineStep = (status) =>
  PIPELINE_STEPS.some((s) => s.toLowerCase() === status?.toLowerCase());

export const getStepIndex = (status) =>
  PIPELINE_STEPS.findIndex((s) => s.toLowerCase() === status?.toLowerCase());

// Activity log helpers — timeline is per-lead in localStorage.
const activityKey = (proposalId) => `leadActivity_${proposalId}`;

export const getActivity = (proposalId) => {
  try {
    const raw = localStorage.getItem(activityKey(proposalId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const appendActivity = (proposalId, entry) => {
  const list = getActivity(proposalId);
  const next = [{ ...entry, at: new Date().toISOString() }, ...list];
  localStorage.setItem(activityKey(proposalId), JSON.stringify(next));
  // Let open views (e.g. ProjectDetail's timeline) refresh without a reload.
  window.dispatchEvent(
    new CustomEvent("activityChanged", { detail: { proposalId } }),
  );

  // Best-effort backend write-through. Skip if we can't resolve a backend id
  // (mock / offline lead). Never throws, never blocks the local append.
  const backendId = backendIdForProposal(proposalId);
  if (backendId) {
    Promise.resolve(addLeadActivity(backendId, entry)).catch((err) =>
      console.warn("appendActivity: addLeadActivity failed —", err?.message || err),
    );
  }

  return next;
};

// Fetch a lead's activity log from the backend (GET /leads/:id/activities) and
// normalize it to the local timeline shape: newest-first, every entry carrying
// an `at` ISO timestamp (the backend may name it createdAt). `backendId` is the
// lead's Mongo id. Returns [] on failure or when there's no server id yet, so
// callers keep their local log in that case. Never throws.
export const fetchServerActivity = async (backendId) => {
  if (!backendId) return [];
  let res;
  try {
    res = await getLeadActivities(backendId);
  } catch (err) {
    console.warn(
      "fetchServerActivity: getLeadActivities failed —",
      err?.message || err,
    );
    return [];
  }
  const list = Array.isArray(res) ? res : (res?.data ?? []);
  return list
    .map((e) => ({ ...e, at: e.at || e.createdAt || e.created_at || null }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
};

// Resolve a lead by proposalId across mock data + localStorage overrides.
// Lazy require so this file stays free of UI dependencies.
export const findLeadById = (proposalId, tableData = []) => {
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
  } catch {
    stored = [];
  }
  return (
    stored.find((l) => l.proposalId === proposalId) ||
    tableData.find((l) => l.proposalId === proposalId) ||
    null
  );
};

// Walk every leadActivity_* key in localStorage and return all email sends,
// flattened with the parent proposalId attached. Newest first.
export const getAllProposalEmails = () => {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("leadActivity_")) continue;
    const proposalId = key.replace("leadActivity_", "");
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      continue;
    }
    list.forEach((entry) => {
      if (entry.type === "email") out.push({ ...entry, proposalId });
    });
  }
  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
};

// Returns just the email entries for one lead, oldest first (so the detail
// view reads as a thread).
export const getProposalEmailsForLead = (proposalId) =>
  getActivity(proposalId)
    .filter((e) => e.type === "email")
    .sort((a, b) => new Date(a.at) - new Date(b.at));

// ── Projects pipeline ────────────────────────────────────────────────────────
// A "project" exists when a proposal has been sent for a lead. It tracks the
// full lifecycle from sales close-out through delivery handover.

export const SALES_STEPS = ["Proposal", "Negotiation", "Won"];
// Delivery steps mirror PAYMENT_MILESTONES from src/data/MilestoneConfig.js
// — short labels for the stepper, full names live in the milestone config.
export const DELIVERY_STEPS = [
  "ADVANCE",
  "STAGEWISE A",
  "STAGEWISE B",
  "REMAINING",
];

export const PROJECT_PIPELINE_STEPS = [...SALES_STEPS, ...DELIVERY_STEPS];

// Map MilestoneConfig.PAYMENT_MILESTONES.id (1..5) to the delivery step index.
export const milestoneIdToDeliveryIndex = (id) => {
  if (!id || id < 1 || id > DELIVERY_STEPS.length) return -1;
  return id - 1;
};

// Resolve which project stage a lead is currently sitting in. Returns
// `{ phase: "sales"|"delivery"|"closed"|"prepipeline", stepIndex, label }`.
export const getProjectStage = (lead, milestones) => {
  if (!lead) return { phase: "prepipeline", stepIndex: -1, label: "—" };
  const status = lead.status?.toLowerCase();

  if (status === "lost")
    return { phase: "closed", stepIndex: -1, label: "Lost" };

  if (["proposal", "negotiation"].includes(status)) {
    return {
      phase: "sales",
      stepIndex: SALES_STEPS.findIndex((s) => s.toLowerCase() === status),
      label: lead.status,
    };
  }
  if (status === "won") {
    if (!lead.convertedClientID) {
      return { phase: "sales", stepIndex: 2, label: "Won" };
    }
    // Won + client created: walk milestones to find highest paid one.
    const paid = (milestones || []).filter((m) => m.status === "paid");
    
    // Check if ALL milestones are paid (fully completed payment)
    let isCompleted = milestones.length > 0 && milestones.every((m) => m.status === "paid");
    if (!isCompleted) {
      // Check paymentStatus from overrides or clients data
      let paymentStatus = "";
      try {
        const o = JSON.parse(localStorage.getItem("staticClientStatusOverrides") || "{}");
        if (o[lead.convertedClientID]) {
          paymentStatus = o[lead.convertedClientID];
        }
      } catch {
        /* ignore malformed overrides */
      }
      if (!paymentStatus) {
        try {
          const saved = localStorage.getItem("newClientsData");
          const newClients = saved ? JSON.parse(saved) : [];
          const found = newClients.find((c) => c.clientID === lead.convertedClientID);
          if (found) paymentStatus = found.paymentStatus;
        } catch {
          /* ignore malformed clients cache */
        }
      }
      if (paymentStatus === "completed") {
        isCompleted = true;
      }
    }

    if (isCompleted) {
      return { phase: "closed", stepIndex: DELIVERY_STEPS.length - 1, label: "Completed" };
    }

    if (paid.length === 0)
      return { phase: "delivery", stepIndex: -1, label: "ADVANCE" };
    const highest = paid.reduce((max, m) => (m.id > max ? m.id : max), 0);
    const idx = milestoneIdToDeliveryIndex(highest);
    if (idx === DELIVERY_STEPS.length - 1)
      return { phase: "closed", stepIndex: idx, label: "REMAINING" };
    return { phase: "delivery", stepIndex: idx, label: DELIVERY_STEPS[idx] };
  }
  return { phase: "prepipeline", stepIndex: -1, label: lead.status || "—" };
};

// Stage progress used by the list view ("4/8").
export const getProjectProgress = (lead, milestones) => {
  const { phase, stepIndex } = getProjectStage(lead, milestones);
  if (phase === "sales")
    return `${stepIndex + 1}/${PROJECT_PIPELINE_STEPS.length}`;
  if (phase === "delivery")
    return `${SALES_STEPS.length + stepIndex + 1}/${PROJECT_PIPELINE_STEPS.length}`;
  if (phase === "closed" && stepIndex === DELIVERY_STEPS.length - 1)
    return `${PROJECT_PIPELINE_STEPS.length}/${PROJECT_PIPELINE_STEPS.length}`;
  return `—`;
};

// Find the most recent activity entry for "last activity" column.
export const getLastActivity = (proposalId) => {
  const list = getActivity(proposalId);
  return list.length > 0 ? list[0] : null;
};

// Read milestones for a converted lead. clientID is set on lead.convertedClientID.
export const getMilestonesForLead = (lead) => {
  if (!lead?.convertedClientID) return [];
  try {
    const raw = localStorage.getItem(
      `clientMilestones_${lead.convertedClientID}`,
    );
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveMilestonesForLead = (lead, milestones) => {
  if (!lead?.convertedClientID) return;
  localStorage.setItem(
    `clientMilestones_${lead.convertedClientID}`,
    JSON.stringify(milestones),
  );
};

// Aggregate every project-eligible lead: any lead that has at least one
// proposal email logged. Returns enriched rows with progress info.
export const getAllProjects = (allLeads = []) => {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("leadActivity_")) continue;
    const proposalId = key.replace("leadActivity_", "");
    let list = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      continue;
    }
    if (!list.some((e) => e.type === "email")) continue;
    if (seen.has(proposalId)) continue;
    seen.add(proposalId);
    const lead = allLeads.find((l) => l.proposalId === proposalId);
    if (!lead) continue;
    const milestones = getMilestonesForLead(lead);
    const stage = getProjectStage(lead, milestones);
    const last = list[0];
    out.push({
      lead,
      stage,
      lastActivity: last,
      progress: getProjectProgress(lead, milestones),
      milestones,
    });
  }
  return out;
};
