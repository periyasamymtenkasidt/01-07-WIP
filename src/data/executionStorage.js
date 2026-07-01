// Execution storage — the "split the work for the contract" step.
//
// A won contract is broken into Work Packages by trade (carpentry, electrical,
// …), each optionally assigned to a subcontractor with a work-order value and an
// `actualCost`. Work packages carry `scopeItemId` so they tie back to the room
// they belong to (Rail 🟦), and their actuals are the LABOUR half of project
// margin (procurement is the material half).
//
// Stored per contract under `workPackages_<contractId>`.

const KEY = (contractId) => `workPackages_${contractId}`;

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

export const TRADES = [
  "Civil",
  "Carpentry",
  "Electrical",
  "Plumbing",
  "False Ceiling",
  "Painting",
  "Furniture",
  "Flooring",
];

const genId = () =>
  `wp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export const listWorkPackages = (contractId) =>
  contractId ? readJson(KEY(contractId), []) : [];

const writeAll = (contractId, list) => {
  localStorage.setItem(KEY(contractId), JSON.stringify(list));
  return list;
};

export const createWorkPackage = (
  contractId,
  {
    scopeItemId = null,
    trade = "Carpentry",
    title = "",
    subcontractorId = null,
    subcontractorName = "",
    workOrderValue = 0,
  } = {},
) => {
  const wp = {
    id: genId(),
    contractId,
    scopeItemId,
    trade,
    title,
    subcontractorId,
    subcontractorName,
    workOrderValue: Number(workOrderValue) || 0,
    actualCost: 0,
    status: "Not Started", // Not Started → In Progress → Done | Blocked
    createdAt: new Date().toISOString(),
  };
  writeAll(contractId, [wp, ...listWorkPackages(contractId)]);
  return wp;
};

// Split a contract's scope snapshot into one package per room for a given trade —
// a quick way to bootstrap the WBS instead of adding packages one by one.
export const seedPackagesFromScope = (contractId, scopeSnapshot = [], trade = "Carpentry") =>
  scopeSnapshot.map((s) =>
    createWorkPackage(contractId, {
      scopeItemId: s.scopeItemId,
      trade,
      title: `${trade} — ${s.area}`,
      workOrderValue: 0,
    }),
  );

export const updateWorkPackage = (contractId, id, changes) => {
  const next = listWorkPackages(contractId).map((wp) =>
    wp.id === id ? { ...wp, ...changes } : wp,
  );
  writeAll(contractId, next);
  return next.find((wp) => wp.id === id) || null;
};

// Labour actuals for a contract = Σ work-package actualCost. Feeds project P&L.
export const getLabourActuals = (contractId) =>
  listWorkPackages(contractId).reduce(
    (s, wp) => s + (Number(wp.actualCost) || 0),
    0,
  );
