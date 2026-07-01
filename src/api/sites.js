// Sites & Survey API — FRONTEND_API.md §7.
//
// Create needs { client } (id); server assigns siteId (ST-YYYY-###).
// Survey freeze is a one-time immutable snapshot; edits after freeze 422 until
// unfreeze (which archives the design flow and reopens the survey).

import { api, apiList } from "./client";

// GET /sites?q=&page=&limit=  → paged { data, page, total, pages }
export const listSites = (params = {}) => apiList("/sites", params);

export const createSite = (body) => api("/sites", { method: "POST", body });

export const getSite = (id) => api(`/sites/${id}`);

export const updateSite = (id, patch) =>
  api(`/sites/${id}`, { method: "PATCH", body: patch });

export const deleteSite = (id) => api(`/sites/${id}`, { method: "DELETE" });

// Survey measurements.
export const getMeasurements = (id) => api(`/sites/${id}/measurements`);
// Bulk upsert by area+scopeItemId: { measurements: [{ area, scopeItemId, ... }] }
export const putMeasurements = (id, measurements) =>
  api(`/sites/${id}/measurements`, {
    method: "PUT",
    body: { measurements },
  });

// Freeze body: { presetKey, propertyType, quote, items, baseline:{subtotal,gst,grandTotal} }
// 409 if already frozen.
export const freezeSurvey = (id, body) =>
  api(`/sites/${id}/freeze-survey`, { method: "POST", body });

// Archives the design flow, reopens the survey.
export const unfreezeSurvey = (id) =>
  api(`/sites/${id}/unfreeze`, { method: "POST" });

// Feasibility (Architecture-only).
export const getFeasibility = (id) => api(`/sites/${id}/feasibility`);
export const putFeasibility = (id, body) =>
  api(`/sites/${id}/feasibility`, { method: "PUT", body });
// { decision: "Go"|"No-Go", note }
export const feasibilityDecision = (id, body) =>
  api(`/sites/${id}/feasibility/decision`, { method: "POST", body });
