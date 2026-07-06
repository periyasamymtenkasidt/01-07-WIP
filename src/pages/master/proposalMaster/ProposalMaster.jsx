import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  Plus,
  Trash2,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  Package,
  Search,
  Home,
  Ruler,
  Tag,
  CheckCircle2,
  XCircle,
  Sparkles,
  // TrendingUp, Hash — used only by the hidden stats banner (commented out below)
  IndianRupee,
  ChefHat,
  Sofa,
  Bed,
  Bath,
  DoorOpen,
  BookOpen,
  Building2,
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
  digitsOnly,
  handleSizeRangeKeyDown,
} from "../../../utils/sizeRangeValidation";
import {
  assignCategoryNames,
  addScopeItemsWithDuplicateCheck,
} from "../../../utils/scopeNaming";
import {
  scopeRoomKey,
  parseBaseArea,
  getNormalizedAllocations,
  initializeFormulasForItems,
  recalculateScopeItems,
  getNormalizedConfig,
} from "../../../data/scopeEstimator";
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
import {
  mapScopeItemsToGrade,
  syncScopeItemsToLibrary,
} from "../../../data/gradeMapping";
import { PROPERTY_TYPES } from "../../../helperConfigData/helperData";
import {
  getGlobalPropertyTypes,
  addPropertyTypes,
  removePropertyTypeGlobally,
  isPropertyTypeInUse,
} from "../../../data/propertyTypeStorage";

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

// Per-scope grade chip — shorthand (Economy → EC, Premium → PR, Luxury → LX)
// shown next to the item name so the grade is identifiable at a glance.
// Mirrors the shorthand used on the Item Master cards.
const gradeShorthand = (key) => {
  const label = gradeLabel(key);
  if (!label) return "";
  return label
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((word) => word.slice(0, 2).toUpperCase())
    .join("");
};

const GRADE_CHIP_STYLE = {
  economy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  premium: "bg-amber-50 text-amber-700 border-amber-200",
  luxury: "bg-violet-50 text-violet-700 border-violet-200",
};
const gradeChipStyle = (key) =>
  GRADE_CHIP_STYLE[key] || "bg-active-bg text-select-blue border-select-blue/20";

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
  const isInitialRef = useRef(true);
  const [activeKey, setActiveKey] = useState(() => {
    const keys = Object.keys(getMaster());
    return keys[0] || "2BHK";
  });
  const [showAddPreset, setShowAddPreset] = useState(false);
  const [newPresetKey, setNewPresetKey] = useState("");
  // Anchored materials popover: { idx, rect } where rect is the trigger button's
  // bounding box, or null when closed.
  const [matPopover, setMatPopover] = useState(null);
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
  // Read-only info modal for a single scope row: { item, idx } or null.
  const [scopeInfo, setScopeInfo] = useState(null);
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
  // When false, the editor is collapsed and only the property-type cards show;
  // clicking a type card opens the editor as a separate view for that type.
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  // Smart Estimator collapses to an accordion so it doesn't eat vertical space
  // when the user isn't tuning allocations. Collapsed by default.
  const [estimatorOpen, setEstimatorOpen] = useState(false);

  // Reset config tab + collapse the editor back to type selection when the
  // preset changes.
  useEffect(() => {
    setActiveConfigIdx(0);
    setTypeEditorOpen(false);
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

  // Every edit to `master` is persisted immediately — there is no separate
  // "Save Changes" step, so this is the only place that writes to storage.
  useEffect(() => {
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }
    saveMaster(master);
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
  const updateActive = useCallback((changes) => {
    setMaster((prev) => ({
      ...prev,
      [activeKey]: { ...prev[activeKey], ...changes },
    }));
  }, [activeKey]);

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
  }, [activeKey, activeConfig?.propertyType, active, updateActive]);

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

  // Reflect the Item Master into the Scope of Work. The Master page is tabbed, so
  // Proposal Master is unmounted while the user edits in the Item Master tab —
  // the live `itemLibraryChanged` event therefore can't be relied on. Instead we
  // re-derive every linked scope row from the master whenever this config loads
  // (e.g. on returning to the tab), the active grade changes, a row is added, or
  // the library changes in a background window (libVersion):
  //   1. sync the descriptive fields (name, spec, HSN, unit, GST, days) — except
  //      fields the user has hand-edited on the row (isItemNameCustom /
  //      isDescriptionCustom), so manual wording is preserved;
  //   2. re-map rate / materials / amount to the active grade;
  //   3. recalculate the area-based estimator.
  // It writes only when the derived rows actually differ from the current ones,
  // so it never loops and is a no-op once everything is already in sync.
  useEffect(() => {
    if (!active || !activeConfig) return;
    const items = activeConfig.scopeItems || [];
    if (items.length === 0) return;

    let target = syncScopeItemsToLibrary(items);
    target = mapScopeItemsToGrade(target, activeGrade);
    if (activeConfig.enableFormulaEstimator) {
      const totalArea =
        activeConfig.totalArea || parseBaseArea(activeConfig.sizeRange) || 1000;
      const allocations = getNormalizedAllocations(
        target,
        activeConfig.roomAllocations || {},
      );
      target = recalculateScopeItems(target, totalArea, allocations, true);
    }

    const differs = target.some((t, i) => {
      const o = items[i];
      return (
        t.itemName !== o.itemName ||
        t.spec !== o.spec ||
        t.hsn !== o.hsn ||
        t.unit !== o.unit ||
        t.gstPercent !== o.gstPercent ||
        t.days !== o.days ||
        t.rate !== o.rate ||
        t.amount !== o.amount ||
        (t.grade || "") !== (o.grade || "")
      );
    });
    if (!differs) return;

    setConfigField((config) => ({
      ...config,
      grade: activeGrade,
      scopeItems: target,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeKey,
    activeConfigIdx,
    activeGrade,
    activeConfig?.scopeItems?.length,
    libVersion,
  ]);

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

  // Remove a single material line from a scope row. Note: re-mapping a scope to
  // a grade (grade switch / tab return / library change) re-seeds materials from
  // the rate build-up, so a removed material reappears on the next re-map.
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

  // Open the anchored materials popover for a scope row. It stays open until the
  // user clicks the popover's X button; clicking another card's Materials button
  // just moves the popover to that card.
  const openMatPopover = (idx, e) => {
    e.stopPropagation();
    // Anchor to the whole scope card (not the small button) so the popover sits
    // directly below the card and matches its width.
    const card = e.currentTarget.closest("[data-scope-card]") || e.currentTarget;
    const r = card.getBoundingClientRect();
    setMatPopover({
      idx,
      rect: { top: r.top, bottom: r.bottom, left: r.left, width: r.width },
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      // Changes already autosave — just swallow the browser's native
      // "Save Page As" shortcut so it doesn't hijack the keystroke.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
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

  // Stats banner hidden per request — keep the aggregation for future use.
  // const globalStats = useMemo(() => {
  //   const allItems = presetKeys.flatMap((k) =>
  //     (master[k]?.configurations || []).flatMap((c) => c.scopeItems || []),
  //   );
  //   const totalAmount = allItems.reduce(
  //     (s, it) => s + (Number(it.amount) || 0),
  //     0,
  //   );
  //   const totalMaterials = allItems.reduce(
  //     (s, it) => s + (it.materials?.length || 0),
  //     0,
  //   );
  //   return {
  //     presets: presetKeys.length,
  //     items: allItems.length,
  //     materials: totalMaterials,
  //     avgQuote:
  //       presetKeys.length > 0 ? Math.round(totalAmount / presetKeys.length) : 0,
  //   };
  // }, [presetKeys, master]);

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
        s.grade || s.defaultGrade || activeConfig?.grade || lib.defaultGrade || "economy"
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

  // Material lookup for pricing each material line from the rate build-up.
  const matById = materialsById(listMaterials());

  return (
    <div className="bg-overallbg font-sans h-full overflow-hidden flex flex-col">
      <div className="px-6 py-4 flex-1 min-h-0 overflow-hidden flex flex-col gap-4">
        {/* ── Presets: horizontal tab bar (hidden in the full editor view) ── */}
        {!typeEditorOpen && (
        <div className="shrink-0 bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5 pl-2 pr-1 shrink-0">
            <Layers size={13} className="text-select-blue" />
            <h3 className="hidden sm:block text-[11px] font-bold uppercase tracking-wider text-textcolor">
              Presets
            </h3>
            <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md">
              {presetKeys.length}
            </span>
          </div>

          {/* Tabs — scroll sideways with the scrollbar hidden */}
          <div className="flex-1 min-w-0 overflow-x-auto scroll-hidden-bar">
            {filteredKeys.length === 0 ? (
              <p className="text-[11px] text-text-subtle px-2 py-1.5">
                No matches
              </p>
            ) : (
              <div className="flex items-center gap-1.5 w-max">
                {filteredKeys.map((k) => {
                  const p = master[k];
                  const allCfgItems = (p.configurations || []).flatMap(
                    (c) => c.scopeItems || [],
                  );
                  const t = computeTotals(allCfgItems);
                  const firstCfg = p.configurations?.[0];
                  const isActive = k === activeKey;
                  const cat = getCategory(p.label || k);
                  const c = COLOR_MAP[cat.color];
                  const typeCount = (p.configurations || []).length;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setActiveKey(k)}
                      title={`${p.label} · ${formatAmount(t.grandTotal)}${firstCfg?.sizeRange ? ` · ${formatSizeRange(firstCfg.sizeRange)}` : ""}`}
                      className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 border transition-all ${
                        isActive
                          ? "bg-active-bg border-select-blue/40 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                          : "bg-transparent border-transparent hover:bg-bg-soft"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${c.dot}`} />
                      <span
                        className={`text-[12px] font-bold ${isActive ? "text-select-blue" : "text-textcolor"}`}
                      >
                        {k}
                      </span>
                      <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
                        {typeCount} type{typeCount === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative shrink-0 hidden md:block">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <input
              type="text"
              value={presetSearch}
              onChange={(e) => setPresetSearch(e.target.value)}
              placeholder="Search presets"
              className="w-[150px] bg-bg-soft border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[11px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30"
            />
          </div>

          {/* Keyboard shortcuts */}
          <button
            type="button"
            onClick={() => setShowShortcuts(true)}
            title="Keyboard shortcuts ( ? )"
            className="hidden sm:flex shrink-0 items-center gap-1 px-2.5 py-2 bg-white border border-bordergray rounded-lg text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all"
          >
            <Keyboard size={12} />
          </button>

          {/* Add preset — pinned to the right end */}
          {showAddPreset ? (
            <div className="flex items-center gap-1.5 shrink-0">
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
                className="w-[120px] bg-white border border-bordergray rounded-lg text-[12px] px-2.5 py-2 focus:outline-none focus:border-select-blue"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddPreset}
                className="px-2.5 py-2 rounded-lg bg-select-blue text-white text-[11px] font-semibold hover:bg-primary"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddPreset(false);
                  setNewPresetKey("");
                }}
                className="px-2.5 py-2 rounded-lg border border-bordergray text-[11px] text-text-muted hover:bg-bg-soft"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddPreset(true)}
              className="shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[11.5px] font-semibold shadow-sm hover:bg-primary transition-all"
            >
              <Plus size={13} /> Add Preset
            </button>
          )}
        </div>
        )}

        {/* ── Editor + right panel ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 items-stretch flex-1 min-h-0 overflow-hidden">
          {/* ── Middle: Editor ──────────────────────────────────────────── */}
          <main className="space-y-5 min-w-0 overflow-y-auto pb-28 scroll-hidden-bar">
            {/* ── Property Types — selection view (editor collapsed) ─────── */}
            {!typeEditorOpen && (
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-4">
              {/* Preset header — manage the active preset, then pick a type */}
              <div className="flex items-center justify-between gap-3 pb-3 mb-3 border-b border-bordergray">
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
                      <Tag size={12} className="text-select-blue shrink-0" />
                      <span className="text-[12.5px] font-bold text-textcolor truncate">
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

              <div className="flex items-center gap-1.5 mb-3">
                <Home size={12} className="text-select-blue" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-textcolor">
                  Property Types
                </h3>
                <span className="text-[10px] text-text-muted">
                  · select a type to open its editor
                </span>
              </div>
              <div className="flex items-stretch gap-2 flex-wrap">
                {(active.configurations || []).map((cfg, idx) => {
                  const isActive = idx === activeConfigIdx;
                  const cfgItems = cfg.scopeItems || [];
                  const cfgTotal = computeTotals(cfgItems);
                  return (
                    <button
                      key={cfg.propertyType}
                      type="button"
                      onClick={() => {
                        setActiveConfigIdx(idx);
                        setTypeEditorOpen(true);
                      }}
                      title={`Open the editor for ${cfg.propertyType}`}
                      className={`text-left rounded-xl border px-3 py-2.5 min-w-[160px] transition-all ${
                        isActive
                          ? "bg-active-bg border-select-blue/50 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                          : "bg-white border-bordergray hover:border-select-blue/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`text-[12px] font-bold truncate ${isActive ? "text-select-blue" : "text-textcolor"}`}
                        >
                          {cfg.propertyType}
                        </span>
                        {isActive && (
                          <Check
                            size={13}
                            strokeWidth={3}
                            className="text-select-blue shrink-0"
                          />
                        )}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {formatSizeRange(cfg.sizeRange) || "Size not set"}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5 text-[10.5px]">
                        <span className="text-text-muted">
                          {cfgItems.length} scope
                          {cfgItems.length === 1 ? "" : "s"}
                        </span>
                        <span
                          className={`font-bold tabular-nums ${isActive ? "text-select-blue" : "text-textcolor"}`}
                        >
                          {formatAmount(cfgTotal.grandTotal)}
                        </span>
                      </div>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setAddTypeModalOpen(true)}
                  className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-bordergray px-4 min-w-[110px] text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/40 transition-all"
                >
                  <Plus size={15} />
                  <span className="text-[11px] font-semibold">Add Type</span>
                </button>
              </div>
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
            </section>
            )}

            {/* ── Editor view — opens when a type card is clicked ────────── */}
            {typeEditorOpen && (
              <>
                <button
                  type="button"
                  onClick={() => setTypeEditorOpen(false)}
                  className="w-fit flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-select-blue"
                >
                  <ChevronLeft size={15} /> Property Types
                  {activeConfig?.propertyType && (
                    <span className="text-text-subtle font-normal">
                      / {activeConfig.propertyType}
                    </span>
                  )}
                </button>

            {/* Preset hero card */}
            <section className="relative bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-y-auto overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-br from-select-blue/8 via-active-bg/40 to-transparent pointer-events-none" />
              <div className="relative px-5 py-4 border-b border-bordergray flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Left — property type + preset context */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-9 w-9 rounded-xl bg-select-blue/10 text-select-blue flex items-center justify-center shrink-0">
                    <Home size={16} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-bold text-textcolor leading-tight truncate">
                      {activeConfig?.propertyType || "Property Type"}
                    </h2>
                    {/* Just the preset key — the full label ("1 BHK / Studio
                        Apartment") repeats the title + key, so it's omitted. */}
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-select-blue">
                      <Tag size={9} /> {activeKey}
                    </span>
                  </div>
                </div>

                {/* Right — Size Range shares the row (uses the empty space) */}
                <div className="shrink-0 w-full sm:w-auto">
                  <label className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-text-muted mb-1">
                    <Ruler size={10} /> Size Range
                    <span className="font-medium normal-case tracking-normal text-text-subtle">
                      · ₹/sq ft basis
                    </span>
                  </label>
                  <div className="relative flex items-center w-full sm:w-44">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={activeConfig?.sizeRange || ""}
                      onKeyDown={handleSizeRangeKeyDown}
                      onChange={(e) => {
                        // Whole numbers only — strip any non-digit (incl. - and +).
                        const val = digitsOnly(e.target.value);
                        setSizeRangeError(validateSizeRangeInput(val));
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
                      placeholder="e.g. 1000"
                      className={`${inputBase} pr-12 py-1.5`}
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
                </div>
              </div>


              {/* Smart Estimator Card */}
              {activeConfig && (
                <div className="relative mx-5 mb-5 bg-white rounded-2xl p-5 border border-bordergray shadow-sm space-y-4">
                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => setEstimatorOpen((o) => !o)}
                      className="flex items-center gap-2 text-left"
                      aria-expanded={estimatorOpen}
                    >
                      {estimatorOpen ? (
                        <ChevronDown size={15} className="text-text-muted shrink-0" />
                      ) : (
                        <ChevronRight size={15} className="text-text-muted shrink-0" />
                      )}
                      <div className="h-7 w-7 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                        <Sparkles size={13} />
                      </div>
                      <div>
                        <h2 className="text-[13px] font-bold text-textcolor">Smart Estimator</h2>
                        <p className="text-[10.5px] text-text-muted">Formula-based quantity & rate calculation</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      {/* Allocation status stays visible even when collapsed so the
                          "must equal 100%" warning isn't hidden by the accordion. */}
                      {activeConfig.enableFormulaEstimator && !estimatorOpen && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            allocationSum === 100
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                          }`}
                          title="Room allocation total"
                        >
                          {allocationSum}%
                        </span>
                      )}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!activeConfig.enableFormulaEstimator}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) setEstimatorOpen(true);
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
                  </div>

                  {estimatorOpen && activeConfig.enableFormulaEstimator && (
                    <div className="space-y-3 border-t border-bordergray pt-3">
                      {/* Compact read-only summary — no fake inputs */}
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Ruler size={12} className="text-text-subtle" />
                          <span className="text-text-muted">Total area</span>
                          <span
                            className="font-bold text-textcolor tabular-nums"
                            title="Derived from Size Range — edit Size Range to change this"
                          >
                            {(
                              activeConfig.totalArea ||
                              parseBaseArea(activeConfig.sizeRange) ||
                              0
                            ).toLocaleString("en-IN")}{" "}
                            sqft
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="text-text-muted">Allocated</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                              allocationSum === 100
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                            }`}
                          >
                            {allocationSum}%
                          </span>
                          {allocationSum !== 100 && (
                            <span className="text-[9.5px] text-red-500 font-bold">
                              must equal 100%
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Room allocations — compact rows with a visual split bar */}
                      <div>
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">
                          Room Allocations &amp; Split
                        </p>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-5 gap-y-1 max-h-[200px] overflow-y-auto scroll-hidden-bar pr-1">
                          {Object.keys(activeConfig.roomAllocations || {}).map((room) => {
                            const pct = activeConfig.roomAllocations[room] || 0;
                            const totalAreaVal = activeConfig.totalArea || parseBaseArea(activeConfig.sizeRange) || 1000;
                            const roomArea = Math.round(totalAreaVal * (pct / 100));
                            return (
                              <div
                                key={room}
                                className="flex items-center gap-2 py-1"
                              >
                                <span
                                  className="text-[11px] font-semibold text-textcolor truncate w-[92px] shrink-0"
                                  title={room}
                                >
                                  {room}
                                </span>
                                <div className="flex-1 h-1.5 min-w-0 bg-bg-soft rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-select-blue rounded-full transition-all"
                                    style={{ width: `${Math.min(100, pct)}%` }}
                                  />
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
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
                                    className="w-11 text-center rounded-md border border-bordergray py-0.5 text-[11px] text-textcolor tabular-nums focus:outline-none focus:border-select-blue"
                                  />
                                  <span className="text-[10px] text-text-muted">%</span>
                                </div>
                                <span className="text-[9.5px] text-text-subtle tabular-nums w-[58px] text-right shrink-0">
                                  {roomArea.toLocaleString("en-IN")} sqft
                                </span>
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
                  <label className="flex items-center gap-1.5 rounded-lg border border-bordergray bg-bg-soft/50 px-2 py-1">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
                      Grade
                    </span>
                    <select
                      value={activeGrade}
                      onChange={(e) => handleGradeChange(e.target.value)}
                      title="Apply the selected grade's Item Master rates and materials"
                      className="bg-white border border-bordergray rounded-md px-2 py-1 text-[10px] font-semibold text-textcolor cursor-pointer focus:outline-none focus:border-select-blue"
                    >
                      {availableGrades.map((grade) => (
                        <option key={grade.key} value={grade.key}>
                          {grade.label}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  const GroupIcon = gcat.icon;
                  const groupOpen = isGroupOpen(group.room);
                  const roomShare =
                    totals.subtotal > 0
                      ? Math.round((group.total / totals.subtotal) * 100)
                      : 0;
                  return (
                    <div
                      key={group.room}
                      className="rounded-2xl border border-bordergray bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
                    >
                      {/* Room header — click to expand/collapse */}
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.room)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-bg-soft/60 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {groupOpen ? (
                            <ChevronDown size={14} className="text-text-muted shrink-0" />
                          ) : (
                            <ChevronRight size={14} className="text-text-muted shrink-0" />
                          )}
                          <span
                            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${gc.bg} ${gc.text}`}
                          >
                            <GroupIcon size={15} />
                          </span>
                          <div className="text-left min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-[12px] font-bold text-textcolor uppercase tracking-wide truncate">
                                {group.room}
                              </h4>
                              <span className="text-[9.5px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md border border-bordergray shrink-0">
                                {group.rows.length}
                              </span>
                            </div>
                            <p className="text-[10px] text-text-muted">
                              {roomShare}% of quote
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="block text-[12.5px] font-bold text-textcolor tabular-nums">
                            {formatAmount(group.total)}
                          </span>
                          <div className="w-24 h-1 bg-bg-soft rounded-full overflow-hidden mt-1 ml-auto">
                            <div
                              className={`h-full ${gc.bar}`}
                              style={{ width: `${Math.min(100, roomShare)}%` }}
                            />
                          </div>
                        </div>
                      </button>
                      {groupOpen && (
                        <div className="border-t border-bordergray p-3 grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                          {group.rows.map(({ item, idx }) => {
                            const matCount = (item.materials || []).length;
                            const cat = getCategory(item.area);
                            const c = COLOR_MAP[cat.color];
                            const Icon = cat.icon;
                            const amount = Number(item.amount) || 0;
                            const pct =
                              totals.subtotal > 0
                                ? Math.round((amount / totals.subtotal) * 100)
                                : 0;
                            const split =
                              activeConfig?.roomAllocations?.[scopeRoomKey(item)];
                            // Resolve the linked rate build-up only to tell whether
                            // this scope has the selected grade's build-up (rate > 0),
                            // which controls the grade chip's muted/active state.
                            const matLib = item.masterId
                              ? libById[item.masterId]
                              : null;
                            const rowGrade =
                              item.grade ||
                              activeConfig?.grade ||
                              activeGrade ||
                              "economy";
                            const rowRecipe =
                              matLib?.recipes?.[rowGrade] ||
                              item.recipes?.[rowGrade];
                            const rowCalc = rowRecipe
                              ? computeRecipe(rowRecipe, matById)
                              : null;
                            const gradeShort = gradeShorthand(rowGrade);
                            const gradeAvailable = (rowCalc?.rate || 0) > 0;
                            const popoverOpen = matPopover?.idx === idx;
                            return (
                              <div
                                key={idx}
                                data-scope-card
                                className={`group bg-white rounded-xl border transition-all ${
                                  popoverOpen
                                    ? "border-select-blue/50 shadow-[0_2px_10px_rgba(15,23,42,0.08)]"
                                    : "border-bordergray hover:border-select-blue/40 hover:shadow-[0_2px_10px_rgba(15,23,42,0.06)]"
                                }`}
                              >
                                {/* Card body — click the name to edit (opens Edit
                                    Scope); the action buttons stop propagation. */}
                                <div className="p-3.5">
                                  {/* Header — icon, name + grade chip, amount, delete */}
                                  <div className="flex items-start gap-2.5">
                                    <span
                                      className={`h-8 w-8 flex items-center justify-center rounded-lg shrink-0 ${c.bg} ${c.text}`}
                                    >
                                      <Icon size={14} />
                                    </span>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <button
                                          type="button"
                                          onClick={() => openEditScope(idx)}
                                          title="Click to edit this scope"
                                          className="min-w-0 truncate text-left text-[12.5px] font-bold text-textcolor hover:text-select-blue hover:underline transition-colors cursor-pointer"
                                        >
                                          {namedOriginalItems[idx]
                                            ?._displayCategory ||
                                            item.itemName ||
                                            item.area || (
                                              <span className="text-text-subtle font-normal italic no-underline">
                                                Untitled scope
                                              </span>
                                            )}
                                        </button>
                                        {gradeShort && (
                                          <span
                                            className={`shrink-0 text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                              gradeAvailable
                                                ? gradeChipStyle(rowGrade)
                                                : "bg-bg-soft text-text-subtle border-bordergray border-dashed"
                                            }`}
                                            title={
                                              gradeAvailable
                                                ? `${gradeLabel(rowGrade)} grade`
                                                : `No ${gradeLabel(rowGrade)} build-up for this item — price unchanged`
                                            }
                                          >
                                            {gradeShort}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setScopeInfo({ item, idx });
                                          }}
                                          title="View scope details"
                                          className="h-5 w-5 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-active-bg transition-colors shrink-0"
                                        >
                                          <Info size={12} />
                                        </button>
                                      </div>
                                      {item.description && (
                                        <span
                                          className="block text-[10.5px] text-text-muted truncate mt-0.5"
                                          title={item.description}
                                        >
                                          {item.description}
                                        </span>
                                      )}
                                    </div>

                                    <span className="text-[14px] font-bold text-textcolor tabular-nums shrink-0">
                                      {formatAmount(amount)}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeScopeRow(idx);
                                      }}
                                      title="Remove scope"
                                      className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>

                                  {/* Metrics + share bar — aligned under the name so
                                      the card fills its width instead of leaving a gap */}
                                  <div className="mt-2.5 pl-[42px]">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                      <span
                                        className="inline-flex items-baseline gap-1.5"
                                        title={
                                          split != null
                                            ? `${split}% area split`
                                            : "Calculated quantity"
                                        }
                                      >
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                                          Qty
                                        </span>
                                        <span className="text-[11px] font-semibold text-textcolor tabular-nums">
                                          {Number(item.qty || 0).toLocaleString("en-IN", {
                                            maximumFractionDigits: 2,
                                          }) || "—"}{" "}
                                          {item.unit || ""}
                                          {split != null && (
                                            <span className="font-medium text-text-muted">
                                              {" "}
                                              · {split}%
                                            </span>
                                          )}
                                        </span>
                                      </span>
                                      <span className="inline-flex items-baseline gap-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                                          Rate/Sqft
                                        </span>
                                        <span className="text-[11px] font-semibold text-textcolor tabular-nums">
                                          ₹{Number(item.rate || 0).toLocaleString("en-IN")}
                                        </span>
                                      </span>
                                      <span className="inline-flex items-baseline gap-1.5">
                                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                                          Days
                                        </span>
                                        <span className="text-[11px] font-semibold text-textcolor tabular-nums">
                                          {(item.days ?? "") !== ""
                                            ? `${item.days} d`
                                            : "—"}
                                        </span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => openMatPopover(idx, e)}
                                        title="View materials & specifications"
                                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -my-0.5 text-[10.5px] font-semibold transition-colors ${
                                          popoverOpen
                                            ? "bg-active-bg text-select-blue"
                                            : "text-select-blue hover:bg-active-bg/60"
                                        }`}
                                      >
                                        Materials{matCount > 0 ? ` (${matCount})` : ""}
                                        {popoverOpen ? (
                                          <ChevronDown size={11} />
                                        ) : (
                                          <ChevronRight size={11} />
                                        )}
                                      </button>
                                    </div>
                                    {pct > 0 && (
                                      <div className="flex items-center gap-2 mt-2">
                                        <div className="flex-1 h-1.5 bg-bg-soft rounded-full overflow-hidden">
                                          <div
                                            className={`h-full ${c.bar}`}
                                            style={{ width: `${Math.min(100, pct)}%` }}
                                          />
                                        </div>
                                        <span className="text-[9px] font-semibold text-text-subtle tabular-nums shrink-0">
                                          {pct}% of quote
                                        </span>
                                      </div>
                                    )}
                                  </div>
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

            {/* ── Cost Breakdown — positioned below Scope of Work ───────── */}
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
              <div className="p-4">
                {scopeItems.length === 0 ? (
                  <p className="text-[11px] text-text-subtle text-center py-2">
                    Add scope items to see distribution
                  </p>
                ) : (
                  (() => {
                    // Bars scale to the biggest line item so the progress is
                    // readable; the % shown is share of the project subtotal.
                    const maxAmt = Math.max(
                      1,
                      ...scopeItems.map((s) => Number(s.amount) || 0),
                    );
                    const cards = scopeItems
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
                        return { idx, amount, pct, c, title, subtitle };
                      })
                      .sort((a, b) => b.amount - a.amount);

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {cards.map(({ idx, amount, pct, c, title, subtitle }) => (
                          <div
                            key={idx}
                            className="rounded-xl border border-bordergray bg-white p-3 hover:border-select-blue/40 hover:shadow-[0_2px_8px_rgba(15,23,42,0.06)] transition-all"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <span className="flex items-start gap-1.5 min-w-0">
                                <span
                                  className={`h-2 w-2 rounded-full shrink-0 mt-1 ${c.dot}`}
                                />
                                <span className="min-w-0">
                                  <span className="block text-[11px] font-semibold text-textcolor truncate">
                                    {title}
                                  </span>
                                  {subtitle && (
                                    <span className="block text-[9.5px] text-text-subtle uppercase tracking-wide truncate">
                                      {subtitle}
                                    </span>
                                  )}
                                </span>
                              </span>
                              <span className="shrink-0 text-[10px] font-bold text-select-blue bg-active-bg px-1.5 py-0.5 rounded-md tabular-nums">
                                {pct}%
                              </span>
                            </div>
                            <p className="text-[14px] font-bold text-textcolor tabular-nums leading-none mb-2">
                              {formatAmount(amount)}
                            </p>
                            <div className="h-1.5 bg-bg-soft rounded-full overflow-hidden">
                              <div
                                className={`h-full ${c.bar} transition-all`}
                                style={{ width: `${(amount / maxAmt) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
            </section>
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Sticky totals bar — only in the editor view ────────────────── */}
      {typeEditorOpen && (
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
      )}

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

      {/* Anchored materials popover — floats next to the clicked card's
          "Materials" button (z-indexed), so the card grid never reflows. The
          transparent backdrop closes it on any outside click. */}
      {matPopover != null &&
        scopeItems[matPopover.idx] &&
        (() => {
          const item = scopeItems[matPopover.idx];
          const mats = item.materials || [];
          const mLib = item.masterId ? libById[item.masterId] : null;
          const grade =
            item.grade || activeConfig?.grade || activeGrade || "economy";
          const recipe = mLib?.recipes?.[grade] || item.recipes?.[grade];
          const calc = recipe ? computeRecipe(recipe, matById) : null;
          const lines = calc?.lines || [];
          const matAmount = (m, mIdx) => {
            const line =
              lines.find(
                (l) =>
                  (m.materialId && l.materialId === m.materialId) ||
                  (m.id && l.materialId === m.id) ||
                  (l.name &&
                    m.name &&
                    l.name.toLowerCase() === m.name.toLowerCase()),
              ) || lines[mIdx];
            if (line) return Number(line.amount) || 0;
            return (
              (Number(m.rate) || 0) *
              (Number(m.qty) || 0) *
              (1 + (Number(m.wastagePct) || 0) / 100)
            );
          };
          // Match the scope card's width and left edge so the panel sits exactly
          // below the card; flip above / nudge left to stay inside the viewport.
          const { rect } = matPopover;
          const margin = 12;
          const width = Math.min(rect.width, window.innerWidth - margin * 2);
          const left = Math.max(
            margin,
            Math.min(rect.left, window.innerWidth - width - margin),
          );
          const spaceBelow = window.innerHeight - rect.bottom;
          const openUp = spaceBelow < 260 && rect.top > spaceBelow;
          const style = openUp
            ? {
                left,
                width,
                bottom: window.innerHeight - rect.top + 6,
                maxHeight: rect.top - margin,
              }
            : {
                left,
                width,
                top: rect.bottom + 6,
                maxHeight: spaceBelow - margin,
              };
          // Caret: a small rotated square poking out of the panel edge toward the
          // card. Points up when the panel is below the card, down when flipped
          // above. Rendered separately so the panel's overflow-hidden can't clip it.
          const caretLeft = Math.min(left + 28, left + width - 24);
          const caretStyle = openUp
            ? { left: caretLeft, top: rect.top - 12 }
            : { left: caretLeft, top: rect.bottom };
          const name =
            namedOriginalItems[matPopover.idx]?._displayCategory ||
            item.itemName ||
            item.area ||
            "Scope";
          return (
            <>
              {/* Blocking overlay — absorbs clicks so nothing behind (scope name,
                  other cards) is interactive while the popover is open. It does
                  NOT close the popover; only the X button does. */}
              <div
                className="fixed inset-0 z-90 bg-gray-900/5"
                onClick={(e) => e.stopPropagation()}
              />
              {/* Caret pointing at the card */}
              <div
                style={caretStyle}
                className={`fixed z-[101] h-3 w-3 rotate-45 bg-white border-bordergray ${
                  openUp ? "border-b border-r" : "border-t border-l"
                }`}
              />
              <div
                role="dialog"
                style={style}
                className="fixed z-100 bg-white rounded-xl border border-bordergray shadow-[0_8px_30px_rgba(15,23,42,0.18)] flex flex-col overflow-hidden font-manrope"
              >
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-bordergray bg-bg-soft/50">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Package size={12} className="text-select-blue shrink-0" />
                    <span className="text-[11.5px] font-bold text-textcolor truncate">
                      {name}
                    </span>
                    {mats.length > 0 && (
                      <span className="text-[9.5px] font-semibold text-text-subtle shrink-0">
                        ({mats.length})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMatPopover(null)}
                    className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>

                {/* Body */}
                <div className="p-3">
                  {mats.length === 0 ? (
                    <p className="text-[11px] text-text-subtle py-2 text-center">
                      No materials. Use Edit Scope to add them.
                    </p>
                  ) : (
                    <>
                      <div className="grid grid-cols-[1fr_1.3fr_92px_28px] gap-2 px-1 mb-1.5 text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                        <span>Material</span>
                        <span>Specification</span>
                        <span className="text-right">Amount</span>
                        <span />
                      </div>
                      {/* Rows scroll (scrollbar hidden) once there are more than
                          4 materials — the panel height stays fixed at ~4 rows. */}
                      <div className="space-y-1.5 max-h-[136px] overflow-y-auto scroll-hidden-bar">
                      {mats.map((m, mIdx) => {
                        const amt = matAmount(m, mIdx);
                        return (
                          <div
                            key={mIdx}
                            className="grid grid-cols-[1fr_1.3fr_92px_28px] gap-2 items-stretch"
                          >
                            <div className="bg-white border border-bordergray rounded-lg px-2 py-1.5 text-[11px] font-medium text-textcolor truncate">
                              {m.name || "—"}
                            </div>
                            <div className="bg-white border border-bordergray rounded-lg px-2 py-1.5 text-[11px] text-text-muted truncate">
                              {m.spec || "—"}
                            </div>
                            <div
                              className="bg-white border border-bordergray rounded-lg px-2 py-1.5 text-[11px] font-semibold text-textcolor tabular-nums text-right truncate"
                              title="Material amount from the rate build-up"
                            >
                              {amt > 0
                                ? `₹${Math.round(amt).toLocaleString("en-IN")}`
                                : "—"}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeMaterial(matPopover.idx, mIdx)}
                              title="Remove material"
                              className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          );
        })()}

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

      {scopeInfo && (
        <Modal
          title={
            scopeInfo.item.itemName ||
            scopeInfo.item.area ||
            "Scope details"
          }
          subtitle={`${scopeInfo.item.area || "Unassigned"}${
            activeConfig?.propertyType ? ` · ${activeConfig.propertyType}` : ""
          }`}
          maxWidth="max-w-[560px]"
          onClose={() => setScopeInfo(null)}
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const { idx } = scopeInfo;
                  setScopeInfo(null);
                  openEditScope(idx);
                }}
                className="px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-primary"
              >
                Edit scope
              </button>
              <button
                type="button"
                onClick={() => setScopeInfo(null)}
                className="px-3.5 py-2 rounded-lg border border-bordergray text-[12px] font-semibold text-text-muted hover:bg-bg-soft"
              >
                Close
              </button>
            </div>
          }
        >
          {(() => {
            const s = scopeInfo.item;
            const hasDimensions =
              Number(s.length) > 0 ||
              Number(s.breadth) > 0 ||
              Number(s.height) > 0;
            const qtyLabel = `${Number(s.qty || 0).toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}${s.unit ? ` ${s.unit}` : ""}`;
            // Compact metadata pairs — only the ones with a value are shown.
            const meta = [
              {
                label: "Grade",
                value: s.grade ? (
                  <span
                    className={`inline-flex items-center text-[9.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${gradeChipStyle(
                      s.grade,
                    )}`}
                  >
                    {gradeLabel(s.grade)}
                  </span>
                ) : null,
              },
              {
                label: "Est. days",
                value:
                  s.days !== "" && s.days != null ? `${s.days} days` : null,
              },
              { label: "HSN", value: s.hsn || null },
              {
                label: "Dimensions",
                value: hasDimensions
                  ? `${s.length || 0} × ${s.breadth || 0} × ${s.height || 0}`
                  : null,
              },
            ].filter((m) => m.value);

            // Ordered rows for the spec table — quantity/rate lead, then
            // descriptive attributes. Empty values are dropped.
            const rows = [
              { label: "Quantity", value: qtyLabel },
              {
                label: "Rate",
                value: `${formatAmount(s.rate)}${s.unit ? ` / ${s.unit}` : ""}`,
              },
              ...meta.map((m) => ({ label: m.label, value: m.value })),
            ].filter((r) => r.value);

            return (
              <div className="space-y-5">
                {s.description && (
                  <p className="text-[12.5px] text-textcolor leading-relaxed">
                    {s.description}
                  </p>
                )}

                {/* Spec sheet — key/value rows with an emphasized total footer */}
                <div className="rounded-xl border border-bordergray overflow-hidden">
                  <dl>
                    {rows.map((r) => (
                      <div
                        key={r.label}
                        className="flex items-center justify-between gap-4 px-4 py-2.5 border-b border-bordergray"
                      >
                        <dt className="text-[11.5px] text-text-muted">
                          {r.label}
                        </dt>
                        <dd className="text-[12.5px] font-semibold text-textcolor tabular-nums text-right">
                          {r.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-active-bg/60">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-select-blue">
                      Total Amount
                    </span>
                    <span className="text-[16px] font-bold text-select-blue tabular-nums">
                      {formatAmount(s.amount)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
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
// Stats banner hidden per request — kept for future use.
// const BentoStat = ({ icon, label, value, tint }) => {
//   const tints = {
//     blue: "from-blue-50 to-white text-blue-600 border-blue-100",
//     purple: "from-purple-50 to-white text-purple-600 border-purple-100",
//     orange: "from-orange-50 to-white text-orange-600 border-orange-100",
//     emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-100",
//   };
//   return (
//     <div
//       className={`relative bg-linear-to-br ${tints[tint]} border rounded-xl p-3 overflow-hidden`}
//     >
//       <div className="flex items-center justify-between mb-1">
//         <span className="opacity-80">{icon}</span>
//         <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">
//           {label}
//         </span>
//       </div>
//       <p className="text-[18px] font-bold text-textcolor tabular-nums leading-tight">
//         {value}
//       </p>
//     </div>
//   );
// };

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