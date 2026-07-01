// Procurement storage — turns the Material master from a price CATALOG into a
// flow, and captures the material half of project ACTUALS.
//
// Pipeline: BOQ material take-off → Purchase Order → GRN (goods received).
// Each PO carries an `actualCost`, which is what makes budget-vs-actual (and
// therefore project margin) computable.
//
// Stored per contract under `purchaseOrders_<contractId>`.

import { computeItemQty } from "./boqStorage";
import { listContracts } from "./contractStorage";

const KEY = (contractId) => `purchaseOrders_${contractId}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

// ── Material take-off ────────────────────────────────────────────────────────
// Roll every material referenced across a BOQ's line items into a deduped
// requisition. BOQ item materials are { name, spec } (no per-line qty), so we
// attribute the parent line's computed qty as an indicative quantity and tag
// which sections (rooms → scopeItemId) consume each material. This is the
// indent the buyer works from; exact quantities are refined on the PO.
export const buildTakeoffFromBoq = (boq) => {
  const byMaterial = new Map();
  for (const section of boq?.sections || []) {
    for (const item of section.items || []) {
      const qty = computeItemQty(item);
      for (const mat of item.materials || []) {
        const k = `${mat.name || ""}|${mat.spec || ""}`;
        if (!byMaterial.has(k)) {
          byMaterial.set(k, {
            materialId: mat.id || null,
            name: mat.name || "",
            spec: mat.spec || "",
            estimatedQty: 0,
            unit: item.unit || "nos",
            usedIn: [],
          });
        }
        const entry = byMaterial.get(k);
        entry.estimatedQty += qty;
        const room = section.category || section.name || "";
        if (room && !entry.usedIn.includes(room)) entry.usedIn.push(room);
      }
    }
  }
  return [...byMaterial.values()];
};

// ── Purchase Orders ──────────────────────────────────────────────────────────
export const generatePoId = (contractId) => {
  const year = new Date().getFullYear();
  const n = listPurchaseOrders(contractId).length + 1;
  return `PO-${year}-${String(n).padStart(3, "0")}`;
};

export const listPurchaseOrders = (contractId) =>
  contractId ? readJson(KEY(contractId), []) : [];

const writeAll = (contractId, list) => {
  localStorage.setItem(KEY(contractId), JSON.stringify(list));
  return list;
};

const lineAmount = (l) => (Number(l.qty) || 0) * (Number(l.rate) || 0);

export const createPurchaseOrder = (
  contractId,
  { vendorId = null, vendorName = "", items = [], expectedOn = "" } = {},
) => {
  const lines = items.map((l) => ({
    materialId: l.materialId || null,
    name: l.name || "",
    spec: l.spec || "",
    qty: Number(l.qty) || 0,
    unit: l.unit || "nos",
    rate: Number(l.rate) || 0,
    amount: lineAmount(l),
  }));
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const po = {
    id: generatePoId(contractId),
    contractId,
    vendorId,
    vendorName,
    items: lines,
    total,
    actualCost: total, // ordered value; reconciled on receipt if it differs
    status: "ordered", // draft → ordered → partially_received → received
    expectedOn,
    grns: [],
    createdAt: new Date().toISOString(),
  };
  writeAll(contractId, [po, ...listPurchaseOrders(contractId)]);
  return po;
};

// Record goods received against a PO (a GRN). receivedItems is a partial map of
// material → qtyReceived; status flips to received once everything is in.
export const receivePurchaseOrder = (contractId, poId, receivedItems = []) => {
  const next = listPurchaseOrders(contractId).map((po) => {
    if (po.id !== poId) return po;
    const grns = [
      ...(po.grns || []),
      { receivedItems, receivedOn: new Date().toISOString() },
    ];
    const totalReceived = {};
    grns.forEach((g) =>
      g.receivedItems.forEach((r) => {
        totalReceived[r.materialId ?? r.name] =
          (totalReceived[r.materialId ?? r.name] || 0) + (Number(r.qty) || 0);
      }),
    );
    const fullyReceived = po.items.every(
      (l) => (totalReceived[l.materialId ?? l.name] || 0) >= l.qty,
    );
    return { ...po, grns, status: fullyReceived ? "received" : "partially_received" };
  });
  writeAll(contractId, next);
  return next.find((po) => po.id === poId) || null;
};

// Material actuals for a contract = Σ PO actualCost. Feeds project P&L.
export const getMaterialActuals = (contractId) =>
  listPurchaseOrders(contractId).reduce(
    (s, po) => s + (Number(po.actualCost) || 0),
    0,
  );

// Every PO across all contracts, tagged with the project/client it belongs to —
// the data behind the top-level Procurement module's list and GRN views.
export const listAllPurchaseOrders = () =>
  listContracts().flatMap((c) =>
    listPurchaseOrders(c.id).map((po) => ({
      ...po,
      clientName: c.clientName,
      contractId: c.id,
    })),
  );

// Single PO lookup by id, tagged with its project/client — backs the PO detail page.
export const getPurchaseOrderById = (id) =>
  listAllPurchaseOrders().find((po) => po.id === id) || null;
