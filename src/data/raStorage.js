// Running Account (RA) Bill storage.
// RA bills represent progressive payment claims by a contractor against an
// approved/signed BOQ. Multiple bills are raised as work progresses; each
// captures quantities executed in that period. Cumulative billed quantity
// across all certified bills must not exceed the BOQ quantity.

import { computeItemQty } from "./boqStorage";

const KEY = (boqId) => `ra_${boqId}`;

const genId = () =>
  `RA-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

// ── CRUD ─────────────────────────────────────────────────────────────────────

export const listRABills = (boqId) => {
  try {
    const raw = localStorage.getItem(KEY(boqId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveRABill = (boqId, bill) => {
  const bills = listRABills(boqId);
  const idx = bills.findIndex((b) => b.id === bill.id);
  const next = { ...bill, updatedAt: new Date().toISOString() };
  const updated =
    idx >= 0 ? bills.map((b) => (b.id === bill.id ? next : b)) : [...bills, next];
  localStorage.setItem(KEY(boqId), JSON.stringify(updated));
  return next;
};

export const deleteRABill = (boqId, billId) => {
  const updated = listRABills(boqId).filter((b) => b.id !== billId);
  localStorage.setItem(KEY(boqId), JSON.stringify(updated));
};

// ── Compute helpers ───────────────────────────────────────────────────────────

// Cumulative quantity billed in all certified/paid bills *before* the current one.
export const previousBilledQty = (bills, itemId, currentBillId) =>
  bills
    .filter((b) => b.id !== currentBillId && b.status !== "draft")
    .reduce((sum, b) => {
      const line = (b.items || []).find((it) => it.itemId === itemId);
      return sum + (Number(line?.thisBillQty) || 0);
    }, 0);

export const computeRALine = (line) => {
  const qty = Number(line.thisBillQty) || 0;
  const rate = Number(line.rate) || 0;
  const gross = qty * rate;
  const gst = (gross * (Number(line.gstPercent) || 0)) / 100;
  return { gross, gst, total: gross + gst };
};

export const computeRABillTotals = (bill) => {
  let gross = 0;
  let gst = 0;
  for (const line of bill.items || []) {
    const c = computeRALine(line);
    gross += c.gross;
    gst += c.gst;
  }
  const total = gross + gst;
  const retentionAmt = (total * (Number(bill.retentionPercent) || 0)) / 100;
  const netPayable = Math.max(0, total - retentionAmt);
  return { gross, gst, total, retentionAmt, netPayable };
};

// Build a line-items array for a new bill from the BOQ, pre-computing BOQ qty,
// rate, GST per item and the cumulative qty already billed in previous bills.
export const buildRABillItems = (boq, existingBills = [], currentBillId = null) => {
  const items = [];
  for (const section of boq.sections || []) {
    for (const item of section.items || []) {
      const boqQty = computeItemQty(item);
      const prevQty = previousBilledQty(existingBills, item.id, currentBillId);
      items.push({
        itemId: item.id,
        description: item.description || "",
        section: section.name || "",
        unit: item.unit || "",
        boqQty,
        rate: Number(item.rate) || 0,
        gstPercent: Number(item.gstPercent) || 0,
        previousBilledQty: prevQty,
        remainingQty: Math.max(0, boqQty - prevQty),
        thisBillQty: 0,
      });
    }
  }
  return items;
};

// Factory — creates a blank RA bill pre-populated from the BOQ.
export const createRABill = (boq, existingBills = []) => {
  const billNo = existingBills.length + 1;
  return {
    id: genId(),
    boqId: boq.id,
    billNo,
    billDate: new Date().toISOString().slice(0, 10),
    forPeriodFrom: "",
    forPeriodTo: new Date().toISOString().slice(0, 10),
    workOrderNo: boq.procurement?.contractId || "",
    contractorName: "",
    items: buildRABillItems(boq, existingBills, null),
    retentionPercent: Number(boq.commercial?.retentionPercent) || 0,
    remarks: "",
    certifiedBy: "",
    certifiedAt: "",
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};
