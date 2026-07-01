// Client Portal API — FRONTEND_API.md §9 (client token only).
//
// Login with audience:"client". All endpoints are RLS-scoped to the token's own
// clientId — internal review, costs, vendor/procurement data are stripped
// server-side. request-revision returns billable:true past the free rounds.

import { api } from "./client";

export const getPortalMe = () => api("/portal/me");

// Only AWAITING_CLIENT + already-APPROVED stages.
export const getPortalStages = () => api("/portal/stages");

export const approvePortalStage = (stageId) =>
  api(`/portal/stages/${stageId}/approve`, { method: "POST" });

// { comment } required → round++, back to DRAFTING.
export const requestPortalRevision = (stageId, comment) =>
  api(`/portal/stages/${stageId}/request-revision`, {
    method: "POST",
    body: { comment },
  });

export const getPortalMilestones = () => api("/portal/milestones");
