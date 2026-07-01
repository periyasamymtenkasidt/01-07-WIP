// Contract storage — the delivery ANCHOR that was missing from the flow.
//
// Until now "projects" were computed on the fly from Lead + Client + Milestones
// + Schedule and never persisted, so there was no single record that locks the
// agreed scope + value + payment schedule at the moment a lead is Won. Every
// downstream record (procurement PO, subcontractor work order, change order,
// invoice, P&L) needs that anchor via `contractId`.
//
// Rails this closes:
//   💰 Money    — baseValue + approved variations = contractValue (the billing base)
//   🟦 Scope    — scopeSnapshot freezes the rooms (scopeItemId) at sign time
//   ⏱ Time     — timelineDays = Σ room days
//
// One contract per client conversion. Stored under `contract_<id>` with a master
// index at `contract_index` (mirrors boqStorage).

import { PAYMENT_MILESTONES } from "./MilestoneConfig";

const INDEX_KEY = "contract_index";
const ITEM_KEY = (id) => `contract_${id}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

// ── ID generation ──────────────────────────────────────────────────────────
export const generateContractId = () => {
  const year = new Date().getFullYear();
  const n = listContracts().length + 1;
  return `CON-${year}-${String(n).padStart(3, "0")}`;
};

// ── CRUD ───────────────────────────────────────────────────────────────────
export const listContracts = () => readJson(INDEX_KEY, []);

export const getContract = (id) => {
  if (!id) return null;
  return readJson(ITEM_KEY(id), null);
};

// Look the contract up by the IDs the rest of the app already carries, so screens
// that only know a client or lead can still resolve the anchor.
export const getContractByClient = (clientID) =>
  listContracts().find((c) => c.clientID === clientID) || null;

export const getContractByLead = (leadId) =>
  listContracts().find((c) => c.leadId === leadId) || null;

export const saveContract = (contract) => {
  const next = { ...contract, updatedAt: new Date().toISOString() };
  // Keep contractValue derived: base + approved variations.
  next.contractValue =
    (Number(next.baseValue) || 0) + (Number(next.variationsValue) || 0);
  localStorage.setItem(ITEM_KEY(next.id), JSON.stringify(next));

  const idx = listContracts();
  const summary = {
    id: next.id,
    clientID: next.clientID,
    leadId: next.leadId,
    boqId: next.boqId,
    status: next.status,
    contractValue: next.contractValue,
    clientName: next.clientName,
    createdAt: next.createdAt,
    updatedAt: next.updatedAt,
  };
  const exists = idx.some((c) => c.id === next.id);
  const nextIdx = exists
    ? idx.map((c) => (c.id === next.id ? summary : c))
    : [summary, ...idx];
  localStorage.setItem(INDEX_KEY, JSON.stringify(nextIdx));
  return next;
};

// ── Factory ────────────────────────────────────────────────────────────────
// Build the scope snapshot from the seeded schedule rooms (each room carries the
// scope identity, amount, days and materials). Falls back to the lead's own
// quote scope items if a schedule wasn't seeded.
const buildScopeSnapshot = (schedule, lead) => {
  const rooms = schedule?.rooms || [];
  if (rooms.length > 0) {
    return rooms.map((r) => ({
      scopeItemId: r.id,
      area: r.room || "",
      description: r.description || "",
      amount: Number(r.amount) || 0,
      days: Number(r.days) || 0,
      materials: r.materials || [],
    }));
  }
  const items = lead?.quoteScopeItems || [];
  return items.map((s) => ({
    scopeItemId: s.id,
    area: s.area || "",
    description: s.description || "",
    amount: Number(s.amount) || 0,
    days: Number(s.days) || 0,
    materials: s.materials || [],
  }));
};

// Called from LeadEdit.handleConvert at the moment of Won. Locks the agreed
// value + scope + payment schedule. `milestones` are the already-computed
// clientMilestones_<clientID> rows, referenced live so paid status stays in sync.
export const createContractFromConversion = ({
  lead,
  clientID,
  clientName,
  numericValue,
  schedule,
  milestones,
  marginPercent = 20,
  boqId = null,
}) => {
  const scopeSnapshot = buildScopeSnapshot(schedule, lead);
  const timelineDays = scopeSnapshot.reduce((s, r) => s + (r.days || 0), 0);
  const milestoneSource = milestones?.length ? milestones : PAYMENT_MILESTONES;

  const contract = {
    id: generateContractId(),
    clientID,
    clientName: clientName || lead?.clientName || "",
    leadId: lead?.proposalId || null,
    boqId,
    status: "signed", // conversion == signed; advances to in_progress on execution
    baseValue: Number(numericValue) || 0,
    variationsValue: 0,
    contractValue: Number(numericValue) || 0,
    marginPercent,
    timelineDays,
    scopeSnapshot,
    // Live reference — finance reads paid/overdue status from this key so the
    // contract never drifts from the milestone tracker the UI already updates.
    milestonesKey: `clientMilestones_${clientID}`,
    paymentSchedule: milestoneSource.map((m) => ({
      milestoneId: m.id,
      name: m.name,
      percent: m.pct ?? m.percent,
      amount: Number(m.base) || Math.round((numericValue * (m.pct ?? 0)) / 100),
    })),
    scheduleKey: lead?.proposalId ? `projectSchedule_${lead.proposalId}` : null,
    createdAt: new Date().toISOString(),
  };
  return saveContract(contract);
};

// ── Linking & recompute ──────────────────────────────────────────────────────
// Attach a BOQ once it's signed (closes the cost half of the 💰 rail).
export const linkBoqToContract = (contractId, boqId) => {
  const c = getContract(contractId);
  if (!c) return null;
  return saveContract({ ...c, boqId });
};

// Apply the total approved-variation value (see changeOrderStorage). contractValue
// is re-derived on save, so billing % always uses base + approved variations.
export const setVariationsValue = (contractId, variationsValue) => {
  const c = getContract(contractId);
  if (!c) return null;
  return saveContract({ ...c, variationsValue: Number(variationsValue) || 0 });
};

export const setContractStatus = (contractId, status) => {
  const c = getContract(contractId);
  if (!c) return null;
  return saveContract({ ...c, status });
};
