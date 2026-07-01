// Leads API — FRONTEND_API.md §3.
//
// IDs in URLs are the Mongo `id` (not the display `proposalId` like LD-2026-001).
// Create requires { clientName, serviceTrack }; the server assigns proposalId.

import { api, apiList } from "./client";

// GET /leads?status=&track=&q=&page=&limit=  → paged { data, page, total, pages }
export const listLeads = (params = {}) => apiList("/leads", params);

export const createLead = (body) => api("/leads", { method: "POST", body });

export const updateLead = (id, patch) =>
  api(`/leads/${id}`, { method: "PATCH", body: patch });

export const deleteLead = (id) => api(`/leads/${id}`, { method: "DELETE" });

// Activities — call/email/note log. GET returns the lead's timeline entries;
// POST appends one. IDs here are the lead's Mongo `id`.
export const getLeadActivities = (id) => api(`/leads/${id}/activities`);
export const addLeadActivity = (id, activity) =>
  api(`/leads/${id}/activities`, { method: "POST", body: activity });

// Lead → Client. Idempotent: 201 first time, 200 if already converted.
// Returns { client, alreadyConverted }.
export const convertLead = (id) =>
  api(`/leads/${id}/convert`, { method: "POST" });

// Lead quotes live in api/quotes.js (listLeadQuotes / createLeadQuote).
