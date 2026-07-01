// Clients API — FRONTEND_API.md §4.
//
// Create requires { clientName, serviceTrack }; server assigns clientId
// (BL-YYYY-###). Milestones are payment milestones sorted server-side.

import { api, apiList } from "./client";

// GET /clients?q=&page=&limit=  → paged { data, page, total, pages }
export const listClients = (params = {}) => apiList("/clients", params);

export const createClient = (body) => api("/clients", { method: "POST", body });

export const getClient = (id) => api(`/clients/${id}`);

export const updateClient = (id, patch) =>
  api(`/clients/${id}`, { method: "PATCH", body: patch });

export const deleteClient = (id) => api(`/clients/${id}`, { method: "DELETE" });

// Payment milestones.
export const getClientMilestones = (id) => api(`/clients/${id}/milestones`);

// PATCH /milestones/:id — mark paid / update status. Setting status=paid
// auto-stamps paidDate if absent.
export const updateMilestone = (milestoneId, patch) =>
  api(`/milestones/${milestoneId}`, { method: "PATCH", body: patch });
