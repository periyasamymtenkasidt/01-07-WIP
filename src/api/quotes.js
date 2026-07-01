// Quotes (Proposals) API — FRONTEND_API.md §5.
//
// Server computes subtotal / gst / grandTotal from scopeItems (GST default 18%):
// don't send totals, read them back. Sending stamps an immutable PDF-record.

import { api } from "./client";

// Quotes for a lead.
export const listLeadQuotes = (leadId) => api(`/leads/${leadId}/quotes`);

// Create body: { recipientName, recipientEmail, presetKey, propertyType, grade,
// scopeItems, inclusions, exclusions }.
export const createLeadQuote = (leadId, body) =>
  api(`/leads/${leadId}/quotes`, { method: "POST", body });

export const getQuote = (id) => api(`/quotes/${id}`);

// POST /quotes/:id/send — stamps sentAt, archives an immutable PDF-record.
export const sendQuote = (id) => api(`/quotes/${id}/send`, { method: "POST" });
