// Design Flow & Internal Review API — FRONTEND_API.md §8 (the core module).
//
// Note the path split: the flow lives under a site (`/sites/:id/design-flow`),
// but stage actions key off the design-STAGE id (`/design-stages/:stageId/...`),
// and comments off the comment id. GET design-flow returns { flow, stages[] }
// (stages ordered); map stageKey → stage.id from that before calling stage ops.

import { api } from "./client";

// GET /sites/:id/design-flow → { flow, stages[] }
export const getDesignFlow = (siteId) => api(`/sites/${siteId}/design-flow`);

// POST /sites/:id/design-flow — start design (requires a frozen survey).
export const startDesign = (siteId, body) =>
  api(`/sites/${siteId}/design-flow`, { method: "POST", body });

// PATCH /design-stages/:id/deliverables — { deliverables:[{id,type,name,fileId|src,mime}] }
export const setStageDeliverables = (stageId, deliverables) =>
  api(`/design-stages/${stageId}/deliverables`, {
    method: "PATCH",
    body: { deliverables },
  });

// PUT /design-stages/:id/checklist/:index — { value:"yes"|"no"|null, comment }
export const setChecklistItem = (stageId, index, patch) =>
  api(`/design-stages/${stageId}/checklist/${index}`, {
    method: "PUT",
    body: patch,
  });

// DRAFTING → INTERNAL_REVIEW
export const submitInternalReview = (stageId) =>
  api(`/design-stages/${stageId}/submit-internal-review`, { method: "POST" });

// { role, comment } — role must match the current internal step.
export const internalApprove = (stageId, body) =>
  api(`/design-stages/${stageId}/internal-approve`, { method: "POST", body });

// { role, comment } — kickback to DRAFTING.
export const internalReturn = (stageId, body) =>
  api(`/design-stages/${stageId}/internal-return`, { method: "POST", body });

// Design comment register (DC-###).
export const getStageComments = (stageId) =>
  api(`/design-stages/${stageId}/comments`);
// { drawingRef, comment, raisedBy }
export const addStageComment = (stageId, body) =>
  api(`/design-stages/${stageId}/comments`, { method: "POST", body });
// { status, resolution } — resolution required to Close.
export const updateDesignComment = (commentId, patch) =>
  api(`/design-comments/${commentId}`, { method: "PATCH", body: patch });

// BOQ stage — auto-build the bill from the frozen survey (BACKEND_SPEC §8).
export const generateStageBoq = (stageId) =>
  api(`/design-stages/${stageId}/generate-boq`, { method: "POST" });
