// Final client quote — the priced document sent to the client AFTER the BOQ is
// finalized. The BOQ (see boqStorage.js) is the internal COST build-up; this is
// the client-facing PRICE snapshot derived from it.
//
// Design: a final quote is a frozen snapshot written into the SAME
// `quotes_<parentId>` store the lead/client portal already reads (see
// QuotePresets.saveQuote and clientportal/pages/ProjectQuotes.jsx). Reusing that
// store means the client portal and the shared QuotePreview render it with zero
// extra wiring — this module only has to produce a quote object in the shape
// QuotePreview expects and hand it to saveQuote().
//
// QuotePreview recomputes its own subtotal/GST/total from the scope rows
// (Σ amount + flat 18% GST), so each row's `amount` must already be the
// client price for that line, and the stored summary totals mirror that math.

import {
  computeItemQty,
  computeItemAmount,
  computeQuoteFromBoq,
  validateBoqForSend,
  DIMENSIONAL_UNITS,
  getBoq,
  saveBoq,
} from "./boqStorage";
import { getClient } from "./clientStorage";
import {
  GST_RATE,
  generateQuoteId,
  saveQuote,
  getQuotesForParent,
} from "./QuotePresets";
import { buildTakeoffFromBoq } from "./procurementStorage";
import { UNITS } from "./boqUnits";

const unitLabelOf = (code) => UNITS.find((u) => u.code === code)?.label || code;

// Rolled-up material take-off for the client "Material Summary" table — every
// material used across the BOQ, deduped, with its wastage-inclusive quantity,
// blended rate and value. Unit codes are resolved to display labels (sqft ->
// "Sq Ft"). The takeoff's internal `usedIn` (which rooms consume it) is dropped
// — it's not shown to the client.
const buildMaterialSummary = (boq) =>
  buildTakeoffFromBoq(boq)
    .filter((t) => (t.name || t.spec) && Number(t.estimatedQty) > 0)
    .map((t) => ({
      name: t.name || "",
      spec: t.spec || "",
      qty: Number(t.estimatedQty) || 0,
      unit: unitLabelOf(t.unit),
      rate: Number(t.rate) || 0,
      amount: Number(t.estimatedAmount) || 0,
    }));

// Resolve the parent id the client portal keys quotes on. The portal looks up
// quotes by `client.sourceLeadId || client.clientID`, so a BOQ-derived quote has
// to be saved under that same id or it will never surface for the client. A BOQ
// only stores `client.id` (= clientID), so re-read the full client record to
// recover its originating lead id. Falls back to the raw client id, then null.
export const resolveQuoteParentId = (boq) => {
  const clientId = boq?.client?.id;
  if (!clientId) return null;
  const full = getClient(clientId);
  return full?.sourceLeadId || full?.clientID || clientId;
};

// Pull the leading number out of a validity string like "30 days from issue".
const parseValidityDays = (validity) => {
  if (typeof validity === "number") return validity;
  const match = String(validity || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
};

// Format a decimal dimension into feet-inches (e.g. 3.58 -> 3'7"). Feet = whole
// part, inches = fractional part x 12, rolling 12" up to the next foot. Values
// under a foot render as inches only ("7"").
const toFeetInches = (value) => {
  const v = Number(value) || 0;
  if (v <= 0) return "";
  let ft = Math.floor(v);
  let inches = Math.round((v - ft) * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  if (ft === 0) return `${inches}"`;
  return inches > 0 ? `${ft}'${inches}"` : `${ft}'`;
};

// One L x B (x H) dimension set -> a display string. Feet-based units render as
// feet-inches ("3'7" X 7'7""); other units as "n.nn <suffix>". Zero/blank
// dimensions are skipped so a length-only item shows just its length.
const dimsToText = (dims, suffix) => {
  const fmt =
    suffix === "ft"
      ? toFeetInches
      : (v) =>
          Number(v) > 0
            ? `${Number(v).toFixed(2)}${suffix ? ` ${suffix}` : ""}`
            : "";
  return [dims?.length, dims?.breadth ?? dims?.width, dims?.height]
    .map(fmt)
    .filter(Boolean)
    .join(" × ");
};

// Client-facing measurement lines for a BOQ line item. Prefers the item's
// measurement rows (each keeps its own location, e.g. a "LOFT" sub-line),
// falling back to the single dimensions block. Returns an array of strings (one
// per measured entry) or undefined when the item carries no usable dimensions —
// undefined keeps the measurement column out of quotes that have no dimensions.
const buildMeasurementText = (item) => {
  const suffix = DIMENSIONAL_UNITS[item?.unit]?.suffix || "";
  const lines = [];
  const rows = Array.isArray(item?.measurementRows) ? item.measurementRows : [];
  if (rows.length > 0) {
    for (const r of rows) {
      const text = dimsToText(
        { length: r.length, breadth: r.breadth ?? r.width, height: r.height },
        suffix,
      );
      if (!text) continue;
      const loc = (r.location || "").trim();
      lines.push(loc ? `${loc.toUpperCase()} — ${text}` : text);
    }
  } else if (item?.dimensions?.enabled) {
    const text = dimsToText(item.dimensions, suffix);
    if (text) lines.push(text);
  }
  return lines.length > 0 ? lines : undefined;
};

// One BOQ line item -> one client quote scope row. Uses the item's EFFECTIVE
// client rate (the rate-analysis final rate when the item opts in, else the flat
// rate) via computeItemAmount, folds the line discount into the amount, and
// applies the optional BOQ-level margin uplift so the cost->price spread carried
// on the BOQ (`marginPercent`) is reflected in what the client sees. Every
// internal-only field — rate analysis, vendor comparisons, cost build-up — is
// deliberately dropped: this row is client-facing.
const boqItemToScopeRow = (item, room, marginFactor) => {
  const qty = computeItemQty(item);
  const { gross, net } = computeItemAmount(item);
  const baseRate = qty > 0 ? gross / qty : 0;
  return {
    area: room,
    heading: room,
    // Work name shows in the OBJECTS column; the spec is the detailed
    // description. Flag both custom so QuotePreview's master refresh + the scope
    // normalizer leave them exactly as taken from the BOQ.
    itemName: item.description || "Item",
    description: item.spec || "",
    isItemNameCustom: true,
    isDescriptionCustom: true,
    unit: item.unit || "nos",
    qty,
    // L x B (x H) shown in the client quote's Measurement column, feet-inches
    // for feet-based units. Undefined when the item has no dimensions.
    measurement: buildMeasurementText(item),
    rate: Math.round(baseRate * marginFactor),
    amount: Math.round(net * marginFactor),
    materials: Array.isArray(item.materials)
      ? item.materials.map((m) => ({ name: m.name || "", spec: m.spec || "" }))
      : [],
  };
};

// Build the client quote object from a BOQ. Pure — does not persist. `quoteId`
// can be supplied to reuse an id (e.g. build once for a confirm preview, then
// save the same object) instead of burning a new one on every call.
export const createFinalQuoteFromBoq = (boq, { quoteId } = {}) => {
  const marginFactor = 1 + (Number(boq?.marginPercent) || 0) / 100;

  const scopeItems = [];
  for (const section of boq?.sections || []) {
    const room = section.category || section.name || "General";
    for (const item of section.items || []) {
      scopeItems.push(boqItemToScopeRow(item, room, marginFactor));
    }
  }

  // Mirror QuotePreview's own math (Σ amount + flat GST) so the stored summary
  // matches the rendered document exactly.
  const subtotal = scopeItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const gst = Math.round((subtotal * GST_RATE) / 100);
  const grandTotal = subtotal + gst;

  return {
    quoteId: quoteId || generateQuoteId(),
    parentId: resolveQuoteParentId(boq),
    parentType: "client",
    // Provenance — lets the quote trace back to the exact BOQ revision it came
    // from, and marks it as BOQ-derived vs a pre-BOQ proposal.
    source: "boq",
    sourceBoqId: boq?.id || null,
    boqRevision: boq?.revision || 1,
    recipientName: boq?.client?.name || "",
    recipientEmail: boq?.client?.email || "",
    recipientPhone: boq?.client?.phone || "",
    propertyType: boq?.project?.propertyType || "",
    sizeRange: boq?.project?.sizeRange || "",
    validityDays: parseValidityDays(boq?.validity) || 30,
    scopeItems,
    // Rolled-up material take-off shown as a "Material Summary" table after the
    // priced scope. Empty array when the BOQ carries no materials.
    materialSummary: buildMaterialSummary(boq),
    inclusions: Array.isArray(boq?.inclusions) ? boq.inclusions : [],
    exclusions: Array.isArray(boq?.exclusions) ? boq.exclusions : [],
    notes: boq?.notes || "",
    createdAt: new Date().toISOString(),
    subtotal,
    gst,
    grandTotal,
    // Reference figure from the BOQ cost model (incl. contingency / BOQ-level
    // charges the itemized client PDF does not break out). Stored for the record
    // only — never shown to the client.
    boqGrandTotal: computeQuoteFromBoq(boq).grandTotal,
    status: "draft",
  };
};

// Send-readiness for a final quote: a client must be linked (else it has nowhere
// to land), and the BOQ must clear its own send-readiness blocks. Returns the
// same { blocks, warnings } shape as validateBoqForSend so the caller can reuse
// the BOQ send dialog / toasts.
export const validateFinalQuote = (boq) => {
  const { blocks, warnings } = validateBoqForSend(boq);
  const nextBlocks = [...blocks];
  if (!resolveQuoteParentId(boq)) {
    nextBlocks.push(
      "Link a client to this BOQ before generating the final quote — the quote is published to that client's portal.",
    );
  }
  return { blocks: nextBlocks, warnings };
};

// Freeze the quote and publish it to the client portal store. Accepts an
// optional pre-built quote so a caller can preview totals before confirming and
// then persist the very same object (no second id generated). Returns
// { ok, quote, parentId } or { ok: false, error }.
export const sendFinalQuote = (boq, prebuilt) => {
  const parentId = resolveQuoteParentId(boq);
  if (!parentId) {
    return {
      ok: false,
      error:
        "No client is linked to this BOQ, so the final quote has nowhere to be sent. Link a client first.",
    };
  }
  const base = prebuilt || createFinalQuoteFromBoq(boq);
  const quote = {
    ...base,
    parentId,
    status: "sent",
    sentAt: new Date().toISOString(),
  };
  saveQuote(parentId, quote);
  return { ok: true, quote, parentId };
};

// ── Client response (portal) ────────────────────────────────────────────────
// A quote is "actionable" by the client while it is sent/viewed and not yet
// decided. Once accepted it is locked; a change request sends it back to the
// admin (still editable on the BOQ side).
export const QUOTE_ACCEPTABLE_STATUSES = ["sent", "viewed", "changes_requested"];

export const isQuoteActionable = (quote) =>
  QUOTE_ACCEPTABLE_STATUSES.includes(quote?.status || "");

// Append a client-action entry to the source BOQ's audit trail and, on accept,
// stamp the BOQ's client-acceptance fields + complete its client-approval stage.
// This is what makes the admin's BOQ reflect the client's REAL action instead of
// being admin-asserted. Best-effort — a missing/removed BOQ is a no-op.
const writeClientResponseToBoq = (boqId, decision, { who, at, comment, quoteId }) => {
  const boq = getBoq(boqId);
  if (!boq) return;
  const approval = boq.approval || {};
  const entry = {
    id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    action: decision === "accept" ? "client_accepted" : "client_changes_requested",
    label:
      decision === "accept" ? "Client Accepted Quote" : "Client Requested Changes",
    actor: who,
    details:
      decision === "accept"
        ? "Client accepted the final quote in the portal."
        : `Client requested changes in the portal${comment ? `: ${comment}` : ""}.`,
    at,
    status: boq.status,
    revision: boq.revision || 1,
  };
  const next = {
    ...boq,
    approval:
      decision === "accept"
        ? {
            ...approval,
            clientAcceptedBy: who,
            clientAcceptedAt: at,
            stages: {
              ...(approval.stages || {}),
              clientApproval: {
                ...(approval.stages?.clientApproval || {}),
                status: "completed",
                completedBy: who,
                completedAt: at,
              },
            },
          }
        : approval,
    auditTrail: [...(boq.auditTrail || []), entry],
    // In-BOQ notification: the latest client action on this BOQ's quote. Drives
    // the banner in the BOQ editor. `acknowledged` is flipped when the admin
    // dismisses it there.
    clientRequest: {
      type: decision === "accept" ? "accepted" : "changes_requested",
      quoteId: quoteId || "",
      by: who,
      at,
      comment: comment || "",
      acknowledged: false,
    },
  };
  saveBoq(next);
};

// Record the client's decision on a published quote from the portal. `decision`
// is "accept" or "request". On accept the quote is stamped with the client's
// name + timestamp (a lightweight click-to-sign) and locked; on request it is
// flagged with the client's comment and left open for the admin to revise.
// Writes the same action back to the source BOQ (when the quote is BOQ-derived).
export const respondToFinalQuote = (parentId, quoteId, decision, { name, comment } = {}) => {
  if (!parentId || !quoteId) {
    return { ok: false, error: "Missing quote reference." };
  }
  const quote = getQuotesForParent(parentId).find((q) => q.quoteId === quoteId);
  if (!quote) return { ok: false, error: "Quote not found." };
  if (decision === "accept" && !isQuoteActionable(quote)) {
    return { ok: false, error: "This quote has already been decided." };
  }
  const at = new Date().toISOString();
  const who = (name || quote.recipientName || "Client").trim();

  const next =
    decision === "accept"
      ? { ...quote, status: "accepted", acceptedBy: who, acceptedAt: at }
      : {
          ...quote,
          status: "changes_requested",
          changeRequestedBy: who,
          changeRequestedAt: at,
          clientComment: (comment || "").trim(),
        };
  saveQuote(parentId, next);

  if (quote.source === "boq" && quote.sourceBoqId) {
    writeClientResponseToBoq(quote.sourceBoqId, decision, {
      who,
      at,
      comment: (comment || "").trim(),
      quoteId,
    });
  }
  return { ok: true, quote: next };
};
