// Smart Estimator — splits a project's total sqft across rooms (by
// allocation %) and derives each scope row's qty from its room's share.
// Shared by Proposal Master (live editing UI) and the Item-Master-seeded
// factory presets in QuotePresets.js, so both compute quantities the same
// way: a single source of truth for "how much sqft does this room/item get".
import { cleanSizeRange } from "../utils/sizeRangeValidation";

export const evaluateFormula = (formulaStr, variables = {}) => {
  if (!formulaStr) return 0;
  try {
    let sanitized = formulaStr;
    Object.keys(variables).forEach((name) => {
      const regex = new RegExp(`\\b${name}\\b`, "gi");
      sanitized = sanitized.replace(regex, variables[name]);
    });
    sanitized = sanitized.replace(/[a-zA-Z]/g, "");
    const result = new Function(`return (${sanitized});`)();
    return typeof result === "number" && !isNaN(result) ? Math.round(result * 100) / 100 : 0;
  } catch {
    return 0;
  }
};

export const scopeRoomKey = (item) =>
  (item.area || item.heading || "Unassigned").trim().toUpperCase();

// Base carpet area from the size range: single → itself, range → midpoint.
export const parseBaseArea = (sizeRange) => {
  const nums = (cleanSizeRange(sizeRange || "").match(/\d+/g) || [])
    .map(Number)
    .filter((n) => n > 0);
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
};

export const isAreaUnit = (unit) => unit === "sqft" || unit === "sqm";
export const isLengthUnit = (unit) => unit === "rmt" || unit === "rft" || unit === "mm";
export const isCountUnit = (unit) => ["nos", "set", "pair", "lot", "ls", "day"].includes(unit);

export const roundQty = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const getUnitBaseForItem = (item, roomArea, scopeCount = 1) => {
  const unit = item.unit || "sqft";
  if (isAreaUnit(unit)) return roomArea / Math.max(1, scopeCount);
  if (isLengthUnit(unit)) return Math.max(1, Math.sqrt(roomArea) * 4);
  if (isCountUnit(unit)) return 1;
  return roomArea;
};

export const defaultQtyFormulaForItem = (item) => {
  const unit = item.unit || "sqft";
  const factor = Number(item.areaFactor) > 0 ? Number(item.areaFactor) : 1;
  if (isAreaUnit(unit)) return "A";
  if (isLengthUnit(unit)) return `A * ${factor}`;
  return `${factor}`;
};

const qtyFormulaForItem = (item) => {
  if (!isAreaUnit(item.unit || "sqft")) {
    return item.qtyFormula || defaultQtyFormulaForItem(item);
  }

  // Older estimator runs stored formulas such as "A * 0.65", where A was the
  // complete room area. Area scopes now share that room area equally, so
  // replace those generated formulas with the new split base quantity.
  const formula = String(item.qtyFormula || "").replace(/\s+/g, "");
  if (!formula || /^A(?:\*\d*\.?\d+)?$/i.test(formula)) return "A";
  return item.qtyFormula;
};

export const formulaVars = ({ unitBase, roomArea, totalArea, count }) => ({
  A: unitBase,
  Area: unitBase,
  area: unitBase,
  UnitBase: unitBase,
  unitBase,
  RoomArea: roomArea,
  roomArea,
  TotalArea: totalArea,
  totalArea,
  Count: count,
  count,
});

// Default room → % of total project area, used whenever a room has no saved
// allocation yet. Rooms not listed here default to 10%.
export const ROOM_ALLOCATION_DEFAULTS = {
  "LIVING ROOM": 30,
  "KITCHEN": 20,
  "MASTER BEDROOM": 25,
  "BEDROOM 2": 15,
  "BEDROOM 3": 15,
  "BATHROOMS": 10,
  "FOYER": 5,
  "DINING": 12,
  "STUDY": 8,
  "STAIRCASE": 5,
  "UTILITY": 5,
};

export const getNormalizedAllocations = (scopeItems, savedAllocs = {}) => {
  const rooms = Array.from(
    new Set((scopeItems || []).map(scopeRoomKey))
  );
  if (rooms.length === 0) return {};

  const rawAllocs = {};
  rooms.forEach((room) => {
    if (typeof savedAllocs[room] === "number" && !isNaN(savedAllocs[room])) {
      rawAllocs[room] = savedAllocs[room];
    } else {
      rawAllocs[room] = ROOM_ALLOCATION_DEFAULTS[room] !== undefined ? ROOM_ALLOCATION_DEFAULTS[room] : 10;
    }
  });

  const sum = Object.values(rawAllocs).reduce((s, val) => s + val, 0);
  const normalized = {};
  if (sum > 0) {
    let tempSum = 0;
    rooms.forEach((room) => {
      const pct = Math.round((rawAllocs[room] / sum) * 100);
      normalized[room] = pct;
      tempSum += pct;
    });

    const diff = 100 - tempSum;
    if (diff !== 0 && rooms.length > 0) {
      const keyToAdjust = rooms.reduce((a, b) => normalized[a] > normalized[b] ? a : b, rooms[0]);
      normalized[keyToAdjust] = Math.max(0, normalized[keyToAdjust] + diff);
    }
  } else {
    const share = Math.floor(100 / rooms.length);
    rooms.forEach((room, idx) => {
      normalized[room] = idx === 0 ? 100 - share * (rooms.length - 1) : share;
    });
  }

  return normalized;
};

export const estimateScopeItems = (items, areaVal, allocsVal) => {
  const roomCounts = {};
  (items || []).forEach((item) => {
    const normRoom = scopeRoomKey(item);
    roomCounts[normRoom] = (roomCounts[normRoom] || 0) + 1;
  });

  return (items || []).map((item) => {
    const normRoom = scopeRoomKey(item);
    const pct = allocsVal[normRoom] !== undefined ? allocsVal[normRoom] : 10;
    const roomArea = Math.round(areaVal * (pct / 100)) || 100;
    const count = roomCounts[normRoom] || 1;
    const unitBase =
      roundQty(getUnitBaseForItem(item, roomArea, count)) || 1;
    const vars = formulaVars({ unitBase, roomArea, totalArea: areaVal, count });
    const qtyFormula = qtyFormulaForItem(item);
    const calculatedQty = evaluateFormula(qtyFormula, vars);
    const previousAmount = Number(item.amount) || 0;
    const previousQty = Number(item.qty) || 0;
    const finalRate =
      Number(item.rate) ||
      Math.round((previousAmount / (calculatedQty || previousQty || unitBase || 1)) * 100) / 100 ||
      0;
    const amount = Math.round(calculatedQty * finalRate);

    const materials = (item.materials || []).map((m) => {
      const consFormula = m.consumptionFormula || "Q * 4.5";
      const matQty = evaluateFormula(consFormula, { ...vars, Q: calculatedQty, Qty: calculatedQty });
      return {
        ...m,
        consumptionFormula: consFormula,
        qty: matQty,
      };
    });

    return {
      ...item,
      qtyFormula,
      qty: calculatedQty,
      estimatorBaseQty: unitBase,
      estimatorRoomArea: roomArea,
      rate: finalRate,
      amount,
      materials,
    };
  });
};

// Alias kept for call sites that read better as "initialize" (first run)
// vs. "recalculate" (subsequent edits) — same function either way.
export const initializeFormulasForItems = estimateScopeItems;

export const recalculateScopeItems = (items, areaVal, allocsVal, enabled) => {
  if (!enabled) return items;
  return estimateScopeItems(items, areaVal, allocsVal);
};

export const getNormalizedConfig = (config) => {
  if (!config) return config;
  const enableFormulaEstimator = config.enableFormulaEstimator ?? false;
  const totalArea = config.totalArea || parseBaseArea(config.sizeRange) || 1000;
  const roomAllocations = getNormalizedAllocations(config.scopeItems, config.roomAllocations || {});

  let scopeItems = config.scopeItems || [];
  if (enableFormulaEstimator) {
    scopeItems = initializeFormulasForItems(scopeItems, totalArea, roomAllocations);
  }

  return {
    ...config,
    enableFormulaEstimator,
    totalArea,
    roomAllocations,
    scopeItems,
  };
};
