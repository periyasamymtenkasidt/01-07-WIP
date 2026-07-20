// RFQ (Request for Quotation) storage — sits between BOQ material take-off
// and Purchase Orders. Lets a buyer invite multiple vendors to quote the same
// take-off list, record what each one quoted (keyed in manually — there's no
// live vendor portal), award a winner, then convert the awarded quote
// straight into a Purchase Order.
//
// Pipeline: BOQ take-off → RFQ (multi-vendor quotes) → award → Purchase Order → GRN.
// Stored per contract under `rfqs_<contractId>`, same convention as POs.

import { createPurchaseOrder } from "./procurementStorage";
import { listContracts } from "./contractStorage";
import { listVendors } from "./vendorStorage";
import { getBoq } from "./boqStorage";

const KEY = (contractId) => `rfqs_${contractId}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

export const generateRfqId = () => {
  const year = new Date().getFullYear();
  const n = listAllRfqs().length + 1;
  return `RFQ-${year}-${String(n).padStart(3, "0")}`;
};

export const listRfqs = (contractId) =>
  contractId ? readJson(KEY(contractId), []) : [];

const writeAll = (contractId, list) => {
  localStorage.setItem(KEY(contractId), JSON.stringify(list));
  return list;
};

const lineAmount = (l) => {
  const basic = (Number(l.qty) || 0) * (Number(l.rate) || 0);
  const gst = Number(l.gst) || 0;
  return basic + (basic * gst) / 100;
};

// Normalized identity for a line item — the trimmed lowercase name, which is the
// stable human identity of the material. The Material-Master id is only a
// fallback for the rare unnamed line. Keying on the NAME (not the id) is what
// lets a take-off RFQ (lines carry materialId) and a manually-typed RFQ (no
// materialId) for the same material reconcile into one request instead of
// spawning a duplicate.
const itemKey = (l) => {
  const name = (l.name || "").trim().toLowerCase();
  if (name) return `name:${name}`;
  return l.materialId ? `id:${l.materialId}` : "";
};

// Scope signature = the sorted, de-duplicated set of item keys. Two RFQs are the
// "same request" only when these match. Empty (unidentifiable) keys are dropped.
const scopeSignature = (items = []) =>
  Array.from(new Set(items.map(itemKey)))
    .filter(Boolean)
    .sort()
    .join("|");

// An RFQ stays "open" (mergeable) until a vendor is awarded; once awarded or
// closed its scope + vendor list is frozen and must never be merged into.
const isOpenRfq = (rfq) => rfq.status !== "awarded" && rfq.status !== "closed";

const blankQuote = (vendorId) => ({
  vendorId,
  quotedAt: null,
  lines: [],
  total: 0,
  notes: "",
});

// Create an RFQ from a take-off (or manually entered) item list, inviting the
// given vendors. Each invited vendor starts with an empty quote — quotes are
// recorded later via recordVendorQuote as they come back.
//
// Merge is keyed on the OPEN REQUEST, never on the vendor: if an open RFQ for
// this contract already covers the same scope (same set of line items), the
// newly-invited vendors are folded into it instead of spawning a duplicate. A
// vendor already appearing in some other RFQ is NOT a trigger — the request
// (contract + open + scope) is the identity — so distinct scopes stay separate
// and awarded/closed RFQs are left untouched.
export const createRfq = (contractId, { items = [], vendorIds = [], expectedDeliveryDate = "", clientName = "" } = {}) => {
  const normalizedItems = items.map((l) => ({
    materialId: l.materialId || null,
    name: l.name || "",
    spec: l.spec || "",
    qty: Number(l.qty) || 0,
    unit: l.unit || "nos",
  }));

  const existing = listRfqs(contractId);
  const newSig = scopeSignature(normalizedItems);
  const target =
    newSig &&
    existing.find(
      (rfq) => isOpenRfq(rfq) && scopeSignature(rfq.items) === newSig,
    );

  if (target) {
    const invited = new Set(target.quotes.map((q) => q.vendorId));
    const addedQuotes = vendorIds
      .filter((id) => !invited.has(id))
      .map(blankQuote);
    // Scope matches by signature, so there is normally nothing to add here; the
    // union is a defensive no-op that keeps the merge robust if an unlinked line
    // ever slips through with a new name.
    const existingKeys = new Set(target.items.map(itemKey));
    const addedItems = normalizedItems.filter(
      (l) => !existingKeys.has(itemKey(l)),
    );
    const merged = {
      ...target,
      items: [...target.items, ...addedItems],
      quotes: [...target.quotes, ...addedQuotes],
    };
    writeAll(
      contractId,
      existing.map((rfq) => (rfq.id === target.id ? merged : rfq)),
    );
    return merged;
  }

  const rfq = {
    id: generateRfqId(),
    contractId,
    clientName,
    items: normalizedItems,
    quotes: vendorIds.map(blankQuote),
    status: "sent", // sent → quoted → awarded → closed
    awardedVendorId: null,
    poId: null,
    expectedDeliveryDate,
    createdAt: new Date().toISOString(),
  };
  writeAll(contractId, [rfq, ...existing]);
  return rfq;
};

// Record (or update) one invited vendor's quoted rates against the RFQ's
// item list. Flips status sent → quoted the first time anyone quotes.
export const recordVendorQuote = (
  contractId,
  rfqId,
  vendorId,
  { lines = [], notes = "", committedDeliveryDate = "" } = {},
) => {
  const next = listRfqs(contractId).map((rfq) => {
    if (rfq.id !== rfqId) return rfq;
    const quoteLines = lines.map((l) => ({
      materialId: l.materialId || null,
      name: l.name || "",
      spec: l.spec || "",
      qty: Number(l.qty) || 0,
      unit: l.unit || "nos",
      rate: Number(l.rate) || 0,
      gst: Number(l.gst) || 0,
      amount: lineAmount(l),
    }));
    const total = quoteLines.reduce((s, l) => s + l.amount, 0);
    const quotes = rfq.quotes.map((q) =>
      q.vendorId === vendorId
        ? { ...q, lines: quoteLines, total, notes, committedDeliveryDate, quotedAt: new Date().toISOString() }
        : q,
    );
    const anyQuoted = quotes.some((q) => q.quotedAt);
    return {
      ...rfq,
      quotes,
      status: rfq.status === "sent" && anyQuoted ? "quoted" : rfq.status,
    };
  });
  writeAll(contractId, next);
  return next.find((r) => r.id === rfqId) || null;
};

export const updateRfqExpectedDeliveryDate = (contractId, rfqId, expectedDeliveryDate) => {
  const next = listRfqs(contractId).map((rfq) =>
    rfq.id === rfqId ? { ...rfq, expectedDeliveryDate } : rfq,
  );
  writeAll(contractId, next);
  return next.find((r) => r.id === rfqId) || null;
};

export const awardRfq = (contractId, rfqId, vendorId) => {
  const next = listRfqs(contractId).map((rfq) =>
    rfq.id === rfqId ? { ...rfq, awardedVendorId: vendorId, status: "awarded" } : rfq,
  );
  writeAll(contractId, next);
  return next.find((r) => r.id === rfqId) || null;
};

// Convert an awarded RFQ straight into a Purchase Order, carrying the winning
// vendor's quoted lines/rates over via the existing PO creator. Marks the
// RFQ closed and links the new PO's id.
export const convertRfqToPo = (contractId, rfqId) => {
  const rfq = listRfqs(contractId).find((r) => r.id === rfqId);
  if (!rfq || !rfq.awardedVendorId) return null;
  const winning = rfq.quotes.find((q) => q.vendorId === rfq.awardedVendorId);
  if (!winning) return null;

  const vendor = listVendors().find((v) => v.id === rfq.awardedVendorId);
  const po = createPurchaseOrder(contractId, {
    vendorId: rfq.awardedVendorId,
    vendorName: vendor?.name || "",
    expectedOn: winning.committedDeliveryDate || "",
    items: winning.lines,
    clientName: rfq.clientName || "",
  });

  const next = listRfqs(contractId).map((r) =>
    r.id === rfqId ? { ...r, status: "closed", poId: po.id } : r,
  );
  writeAll(contractId, next);
  return po;
};

// Every RFQ across all contracts AND BOQ-keyed buckets (used when no contract
// is linked), tagged with clientName for the RFQs table.
export const listAllRfqs = () => {
  const contracts = listContracts();
  const contractKeySet = new Set(contracts.map((c) => KEY(c.id)));

  // Contract-backed RFQs — clientName comes from the contract record.
  const contractRfqs = contracts.flatMap((c) =>
    listRfqs(c.id).map((rfq) => ({
      ...rfq,
      clientName: c.clientName || rfq.clientName || "—",
      contractId: c.id,
    })),
  );

  const seenIds = new Set(contractRfqs.map((r) => r.id));

  // BOQ-backed RFQs (rfqs_<boqId>) — clientName stored in the record, or
  // resolved live from the BOQ for records written before the field was added.
  const boqRfqs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith("rfqs_") || contractKeySet.has(key)) continue;
    const records = readJson(key, []);
    records.forEach((rfq) => {
      if (seenIds.has(rfq.id)) return;
      seenIds.add(rfq.id);
      const resolvedName =
        rfq.clientName ||
        getBoq(rfq.contractId)?.client?.name ||
        "—";
      boqRfqs.push({ ...rfq, clientName: resolvedName });
    });
  }

  return [...contractRfqs, ...boqRfqs];
};

// One-time migration: reassign globally unique IDs to any RFQs that share
// the same id across contracts (artifact of the old per-contract counter).
export const migrateRfqIds = () => {
  const year = new Date().getFullYear();
  const contracts = listContracts();

  // Collect all RFQs with their contract context
  const all = contracts.flatMap((c) =>
    listRfqs(c.id).map((rfq) => ({ rfq, contractId: c.id })),
  );

  // Build the full set of existing IDs so new ones never clash
  const usedIds = new Set(all.map(({ rfq }) => rfq.id));

  const nextUniqueId = () => {
    let n = all.length + 1;
    let candidate;
    do {
      candidate = `RFQ-${year}-${String(n).padStart(3, "0")}`;
      n += 1;
    } while (usedIds.has(candidate));
    usedIds.add(candidate);
    return candidate;
  };

  // Per-contract mutable lists
  const lists = {};
  contracts.forEach((c) => { lists[c.id] = listRfqs(c.id); });

  const seen = new Set();
  all.forEach(({ rfq, contractId }) => {
    if (seen.has(rfq.id)) {
      const newId = nextUniqueId();
      lists[contractId] = lists[contractId].map((r) =>
        r.id === rfq.id ? { ...r, id: newId } : r,
      );
    } else {
      seen.add(rfq.id);
    }
  });

  contracts.forEach((c) => writeAll(c.id, lists[c.id]));
};

// Single RFQ lookup by id, tagged with its project/client — backs the public
// vendor quote form (which only has the RFQ id from its shared link).
export const getRfqById = (id) => listAllRfqs().find((rfq) => rfq.id === id) || null;