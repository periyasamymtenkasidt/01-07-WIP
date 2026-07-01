import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronRight,
  Layers,
  Package,
  FileText,
  Search,
  Home,
  Ruler,
  Tag,
  CheckCircle2,
  XCircle,
  Sparkles,
  TrendingUp,
  Hash,
  IndianRupee,
  GripVertical,
  ChefHat,
  Sofa,
  Bed,
  Bath,
  DoorOpen,
  BookOpen,
  Building2,
  Command,
  BarChart3,
  Wallet,
  AlertTriangle,
  Info,
  Keyboard,
  Pencil,
  Eye,
} from "lucide-react";
import {
  getMaster,
  saveMaster,
  computeTotals,
  GST_RATE,
  DEFAULT_PRESETS,
} from "../../../data/QuotePresets";
import { formatAmount } from "../../../utils/formatAmount";
import {
  validateSizeRangeInput,
  formatSizeRange,
  cleanSizeRange,
} from "../../../utils/sizeRangeValidation";
import { DIMENSIONAL_UNITS } from "../../../data/boqStorage";
import { UNITS } from "../../../data/boqUnits";
import {
  assignCategoryNames,
  addScopeItemsWithDuplicateCheck,
} from "../../../utils/scopeNaming";
import ItemFormModal from "../../../components/ItemFormModal";
import Modal from "../../../components/Modal";
import {
  getRoomDefaultDays,
} from "../../../data/scheduleConfig";
import { computeLibraryItemAmount, listLibrary } from "../../../data/itemLibrary";
import { listMaterials } from "../../../data/materialLibrary";
import {
  computeRecipe,
  materialsById,
  collectGrades,
  gradeLabel,
} from "../../../data/rateBuildup";
import { mapScopeItemsToGrade } from "../../../data/gradeMapping";
import { PROPERTY_TYPES } from "../../../helperConfigData/helperData";
import {
  getGlobalPropertyTypes,
  addPropertyTypes,
  removePropertyTypeGlobally,
  isPropertyTypeInUse,
} from "../../../data/propertyTypeStorage";

// ── Smart Estimator Helper Functions ─────────────────────────────────────────

const evaluateFormula = (formulaStr, variables = {}) => {
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

const scopeRoomKey = (item) =>
  (item.area || item.heading || "Unassigned").trim().toUpperCase();

// Base carpet area from the size range: single → itself, range → midpoint.
const parseBaseArea = (sizeRange) => {
  const nums = (cleanSizeRange(sizeRange || "").match(/\d+/g) || [])
    .map(Number)
    .filter((n) => n > 0);
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
};

const isAreaUnit = (unit) => unit === "sqft" || unit === "sqm";
const isLengthUnit = (unit) => unit === "rmt" || unit === "rft" || unit === "mm";
const isCountUnit = (unit) => ["nos", "set", "pair", "lot", "ls", "day"].includes(unit);

const roundQty = (value) => Math.round((Number(value) || 0) * 100) / 100;

const getUnitBaseForItem = (item, roomArea) => {
  const unit = item.unit || "sqft";
  if (isAreaUnit(unit)) return roomArea;
  if (isLengthUnit(unit)) return Math.max(1, Math.sqrt(roomArea) * 4);
  if (isCountUnit(unit)) return 1;
  return roomArea;
};

const defaultQtyFormulaForItem = (item) => {
  const unit = item.unit || "sqft";
  const factor = Number(item.areaFactor) > 0 ? Number(item.areaFactor) : 1;
  if (isAreaUnit(unit) || isLengthUnit(unit)) return `A * ${factor}`;
  return `${factor}`;
};

const formulaVars = ({ unitBase, roomArea, totalArea, count }) => ({
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

const getNormalizedAllocations = (scopeItems, savedAllocs = {}) => {
  const rooms = Array.from(
    new Set((scopeItems || []).map(scopeRoomKey))
  );
  if (rooms.length === 0) return {};

  const defaults = {
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

  const rawAllocs = {};
  rooms.forEach((room) => {
    if (typeof savedAllocs[room] === "number" && !isNaN(savedAllocs[room])) {
      rawAllocs[room] = savedAllocs[room];
    } else {
      rawAllocs[room] = defaults[room] !== undefined ? defaults[room] : 10;
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

const estimateScopeItems = (items, areaVal, allocsVal) => {
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
    const unitBase = roundQty(getUnitBaseForItem(item, roomArea)) || 1;
    const vars = formulaVars({ unitBase, roomArea, totalArea: areaVal, count });
    const qtyFormula = item.qtyFormula || defaultQtyFormulaForItem(item);
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

const initializeFormulasForItems = estimateScopeItems;

const recalculateScopeItems = (items, areaVal, allocsVal, enabled) => {
  if (!enabled) return items;
  return estimateScopeItems(items, areaVal, allocsVal);
};

const getNormalizedConfig = (config) => {
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

const blankPreset = (propertyType = "Apartment") => ({
  label: "New Preset",
  configurations: [
    {
      propertyType,
      grade: "economy",
      sizeRange: "",
      scopeItems: [],
      inclusions: [],
      exclusions: [],
    },
  ],
});

const inputBase =
  "bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle";

const CATEGORY_STYLES = {
  kitchen: { color: "orange", icon: ChefHat },
  living: { color: "blue", icon: Sofa },
  dining: { color: "blue", icon: Sofa },
  bedroom: { color: "purple", icon: Bed },
  master: { color: "purple", icon: Bed },
  bath: { color: "teal", icon: Bath },
  foyer: { color: "amber", icon: DoorOpen },
  passage: { color: "amber", icon: DoorOpen },
  study: { color: "indigo", icon: BookOpen },
  office: { color: "indigo", icon: BookOpen },
  stair: { color: "slate", icon: Building2 },
  utility: { color: "slate", icon: Package },
};

const COLOR_MAP = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    bar: "bg-blue-500",
    dot: "bg-blue-500",
    border: "border-blue-200",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    border: "border-orange-200",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    bar: "bg-purple-500",
    dot: "bg-purple-500",
    border: "border-purple-200",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-700",
    bar: "bg-teal-500",
    dot: "bg-teal-500",
    border: "border-teal-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
    border: "border-amber-200",
  },
  indigo: {
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    bar: "bg-indigo-500",
    dot: "bg-indigo-500",
    border: "border-indigo-200",
  },
  slate: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    bar: "bg-slate-500",
    dot: "bg-slate-500",
    border: "border-slate-200",
  },
  gray: {
    bg: "bg-bg-soft",
    text: "text-text-muted",
    bar: "bg-text-subtle",
    dot: "bg-text-subtle",
    border: "border-bordergray",
  },
};

const getCategory = (area) => {
  const a = (area || "").toLowerCase();
  for (const key of Object.keys(CATEGORY_STYLES)) {
    if (a.includes(key)) return CATEGORY_STYLES[key];
  }
  return { color: "gray", icon: Package };
};

const ProposalMaster = () => {
  const [master, setMaster] = useState(() => getMaster());
  const [hasChanges, setHasChanges] = useState(false);
  const [isInitial, setIsInitial] = useState(true);
  const [activeKey, setActiveKey] = useState(() => {
    const keys = Object.keys(getMaster());
    return keys[0] || "2BHK";
  });
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPresetKey, setNewPresetKey] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [presetSearch, setPresetSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [sizeRangeError, setSizeRangeError] = useState("");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Whether the shared Item Form modal is open for adding a new scope row.
  const [scopeFormOpen, setScopeFormOpen] = useState(false);
  // Index of the scope row being edited via the modal, or null when adding new.
  const [editingScopeIdx, setEditingScopeIdx] = useState(null);
  // Detailed read-only preview of the whole preset, grouped by room.
  const [previewOpen, setPreviewOpen] = useState(false);
  // Whether the Add Type modal is open.
  const [addTypeModalOpen, setAddTypeModalOpen] = useState(false);
  // Preserved configs for unchecked property types. Keyed by
  // `${presetKey}::${propertyType}` so re-checking restores data.
  const [hiddenConfigs, setHiddenConfigs] = useState({});
  const [libVersion, setLibVersion] = useState(0);
  useEffect(() => {
    const refreshLibrary = () => setLibVersion((version) => version + 1);
    window.addEventListener("itemLibraryChanged", refreshLibrary);
    window.addEventListener("storage", refreshLibrary);
    return () => {
      window.removeEventListener("itemLibraryChanged", refreshLibrary);
      window.removeEventListener("storage", refreshLibrary);
    };
  }, []);
  // Accordion state for scope category groups in Scope of Work section.
  const [expandedGroups, setExpandedGroups] = useState({});
  const toggleGroup = (room) =>
    setExpandedGroups((p) => ({
      ...p,
      [room]: p[room] === false ? true : p[room] === true ? false : false,
    }));
  const isGroupOpen = (room) => expandedGroups[room] !== false; // default open

  const openAddScope = () => {
    // Block adding scope to a configuration that has no property type — that's
    // what produced "empty type" rows and the un-interpolated preset label.
    if (!activeConfig?.propertyType?.trim()) {
      showToast("Select a property type before adding scope items.", "error");
      return;
    }
    setEditingScopeIdx(null);
    setScopeFormOpen(true);
  };
  const openEditScope = (idx) => {
    setEditingScopeIdx(idx);
    setScopeFormOpen(true);
  };

  // The work's estimating factor, from the Item Master (matched by name).
  const masterAreaFactorFor = (name) => {
    const n = (name || "").trim().toLowerCase();
    if (!n) return 1;
    const lib = listLibrary();
    const hit =
      lib.find((it) => (it.description || "").trim().toLowerCase() === n) ||
      lib.find((it) => (it.description || "").toLowerCase().includes(n));
    return hit && Number(hit.areaFactor) > 0 ? Number(hit.areaFactor) : 1;
  };

  // One-click: estimate every work's assumed qty from the package size range.
  // Dimensional works (sqft/rft) = area × factor; count (nos) works = factor.
  const autofillQtyFromSize = () => {
    const baseArea = parseBaseArea(activeConfig?.sizeRange);
    if (!baseArea) {
      showToast("Set a valid size range first (e.g. 300 or 300-400)", "error");
      return;
    }
    let n = 0;
    setConfigField((cfg) => {
      if (cfg.enableFormulaEstimator) {
        n = (cfg.scopeItems || []).length;
        const totalArea = cfg.totalArea || baseArea;
        const allocations = getNormalizedAllocations(
          cfg.scopeItems,
          cfg.roomAllocations || {},
        );
        return {
          ...cfg,
          totalArea,
          roomAllocations: allocations,
          scopeItems: recalculateScopeItems(
            cfg.scopeItems || [],
            totalArea,
            allocations,
            true,
          ),
        };
      }

      return {
        ...cfg,
        scopeItems: (cfg.scopeItems || []).map((s) => {
          const factor = masterAreaFactorFor(s.itemName || s.description);
          const dimensional = !!DIMENSIONAL_UNITS[s.unit || "nos"];
          const qty = dimensional
            ? Math.round(baseArea * factor)
            : Math.max(1, Math.round(factor));
          n += 1;
          return { ...s, qty, amount: computeLibraryItemAmount({ ...s, qty }) };
        }),
      };
    });
    showToast(`Estimated ${n} qty from ${baseArea} sqft`, "success");
  };

  // Map a scope row → the flat form shape ItemFormModal expects. Rate-based:
  // the quote carries an assumed qty × a fixed ₹/unit rate, so the survey-driven
  // BOQ reuses the SAME rate and only varies by measured quantity. Legacy
  // lump-sum rows (no rate) fall back to their amount as the rate.
  const scopeRowToForm = (item) => ({
    id: item.id,
    heading: item.heading || item.area || "",
    itemName: item.itemName || item.description || "",
    description: item.area || "",
    spec: item.description || "",
    length: item.length ?? 0,
    breadth: item.breadth ?? 0,
    height: item.height ?? 0,
    qty: item.qty ?? 0,
    rate: item.rate ?? (Number(item.amount) || 0),
    unit: item.unit || "sqft",
    days: item.days ?? "",
    materials: item.materials ? item.materials.map((m) => ({ ...m })) : [],
  });
  // Rename mode for the active preset's key.
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const presetKeys = Object.keys(master);
  const active = master[activeKey];
  const [activeConfigIdx, setActiveConfigIdx] = useState(0);

  // Reset config tab when switching presets
  useEffect(() => {
    setActiveConfigIdx(0);
    setSizeRangeError("");
  }, [activeKey]);

  useEffect(() => {
    setSizeRangeError("");
  }, [activeConfigIdx]);

  // Derived: the currently-active property-type configuration
  const activeConfig =
    active?.configurations?.[activeConfigIdx] || active?.configurations?.[0];
  const libById = useMemo(() => {
    void libVersion;
    const items = {};
    for (const item of listLibrary()) items[item.id] = item;
    return items;
  }, [libVersion]);
  const availableGrades = useMemo(
    () => collectGrades(Object.values(libById)),
    [libById],
  );
  const activeGrade =
    activeConfig?.grade ||
    availableGrades.find((grade) => grade.key === "economy")?.key ||
    availableGrades[0]?.key ||
    "economy";

  useEffect(() => {
    if (isInitial) {
      setIsInitial(false);
      return;
    }
    saveMaster(master);
    setHasChanges(true);
  }, [master]);

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const askConfirm = (cfg) => setConfirmDialog(cfg);

  // Preset-level updates (e.g. label)
  const updateActive = (changes) => {
    setMaster((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], ...changes },
    }));
  };

  // Automatically update the preset label based on key and active config property
  // type. When there is no property type, fall back to the formatted key alone so
  // a raw, un-interpolated template label (e.g. "1 BHK ${propertyTypes[0]}") or an
  // empty label never shows.
  useEffect(() => {
    if (!active) return;
    const formattedKey = activeKey.replace(/^(\d+)(BHK)$/i, "$1 BHK");
    let generatedLabel = null;
    if (activeConfig?.propertyType?.trim()) {
      generatedLabel = `${formattedKey} / ${activeConfig.propertyType}`;
    } else if (!active.label || active.label.includes("${")) {
      generatedLabel = formattedKey;
    }
    if (generatedLabel && active.label !== generatedLabel) {
      updateActive({ label: generatedLabel });
    }
  }, [activeKey, activeConfig?.propertyType, active]);

  // Automatically normalize the configuration's estimator fields if missing
  useEffect(() => {
    if (active && activeConfig) {
      const isNormalized =
        activeConfig.enableFormulaEstimator !== undefined &&
        activeConfig.totalArea !== undefined &&
        activeConfig.roomAllocations !== undefined;

      if (!isNormalized) {
        setMaster((prev) => {
          const preset = prev[activeKey];
          if (!preset) return prev;
          const configs = [...(preset.configurations || [])];
          const cfg = configs[activeConfigIdx];
          if (!cfg) return prev;

          const normalizedCfg = getNormalizedConfig(cfg);
          configs[activeConfigIdx] = normalizedCfg;

          return {
            ...prev,
            [activeKey]: {
              ...preset,
              configurations: configs,
            },
          };
        });
      }
    }
  }, [activeKey, activeConfigIdx, active, activeConfig]);

  // Config-level updates (scope, inclusions, exclusions, sizeRange, etc.)
  const setConfigField = (updater) => {
    setMaster((prev) => {
      const preset = prev[activeKey];
      const configs = [...(preset.configurations || [])];
      configs[activeConfigIdx] = updater({ ...configs[activeConfigIdx] });
      return { ...prev, [activeKey]: { ...preset, configurations: configs } };
    });
  };

  const recalculateConfigScope = (cfg, scopeItems = cfg.scopeItems || []) => {
    if (!cfg.enableFormulaEstimator) return { ...cfg, scopeItems };
    const totalArea = cfg.totalArea || parseBaseArea(cfg.sizeRange) || 1000;
    const roomAllocations = getNormalizedAllocations(
      scopeItems,
      cfg.roomAllocations || {},
    );
    return {
      ...cfg,
      totalArea,
      roomAllocations,
      scopeItems: recalculateScopeItems(
        scopeItems,
        totalArea,
        roomAllocations,
        true,
      ),
    };
  };

  const applyGradeToConfig = (grade) => {
    setConfigField((config) => {
      // Map every scope row to the selected grade via the shared mapper. It
      // resolves the linked Item Master item by masterId OR by name, so rows
      // added from the library (which may not carry a masterId) still pick up
      // the grade's rate, materials and amount — matching the QuoteModal flow.
      let items = mapScopeItemsToGrade(config.scopeItems || [], grade);

      if (config.enableFormulaEstimator) {
        const totalArea =
          config.totalArea || parseBaseArea(config.sizeRange) || 1000;
        const allocations = getNormalizedAllocations(
          items,
          config.roomAllocations || {},
        );
        items = recalculateScopeItems(items, totalArea, allocations, true);
      }

      return { ...config, grade, scopeItems: items };
    });
  };

  const handleGradeChange = (grade) => {
    if (!grade || (activeConfig?.grade && grade === activeGrade)) return;

    const linkableItems = (activeConfig?.scopeItems || []).filter(
      (item) =>
        (item.masterId && libById[item.masterId]?.recipes?.[grade]) ||
        item.recipes?.[grade],
    );
    const applyGrade = () => {
      applyGradeToConfig(grade);
      showToast(
        linkableItems.length > 0
          ? `Mapped ${linkableItems.length} scope item(s) to ${gradeLabel(grade)} grade`
          : `Grade set to ${gradeLabel(grade)}`,
        linkableItems.length > 0 ? "success" : "info",
      );
    };

    const hasMappedScopes = (activeConfig?.scopeItems || []).some(
      (item) => item.masterId,
    );
    if (hasMappedScopes) {
      askConfirm({
        title: `Switch to ${gradeLabel(grade)} grade?`,
        message:
          `This re-maps Item Master-linked scope items to ${gradeLabel(grade)} pricing ` +
          "(rate, materials and amount) and recalculates proposal totals. Manual edits to those rows will be overwritten.",
        confirmLabel: "Re-map scopes",
        onConfirm: applyGrade,
      });
    } else {
      applyGrade();
    }
  };

  // Auto-map the scope of work to the selected quality grade. Whenever a config
  // loads, its grade changes, or a row is added, any row not yet aligned to the
  // active grade is mapped to that grade's Item Master rate/materials/amount —
  // so the scope data always reflects the selected grade without a manual
  // toggle. Rows already tagged with the active grade are left untouched, so
  // this never loops and never clobbers manual rate edits on aligned rows.
  useEffect(() => {
    if (!active || !activeConfig) return;
    const items = activeConfig.scopeItems || [];
    if (items.length === 0) return;
    const aligned = items.every((it) => (it.grade || "") === activeGrade);
    if (aligned) return;
    applyGradeToConfig(activeGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, activeConfigIdx, activeGrade, activeConfig?.scopeItems?.length]);

  const updateScope = (idx, key, value) => {
    setConfigField((cfg) => {
      // Check for duplicate heading if changing the area/heading field
      if (key === "area") {
        const item = cfg.scopeItems[idx];
        const newHeading = value.trim().toUpperCase();
        const duplicateExists = cfg.scopeItems.some((s, i) => {
          if (i === idx) return false;
          return (
            (s.area || s.heading || "").trim().toUpperCase() === newHeading &&
            (s.itemName || "").trim().toLowerCase() ===
              (item.itemName || "").trim().toLowerCase()
          );
        });

        if (duplicateExists) {
          showToast(
            `"${item.itemName}" already exists under heading "${newHeading}".`,
            "error",
          );
          return cfg; // Do not update
        }
      }

      const scopeItems = cfg.scopeItems.map((s, i) => {
          if (i !== idx) return s;
          const target = { ...s, [key]: value };
          if (key === "description") {
            target.isDescriptionCustom = true;
          }
          if (key === "area") {
            target.isAreaCustom = true;
          }
          if (key === "itemName") {
            target.isItemNameCustom = true;
          }
          return target;
        });

      if (key === "area" || key === "rate" || key === "unit") {
        return recalculateConfigScope(cfg, scopeItems);
      }

      return {
        ...cfg,
        scopeItems,
      };
    });
  };

  // Save handler for the shared Item Form modal opened by "Add Scope".
  const handleScopeFormSave = (formOrArray) => {
    // Duplicates (same item under the same heading) are allowed — the Item
    // Form already confirms them with the user before saving, so this just
    // persists whatever it receives.
    if (Array.isArray(formOrArray)) {
      const newRows = formOrArray.map((form) => {
        const computed = computeLibraryItemAmount(form);
        const amount = computed || Number(form.rate) || 0;
        const materials = form.materials
          ? form.materials.map((m) => ({ ...m }))
          : [];
        const heading = form.heading || form.description || "";
        const itemName = form.itemName || form.description || "";
        const description = form.spec || form.description || "";
        const area = heading;
        const days =
          form.days !== "" && form.days != null
            ? Number(form.days)
            : getRoomDefaultDays(area);
        return {
          ...form,
          heading,
          itemName,
          description,
          area,
          amount,
          days,
          materials,
          length: Number(form.length) || 0,
          breadth: Number(form.breadth) || 0,
          height: Number(form.height) || 0,
          qty: Number(form.qty) || 0,
          rate: Number(form.rate) || 0,
          unit: form.unit || "ls",
        };
      });

      setConfigField((cfg) => {
        const scopeItems = addScopeItemsWithDuplicateCheck(
          cfg.scopeItems,
          newRows,
        );
        return recalculateConfigScope(cfg, scopeItems);
      });
      showToast(`Added ${newRows.length} scope item(s)`, "success");
    } else {
      const form = formOrArray;
      const existingScope =
        editingScopeIdx != null
          ? activeConfig?.scopeItems?.[editingScopeIdx]
          : null;
      const computed = computeLibraryItemAmount(form);
      const amount = computed || Number(form.rate) || 0;
      const materials = form.materials
        ? form.materials.map((m) => ({ ...m }))
        : [];
      const heading = existingScope
        ? existingScope.heading || existingScope.area || ""
        : form.heading || form.description || "";
      const itemName = form.itemName || form.description || "";
      const description = form.spec || form.description || "";
      const area = heading;
      const days =
        form.days !== "" && form.days != null
          ? Number(form.days)
          : getRoomDefaultDays(area);

      if (editingScopeIdx != null) {
        setConfigField((cfg) => {
          const scopeItems = cfg.scopeItems.map((s, i) =>
            i === editingScopeIdx
              ? {
                  ...s,
                  ...form,
                  heading,
                  itemName,
                  description,
                  area,
                  amount,
                  days,
                  materials,
                  length: Number(form.length) || 0,
                  breadth: Number(form.breadth) || 0,
                  height: Number(form.height) || 0,
                  qty: Number(form.qty) || 0,
                  rate: Number(form.rate) || 0,
                  unit: form.unit || "ls",
                }
              : s,
          );
          return recalculateConfigScope(cfg, scopeItems);
        });
        showToast(`Updated "${heading || "scope"}"`, "success");
      } else {
        const newRow = {
          ...form,
          heading,
          itemName,
          description,
          area,
          amount,
          days,
          materials,
          length: Number(form.length) || 0,
          breadth: Number(form.breadth) || 0,
          height: Number(form.height) || 0,
          qty: Number(form.qty) || 0,
          rate: Number(form.rate) || 0,
          unit: form.unit || "ls",
        };
        setConfigField((cfg) => {
          const scopeItems = addScopeItemsWithDuplicateCheck(cfg.scopeItems, [
            newRow,
          ]);
          return recalculateConfigScope(cfg, scopeItems);
        });
        showToast(`Added "${heading || "scope"}"`, "success");
      }
    }
    setScopeFormOpen(false);
    setEditingScopeIdx(null);
  };

  const removeScopeRow = (idx) => {
    setConfigField((cfg) =>
      recalculateConfigScope(
        cfg,
        cfg.scopeItems.filter((_, i) => i !== idx),
      ),
    );
    showToast("Scope item removed", "info");
  };

  const updateMaterial = (scopeIdx, matIdx, key, value) => {
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === scopeIdx
          ? {
              ...s,
              materials: (s.materials || []).map((m, j) =>
                j === matIdx ? { ...m, [key]: value } : m,
              ),
            }
          : s,
      ),
    }));
  };

  const addMaterial = (scopeIdx, preset) => {
    const newMat = preset ?? { name: "", spec: "" };
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === scopeIdx
          ? { ...s, materials: [...(s.materials || []), newMat] }
          : s,
      ),
    }));
    setExpanded((p) => ({ ...p, [scopeIdx]: true }));
  };

  const removeMaterial = (scopeIdx, matIdx) => {
    setConfigField((cfg) => ({
      ...cfg,
      scopeItems: cfg.scopeItems.map((s, i) =>
        i === scopeIdx
          ? {
              ...s,
              materials: (s.materials || []).filter((_, j) => j !== matIdx),
            }
          : s,
      ),
    }));
  };

  const handleAddPreset = () => {
    const trimmed = newPresetKey.trim();
    if (!trimmed) return;
    if (master[trimmed]) {
      showToast("A preset with that name already exists", "error");
      return;
    }
    // Prepend new preset as the first entry
    setMaster((prev) => ({ [trimmed]: blankPreset(), ...prev }));
    setActiveKey(trimmed);
    setNewPresetKey("");
    setShowAddPreset(false);
    showToast(`Preset "${trimmed}" created`, "success");
  };

  // Rename the active preset's key. Rebuilds the master object preserving
  // insertion order so the preset rail doesn't jump around after rename.
  const handleRenamePreset = () => {
    const trimmed = renameValue.trim();
    if (!trimmed) {
      showToast("Name can't be empty", "error");
      return;
    }
    if (trimmed === activeKey) {
      setRenaming(false);
      return;
    }
    if (master[trimmed]) {
      showToast("A preset with that name already exists", "error");
      return;
    }
    setMaster((prev) => {
      const next = {};
      for (const k of Object.keys(prev)) {
        next[k === activeKey ? trimmed : k] = prev[k];
      }
      return next;
    });
    setActiveKey(trimmed);
    setRenaming(false);
    setRenameValue("");
    showToast(`Renamed to "${trimmed}"`, "success");
  };

  const startRename = () => {
    setRenameValue(activeKey);
    setRenaming(true);
  };

  const handleDuplicatePreset = () => {
    let i = 2;
    let candidate = `${activeKey} Copy`;
    while (master[candidate]) {
      candidate = `${activeKey} Copy ${i++}`;
    }
    setMaster((prev) => ({
      ...prev,
      [candidate]: {
        ...JSON.parse(JSON.stringify(prev[activeKey])),
        label: `${prev[activeKey].label} (Copy)`,
      },
    }));
    setActiveKey(candidate);
    showToast(`Duplicated as "${candidate}"`, "success");
  };

  const handleDeletePreset = () => {
    if (presetKeys.length <= 1) {
      showToast("Keep at least one preset", "error");
      return;
    }
    askConfirm({
      title: `Delete "${activeKey}"?`,
      message:
        "This preset and all its scope items will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete preset",
      danger: true,
      onConfirm: () => {
        setMaster((prev) => {
          const next = { ...prev };
          delete next[activeKey];
          return next;
        });
        setActiveKey(presetKeys.find((k) => k !== activeKey));
        showToast(`Preset "${activeKey}" deleted`, "info");
      },
    });
  };

  const handleReset = () => {
    askConfirm({
      title: "Reset all presets?",
      message:
        "All your custom presets will be replaced with the factory defaults. Custom edits will be lost.",
      confirmLabel: "Reset to defaults",
      danger: true,
      onConfirm: () => {
        setMaster(DEFAULT_PRESETS);
        setActiveKey(Object.keys(DEFAULT_PRESETS)[0]);
        setHasChanges(true);
        showToast("Reset to factory defaults (unsaved changes)", "success");
      },
    });
  };

  const handleManualSave = () => {
    const currentSizeRange = activeConfig?.sizeRange || "";
    const err = validateSizeRangeInput(currentSizeRange);
    if (err) {
      showToast(err, "error");
      setSizeRangeError(err);
      return;
    }
    saveMaster(master);
    setHasChanges(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    showToast("All changes saved successfully", "success");
  };

  const toggleExpanded = (idx) => {
    setExpanded((p) => ({ ...p, [idx]: !p[idx] }));
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleManualSave();
      }
      if (e.key === "Escape") {
        setConfirmDialog(null);
        setShowShortcuts(false);
      }
      if (e.key === "?" && !e.target.matches("input, textarea")) {
        setShowShortcuts((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredKeys = useMemo(() => {
    const q = presetSearch.trim().toLowerCase();
    if (!q) return presetKeys;
    return presetKeys.filter(
      (k) =>
        k.toLowerCase().includes(q) ||
        (master[k]?.label || "").toLowerCase().includes(q),
    );
  }, [presetKeys, presetSearch, master]);

  const globalStats = useMemo(() => {
    const allItems = presetKeys.flatMap((k) =>
      (master[k]?.configurations || []).flatMap((c) => c.scopeItems || []),
    );
    const totalAmount = allItems.reduce(
      (s, it) => s + (Number(it.amount) || 0),
      0,
    );
    const totalMaterials = allItems.reduce(
      (s, it) => s + (it.materials?.length || 0),
      0,
    );
    return {
      presets: presetKeys.length,
      items: allItems.length,
      materials: totalMaterials,
      avgQuote:
        presetKeys.length > 0 ? Math.round(totalAmount / presetKeys.length) : 0,
    };
  }, [presetKeys, master]);

  const sortedScope = useMemo(() => {
    if (!activeConfig) return [];
    return (activeConfig.scopeItems || []).map((item, idx) => ({
      item,
      idx,
    }));
  }, [activeConfig]);

  const namedOriginalItems = useMemo(() => {
    return assignCategoryNames(activeConfig?.scopeItems || []);
  }, [activeConfig?.scopeItems]);

  // Group scope rows by room so each room shows as one block in the list.
  const groupedScope = useMemo(() => {
    const groups = [];
    const byRoom = new Map();
    sortedScope.forEach(({ item, idx }) => {
      const room = item.area || "Unassigned";
      if (!byRoom.has(room)) {
        const g = { room, rows: [], total: 0 };
        byRoom.set(room, g);
        groups.push(g);
      }
      const g = byRoom.get(room);
      g.rows.push({ item, idx });
      g.total += Number(item.amount) || 0;
    });
    return groups;
  }, [sortedScope]);

  // Sum of the active config's room allocation percentages — used by the
  // Smart Estimator card to flag when allocations don't add up to 100%.
  const allocationSum = useMemo(() => {
    return Object.values(activeConfig?.roomAllocations || {}).reduce(
      (s, v) => s + (Number(v) || 0),
      0,
    );
  }, [activeConfig?.roomAllocations]);

  if (!active) {
    return (
      <div className="p-8 text-text-muted text-sm">No preset selected.</div>
    );
  }

  const scopeItems = activeConfig?.scopeItems || [];
  const totals = computeTotals(scopeItems);
  const maxScope = Math.max(1, ...scopeItems.map((s) => Number(s.amount) || 0));
  // Cost split — materials vs labour vs margin — aggregated from each scope
  // item's rate build-up (via its linked Item Master recipe). Items without a
  // build-up fall into "No build-up".
  const costSplit = (() => {
    const libById = {};
    for (const l of listLibrary()) libById[l.id] = l;
    const matById = materialsById(listMaterials());
    let material = 0;
    let labour = 0;
    let margin = 0;
    let other = 0;
    for (const s of scopeItems) {
      const amount = Number(s.amount) || 0;
      const lib = s.masterId ? libById[s.masterId] : null;
      const recipe = lib?.recipes?.[
        s.grade || s.defaultGrade || activeConfig?.grade || lib.defaultGrade || "premium"
      ];
      const c = recipe ? computeRecipe(recipe, matById) : null;
      if (c && c.rate > 0) {
        material += amount * (c.materialCost / c.rate);
        labour += amount * (c.labour / c.rate);
        margin += amount * ((c.overhead + c.margin) / c.rate);
      } else {
        other += amount;
      }
    }
    return { material, labour, margin, other, total: material + labour + margin + other };
  })();

  return (
    <div className="bg-overallbg font-sans h-full overflow-hidden flex flex-col">
      {/* ── Top header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 z-30 bg-overallbg/80 backdrop-blur-xl border-b border-bordergray/70">
        <div className="px-6 py-4 flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <FileText size={18} />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-overallbg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                  Proposal Master
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live
                </span>
              </div>
              <p className="text-[12px] text-text-muted mt-0.5">
                Quotation templates per property preset · changes apply
                instantly to new proposals
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts ( ? )"
              className="hidden sm:flex items-center gap-1 px-2.5 py-2 bg-white border border-bordergray rounded-lg text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all"
            >
              <Keyboard size={12} />
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray cursor-pointer rounded-lg text-[12px] font-semibold text-textcolor hover:bg-bg-soft hover:border-text-subtle transition-all"
            >
              <RotateCcw size={13} /> Reset
            </button>
            <button
              type="button"
              onClick={handleManualSave}
              className={`flex items-center gap-1.5 px-4 py-2 cursor-pointer rounded-lg text-[12px] font-semibold transition-all shadow-md ${
                savedFlash
                  ? "bg-emerald-500 text-white shadow-emerald-500/20"
                  : "bg-linear-to-br from-select-blue to-primary text-white hover:shadow-select-blue/30 hover:scale-[1.02]"
              } ${hasChanges && !savedFlash ? "animate-pulse ring-2 ring-select-blue/20" : ""}`}
            >
              {savedFlash ? <Check size={13} /> : <Save size={13} />}
              {savedFlash ? "Saved" : "Save Changes"}
              {!savedFlash && (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-semibold bg-white/15 px-1.5 py-0.5 rounded ml-1">
                  <Command size={9} /> S
                </kbd>
              )}
            </button>
          </div>
        </div>

        {/* Bento stats banner */}
        <div className="px-6 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BentoStat
            icon={<Layers size={13} />}
            label="Presets"
            value={globalStats.presets}
            tint="blue"
          />
          <BentoStat
            icon={<Hash size={13} />}
            label="Total Scope Items"
            value={globalStats.items}
            tint="purple"
          />
          <BentoStat
            icon={<Package size={13} />}
            label="Material Specs"
            value={globalStats.materials}
            tint="orange"
          />
          <BentoStat
            icon={<TrendingUp size={13} />}
            label="Avg Quote Value"
            value={formatAmount(globalStats.avgQuote)}
            tint="emerald"
          />
        </div>
      </div>

      <div className="px-6 py-5 flex-1 min-h-0 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_340px] gap-5 items-stretch h-full">
          {/* ── Left: Preset rail ───────────────────────────────────────── */}
          <aside className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] flex flex-col overflow-y-auto scroll-hidden-bar">
            <div className="p-4 border-b border-bordergray shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Layers size={13} className="text-select-blue" />
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-textcolor">
                    Presets
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md">
                  {presetKeys.length}
                </span>
              </div>
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
                />
                <input
                  type="text"
                  value={presetSearch}
                  onChange={(e) => setPresetSearch(e.target.value)}
                  placeholder="Search presets"
                  className="w-full bg-bg-soft border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[11px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30"
                />
              </div>
            </div>

            <div className="p-2 max-h-[55vh] overflow-y-auto scroll-hidden-bar">
              {filteredKeys.length === 0 ? (
                <p className="text-[11px] text-text-subtle text-center py-4">
                  No matches
                </p>
              ) : (
                filteredKeys.map((k) => {
                  const p = master[k];
                  const allCfgItems = (p.configurations || []).flatMap(
                    (c) => c.scopeItems || [],
                  );
                  const t = computeTotals(allCfgItems);
                  const firstCfg = p.configurations?.[0];
                  const isActive = k === activeKey;
                  const cat = getCategory(p.label || k);
                  const c = COLOR_MAP[cat.color];
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveKey(k)}
                      className={`w-full text-left rounded-xl px-3 py-2.5 mb-1 transition-all border ${
                        isActive
                          ? "bg-active-bg border-select-blue/40 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                          : "bg-transparent border-transparent hover:bg-bg-soft"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`}
                          />
                          <span
                            className={`text-[12px] font-bold truncate ${isActive ? "text-select-blue" : "text-textcolor"}`}
                          >
                            {k}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
                          {(p.configurations || []).length} type
                          {(p.configurations || []).length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-text-muted truncate ml-4">
                        {p.label}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-1.5 ml-4">
                        <p
                          className={`text-[10.5px] font-bold tabular-nums ${isActive ? "text-select-blue" : "text-textcolor"}`}
                        >
                          {formatAmount(t.grandTotal)}
                        </p>
                        {firstCfg?.sizeRange && (
                          <span className="text-[9.5px] text-text-subtle truncate">
                            {formatSizeRange(firstCfg.sizeRange)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-bordergray">
              {showAddPreset ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newPresetKey}
                    onChange={(e) => setNewPresetKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPreset();
                      if (e.key === "Escape") {
                        setShowAddPreset(false);
                        setNewPresetKey("");
                      }
                    }}
                    placeholder="e.g. Studio"
                    className="w-full bg-white border border-bordergray rounded-lg text-[12px] px-2.5 py-2 focus:outline-none focus:border-select-blue"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddPreset}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-primary"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddPreset(false);
                        setNewPresetKey("");
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-bordergray text-[11px] text-text-muted hover:bg-bg-soft"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[10px] text-text-subtle">
                    Tip: short keys like "1BHK", "Studio", "Penthouse".
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddPreset(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-bordergray text-[11.5px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/40 transition-all"
                >
                  <Plus size={13} /> New Preset
                </button>
              )}
            </div>
          </aside>

          {/* ── Middle: Editor ──────────────────────────────────────────── */}
          <main className="space-y-5 min-w-0 overflow-y-auto pb-28 scroll-hidden-bar">
            {/* Preset hero card */}
            <section className="relative bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-y-auto overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-br from-select-blue/8 via-active-bg/40 to-transparent pointer-events-none" />
              <div className="relative px-5 py-4 border-b border-bordergray flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {renaming ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <Tag size={11} className="text-select-blue shrink-0" />
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenamePreset();
                          if (e.key === "Escape") {
                            setRenaming(false);
                            setRenameValue("");
                          }
                        }}
                        autoFocus
                        placeholder="e.g. 2BHK Premium"
                        className="bg-white border border-select-blue/40 rounded-md px-2 py-1 text-[12px] font-bold uppercase tracking-widest text-select-blue focus:outline-none focus:ring-2 focus:ring-select-blue/20 w-44"
                      />
                      <button
                        type="button"
                        onClick={handleRenamePreset}
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-select-blue text-white text-[11px] font-semibold hover:bg-primary"
                      >
                        <Check size={11} /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(false);
                          setRenameValue("");
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft"
                      >
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-select-blue bg-white/80 backdrop-blur px-2 py-1 rounded-md shrink-0 border border-select-blue/20">
                        <Tag size={10} /> {activeKey}
                      </span>
                      <span className="text-[12px] text-text-muted truncate">
                        {active.label}
                      </span>
                    </>
                  )}
                </div>
                {!renaming && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={startRename}
                      title="Rename this preset"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor"
                    >
                      <Pencil size={12} /> Rename
                    </button>
                    <button
                      type="button"
                      onClick={handleDuplicatePreset}
                      title="Duplicate this preset"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor"
                    >
                      <Copy size={12} /> Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={handleDeletePreset}
                      title="Delete this preset"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-[11px] font-semibold text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="relative p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field
                  icon={<Tag size={11} />}
                  label="Label"
                  hint="Automatically generated from preset key and property type"
                >
                  <input
                    type="text"
                    value={active.label}
                    readOnly
                    className={`${inputBase} bg-bg-soft border-bordergray cursor-not-allowed text-text-muted`}
                    title="Automatically generated from preset key and property type"
                  />
                </Field>
                <Field
                  icon={<Ruler size={11} />}
                  label="Size Range"
                  hint="Per property type · used to compute ₹/sq ft"
                >
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={activeConfig?.sizeRange || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const err = validateSizeRangeInput(val);
                        setSizeRangeError(err);
                        setConfigField((cfg) => {
                          const totalArea = parseBaseArea(val) || 0;
                          const roomAllocations = getNormalizedAllocations(cfg.scopeItems, cfg.roomAllocations || {});
                          const scopeItems = recalculateScopeItems(cfg.scopeItems, totalArea, roomAllocations, cfg.enableFormulaEstimator);
                          return {
                            ...cfg,
                            sizeRange: val,
                            totalArea,
                            roomAllocations,
                            scopeItems,
                          };
                        });
                      }}
                      placeholder="e.g. 800-1100"
                      className={`${inputBase} pr-14`}
                    />
                    <span className="absolute right-3 text-[10px] font-bold text-gray-400 pointer-events-none uppercase">
                      Sq Ft
                    </span>
                  </div>
                  {sizeRangeError && (
                    <p className="text-red-500 text-[10px] mt-1 font-semibold animate-pulse">
                      {sizeRangeError}
                    </p>
                  )}
                </Field>
              </div>

              {/* ── Property Type Configuration Tabs ─────────────────── */}
              <div className="relative px-5 pb-4">
                <Field
                  icon={<Home size={11} />}
                  label="Property Types"
                  hint="Each type has its own scope, pricing & inclusions"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(active.configurations || []).map((cfg, idx) => (
                      <button
                        key={cfg.propertyType}
                        type="button"
                        onClick={() => setActiveConfigIdx(idx)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                          idx === activeConfigIdx
                            ? "bg-select-blue text-white border-select-blue shadow-sm"
                            : "bg-white text-text-muted border-bordergray hover:border-select-blue/40 hover:text-select-blue"
                        }`}
                      >
                        {idx === activeConfigIdx && (
                          <Check size={10} strokeWidth={3} />
                        )}
                        {cfg.propertyType}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddTypeModalOpen(true)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11px] font-semibold shadow-sm hover:shadow-md hover:shadow-select-blue/20 transition-all"
                    >
                      <Plus size={11} /> Add Type
                    </button>
                  </div>
                </Field>
                {activeConfig && (active.configurations || []).length > 1 && (
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const typeName = activeConfig.propertyType;
                        // Check if this property type is used by any active record globally
                        if (isPropertyTypeInUse(typeName)) {
                          showToast(
                            `Cannot remove "${typeName}" — it is linked with active records.`,
                            "error",
                          );
                          return;
                        }
                        askConfirm({
                          title: `Permanently delete "${typeName}"?`,
                          message:
                            "This will remove the property type globally from all presets, inquiry forms, proposal forms, and convert-to-client forms. This cannot be undone.",
                          confirmLabel: "Delete Globally",
                          danger: true,
                          onConfirm: () => {
                            // 1. Remove from global registry
                            removePropertyTypeGlobally(typeName);
                            // 2. Remove from every preset in master
                            setMaster((prev) => {
                              const next = {};
                              for (const pk of Object.keys(prev)) {
                                const preset = prev[pk];
                                const configs = (
                                  preset.configurations || []
                                ).filter(
                                  (c) =>
                                    c.propertyType.trim().toLowerCase() !==
                                    typeName.trim().toLowerCase(),
                                );
                                // Keep at least one config — if all removed, keep as-is
                                next[pk] = {
                                  ...preset,
                                  configurations:
                                    configs.length > 0
                                      ? configs
                                      : preset.configurations,
                                };
                              }
                              return next;
                            });
                            // 3. Clean up hidden configs cache
                            setHiddenConfigs((prev) => {
                              const next = { ...prev };
                              for (const key of Object.keys(next)) {
                                if (
                                  key.split("::")[1]?.trim().toLowerCase() ===
                                  typeName.trim().toLowerCase()
                                ) {
                                  delete next[key];
                                }
                              }
                              return next;
                            });
                            setActiveConfigIdx(0);
                            showToast(`"${typeName}" deleted globally`, "info");
                          },
                        });
                      }}
                      className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-600"
                    >
                      <Trash2 size={10} /> Remove Type
                    </button>
                  </div>
                )}
              </div>

              {/* Smart Estimator Card */}
              {activeConfig && (
                <div className="relative mx-5 mb-5 bg-white rounded-2xl p-5 border border-bordergray shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <h2 className="text-[13px] font-bold text-textcolor">Smart Estimator</h2>
                        <p className="text-[10.5px] text-text-muted">Formula-based quantity & rate calculation</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!activeConfig.enableFormulaEstimator}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setConfigField((cfg) => {
                            const totalAreaVal = cfg.totalArea || parseBaseArea(cfg.sizeRange) || 1000;
                            const roomAllocations = getNormalizedAllocations(cfg.scopeItems, cfg.roomAllocations || {});

                            let finalItems = cfg.scopeItems;
                            if (checked) {
                              finalItems = initializeFormulasForItems(cfg.scopeItems, totalAreaVal, roomAllocations);
                            }
                            return {
                              ...cfg,
                              enableFormulaEstimator: checked,
                              roomAllocations,
                              scopeItems: finalItems,
                            };
                          });
                        }}
                        className="sr-only peer"
                      />
                      <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-select-blue"></div>
                      <span className="text-[11.5px] font-bold text-textcolor">
                        Auto Calculations
                      </span>
                    </label>
                  </div>

                  {activeConfig.enableFormulaEstimator && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start border-t border-bordergray pt-3">
                        <div>
                          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                            Total Project Area (Sq.ft)
                          </label>
                          <input
                            type="number"
                            value={
                              activeConfig.totalArea ||
                              parseBaseArea(activeConfig.sizeRange) ||
                              ""
                            }
                            readOnly
                            title="Derived from Size Range above — edit Size Range to change this"
                            placeholder="e.g. 1000"
                            className="w-full rounded-xl border border-bordergray bg-bg-soft px-3.5 py-2 text-[12.5px] text-text-muted cursor-not-allowed"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                            Allocation Sum
                          </label>
                          <div className="flex items-center gap-2 h-[38px]">
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold ${
                                allocationSum === 100
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-250 animate-pulse"
                              }`}
                            >
                              {allocationSum}% Allocated
                            </span>
                            {allocationSum !== 100 && (
                              <span className="text-[9.5px] text-red-500 font-bold">
                                Should equal exactly 100%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Room Allocation Grid */}
                      <div className="border-t border-bordergray pt-3 space-y-2">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                          Room Allocations & Split
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto scroll-hidden-bar">
                          {Object.keys(activeConfig.roomAllocations || {}).map((room) => {
                            const pct = activeConfig.roomAllocations[room] || 0;
                            const totalAreaVal = activeConfig.totalArea || parseBaseArea(activeConfig.sizeRange) || 1000;
                            const roomArea = Math.round(totalAreaVal * (pct / 100));
                            return (
                              <div
                                key={room}
                                className="flex items-center justify-between p-2 rounded-xl border border-bordergray bg-bg-soft/40"
                              >
                                <span className="text-[11px] font-bold text-textcolor truncate max-w-[120px]" title={room}>
                                  {room}
                                </span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className="flex items-center">
                                    <input
                                      type="number"
                                      value={pct}
                                      onChange={(e) => {
                                        const newVal = Number(e.target.value);
                                        setConfigField((cfg) => {
                                          const currentAllocs = { ...(cfg.roomAllocations || {}) };
                                          currentAllocs[room] = newVal;
                                          const totalAreaVal = cfg.totalArea || parseBaseArea(cfg.sizeRange) || 1000;
                                          const finalItems = recalculateScopeItems(cfg.scopeItems, totalAreaVal, currentAllocs, true);
                                          return {
                                            ...cfg,
                                            roomAllocations: currentAllocs,
                                            scopeItems: finalItems,
                                          };
                                        });
                                      }}
                                      className="w-10 text-center rounded-lg border border-bordergray py-1 text-[11px] text-textcolor focus:outline-none focus:border-select-blue"
                                    />
                                    <span className="text-[10px] text-text-muted ml-0.5">%</span>
                                  </div>
                                  <span className="text-[10px] text-text-muted">
                                    ({roomArea} sqft)
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {costSplit.total > 0 && (
                <div className="relative mx-5 mb-5 -mt-1 bg-bg-soft border border-bordergray rounded-lg px-3 py-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-textcolor">
                      <Sparkles size={12} className="text-select-blue" /> Cost split
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Total ₹{Math.round(costSplit.total).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex w-full h-2.5 rounded-full overflow-hidden bg-gray-100">
                    {[
                      { c: "bg-select-blue", v: costSplit.material },
                      { c: "bg-violet-500", v: costSplit.labour },
                      { c: "bg-emerald-500", v: costSplit.margin },
                      { c: "bg-gray-300", v: costSplit.other },
                    ].map(
                      (seg, i) =>
                        seg.v > 0 && (
                          <div
                            key={i}
                            className={seg.c}
                            style={{ width: `${(seg.v / costSplit.total) * 100}%` }}
                          />
                        ),
                    )}
                  </div>
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-[10.5px]">
                    {[
                      { color: "bg-select-blue", label: "Materials", v: costSplit.material },
                      { color: "bg-violet-500", label: "Labour", v: costSplit.labour },
                      { color: "bg-emerald-500", label: "Margin", v: costSplit.margin },
                      ...(costSplit.other > 0
                        ? [{ color: "bg-gray-300", label: "No build-up", v: costSplit.other }]
                        : []),
                    ].map((seg) => (
                      <span key={seg.label} className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${seg.color}`} />
                        <span className="text-text-muted">{seg.label}</span>
                        <span className="font-semibold text-textcolor tabular-nums">
                          ₹{Math.round(seg.v).toLocaleString("en-IN")} (
                          {Math.round((seg.v / costSplit.total) * 100)}%)
                        </span>
                      </span>
                    ))}
                  </div>
                  {costSplit.other === costSplit.total && (
                    <p className="text-[10px] text-text-subtle mt-2">
                      Add rate build-ups to your works (Item Master → calculator) to
                      break this into materials, labour & margin.
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* Scope editor */}
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                    <Package size={13} />
                  </div>
                  <div>
                    <h2 className="text-[13px] font-bold text-textcolor">
                      Scope of Work
                    </h2>
                    <p className="text-[10.5px] text-text-muted">
                      {scopeItems.length} area
                      {scopeItems.length === 1 ? "" : "s"} ·{" "}
                      {activeConfig?.propertyType || ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="flex flex-wrap items-center gap-1 rounded-lg border border-bordergray bg-bg-soft/50 p-1">
                    <span className="px-1.5 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                      Grade
                    </span>
                    {availableGrades.map((grade) => {
                      const selected = activeGrade === grade.key;
                      return (
                        <button
                          key={grade.key}
                          type="button"
                          onClick={() => handleGradeChange(grade.key)}
                          title={`Apply ${grade.label} Item Master rates and materials`}
                          className={`rounded-md border px-2 py-1 text-[10px] font-semibold transition-all ${
                            selected
                              ? "border-select-blue bg-select-blue text-white shadow-sm"
                              : "border-transparent bg-white text-text-muted hover:border-select-blue/30 hover:text-select-blue"
                          }`}
                        >
                          {grade.label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={autofillQtyFromSize}
                    disabled={scopeItems.length === 0}
                    title="Estimate each work's assumed quantity from the size range × the Item Master factor"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-select-blue/30 bg-select-blue/5 text-[11px] font-semibold text-select-blue hover:bg-select-blue/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Sparkles size={12} /> Auto-fill qty
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={scopeItems.length === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-textcolor hover:bg-bg-soft hover:border-text-subtle transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Eye size={12} /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={openAddScope}
                    disabled={!activeConfig?.propertyType?.trim()}
                    title={
                      !activeConfig?.propertyType?.trim()
                        ? "Select a property type first"
                        : "Add a scope item"
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11px] font-semibold hover:shadow-md hover:shadow-select-blue/20 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={12} /> Add Scope
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-5">
                {groupedScope.map((group) => {
                  const gcat = getCategory(group.room);
                  const gc = COLOR_MAP[gcat.color];
                  const groupOpen = isGroupOpen(group.room);
                  return (
                    <div key={group.room}>
                      {/* Room group accordion header — click to expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.room)}
                        className="w-full flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg hover:bg-bg-soft/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {groupOpen ? (
                            <ChevronDown
                              size={13}
                              className="text-text-muted shrink-0"
                            />
                          ) : (
                            <ChevronRight
                              size={13}
                              className="text-text-muted shrink-0"
                            />
                          )}
                          <span
                            className={`h-2.5 w-2.5 rounded-full shrink-0 ${gc.dot}`}
                          />
                          <h4 className="text-[12px] font-bold text-textcolor uppercase tracking-wide truncate">
                            {group.room}
                          </h4>
                          <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md border border-bordergray">
                            {group.rows.length}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-textcolor tabular-nums shrink-0">
                          {formatAmount(group.total)}
                        </span>
                      </button>
                      {groupOpen && (
                        <div className="space-y-3">
                          {group.rows.map(({ item, idx }) => {
                            const isOpen = !!expanded[idx];
                            const matCount = (item.materials || []).length;
                            const cat = getCategory(item.area);
                            const c = COLOR_MAP[cat.color];
                            const Icon = cat.icon;
                            const amount = Number(item.amount) || 0;
                            const pct =
                              totals.subtotal > 0
                                ? Math.round((amount / totals.subtotal) * 100)
                                : 0;
                            const barWidth =
                              maxScope > 0 ? (amount / maxScope) * 100 : 0;
                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-bordergray bg-white hover:border-select-blue/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all group"
                              >
                                {/* Two lines instead of one rigid 7-column row — the
                                    middle column (between the preset rail and the
                                    right sidebar) isn't wide enough for grip+icon+
                                    room+description+days+amount+remove on one line,
                                    which forced a horizontal scrollbar. Identity
                                    (room/description) on line 1, values (days/amount)
                                    on line 2 — always fits, never scrolls sideways. */}
                                <div className="p-3 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      className="h-6 w-5 flex items-center justify-center text-text-subtle opacity-0 group-hover:opacity-100 cursor-grab shrink-0"
                                      title="Drag to reorder (coming soon)"
                                    >
                                      <GripVertical size={12} />
                                    </button>
                                    <span
                                      className={`h-7 w-7 flex items-center justify-center rounded-lg shrink-0 ${c.bg} ${c.text}`}
                                    >
                                      <Icon size={13} />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => openEditScope(idx)}
                                      title="Click to edit this scope"
                                      className="text-[12px] font-semibold text-textcolor px-1 py-2 truncate text-left hover:text-select-blue hover:underline shrink-0 max-w-[120px]"
                                    >
                                      {namedOriginalItems[idx]
                                        ?._displayCategory ||
                                        item.area || (
                                          <span className="text-text-subtle font-normal italic no-underline">
                                            No room
                                          </span>
                                        )}
                                    </button>
                                    <textarea
                                      value={item.description || ""}
                                      onChange={(e) =>
                                        updateScope(
                                          idx,
                                          "description",
                                          e.target.value,
                                        )
                                      }
                                      placeholder="Description"
                                      className={`${inputBase} min-w-0 flex-1 resize-none`}
                                        rows={1}
                                     />
                                    <div className="w-36 shrink-0">
                                      <AmountInput
                                        value={item.amount}
                                        onChange={(v) =>
                                          updateScope(idx, "amount", v)
                                        }
                                        pct={pct}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeScopeRow(idx)}
                                      className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                      title="Remove row"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-[1.6fr_1.2fr_92px] gap-3 items-end">
                                      {/* UNIT */}
                                      <div>
                                        <label className="block text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                                          Unit
                                        </label>
                                        <select
                                          value={item.unit || "sqft"}
                                          onChange={(e) =>
                                            updateScope(idx, "unit", e.target.value)
                                          }
                                          className={`${inputBase} cursor-pointer`}
                                        >
                                          {UNITS.map((u) => (
                                            <option key={u.code} value={u.code}>
                                              {u.label}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      {/* RATE */}
                                      <div>
                                        <label className="block text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                                          Rate (₹)
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle text-[11px] pointer-events-none">
                                            ₹
                                          </span>
                                          <input
                                            type="number"
                                            min={0}
                                            value={item.rate ?? ""}
                                            onChange={(e) =>
                                              updateScope(idx, "rate", e.target.value)
                                            }
                                            placeholder="Rate"
                                            className={`${inputBase} pl-6 tabular-nums`}
                                          />
                                        </div>
                                      </div>
                                      {/* DAYS */}
                                      <div
                                        title="Default duration in days — seeds the project schedule"
                                      >
                                        <label className="block text-[9px] font-semibold uppercase tracking-wider text-text-muted mb-1">
                                          Days
                                        </label>
                                        <div className="relative">
                                          <input
                                            type="number"
                                            min={0}
                                            value={item.days ?? ""}
                                            onChange={(e) =>
                                              updateScope(idx, "days", e.target.value)
                                            }
                                            placeholder="Days"
                                            className={`${inputBase} pr-7 text-center tabular-nums`}
                                          />
                                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-text-subtle pointer-events-none">
                                            d
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    {activeConfig?.enableFormulaEstimator && (
                                      <div className="flex items-center justify-between rounded-lg bg-bg-soft/60 border border-bordergray/60 px-3 py-1.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                                          Calculated Quantity
                                        </span>
                                        <span className="text-[11px] font-bold text-textcolor tabular-nums">
                                          {Number(item.qty || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} {item.unit || "unit"}
                                          {(() => {
                                            const split =
                                              activeConfig?.roomAllocations?.[
                                                scopeRoomKey(item)
                                              ];
                                            return split != null ? (
                                              <span className="ml-1.5 text-[9.5px] font-normal text-text-subtle">
                                                ({split}% split)
                                              </span>
                                            ) : null;
                                          })()}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="px-3 pb-2">
                                  <div className="h-1 w-full bg-bg-soft rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${c.bar} transition-all`}
                                      style={{ width: `${barWidth}%` }}
                                    />
                                  </div>
                                </div>

                                <div className="border-t border-bordergray bg-bg-soft/40">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(idx)}
                                    className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-semibold text-text-muted hover:text-select-blue"
                                  >
                                    <span className="flex items-center gap-1.5">
                                      {isOpen ? (
                                        <ChevronDown size={12} />
                                      ) : (
                                        <ChevronRight size={12} />
                                      )}
                                      Materials & Specifications
                                      {matCount > 0 && (
                                        <span className="ml-1 text-[10px] font-bold text-select-blue bg-white px-1.5 py-0.5 rounded-md border border-bordergray">
                                          {matCount}
                                        </span>
                                      )}
                                    </span>
                                    {!isOpen && matCount > 0 && (
                                      <span className="text-[10px] text-text-subtle truncate max-w-[60%]">
                                        {item.materials
                                          .map((m) => m.name)
                                          .filter(Boolean)
                                          .join(", ")}
                                      </span>
                                    )}
                                    {isOpen && (
                                      <span className="text-[10px] text-text-subtle">
                                        Hide
                                      </span>
                                    )}
                                  </button>

                                  {isOpen && (
                                    <div className="px-4 pb-3 space-y-1.5">
                                      {(item.materials || []).map((m, mIdx) => (
                                        <div
                                          key={mIdx}
                                          className="grid grid-cols-[130px_1fr_24px] gap-2 items-center"
                                        >
                                          <textarea
                                            value={m.name}
                                            onChange={(e) =>
                                              updateMaterial(
                                                idx,
                                                mIdx,
                                                "name",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="Plywood"
                                            className={`${inputBase} py-1.5 text-[11px] resize-none`}
                                            rows={1}
                                          />
                                          <textarea
                                            value={m.spec}
                                            onChange={(e) =>
                                              updateMaterial(
                                                idx,
                                                mIdx,
                                                "spec",
                                                e.target.value,
                                              )
                                            }
                                            placeholder="BWP 19mm"
                                            className={`${inputBase} py-1.5 text-[11px] resize-none`}
                                            rows={1}
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeMaterial(idx, mIdx)
                                            }
                                            className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                                            title="Remove material"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      ))}
                                      <div className="flex items-center gap-3 mt-1.5">
                                        <button
                                          type="button"
                                          onClick={() => addMaterial(idx)}
                                          className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary"
                                        >
                                          <Plus size={11} /> Add Material
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {scopeItems.length === 0 && (
                  <div className="text-center py-10 px-6 rounded-xl border border-dashed border-bordergray bg-linear-to-br from-bg-soft/60 to-active-bg/30">
                    <div className="h-12 w-12 rounded-2xl bg-white border border-bordergray flex items-center justify-center mx-auto mb-3 shadow-sm">
                      <Package size={18} className="text-select-blue" />
                    </div>
                    <p className="text-[13px] font-bold text-textcolor">
                      No scope items yet
                    </p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-xs mx-auto">
                      Use the quick-add chips above to add common rooms, or
                      start blank.
                    </p>
                    <button
                      type="button"
                      onClick={openAddScope}
                      disabled={!activeConfig?.propertyType?.trim()}
                      title={
                        !activeConfig?.propertyType?.trim()
                          ? "Select a property type first"
                          : "Add a blank scope item"
                      }
                      className="mt-4 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[11.5px] font-semibold shadow-md shadow-select-blue/20 hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={13} /> Add Blank Scope
                    </button>
                  </div>
                )}
              </div>
            </section>
          </main>

          {/* ── Right: Stats + Inclusions / Exclusions ──────────────────── */}
          <aside className="space-y-5 min-w-0 overflow-y-auto pb-28">
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-bordergray flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <BarChart3 size={13} className="text-select-blue" />
                  <h3 className="text-[12px] font-bold text-textcolor">
                    Cost Breakdown
                  </h3>
                </span>
                <span className="text-[10px] font-semibold text-text-subtle">
                  {scopeItems.length} scope{scopeItems.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-260px)]">
                {scopeItems.length === 0 ? (
                  <p className="text-[11px] text-text-subtle text-center py-2">
                    Add scope items to see distribution
                  </p>
                ) : (
                  scopeItems
                    .map((item, idx) => {
                      const amount = Number(item.amount) || 0;
                      const pct =
                        totals.subtotal > 0
                          ? Math.round((amount / totals.subtotal) * 100)
                          : 0;
                      const cat = getCategory(item.area);
                      const c = COLOR_MAP[cat.color];
                      const displayItem = namedOriginalItems[idx] || item;
                      const title =
                        displayItem._displayCategory ||
                        item.itemName ||
                        item.description ||
                        item.area ||
                        "Untitled scope";
                      const subtitle =
                        item.area && title !== item.area
                          ? item.area
                          : item.description && title !== item.description
                            ? item.description
                            : "";
                      return { item, idx, amount, pct, c, title, subtitle };
                    })
                    .map(({ idx, amount, pct, c, title, subtitle }) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                            <span className="min-w-0">
                              <span className="block text-[11px] text-textcolor truncate font-medium">
                                {title}
                              </span>
                              {subtitle && (
                                <span className="block text-[9.5px] text-text-subtle truncate">
                                  {subtitle}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="text-[10.5px] font-bold text-text-muted tabular-nums">
                            {pct}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-bg-soft rounded-full overflow-hidden">
                            <div
                              className={`h-full ${c.bar}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-semibold text-text-subtle tabular-nums w-14 text-right">
                            {formatAmount(amount)}
                          </span>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* ── Sticky totals bar ──────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[260px] z-20 pointer-events-none">
        <div className="px-6 pb-4 flex justify-center">
          <div className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-bordergray shadow-[0_8px_30px_rgba(15,23,42,0.12)] rounded-2xl px-5 py-3 flex items-center gap-5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                <Wallet size={14} />
              </span>
              <div>
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-text-subtle">
                  {activeKey} · Quote Summary
                </p>
                <p className="text-[10.5px] text-text-muted">
                  {scopeItems.length} items · {activeConfig?.propertyType || ""}{" "}
                  · {totals.subtotal > 0 ? "live" : "empty"}
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-bordergray hidden sm:block" />
            <FooterStat
              label="Subtotal"
              value={formatAmount(totals.subtotal)}
            />
            <FooterStat
              label={`GST ${GST_RATE}%`}
              value={formatAmount(totals.gst)}
              accent="text-orange-500"
            />
            <div className="flex items-center gap-2 bg-linear-to-br from-select-blue to-primary text-white px-4 py-2 rounded-xl shadow-md shadow-select-blue/20">
              <IndianRupee size={13} />
              <div>
                <p className="text-[8.5px] font-bold uppercase tracking-widest opacity-80">
                  Grand Total
                </p>
                <p className="text-[14px] font-bold tabular-nums leading-tight">
                  {formatAmount(totals.grandTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />
      )}

      {/* ── Confirm modal ──────────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmDialog
          {...confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm?.();
            setConfirmDialog(null);
          }}
        />
      )}

      {/* ── Keyboard shortcuts modal ──────────────────────────────────── */}
      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* ── Add / Edit Scope — reuses the shared Item Master form ───────── */}
      {scopeFormOpen && (
        <ItemFormModal
          initial={
            editingScopeIdx != null &&
            activeConfig?.scopeItems?.[editingScopeIdx]
              ? scopeRowToForm(activeConfig.scopeItems[editingScopeIdx])
              : {}
          }
          onSave={handleScopeFormSave}
          onClose={() => {
            setScopeFormOpen(false);
            setEditingScopeIdx(null);
          }}
          title={editingScopeIdx != null ? "Edit Scope" : "Add Scope"}
          submitLabel={editingScopeIdx != null ? "Save Changes" : "Add Scope"}
          roomCategoryMode
          showCategory={false}
          showDimensions={false}
          showQuantity
          showTags={false}
          multiEntryMode={editingScopeIdx == null}
          existingScopeItems={activeConfig?.scopeItems || []}
          lockHeading={editingScopeIdx != null}
        />
      )}

      {/* ── Add Type Modal — multi-select property types with inline add ── */}
      {addTypeModalOpen && (
        <AddTypeModal
          activeKey={activeKey}
          currentConfigs={active.configurations || []}
          hiddenConfigs={hiddenConfigs}
          onApply={({ checked, unchecked, newlyAdded }) => {
            // 1. Register any newly added types globally
            if (newlyAdded.length > 0) {
              addPropertyTypes(newlyAdded);
            }

            // 2. Preserve data for unchecked types
            setHiddenConfigs((prev) => {
              const next = { ...prev };
              for (const typeName of unchecked) {
                const cfg = (active.configurations || []).find(
                  (c) =>
                    c.propertyType.trim().toLowerCase() ===
                    typeName.trim().toLowerCase(),
                );
                if (cfg) {
                  next[`${activeKey}::${typeName}`] = JSON.parse(
                    JSON.stringify(cfg),
                  );
                }
              }
              return next;
            });

            // 3. Update the master configurations
            setMaster((prev) => {
              const preset = prev[activeKey];
              const existingConfigs = [...(preset.configurations || [])];

              // Remove unchecked types
              let updatedConfigs = existingConfigs.filter(
                (c) =>
                  !unchecked.some(
                    (u) =>
                      u.trim().toLowerCase() ===
                      c.propertyType.trim().toLowerCase(),
                  ),
              );

              // Add newly checked types
              for (const typeName of checked) {
                const alreadyExists = updatedConfigs.some(
                  (c) =>
                    c.propertyType.trim().toLowerCase() ===
                    typeName.trim().toLowerCase(),
                );
                if (alreadyExists) continue;

                // Check hidden configs cache for preserved data
                const cacheKey = `${activeKey}::${typeName}`;
                const preserved = hiddenConfigs[cacheKey];

                if (preserved) {
                  // Restore previously configured data
                  updatedConfigs.push(JSON.parse(JSON.stringify(preserved)));
                } else {
                  // Brand new — empty scope
                  updatedConfigs.push({
                    propertyType: typeName,
                    grade: "economy",
                    sizeRange: "",
                    scopeItems: [],
                    inclusions: [],
                    exclusions: [],
                  });
                }
              }

              // Ensure at least one configuration remains
              if (updatedConfigs.length === 0 && existingConfigs.length > 0) {
                updatedConfigs = [existingConfigs[0]];
              }

              return {
                ...prev,
                [activeKey]: {
                  ...preset,
                  configurations: updatedConfigs,
                },
              };
            });

            // 4. Clean up restored entries from hidden cache
            setHiddenConfigs((prev) => {
              const next = { ...prev };
              for (const typeName of checked) {
                delete next[`${activeKey}::${typeName}`];
              }
              return next;
            });

            // 5. Reset config tab index
            setActiveConfigIdx(0);
            setAddTypeModalOpen(false);

            const totalChanges =
              checked.length + unchecked.length + newlyAdded.length;
            if (totalChanges > 0) {
              showToast(
                `Property types updated (${totalChanges} change${totalChanges > 1 ? "s" : ""})`,
                "success",
              );
            }
          }}
          onClose={() => setAddTypeModalOpen(false)}
          showToast={showToast}
        />
      )}

      {previewOpen && (
        <Modal
          title={`${activeKey} — ${activeConfig?.propertyType || ""}`}
          subtitle="Scope of work, grouped by room"
          onClose={() => setPreviewOpen(false)}
          maxWidth="max-w-[680px]"
          footer={
            <div className="flex items-center justify-end gap-6 text-[13px]">
              <span className="text-text-muted">
                Subtotal:{" "}
                <span className="font-semibold text-textcolor tabular-nums">
                  {formatAmount(totals.subtotal)}
                </span>
              </span>
              <span className="text-text-muted">
                GST {GST_RATE}%:{" "}
                <span className="font-semibold text-textcolor tabular-nums">
                  {formatAmount(totals.gst)}
                </span>
              </span>
              <span className="text-[15px] font-bold text-primary tabular-nums">
                {formatAmount(totals.grandTotal)}
              </span>
            </div>
          }
        >
          <div className="space-y-5">
            {groupedScope.map((group) => {
              const gcat = getCategory(group.room);
              const gc = COLOR_MAP[gcat.color];
              return (
                <div key={group.room}>
                  <div className="flex items-center justify-between border-b border-bordergray pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${gc.dot}`} />
                      <h3 className="text-[13px] font-bold text-textcolor uppercase tracking-wide">
                        {group.room}
                      </h3>
                    </div>
                    <span className="text-[12px] font-bold text-textcolor tabular-nums">
                      {formatAmount(group.total)}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.rows.map(({ item, idx }) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          {item.description && (
                            <p className="text-[12.5px] text-textcolor">
                              {item.description}
                            </p>
                          )}
                          {(item.materials || []).length > 0 && (
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {item.materials
                                .map(
                                  (m) =>
                                    `${m.name}${m.spec ? ` (${m.spec})` : ""}`,
                                )
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {item.days !== "" && item.days != null && (
                            <p className="text-[10.5px] text-text-subtle mt-0.5">
                              {item.days} working day
                              {Number(item.days) === 1 ? "" : "s"}
                            </p>
                          )}
                        </div>
                        <span className="text-[12.5px] font-semibold text-textcolor tabular-nums shrink-0">
                          {formatAmount(Number(item.amount) || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Add Type Modal — property type multi-select with inline creation
// ───────────────────────────────────────────────────────────────────────────

const AddTypeModal = ({
  activeKey,
  currentConfigs,
  hiddenConfigs,
  onApply,
  onClose,
  showToast,
}) => {
  // Snapshot the checked state at modal open — changes are buffered until Apply.
  const initialChecked = useMemo(
    () => new Set(currentConfigs.map((c) => c.propertyType)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Local copy of global types list (may grow during the modal session).
  const [allTypes, setAllTypes] = useState(() => getGlobalPropertyTypes());
  // Which types are currently checked in the modal (local draft state).
  const [draftChecked, setDraftChecked] = useState(
    () => new Set(initialChecked),
  );
  // Newly created types during this modal session.
  const [newlyCreated, setNewlyCreated] = useState([]);
  // Inline textbox value for adding a new type.
  const [newTypeName, setNewTypeName] = useState("");

  const inputRef = useRef(null);

  const handleToggle = useCallback((typeName) => {
    setDraftChecked((prev) => {
      const next = new Set(prev);
      if (next.has(typeName)) {
        next.delete(typeName);
      } else {
        next.add(typeName);
      }
      return next;
    });
  }, []);

  const handleAddNew = useCallback(() => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;

    // Case-insensitive duplicate check against all types
    const lowerTrimmed = trimmed.toLowerCase();
    const isDuplicate = allTypes.some(
      (t) => t.trim().toLowerCase() === lowerTrimmed,
    );
    if (isDuplicate) {
      showToast(`"${trimmed}" already exists`, "error");
      setNewTypeName("");
      return;
    }

    // Add to local list and mark as checked + newly created
    setAllTypes((prev) => [...prev, trimmed]);
    setDraftChecked((prev) => new Set([...prev, trimmed]));
    setNewlyCreated((prev) => [...prev, trimmed]);
    setNewTypeName("");
    inputRef.current?.focus();
  }, [newTypeName, allTypes, showToast]);

  const handleApply = useCallback(() => {
    // Compute diffs from initial state
    const checked = []; // newly checked (was unchecked, now checked)
    const unchecked = []; // newly unchecked (was checked, now unchecked)

    for (const typeName of draftChecked) {
      if (!initialChecked.has(typeName)) {
        checked.push(typeName);
      }
    }
    for (const typeName of initialChecked) {
      if (!draftChecked.has(typeName)) {
        unchecked.push(typeName);
      }
    }

    onApply({ checked, unchecked, newlyAdded: newlyCreated });
  }, [draftChecked, initialChecked, newlyCreated, onApply]);

  // Count changes for the Apply badge
  const changeCount = useMemo(() => {
    let count = 0;
    for (const t of draftChecked) if (!initialChecked.has(t)) count++;
    for (const t of initialChecked) if (!draftChecked.has(t)) count++;
    return count + newlyCreated.length;
  }, [draftChecked, initialChecked, newlyCreated]);

  return (
    <Modal
      title="Manage Property Types"
      subtitle={`Select which property types are available for the "${activeKey}" preset`}
      onClose={onClose}
      maxWidth="max-w-[520px]"
      maxHeight="max-h-[85vh]"
      footer={
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-text-muted">
            {draftChecked.size} type{draftChecked.size !== 1 ? "s" : ""}{" "}
            selected
            {newlyCreated.length > 0 && (
              <span className="text-emerald-600 font-semibold ml-1">
                · {newlyCreated.length} new
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:bg-bg-soft transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={changeCount === 0}
              className="px-5 py-2 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[12px] font-semibold shadow-sm hover:shadow-md hover:shadow-select-blue/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
              {changeCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-white/25 text-[10px] font-bold">
                  {changeCount}
                </span>
              )}
            </button>
          </div>
        </div>
      }
    >
      {/* Inline textbox to add new property type */}
      <div className="mb-4">
        <label className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
          <span className="text-select-blue">
            <Plus size={10} />
          </span>
          Add New Property Type
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNew();
              }
            }}
            placeholder="e.g. Row House, Bungalow…"
            className="flex-1 bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle"
          />
          <button
            type="button"
            onClick={handleAddNew}
            disabled={!newTypeName.trim()}
            className="px-3 py-2 rounded-lg bg-emerald-500 text-white text-[11px] font-semibold hover:bg-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-bordergray mb-3" />

      {/* Scrollable checkbox list */}
      <div className="max-h-[340px] overflow-y-auto scroll-hidden-bar -mx-1 px-1 space-y-1">
        {allTypes.map((typeName) => {
          const isChecked = draftChecked.has(typeName);
          const isNew = newlyCreated.includes(typeName);
          const wasOriginal = initialChecked.has(typeName);
          const hasHiddenData = !!hiddenConfigs[`${activeKey}::${typeName}`];

          return (
            <label
              key={typeName}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                isChecked
                  ? "bg-select-blue/5 border-select-blue/20 hover:bg-select-blue/10"
                  : "bg-white border-transparent hover:bg-bg-soft hover:border-bordergray"
              }`}
            >
              {/* Custom checkbox */}
              <div
                className={`shrink-0 h-4.5 w-4.5 rounded flex items-center justify-center border-2 transition-all duration-200 ${
                  isChecked
                    ? "bg-select-blue border-select-blue text-white shadow-sm"
                    : "bg-white border-slate-300 text-transparent hover:border-slate-400"
                }`}
              >
                <Check size={11} strokeWidth={3} className="shrink-0" />
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={isChecked}
                onChange={() => handleToggle(typeName)}
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[12px] font-medium ${
                    isChecked ? "text-textcolor" : "text-text-muted"
                  }`}
                >
                  {typeName}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  {isNew && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      New
                    </span>
                  )}
                  {hasHiddenData && !isChecked && (
                    <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Data preserved
                    </span>
                  )}
                  {wasOriginal && !isChecked && (
                    <span className="text-[9px] font-semibold text-red-400">
                      Will be hidden
                    </span>
                  )}
                  {!wasOriginal && isChecked && !isNew && (
                    <span className="text-[9px] font-semibold text-select-blue">
                      Will be added
                    </span>
                  )}
                </div>
              </div>
              {/* Right icon indicating state */}
              {isChecked && (
                <CheckCircle2 size={14} className="shrink-0 text-select-blue" />
              )}
            </label>
          );
        })}

        {allTypes.length === 0 && (
          <p className="text-[11px] text-text-subtle text-center py-6">
            No property types available. Add one above.
          </p>
        )}
      </div>
    </Modal>
  );
};

// ───────────────────────────────────────────────────────────────────────────

// Number input that hides "0" so users don't have to delete it before typing,
// and shows the cost-share % suffix when meaningful.
const AmountInput = ({ value, onChange, pct }) => {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? value === 0 || value === "0"
      ? ""
      : value
    : value === 0 || value === "0" || value === ""
      ? ""
      : value;
  return (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle text-[11px]">
        ₹
      </span>
      <input
        type="number"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          e.target.select();
        }}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value === "" ? 0 : e.target.value)}
        placeholder="0"
        className={`${inputBase} pl-6 pr-10 text-right tabular-nums font-semibold`}
      />
      {pct > 0 && !focused && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-text-subtle tabular-nums">
          {pct}%
        </span>
      )}
    </div>
  );
};

const Field = ({ icon, label, hint, children }) => (
  <div>
    <label className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
      <span className="flex items-center gap-1">
        <span className="text-select-blue">{icon}</span>
        {label}
      </span>
      {hint && (
        <span className="text-[9.5px] font-normal text-text-subtle normal-case tracking-normal flex items-center gap-1">
          <Info size={9} /> {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

const BentoStat = ({ icon, label, value, tint }) => {
  const tints = {
    blue: "from-blue-50 to-white text-blue-600 border-blue-100",
    purple: "from-purple-50 to-white text-purple-600 border-purple-100",
    orange: "from-orange-50 to-white text-orange-600 border-orange-100",
    emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-100",
  };
  return (
    <div
      className={`relative bg-linear-to-br ${tints[tint]} border rounded-xl p-3 overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="opacity-80">{icon}</span>
        <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </span>
      </div>
      <p className="text-[18px] font-bold text-textcolor tabular-nums leading-tight">
        {value}
      </p>
    </div>
  );
};

const FooterStat = ({ label, value, accent = "text-textcolor" }) => (
  <div className="flex flex-col">
    <span className="text-[9px] font-bold uppercase tracking-widest text-text-subtle">
      {label}
    </span>
    <span className={`text-[13px] font-bold tabular-nums ${accent}`}>
      {value}
    </span>
  </div>
);

// ───────────────────────────────────────────────────────────────────────────

const Toast = ({ toast, onClose }) => {
  const variants = {
    success: { bg: "bg-emerald-500", icon: <CheckCircle2 size={14} /> },
    error: { bg: "bg-red-500", icon: <AlertTriangle size={14} /> },
    info: { bg: "bg-select-blue", icon: <Info size={14} /> },
  };
  const v = variants[toast.type] || variants.info;
  return (
    <div className="fixed top-6 right-6 z-50 animate-[slideIn_0.2s_ease-out]">
      <div
        className={`${v.bg} text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md`}
      >
        <span className="shrink-0">{v.icon}</span>
        <p className="text-[12px] font-medium flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white shrink-0"
          title="Dismiss"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.15s_ease-out]"
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative"
    >
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
        title="Close dialog"
      >
        <X size={16} />
      </button>
      <div className="p-5 flex items-start gap-3">
        <span
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-50 text-red-500"
              : "bg-select-blue/10 text-select-blue"
          }`}
        >
          {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-textcolor">{title}</h3>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:bg-white hover:text-textcolor"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm ${
            danger
              ? "bg-red-500 hover:bg-red-600"
              : "bg-select-blue hover:bg-primary"
          }`}
        >
          {confirmLabel || "Confirm"}
        </button>
      </div>
    </div>
  </div>
);

const ShortcutsModal = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
    >
      <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Keyboard size={14} className="text-select-blue" />
          <h3 className="text-[13px] font-bold text-textcolor">
            Keyboard Shortcuts
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-5 space-y-2.5">
        <Shortcut keys={["⌘", "S"]} label="Save changes" />
        <Shortcut keys={["?"]} label="Toggle this menu" />
        <Shortcut keys={["Esc"]} label="Close dialogs" />
        <Shortcut keys={["Enter"]} label="Confirm in input fields" />
      </div>
    </div>
  </div>
);

const Shortcut = ({ keys, label }) => (
  <div className="flex items-center justify-between">
    <span className="text-[12px] text-textcolor">{label}</span>
    <span className="flex items-center gap-1">
      {keys.map((k) => (
        <kbd
          key={k}
          className="text-[10px] font-bold bg-bg-soft border border-bordergray rounded px-1.5 py-0.5 text-textcolor"
        >
          {k}
        </kbd>
      ))}
    </span>
  </div>
);

export default ProposalMaster;
