// Change Order (Variation) storage — the biggest revenue leak in fit-out work.
//
// Mid-project scope changes must: be priced (a mini-BOQ), be client-approved,
// then ADD to the contract value so they get billed. Without this, 15–30% of the
// real project value stays invisible. Approving a change order pushes the new
// total variation value back onto the contract (contractValue re-derives).
//
// Stored per contract under `changeOrders_<contractId>`.

import { getContract, setVariationsValue } from "./contractStorage";

const KEY = (contractId) => `changeOrders_${contractId}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

export const generateChangeOrderId = (contractId) => {
  const year = new Date().getFullYear();
  const n = listChangeOrders(contractId).length + 1;
  return `CO-${year}-${String(n).padStart(3, "0")}`;
};

export const listChangeOrders = (contractId) =>
  contractId ? readJson(KEY(contractId), []) : [];

const writeAll = (contractId, list) => {
  localStorage.setItem(KEY(contractId), JSON.stringify(list));
  return list;
};

// Sum of approved variations only — the value the contract should grow by.
export const getApprovedVariationsValue = (contractId) =>
  listChangeOrders(contractId)
    .filter((co) => co.status === "client_approved")
    .reduce((s, co) => s + (Number(co.value) || 0), 0);

// Recompute the contract's variation total and write it back so billing/P&L pick
// it up. Called after any approve/reject.
const syncContractVariations = (contractId) => {
  setVariationsValue(contractId, getApprovedVariationsValue(contractId));
};

export const createChangeOrder = (
  contractId,
  { description = "", value = 0, scopeItemId = null, items = [], addsMilestone = false } = {},
) => {
  if (!getContract(contractId)) return null;
  const co = {
    id: generateChangeOrderId(contractId),
    contractId,
    description,
    value: Number(value) || 0,
    scopeItemId,
    items, // optional mini-BOQ lines
    addsMilestone,
    status: "proposed", // proposed → client_approved | rejected
    createdAt: new Date().toISOString(),
    approvedAt: null,
  };
  writeAll(contractId, [co, ...listChangeOrders(contractId)]);
  return co;
};

const setStatus = (contractId, coId, status) => {
  const next = listChangeOrders(contractId).map((co) =>
    co.id === coId
      ? {
          ...co,
          status,
          approvedAt:
            status === "client_approved" ? new Date().toISOString() : null,
        }
      : co,
  );
  writeAll(contractId, next);
  syncContractVariations(contractId);
  return next.find((co) => co.id === coId) || null;
};

export const approveChangeOrder = (contractId, coId) =>
  setStatus(contractId, coId, "client_approved");

export const rejectChangeOrder = (contractId, coId) =>
  setStatus(contractId, coId, "rejected");
