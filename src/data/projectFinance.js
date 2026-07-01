// Project finance — the executive payoff. Budget (BOQ cost) vs Actual
// (procurement + labour) → live project margin, plus billed/received/outstanding
// from the milestone tracker. This is the number the Accounts / Analytics stubs
// are meant to show but couldn't, because no actuals were captured anywhere.
//
// Pulls together: Contract (revenue + variations), BOQ (planned cost),
// PurchaseOrders (material actuals), WorkPackages (labour actuals), and the
// existing clientMilestones_<clientID> rows (received vs outstanding).

import {
  getContract,
  getContractByClient,
} from "./contractStorage";
import { getBoq, computeBoqTotals } from "./boqStorage";
import { getMaterialActuals } from "./procurementStorage";
import { getLabourActuals } from "./executionStorage";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

// Internal cost the BOQ planned for, ex-GST — materials (afterBoqDiscount)
// PLUS the BOQ's own planned labour + contingency budget (baseForGst), so
// this is comparable to actualCost below (material actuals + labour
// actuals). Falls back to revenue de-margined when no BOQ is linked yet.
const plannedCostFor = (contract) => {
  const boq = contract.boqId ? getBoq(contract.boqId) : null;
  if (boq) return computeBoqTotals(boq).baseForGst;
  const margin = (Number(contract.marginPercent) || 0) / 100;
  return margin > 0 ? contract.contractValue / (1 + margin) : contract.contractValue;
};

// Planned labour/contingency budget, broken out for display alongside the
// actuals they're meant to be compared against.
const plannedLaborAndContingencyFor = (contract) => {
  const boq = contract.boqId ? getBoq(contract.boqId) : null;
  if (!boq) return { plannedLabor: 0, plannedContingency: 0 };
  const t = computeBoqTotals(boq);
  return { plannedLabor: t.laborAmt, plannedContingency: t.contingencyAmt };
};

const billingFromMilestones = (contract) => {
  const rows = contract.milestonesKey ? readJson(contract.milestonesKey, []) : [];
  const paid = rows
    .filter((m) => m.status === "paid")
    .reduce((s, m) => s + (Number(m.base) || 0), 0);
  const overdue = rows.filter((m) => m.status === "overdue").length;
  return { received: paid, overdueCount: overdue };
};

// Core P&L for one contract record.
export const computeProjectPLByContract = (contractId) => {
  const contract = getContract(contractId);
  if (!contract) return null;
  return plFor(contract);
};

// Convenience: resolve the contract from the clientID the UI already has.
export const computeProjectPL = (clientID) => {
  const contract = getContractByClient(clientID);
  if (!contract) return null;
  return plFor(contract);
};

const plFor = (contract) => {
  const revenue = Number(contract.contractValue) || 0; // base + approved variations
  const plannedCost = plannedCostFor(contract);
  const { plannedLabor, plannedContingency } = plannedLaborAndContingencyFor(contract);
  const materialActual = getMaterialActuals(contract.id);
  const labourActual = getLabourActuals(contract.id);
  const actualCost = materialActual + labourActual;

  const grossMargin = revenue - actualCost;
  const marginPct = revenue > 0 ? (grossMargin / revenue) * 100 : 0;
  // Positive budgetVariance = spending under what the BOQ planned (good).
  const budgetVariance = plannedCost - actualCost;

  const { received, overdueCount } = billingFromMilestones(contract);
  const outstanding = Math.max(0, revenue - received);

  return {
    contractId: contract.id,
    clientID: contract.clientID,
    clientName: contract.clientName,
    revenue,
    variationsValue: Number(contract.variationsValue) || 0,
    plannedCost,
    plannedLabor,
    plannedContingency,
    materialActual,
    labourActual,
    actualCost,
    grossMargin,
    marginPct,
    budgetVariance,
    billed: revenue,
    received,
    outstanding,
    overdueCount,
  };
};

// Portfolio roll-up across every signed contract — for the Dashboard / Analytics
// executive view.
export const computePortfolioPL = () => {
  const all = readJson("contract_index", [])
    .map((c) => computeProjectPLByContract(c.id))
    .filter(Boolean);
  const sum = (k) => all.reduce((s, p) => s + (p[k] || 0), 0);
  const revenue = sum("revenue");
  const actualCost = sum("actualCost");
  return {
    projects: all.length,
    revenue,
    actualCost,
    grossMargin: revenue - actualCost,
    marginPct: revenue > 0 ? ((revenue - actualCost) / revenue) * 100 : 0,
    received: sum("received"),
    outstanding: sum("outstanding"),
    perProject: all,
  };
};
