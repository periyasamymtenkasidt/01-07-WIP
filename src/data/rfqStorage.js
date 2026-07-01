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

const KEY = (contractId) => `rfqs_${contractId}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

export const generateRfqId = (contractId) => {
  const year = new Date().getFullYear();
  const n = listRfqs(contractId).length + 1;
  return `RFQ-${year}-${String(n).padStart(3, "0")}`;
};

export const listRfqs = (contractId) =>
  contractId ? readJson(KEY(contractId), []) : [];

const writeAll = (contractId, list) => {
  localStorage.setItem(KEY(contractId), JSON.stringify(list));
  return list;
};

const lineAmount = (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0);

// Create an RFQ from a take-off (or manually entered) item list, inviting the
// given vendors. Each invited vendor starts with an empty quote — quotes are
// recorded later via recordVendorQuote as they come back.
export const createRfq = (contractId, { items = [], vendorIds = [] } = {}) => {
  const rfq = {
    id: generateRfqId(contractId),
    contractId,
    items: items.map((l) => ({
      materialId: l.materialId || null,
      name: l.name || "",
      spec: l.spec || "",
      qty: Number(l.qty) || 0,
      unit: l.unit || "nos",
    })),
    quotes: vendorIds.map((vendorId) => ({
      vendorId,
      quotedAt: null,
      lines: [],
      total: 0,
      notes: "",
    })),
    status: "sent", // sent → quoted → awarded → closed
    awardedVendorId: null,
    poId: null,
    createdAt: new Date().toISOString(),
  };
  writeAll(contractId, [rfq, ...listRfqs(contractId)]);
  return rfq;
};

// Record (or update) one invited vendor's quoted rates against the RFQ's
// item list. Flips status sent → quoted the first time anyone quotes.
export const recordVendorQuote = (
  contractId,
  rfqId,
  vendorId,
  { lines = [], notes = "" } = {},
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
      amount: lineAmount(l),
    }));
    const total = quoteLines.reduce((s, l) => s + l.amount, 0);
    const quotes = rfq.quotes.map((q) =>
      q.vendorId === vendorId
        ? { ...q, lines: quoteLines, total, notes, quotedAt: new Date().toISOString() }
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
export const convertRfqToPo = (contractId, rfqId, { expectedOn = "" } = {}) => {
  const rfq = listRfqs(contractId).find((r) => r.id === rfqId);
  if (!rfq || !rfq.awardedVendorId) return null;
  const winning = rfq.quotes.find((q) => q.vendorId === rfq.awardedVendorId);
  if (!winning) return null;

  const vendor = listVendors().find((v) => v.id === rfq.awardedVendorId);
  const po = createPurchaseOrder(contractId, {
    vendorId: rfq.awardedVendorId,
    vendorName: vendor?.name || "",
    expectedOn,
    items: winning.lines,
  });

  const next = listRfqs(contractId).map((r) =>
    r.id === rfqId ? { ...r, status: "closed", poId: po.id } : r,
  );
  writeAll(contractId, next);
  return po;
};

// Every RFQ across all contracts, tagged with the project/client it belongs
// to — the data behind the top-level RFQs tab list.
export const listAllRfqs = () =>
  listContracts().flatMap((c) =>
    listRfqs(c.id).map((rfq) => ({
      ...rfq,
      clientName: c.clientName,
      contractId: c.id,
    })),
  );

// Single RFQ lookup by id, tagged with its project/client — backs the public
// vendor quote form (which only has the RFQ id from its shared link).
export const getRfqById = (id) => listAllRfqs().find((rfq) => rfq.id === id) || null;
