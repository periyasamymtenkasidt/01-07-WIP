import { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  Trash2,
  Printer,
  Send,
  Pipette,
  Save,
  ListPlus,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Check,
  Scale,
  Truck,
  CreditCard,
  Wrench,
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  FileCheck,
} from "lucide-react";
import DestinationPromptModal from "./DestinationPromptModal";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import CategoryTermsModal from "./CategoryTermsModal";
import { getGlobalTerms, getTermsCategories } from "../data/termsStorage";
import Modal from "./Modal";
import InputField from "./InputField";
import MasterNavLink from "./MasterNavLink";
import {
  getDefaultTermStrings,
  getNonDefaultTermStrings,
} from "../data/termsStorage";

import {
  cleanSizeRange,
  validateSizeRangeInput,
  formatSizeRange,
} from "../utils/sizeRangeValidation";

const quoteRecipientSchema = yup.object().shape({
  recipientName: yup.string().trim(),
  recipientEmail: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
  sizeRange: yup.string().test("isValidSizeRange", function (value) {
    if (!value) return true;
    const errMsg = validateSizeRangeInput(value);
    if (errMsg) {
      return this.createError({ message: errMsg });
    }
    return true;
  }),
});
import QuotePreview from "./QuotePreview";
import {
  getPresetKeys,
  computeTotals,
  generateQuoteId,
  saveQuote,
  getConfigForType,
  getPropertyTypesForPreset,
  getQuotesForParent,
} from "../data/QuotePresets";
import {
  computeLibraryItemAmount,
  computeLibraryItemArea,
  listLibrary,
} from "../data/itemLibrary";
import {
  mapScopeItemsToGrade,
  mapScopeItemToGrade,
  gradeHasValue,
} from "../data/gradeMapping";
import { collectGrades, materialsById } from "../data/rateBuildup";
import { listMaterials } from "../data/materialLibrary";
import { formatAmount } from "../utils/formatAmount";
import {
  assignCategoryNames,
  normalizeScopeItem,
  getDetailedDescription,
  addScopeItemsWithDuplicateCheck,
  refreshScopeItemsFromMaster,
  getCategoryKey,
  getCategoryFromItemName,
  getHeadingCategoryKey,
} from "../utils/scopeNaming";
import { roomColor } from "../data/categoryColors";
import CategorySelect from "./CategorySelect";
import LibraryPickerModal from "./LibraryPickerModal";
import { getRoomDefaultDays } from "../data/scheduleConfig";
import { getProposalRoomPresets } from "../data/proposalRooms";

const SectionHeader = ({ children }) => (
  <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-select-blue mb-3">
    <span className="w-0.5 h-3.5 bg-select-blue rounded-full shrink-0" />
    {children}
  </h2>
);

// ── Custom Premium Checkbox ─────────────────────────────────────────────────
const CustomCheckbox = ({
  checked,
  onChange,
  accent = "green",
  size = "normal",
}) => {
  const isGreen = accent === "green";
  const sizeClasses = size === "small" ? "h-3.5 w-3.5" : "h-4 w-4";
  const checkSize = size === "small" ? 9 : 11;
  const strokeW = size === "small" ? 3.5 : 3;

  return (
    <div className="relative inline-flex items-center">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onChange}
      />
      <div
        className={`shrink-0 rounded flex items-center justify-center border transition-all duration-200 cursor-pointer ${sizeClasses} ${
          checked
            ? isGreen
              ? "bg-emerald-600 border-emerald-600 hover:bg-emerald-700/90 text-white shadow-sm"
              : "bg-red-500/80 hover:bg-red-500 border-red-500/50 text-white shadow-sm"
            : "bg-white border-slate-300 text-transparent hover:border-slate-400"
        }`}
      >
        <Check size={checkSize} strokeWidth={strokeW} className="shrink-0" />
      </div>
    </div>
  );
};

// ── Multi-select Searchable Dropdown ────────────────────────────────────────
// Reusable dropdown with inline search + checkbox selection for picking terms.
// Renders outside the modal via React Portal with real-time screen positioning.
const MultiSelectDropdown = ({
  label,
  items,
  selected,
  onToggle,
  accent = "green",
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      const clickedTrigger = ref.current && ref.current.contains(e.target);
      const clickedDropdown =
        dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!clickedTrigger && !clickedDropdown) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Update position coordinates on resize or modal scroll
  useEffect(() => {
    if (open) {
      updateCoords();
      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, true);
    }
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords, true);
    };
  }, [open]);

  // Auto-focus the input when dropdown opens
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = items.filter((t) =>
    t.toLowerCase().includes(search.toLowerCase()),
  );

  const borderColor =
    accent === "green" ? "border-emerald-400" : "border-red-400";
  const labelColor = accent === "green" ? "text-emerald-700" : "text-red-600";

  if (items.length === 0) return null;

  const placeholder =
    selected.length > 0
      ? `${selected.length} item${selected.length > 1 ? "s" : ""} selected`
      : "Select items…";

  return (
    <div ref={ref} className="relative">
      <label
        className={`text-[10px] font-bold uppercase tracking-widest ${labelColor} mb-1 block`}
      >
        {label}
      </label>
      {/* Inline search trigger — click or type to open and filter */}
      <div
        ref={triggerRef}
        className={`w-full flex items-center bg-white border ${
          open ? borderColor : "border-bordergray"
        } rounded-lg px-3 py-2 transition-all hover:border-select-blue/40 cursor-text`}
        onClick={() => {
          if (!open) setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            if (!open) setOpen(true);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-[11px] text-textcolor focus:outline-none placeholder:text-text-muted min-w-0"
        />
        <ChevronDown
          size={13}
          className={`text-text-subtle shrink-0 transition-transform cursor-pointer ${
            open ? "rotate-180" : ""
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((p) => !p);
            setSearch("");
          }}
        />
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: `${coords.top + 4}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 9999,
            }}
            className="bg-white border border-bordergray rounded-lg shadow-lg max-h-[220px] flex flex-col animate-[fadeIn_0.15s_ease-out]"
          >
            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1 scroll-hidden-bar">
              {filtered.length === 0 ? (
                <p className="text-[11px] text-text-subtle italic text-center py-3">
                  No matching items.
                </p>
              ) : (
                <>
                  {/* Select / Deselect all filtered */}
                  <label className="flex items-center gap-2 cursor-pointer px-1 py-1 rounded hover:bg-bg-soft group">
                    <CustomCheckbox
                      accent={accent}
                      checked={
                        filtered.length > 0 &&
                        filtered.every((i) => selected.includes(i))
                      }
                      onChange={() => {
                        const allChecked = filtered.every((i) =>
                          selected.includes(i),
                        );
                        filtered.forEach((item) => {
                          const isSelected = selected.includes(item);
                          if (allChecked && isSelected) onToggle(item);
                          if (!allChecked && !isSelected) onToggle(item);
                        });
                        // Auto-close dropdown after toggling "All"
                        setOpen(false);
                        setSearch("");
                      }}
                    />
                    <span className="text-[10px] font-semibold text-text-muted group-hover:text-textcolor transition-colors">
                      All
                    </span>
                  </label>
                  {filtered.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2 cursor-pointer px-1 py-1 rounded hover:bg-bg-soft group"
                    >
                      <CustomCheckbox
                        accent={accent}
                        checked={selected.includes(item)}
                        onChange={() => onToggle(item)}
                      />
                      <span className="text-[11px] text-text-muted group-hover:text-textcolor transition-colors leading-tight pt-0.5">
                        {item}
                      </span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

const getCategoriesMeta = () => {
  return getTermsCategories().map((c) => ({
    id: c.id,
    label: c.label,
    icon: FileCheck,
  }));
};

const getCategoriesList = () => getTermsCategories().map((c) => c.id);

const buildInitialFormData = ({
  presetKey,
  recipient,
  defaultPropertyType,
  initialQuote,
  presetData,
}) => {
  const presetKeys = getPresetKeys();
  const defaultTerms = getDefaultTermStrings();

  // If initialQuote is present, we still load the latest inquiry/master data,
  // but preserve identity fields like quoteId and createdAt.
  const activePresetKey =
    presetKey ||
    (presetData?.presetKey && presetKeys.includes(presetData.presetKey)
      ? presetData.presetKey
      : initialQuote?.presetKey || presetKeys[0] || "2BHK");
  const activePropertyType =
    presetData?.propertyType ||
    initialQuote?.propertyType ||
    defaultPropertyType ||
    "";

  const cfg = getConfigForType(activePresetKey, activePropertyType) || {};

  const quoteId = initialQuote?.quoteId || generateQuoteId();
  const createdAt = initialQuote?.createdAt || new Date().toISOString();

  // Load scope items: prefer initialQuote's saved scopeItems, then presetData's scopeItems,
  // and fallback to the master config configuration.
  let scopeItems = initialQuote?.scopeItems
    ? initialQuote.scopeItems.map((s) =>
        normalizeScopeItem({
          ...s,
          materials: s.materials ? s.materials.map((m) => ({ ...m })) : [],
        }),
      )
    : presetData?.scopeItems
      ? presetData.scopeItems.map((s) =>
          normalizeScopeItem({
            ...s,
            materials: s.materials ? s.materials.map((m) => ({ ...m })) : [],
          }),
        )
      : (cfg.scopeItems || []).map((s) =>
          normalizeScopeItem({
            ...s,
            materials: s.materials ? s.materials.map((m) => ({ ...m })) : [],
          }),
        );

  scopeItems = refreshScopeItemsFromMaster(
    scopeItems,
    activePresetKey,
    activePropertyType,
  );
  const activeGrade =
    initialQuote?.grade || presetData?.grade || cfg.grade || "premium";
  // Preserve an already-sent quote exactly on resend. New proposal/sample data
  // gets each scope mapped to its OWN grade (grade is chosen per scope item),
  // falling back to the preset grade for any item without one.
  if (!initialQuote) {
    scopeItems = scopeItems.map((s) =>
      mapScopeItemToGrade(s, s.grade || activeGrade),
    );
  }

  // Load inclusions/exclusions per category with legacy support
  const categoryInclusions = {};
  const categoryExclusions = {};
  const addedInclusions = {};
  const addedExclusions = {};
  const categoriesList = getCategoriesList();

  categoriesList.forEach((cat) => {
    const global = getGlobalTerms(cat);
    const defaultIn = global.inclusions
      .filter((t) => t.isDefault)
      .map((t) => t.text);
    const defaultEx = global.exclusions
      .filter((t) => t.isDefault)
      .map((t) => t.text);

    if (initialQuote?.categoryInclusions?.[cat]) {
      categoryInclusions[cat] = [...initialQuote.categoryInclusions[cat]];
    } else {
      if (initialQuote?.inclusions) {
        const catGlobalIntexts = global.inclusions.map((t) => t.text);
        categoryInclusions[cat] = initialQuote.inclusions.filter((text) =>
          catGlobalIntexts.includes(text),
        );
      } else if (presetData?.categoryInclusions?.[cat]) {
        categoryInclusions[cat] = [...presetData.categoryInclusions[cat]];
      } else if (presetData?.inclusions) {
        const catGlobalIntexts = global.inclusions.map((t) => t.text);
        categoryInclusions[cat] = presetData.inclusions.filter((text) =>
          catGlobalIntexts.includes(text),
        );
      } else {
        categoryInclusions[cat] = defaultIn;
      }
    }

    if (initialQuote?.categoryExclusions?.[cat]) {
      categoryExclusions[cat] = [...initialQuote.categoryExclusions[cat]];
    } else {
      if (initialQuote?.exclusions) {
        const catGlobalExtexts = global.exclusions.map((t) => t.text);
        categoryExclusions[cat] = initialQuote.exclusions.filter((text) =>
          catGlobalExtexts.includes(text),
        );
      } else if (presetData?.categoryExclusions?.[cat]) {
        categoryExclusions[cat] = [...presetData.categoryExclusions[cat]];
      } else if (presetData?.exclusions) {
        const catGlobalExtexts = global.exclusions.map((t) => t.text);
        categoryExclusions[cat] = presetData.exclusions.filter((text) =>
          catGlobalExtexts.includes(text),
        );
      } else {
        categoryExclusions[cat] = defaultEx;
      }
    }

    // Initialize addedInclusions / addedExclusions
    if (initialQuote?.addedInclusions?.[cat]) {
      addedInclusions[cat] = [...initialQuote.addedInclusions[cat]];
    } else if (presetData?.addedInclusions?.[cat]) {
      addedInclusions[cat] = [...presetData.addedInclusions[cat]];
    } else {
      const currentIn = categoryInclusions[cat] || [];
      addedInclusions[cat] = currentIn.filter(
        (item) => !defaultIn.includes(item),
      );
    }

    if (initialQuote?.addedExclusions?.[cat]) {
      addedExclusions[cat] = [...initialQuote.addedExclusions[cat]];
    } else if (presetData?.addedExclusions?.[cat]) {
      addedExclusions[cat] = [...presetData.addedExclusions[cat]];
    } else {
      const currentEx = categoryExclusions[cat] || [];
      addedExclusions[cat] = currentEx.filter(
        (item) => !defaultEx.includes(item),
      );
    }
  });

  const flatIn = [];
  const flatEx = [];
  categoriesList.forEach((cat) => {
    flatIn.push(...(categoryInclusions[cat] || []));
    flatEx.push(...(categoryExclusions[cat] || []));
  });

  return {
    quoteId,
    createdAt,
    recipientName: recipient?.name || initialQuote?.recipientName || "",
    recipientEmail: recipient?.email || initialQuote?.recipientEmail || "",
    recipientPhone: recipient?.phone || initialQuote?.recipientPhone || "",
    propertyType: activePropertyType,
    grade: activeGrade,
    sizeRange: cleanSizeRange(
      presetData?.sizeRange || cfg.sizeRange || initialQuote?.sizeRange || "",
    ),
    validityDays: presetData?.validityDays || initialQuote?.validityDays || 30,
    scopeItems,
    inclusions: flatIn,
    exclusions: flatEx,
    categoryInclusions,
    categoryExclusions,
    addedInclusions,
    addedExclusions,
    notes: presetData?.notes || initialQuote?.notes || "",
  };
};

// Pick the best preset to display in the dropdown given an already-loaded
// quote — first try the preset stored on the inquiry, then the quote, then the first available.
const inferPresetKey = (initialQuote, presetData) => {
  const keys = getPresetKeys();
  if (presetData?.presetKey && keys.includes(presetData.presetKey))
    return presetData.presetKey;
  if (initialQuote?.presetKey && keys.includes(initialQuote.presetKey))
    return initialQuote.presetKey;
  return keys.includes("2BHK") ? "2BHK" : keys[0];
};

const EditableItemNameInput = ({ initialValue, onSave, className }) => {
  const [localValue, setLocalValue] = useState(initialValue);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    if (localValue !== initialValue) {
      onSave(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
  };

  return (
    <input
      type="text"
      value={localValue || ""}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="Item Name…"
      className={className}
    />
  );
};

// `mode` controls labelling only — "proposal" tweaks copy + button so this
// modal can be reused for the "Send Proposal" / "Resend Proposal" flow on a
// lead. Default "quote" keeps the standalone Quick Quote behaviour.
const QuoteModal = ({
  parentId,
  parentType,
  recipient,
  defaultPropertyType,
  initialQuote,
  presetData,
  mode = "quote",
  onClose,
  onSent,
}) => {
  const isProposal = mode === "proposal";
  const isResend = !!initialQuote;
  // The mapped scope of work is read-only only when first sending a proposal.
  // On resend it's editable again so the quote can be revised.
  const lockScope = isProposal && !isResend;
  const [presetKey, setPresetKey] = useState(() =>
    inferPresetKey(initialQuote, presetData),
  );
  const [formData, setFormData] = useState(() =>
    buildInitialFormData({
      presetKey: inferPresetKey(initialQuote, presetData),
      recipient,
      defaultPropertyType,
      initialQuote,
      presetData,
    }),
  );

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const [deleteGroupConfirm, setDeleteGroupConfirm] = useState(null);
  const handleDeleteGroup = (roomName) => {
    setFormData((p) => ({
      ...p,
      scopeItems: p.scopeItems.filter(
        (s) =>
          (s.area || "").trim().toUpperCase() !== roomName.trim().toUpperCase(),
      ),
    }));
    setDeleteGroupConfirm(null);
    showToast(`Deleted "${roomName}" group`, "info");
  };

  const [destPrompt, setDestPrompt] = useState({
    isOpen: false,
    itemName: "",
    existingHeadings: [],
    headingsWithItem: [],
    onSelect: null,
    onCreateNew: null,
    onCancel: null,
  });

  const getDestinationHeading = (itemName, scopeItems, category) => {
    return new Promise((resolve, reject) => {
      const resolvedCategory = category || getCategoryFromItemName(itemName);

      // Get ALL headings from the Proposal rooms list (all room presets)
      const scheduleHeadingNames = getProposalRoomPresets().map((r) =>
        r.name.trim().toUpperCase(),
      );

      // Collect ALL existing headings from scope items (not filtered by category)
      const existingHeadings = Array.from(
        new Set(
          scopeItems.map((item) =>
            (item.area || item.heading || "Unassigned").trim().toUpperCase(),
          ),
        ),
      );

      // Combine and deduplicate
      const allHeadings = Array.from(
        new Set([...scheduleHeadingNames, ...existingHeadings]),
      );

      // Informational only — not used to hide headings
      const headingsWithItem = scopeItems
        .filter(
          (item) =>
            (item.itemName || "").trim().toLowerCase() ===
            itemName.trim().toLowerCase(),
        )
        .map((item) =>
          (item.area || item.heading || "Unassigned").trim().toUpperCase(),
        );

      setDestPrompt({
        isOpen: true,
        itemName,
        category: resolvedCategory,
        existingHeadings: allHeadings,
        headingsWithItem,
        onSelect: (selectedHeading) => {
          setDestPrompt((prev) => ({ ...prev, isOpen: false }));
          resolve(selectedHeading);
        },
        onCreateNew: (newHeading) => {
          setDestPrompt((prev) => ({ ...prev, isOpen: false }));
          resolve(newHeading);
        },
        onCancel: () => {
          setDestPrompt((prev) => ({ ...prev, isOpen: false }));
          reject(new Error("Cancelled by user"));
        },
      });
    });
  };

  // Dynamic terms from the global Terms & Conditions master.
  // Only default items are auto-displayed; non-defaults are added via modal.
  const [termOptions, setTermOptions] = useState(() => {
    const defaults = getDefaultTermStrings();
    return {
      inclusions: Array.from(
        new Set([
          ...(defaults.inclusions || []),
          ...(formData.inclusions || []),
        ]),
      ),
      exclusions: Array.from(
        new Set([
          ...(defaults.exclusions || []),
          ...(formData.exclusions || []),
        ]),
      ),
    };
  });

  // Modal state for dedicated category Terms & Conditions modals
  const [activeCategoryModal, setActiveCategoryModal] = useState(null);
  const [termsParentModalOpen, setTermsParentModalOpen] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState(() => {
    const cats = getTermsCategories();
    const initial = {};
    cats.forEach((c) => {
      initial[c.id] = false;
    });
    return initial;
  });

  const [openGroups, setOpenGroups] = useState({});
  const toggleGroup = (room) => {
    setOpenGroups((prev) => ({ ...prev, [room]: !prev[room] }));
  };
  const isGroupOpen = (room) => openGroups[room] !== false;

  const groupedScope = useMemo(() => {
    const groups = [];
    const byRoom = new Map();
    const namedItems = assignCategoryNames(formData.scopeItems || []);
    namedItems.forEach((item, idx) => {
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
  }, [formData.scopeItems]);

  // react-hook-form for recipient validation
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    formState: { errors },
    setValue: rhfSetValue,
    watch,
  } = useForm({
    resolver: yupResolver(quoteRecipientSchema),
    defaultValues: {
      recipientName: formData.recipientName,
      recipientEmail: formData.recipientEmail,
      sizeRange: cleanSizeRange(formData.sizeRange),
    },
  });

  const watchedSizeRange = watch("sizeRange");

  const [isSending, setIsSending] = useState(false);
  // Controls the library picker modal for "Pick from Library" flow.
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  const totals = useMemo(
    () => computeTotals(formData.scopeItems),
    [formData.scopeItems],
  );
  const gradeOptions = useMemo(() => collectGrades(listLibrary()), []);

  // Per scope row, the set of grade keys that actually carry a value (a recipe
  // computing to a rate > 0). The grade dropdown only offers these, so a grade
  // with no value for a row is hidden for that row alone.
  const gradeKeysByIdx = useMemo(() => {
    const library = listLibrary();
    const materialLookup = materialsById(listMaterials());
    return (formData.scopeItems || []).map(
      (item) =>
        new Set(
          gradeOptions
            .filter((g) =>
              gradeHasValue(item, g.key, { library, materialLookup }),
            )
            .map((g) => g.key),
        ),
    );
  }, [formData.scopeItems, gradeOptions]);

  // Grade is chosen per scope item: re-map only the targeted row to the new
  // grade (rate, materials & amount), leaving every other row untouched.
  const handleScopeGradeChange = (idx, grade) => {
    setFormData((prev) => ({
      ...prev,
      scopeItems: prev.scopeItems.map((s, i) =>
        i === idx ? mapScopeItemToGrade(s, grade) : s,
      ),
    }));
  };

  // Resend guardrail: the revised total can't drift more than MAX_INCREASE_PCT
  // above the ORIGINAL proposal (the first one ever sent for this lead, not
  // just the latest) — otherwise the client is being re-quoted a materially
  // different price under the same "proposal" without a fresh negotiation.
  const MAX_INCREASE_PCT = 20;
  const originalQuote = useMemo(() => {
    if (!isResend || !parentId) return null;
    const history = getQuotesForParent(parentId);
    return history[history.length - 1] || null;
  }, [isResend, parentId]);
  const originalTotal = originalQuote?.grandTotal || 0;
  const increasePct = originalTotal
    ? ((totals.grandTotal - originalTotal) / originalTotal) * 100
    : 0;
  const overLimit = originalTotal > 0 && increasePct > MAX_INCREASE_PCT;

  const handlePresetChange = (e) => {
    const key = e.target.value;
    setPresetKey(key);
    const cfg = getConfigForType(key);
    if (!cfg) return;

    const categoryInclusions = {};
    const categoryExclusions = {};
    const addedInclusions = {};
    const addedExclusions = {};
    const categoriesList = getCategoriesList();
    categoriesList.forEach((cat) => {
      const global = getGlobalTerms(cat);
      categoryInclusions[cat] = global.inclusions
        .filter((t) => t.isDefault)
        .map((t) => t.text);
      categoryExclusions[cat] = global.exclusions
        .filter((t) => t.isDefault)
        .map((t) => t.text);
      addedInclusions[cat] = [];
      addedExclusions[cat] = [];
    });
    const flatIn = [];
    const flatEx = [];
    categoriesList.forEach((cat) => {
      flatIn.push(...(categoryInclusions[cat] || []));
      flatEx.push(...(categoryExclusions[cat] || []));
    });

    rhfSetValue("sizeRange", cleanSizeRange(cfg.sizeRange), {
      shouldValidate: true,
    });
    setFormData((prev) => ({
      ...prev,
      propertyType: cfg.propertyType,
      sizeRange: cleanSizeRange(cfg.sizeRange),
      scopeItems: mapScopeItemsToGrade(
        (cfg.scopeItems || []).map((s) =>
          normalizeScopeItem({
            ...s,
            materials: s.materials ? s.materials.map((m) => ({ ...m })) : [],
          }),
        ),
        null,
      ),
      inclusions: flatIn,
      exclusions: flatEx,
      categoryInclusions,
      categoryExclusions,
      addedInclusions,
      addedExclusions,
    }));
    setTermOptions({
      inclusions: flatIn,
      exclusions: flatEx,
    });
  };

  const handlePropertyTypeChange = (e) => {
    const newType = e.target.value;
    const cfg = getConfigForType(presetKey, newType);
    if (!cfg) {
      updateField("propertyType", newType);
      return;
    }

    const categoryInclusions = {};
    const categoryExclusions = {};
    const addedInclusions = {};
    const addedExclusions = {};
    const categoriesList = getCategoriesList();
    categoriesList.forEach((cat) => {
      const global = getGlobalTerms(cat);
      categoryInclusions[cat] = global.inclusions
        .filter((t) => t.isDefault)
        .map((t) => t.text);
      categoryExclusions[cat] = global.exclusions
        .filter((t) => t.isDefault)
        .map((t) => t.text);
      addedInclusions[cat] = [];
      addedExclusions[cat] = [];
    });
    const flatIn = [];
    const flatEx = [];
    categoriesList.forEach((cat) => {
      flatIn.push(...(categoryInclusions[cat] || []));
      flatEx.push(...(categoryExclusions[cat] || []));
    });

    rhfSetValue("sizeRange", cleanSizeRange(cfg.sizeRange), {
      shouldValidate: true,
    });
    setFormData((prev) => ({
      ...prev,
      propertyType: cfg.propertyType,
      sizeRange: cleanSizeRange(cfg.sizeRange),
      scopeItems: mapScopeItemsToGrade(
        (cfg.scopeItems || []).map((s) =>
          normalizeScopeItem({
            ...s,
            materials: s.materials ? s.materials.map((m) => ({ ...m })) : [],
          }),
        ),
        null,
      ),
      inclusions: flatIn,
      exclusions: flatEx,
      categoryInclusions,
      categoryExclusions,
      addedInclusions,
      addedExclusions,
    }));
    setTermOptions({
      inclusions: flatIn,
      exclusions: flatEx,
    });
  };

  const getActiveCatCount = (cat) => {
    const incs = formData.categoryInclusions?.[cat] || [];
    const excs = formData.categoryExclusions?.[cat] || [];
    return incs.length + excs.length;
  };

  const updateField = (name, value) => {
    setFormData((p) => ({ ...p, [name]: value }));
    // Sync with react-hook-form for validated fields
    if (name === "recipientName" || name === "recipientEmail") {
      rhfSetValue(name, value, { shouldValidate: true });
    }
  };

  const toggleInclusion = (item, forcedCat = null) => {
    const categoriesList = getCategoriesList();
    let foundCat = forcedCat;
    if (!foundCat) {
      foundCat = "GENERAL";
      for (const cat of categoriesList) {
        const global = getGlobalTerms(cat);
        if (global.inclusions.some((t) => t.text === item)) {
          foundCat = cat;
          break;
        }
      }
    }

    setFormData((prev) => {
      const prevCatIn = prev.categoryInclusions?.[foundCat] || [];
      const nextCatIn = prevCatIn.includes(item)
        ? prevCatIn.filter((i) => i !== item)
        : [...prevCatIn, item];

      const updatedCatIn = {
        ...prev.categoryInclusions,
        [foundCat]: nextCatIn,
      };

      const flatIn = [];
      categoriesList.forEach((cat) => {
        flatIn.push(...(updatedCatIn[cat] || []));
      });

      return {
        ...prev,
        inclusions: flatIn,
        categoryInclusions: updatedCatIn,
      };
    });
  };

  const toggleExclusion = (item, forcedCat = null) => {
    const categoriesList = getCategoriesList();
    let foundCat = forcedCat;
    if (!foundCat) {
      foundCat = "GENERAL";
      for (const cat of categoriesList) {
        const global = getGlobalTerms(cat);
        if (global.exclusions.some((t) => t.text === item)) {
          foundCat = cat;
          break;
        }
      }
    }

    setFormData((prev) => {
      const prevCatEx = prev.categoryExclusions?.[foundCat] || [];
      const nextCatEx = prevCatEx.includes(item)
        ? prevCatEx.filter((e) => e !== item)
        : [...prevCatEx, item];

      const updatedCatEx = {
        ...prev.categoryExclusions,
        [foundCat]: nextCatEx,
      };

      const flatEx = [];
      categoriesList.forEach((cat) => {
        flatEx.push(...(updatedCatEx[cat] || []));
      });

      return {
        ...prev,
        exclusions: flatEx,
        categoryExclusions: updatedCatEx,
      };
    });
  };

  const updateScope = (idx, key, value) => {
    setFormData((p) => {
      // Check for duplicate heading if changing the area/heading field
      if (key === "area") {
        const item = p.scopeItems[idx];
        const newHeading = value.trim().toUpperCase();
        const duplicateExists = p.scopeItems.some((s, i) => {
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
          return p;
        }
      }

      const nextItems = p.scopeItems.map((s, i) => {
        if (i !== idx) return s;

        let target = { ...s, [key]: value };

        if (key === "description") {
          target.isDescriptionCustom = true;
        }
        if (key === "area") {
          target.isAreaCustom = true;
        }
        if (key === "itemName") {
          target.isItemNameCustom = true;
        }

        if (
          key === "length" ||
          key === "breadth" ||
          key === "qty" ||
          key === "rate"
        ) {
          const L = Number(target.length) || 0;
          const B = Number(target.breadth) || 0;
          target.calculatedArea = L * B;

          const userQty = target.qty !== "" ? Number(target.qty) : 0;
          const qtyToUse = userQty > 0 ? userQty : target.calculatedArea;
          const rateToUse = Number(target.rate) || 0;
          target.amount = Math.round(qtyToUse * rateToUse);
        }

        return target;
      });
      return { ...p, scopeItems: nextItems };
    });
  };

  // Handler for direct library picker — maps library item to scope row shape.
  const handleLibraryPick = async (lib) => {
    try {
      const itemName = lib.description || "";
      const heading = await getDestinationHeading(
        itemName,
        formData.scopeItems,
        lib.category,
      );

      // Seed the schedule duration: prefer the item's own days, else fall back to
      // the default configured for its room category (Master → Schedule).
      const days =
        lib.days != null && lib.days !== ""
          ? lib.days
          : getRoomDefaultDays(lib.category);
      // New works carry no separate spec, so use the materials as the
      // customer-facing description (kept editable). isDescriptionCustom stops
      // the normalizer from clearing it.
      const matSummary = (lib.materials || [])
        .map((m) => m.name)
        .filter(Boolean)
        .join(", ");
      const norm = normalizeScopeItem({
        area: heading,
        itemName: lib.description || "",
        description: lib.spec || matSummary || "",
        isDescriptionCustom: true,
      });
      const newRow = {
        ...norm,
        // Flag rows the user pulled in via "Pick from Library" so they stay
        // editable even during a first proposal send, where the preset-mapped
        // scope is otherwise locked.
        _userAdded: true,
        length: lib.length != null ? Number(lib.length) : "",
        breadth: lib.breadth != null ? Number(lib.breadth) : "",
        height: lib.height != null ? Number(lib.height) : "",
        calculatedArea: computeLibraryItemArea(lib) || 0,
        qty: lib.qty != null ? Number(lib.qty) : "",
        rate: lib.rate != null ? Number(lib.rate) : "",
        // Library works are priced per unit with no default qty, so the computed
        // amount is 0 — fall back to the unit rate so the price shows.
        amount: computeLibraryItemAmount(lib) || Number(lib.rate) || 0,
        unit: lib.unit || "sqft",
        days,
        materials: lib.materials ? lib.materials.map((m) => ({ ...m })) : [],
      };
      setFormData((p) => ({
        ...p,
        scopeItems: addScopeItemsWithDuplicateCheck(p.scopeItems, [newRow]),
      }));
      setLibraryPickerOpen(false);
    } catch (err) {
      setLibraryPickerOpen(false);
    }
  };

  const removeScopeRow = (idx) => {
    setFormData((p) => ({
      ...p,
      scopeItems: p.scopeItems.filter((_, i) => i !== idx),
    }));
  };

  const updateMaterial = (scopeIdx, matIdx, key, value) => {
    setFormData((p) => ({
      ...p,
      scopeItems: p.scopeItems.map((s, i) =>
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

  const removeMaterial = (scopeIdx, matIdx) => {
    setFormData((p) => ({
      ...p,
      scopeItems: p.scopeItems.map((s, i) =>
        i === scopeIdx
          ? {
              ...s,
              materials: (s.materials || []).filter((_, j) => j !== matIdx),
            }
          : s,
      ),
    }));
  };

  const buildQuote = (overrides = {}) => ({
    quoteId: formData.quoteId,
    parentId,
    parentType,
    presetKey,
    recipientName: overrides.recipientName ?? formData.recipientName,
    recipientEmail: overrides.recipientEmail ?? formData.recipientEmail,
    recipientPhone: formData.recipientPhone,
    propertyType: formData.propertyType,
    grade: formData.grade || "premium",
    sizeRange: cleanSizeRange(overrides.sizeRange ?? watchedSizeRange ?? ""),
    validityDays: Number(formData.validityDays) || 30,
    scopeItems: formData.scopeItems,
    inclusions: formData.inclusions,
    exclusions: formData.exclusions,
    categoryInclusions: formData.categoryInclusions,
    categoryExclusions: formData.categoryExclusions,
    addedInclusions: formData.addedInclusions,
    addedExclusions: formData.addedExclusions,
    notes: formData.notes,
    createdAt: formData.createdAt,
    subtotal: totals.subtotal,
    gst: totals.gst,
    grandTotal: totals.grandTotal,
    status: "draft",
    ...overrides,
  });

  const handleSaveDraft = () => {
    if (!parentId) return;
    saveQuote(parentId, buildQuote());
    onClose?.();
  };

  const handlePrint = async () => {
    try {
      const quote = buildQuote();
      const { createRoot } = await import("react-dom/client");
      const { flushSync } = await import("react-dom");

      // 1. Create a temporary container directly on body
      let printContainer = document.getElementById(
        "quote-print-temp-container",
      );
      if (!printContainer) {
        printContainer = document.createElement("div");
        printContainer.id = "quote-print-temp-container";
        document.body.appendChild(printContainer);
      }

      // 2. Render QuotePreview into the temporary container
      const root = createRoot(printContainer);
      flushSync(() => {
        root.render(<QuotePreview quote={quote} />);
      });

      // 3. Set printing class on body to isolate the container and hide the rest
      document.body.classList.add("printing-quote-mode");

      // 4. Set up safe, once-callable cleanup after print dialog closes
      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;

        try {
          document.body.classList.remove("printing-quote-mode");
        } catch (e) {}
        try {
          window.removeEventListener("afterprint", cleanup);
        } catch (e) {}
        try {
          root.unmount();
        } catch (e) {}
        try {
          printContainer.remove();
        } catch (e) {}
      };

      // Register listener BEFORE triggering print dialog to avoid race conditions
      window.addEventListener("afterprint", cleanup);

      // 5. Trigger print
      window.print();

      // 6. Synchronous fallback: run cleanup immediately after print dialog returns (blocking call)
      cleanup();
    } catch (err) {
      console.error(
        "[QuoteModal] print failed, falling back to basic print:",
        err,
      );
      window.print();
    }
  };

  const handleSend = async (validatedData) => {
    // Also check scope items (not managed by react-hook-form)
    if (!formData.scopeItems?.length) {
      showToast("Add at least one scope item before sending.", "error");
      return;
    }
    if (overLimit) {
      showToast(
        `Total exceeds the original proposal by ${increasePct.toFixed(1)}% — over the ${MAX_INCREASE_PCT}% limit. Reduce the scope or get approval before resending.`,
        "error",
      );
      return;
    }
    const recipientName =
      validatedData.recipientName?.trim() ||
      formData.recipientName?.trim() ||
      "Client";
    const recipientEmail = validatedData.recipientEmail;
    const sizeRange = cleanSizeRange(
      validatedData.sizeRange || formData.sizeRange || "",
    );

    setIsSending(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      const sentAt = new Date().toISOString();
      const subjectPrefix = isProposal
        ? isResend
          ? "Revised proposal"
          : "Proposal"
        : "Quote";
      const subject = `${subjectPrefix} ${formData.quoteId} for your project — ${parentId}`;
      const body = `Hi ${formData.recipientName},\n\nPlease find attached our ${subjectPrefix.toLowerCase()} ${formData.quoteId} for your ${formData.propertyType} (${formData.sizeRange}). The grand total is ${formatAmount(totals.grandTotal)} (incl. GST). This quote is valid for ${formData.validityDays} days.\n\nLooking forward to your feedback.\n\n— Digital Atelier`;
      void body;
      const emailBody = `Hi ${recipientName},\n\nPlease find attached our ${subjectPrefix.toLowerCase()} ${formData.quoteId} for your ${formData.propertyType} (${sizeRange}). The grand total is ${formatAmount(totals.grandTotal)} (incl. GST). This quote is valid for ${formData.validityDays} days.\n\nLooking forward to your feedback.\n\n- Digital Atelier`;
      const quote = buildQuote({
        recipientName,
        recipientEmail,
        sizeRange,
        status: "sent",
        sentAt,
        subject,
        body: emailBody,
      });
      saveQuote(parentId, quote);
      setFormData((p) => ({
        ...p,
        recipientName,
        recipientEmail,
        sizeRange,
      }));
      try {
        onSent?.({
          quoteId: quote.quoteId,
          to: recipientEmail,
          subject,
          body: emailBody,
          total: totals.grandTotal,
          quote,
          isResend,
        });
      } catch (callbackErr) {
        console.error("[QuoteModal] post-send callback failed:", callbackErr);
      }
      onClose?.();
    } catch (err) {
      console.error("[QuoteModal] send failed:", err);
      const message =
        err?.name === "QuotaExceededError"
          ? "Browser storage is full — could not save this quote. Try clearing some old data and resend."
          : "Could not send the quote. Please try again.";
      showToast(message, "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleSendInvalid = (submitErrors) => {
    const firstError =
      submitErrors?.recipientEmail?.message ||
      submitErrors?.sizeRange?.message ||
      submitErrors?.recipientName?.message ||
      "Please fix the highlighted fields before sending.";
    showToast(firstError, "error");
  };

  // Live Preview only: tag each scope item's name with its quality grade in
  // shorthand brackets — two letters from each word (up to three words),
  // uppercased: "Luxury" → "(LU)", "Ultra Premium" → "(ULPR)". This is
  // preview-only — the sent/printed quote (which builds its own quote object)
  // is unaffected, and QuotePreview stays untouched (shared with the sample
  // quote).
  const gradeShorthand = (key) => {
    const label = gradeOptions.find((g) => g.key === key)?.label || key || "";
    if (!label) return "";
    return label
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .map((word) => word.slice(0, 2).toUpperCase())
      .join("");
  };
  const previewQuote = (() => {
    const base = buildQuote();
    return {
      ...base,
      scopeItems: (base.scopeItems || []).map((s) => {
        const short = gradeShorthand(s.grade);
        if (!short) return s;
        return {
          ...s,
          itemName: `${s.itemName || ""} (${short})`,
          // Keep the appended suffix through QuotePreview's master refresh.
          isItemNameCustom: true,
        };
      }),
    };
  })();

  const footer = (
    <div className="flex flex-wrap justify-between items-center gap-3 modal-no-print">
      <button
        type="button"
        onClick={onClose}
        disabled={isSending}
        className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-bg-soft transition-all disabled:opacity-50"
      >
        Cancel
      </button>
      <div className="flex flex-wrap items-center gap-3">
        {/* Save Draft only makes sense in standalone Quote mode — proposal
            mode is a single-shot send. */}
        {!isProposal && (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text hover:bg-bg-soft transition-all disabled:opacity-50"
          >
            <Save size={14} /> Save Draft
          </button>
        )}
        <button
          type="button"
          onClick={handlePrint}
          disabled={isSending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text hover:bg-bg-soft transition-all disabled:opacity-50"
        >
          <Printer size={14} /> Print / Save PDF
        </button>
        <button
          type="button"
          onClick={rhfHandleSubmit(handleSend, handleSendInvalid)}
          disabled={isSending}
          title={
            overLimit
              ? `Exceeds the original proposal by ${increasePct.toFixed(1)}% — over the ${MAX_INCREASE_PCT}% limit`
              : undefined
          }
          className={`min-w-[180px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-lg text-white text-sm font-medium shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed ${
            overLimit
              ? "bg-red-500 hover:bg-red-600"
              : "bg-select-blue hover:bg-primary"
          }`}
        >
          {isSending ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send size={14} />{" "}
              {isProposal
                ? isResend
                  ? "Resend Proposal"
                  : "Send Proposal"
                : "Send via Email"}
            </>
          )}
        </button>
      </div>
    </div>
  );

  const modalTitle = isProposal
    ? isResend
      ? "Resend Proposal"
      : "Send Proposal"
    : "Quick Quote";
  const modalSubtitle = isProposal
    ? isResend
      ? "Existing scope and pricing loaded. Edit, preview, and resend."
      : "Pick a preset, edit the scope, preview, then send via email."
    : "Pick a preset, edit the scope, then send or print.";

  return (
    <Modal
      title={modalTitle}
      subtitle={modalSubtitle}
      onClose={isSending ? undefined : onClose}
      footer={footer}
      maxWidth="max-w-[1300px]"
      maxHeight="h-[90vh]"
      bodyScrollable={false}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] gap-6 h-full min-h-0">
        {/* Form pane */}
        <div className="modal-no-print overflow-y-auto h-full pr-2 scroll-hidden-bar">
          {/* Preset is editable in standalone Quote mode but locked in
              Proposal mode (it was chosen during inquiry creation). */}
          {isProposal ? (
            <div className="mb-5">
              <SectionHeader>Property Preset</SectionHeader>
              <div className="rounded-xl border border-border bg-bg-soft px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-bold text-text">
                    {presetKey.replace(/^(\d+)(BHK)$/i, "$1 BHK")}
                    {formData.propertyType ? ` / ${formData.propertyType}` : ""}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {formatSizeRange(
                      formData.sizeRange ||
                        getConfigForType(presetKey, formData.propertyType)
                          ?.sizeRange,
                    )}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                  From inquiry
                </span>
              </div>
            </div>
          ) : (
            <div className="mb-5">
              <SectionHeader>Preset</SectionHeader>
              <InputField
                name="presetKey"
                label="Property Preset"
                type="select"
                value={presetKey}
                onChange={handlePresetChange}
                options={getPresetKeys()}
              />
              <p className="mt-2 text-[10px] text-text-muted">
                Switching presets reloads scope items. Existing edits will be
                lost.
              </p>
            </div>
          )}

          <div className="border-t border-border my-5" />

          {/* Recipient — proposal mode shows just the email; the standalone
              Quote mode keeps the full name/phone/email block. */}
          {isProposal ? (
            <div className="mb-5">
              <SectionHeader>Recipient Email</SectionHeader>
              <InputField
                name="recipientEmail"
                label="Email"
                type="email"
                register={register("recipientEmail")}
                onChange={(e) => updateField("recipientEmail", e.target.value)}
                error={errors.recipientEmail?.message}
                placeholder="example@domain.com"
              />
              <p className="mt-2 text-[10px] text-text-muted">
                Sample quotation will be sent to this address.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <SectionHeader>Recipient</SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    name="recipientName"
                    label="Name"
                    type="text"
                    register={register("recipientName")}
                    onChange={(e) =>
                      updateField("recipientName", e.target.value)
                    }
                    error={errors.recipientName?.message}
                    placeholder="Full name"
                  />
                  <InputField
                    name="recipientPhone"
                    label="Phone"
                    type="tel"
                    value={formData.recipientPhone}
                    onChange={(e) =>
                      updateField("recipientPhone", e.target.value)
                    }
                    placeholder="10-digit number"
                  />
                </div>
                <div className="mt-3">
                  <InputField
                    name="recipientEmail"
                    label="Email"
                    type="email"
                    register={register("recipientEmail")}
                    onChange={(e) =>
                      updateField("recipientEmail", e.target.value)
                    }
                    error={errors.recipientEmail?.message}
                    placeholder="example@domain.com"
                  />
                </div>
              </div>

              <div className="border-t border-border my-5" />

              <div className="mb-5">
                <SectionHeader>Property</SectionHeader>
                <div className="grid grid-cols-2 gap-3">
                  <InputField
                    name="propertyType"
                    label="Property Type"
                    type="select"
                    value={formData.propertyType}
                    onChange={handlePropertyTypeChange}
                    options={getPropertyTypesForPreset(presetKey)}
                  />
                  <InputField
                    name="sizeRange"
                    label="Size"
                    type="text"
                    register={register("sizeRange")}
                    error={errors.sizeRange?.message}
                    suffix="Sq Ft"
                    placeholder="e.g. 800-1100"
                  />
                </div>
                <div className="mt-3">
                  <InputField
                    name="validityDays"
                    label="Validity (days)"
                    type="number"
                    value={formData.validityDays}
                    onChange={(e) =>
                      updateField("validityDays", e.target.value)
                    }
                    placeholder="30"
                  />
                </div>
              </div>
            </>
          )}

          <div className="border-t border-border my-5" />

          <div className="mb-5">
            <div className="flex justify-between items-center mb-3">
              <SectionHeader>Scope of Work</SectionHeader>
              <button
                type="button"
                onClick={() => setLibraryPickerOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-select-blue/30 bg-active-bg/40 text-select-blue text-[11px] font-semibold hover:bg-active-bg transition-all -mt-3"
              >
                <Pipette size={12} /> Pick from Library
              </button>
            </div>
            {errors.scopeItems && (
              <p className="text-red-500 text-[10px] mb-2">
                {errors.scopeItems.message}
              </p>
            )}
            <div className="space-y-4">
              {groupedScope.map((group) => {
                const roomColorObj = roomColor(group.room.split(" ")[0]);
                const groupOpen = isGroupOpen(group.room);
                return (
                  <div
                    key={group.room}
                    className="border border-bordergray rounded-xl bg-white overflow-hidden shadow-sm"
                  >
                    {/* Accordion Header */}
                    <div className="w-full flex items-center justify-between px-3.5 py-2.5 bg-bg-soft/40 hover:bg-bg-soft/70 transition-colors border-b border-bordergray">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.room)}
                        className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer focus:outline-none"
                      >
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
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${roomColorObj.dot}`}
                        />
                        <h4 className="text-[12px] font-bold text-textcolor uppercase tracking-wide truncate">
                          {group.room}
                        </h4>
                        <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded-md border border-bordergray">
                          {group.rows.length}
                        </span>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-bold text-textcolor tabular-nums">
                          {formatAmount(group.total)}
                        </span>
                        {!lockScope && (
                          <button
                            type="button"
                            onClick={() => setDeleteGroupConfirm(group.room)}
                            className="p-1 rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                            title={`Delete ${group.room} and all its items`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Accordion Content */}
                    {groupOpen && (
                      <div className="p-3 space-y-3 bg-white">
                        {group.rows.map(({ item, idx }) => {
                          // On a first proposal send the scope is read-only —
                          // this applies to both preset-mapped rows and rows
                          // added via "Pick from Library": once added they are
                          // readable but not editable.
                          const rowLocked = lockScope;
                          return (
                            <div
                              key={idx}
                              className="rounded-lg border border-border bg-bg-soft/30 p-2 space-y-2"
                            >
                              <div className="grid grid-cols-[1fr_1.5fr_110px_28px] gap-2 items-start">
                                {rowLocked ? (
                                  <div
                                    className="bg-bg-soft border border-bordergray text-[11px] text-darkgray rounded-md px-2 py-2 w-full truncate"
                                    title={item.itemName || ""}
                                  >
                                    {item.itemName || "—"}
                                  </div>
                                ) : (
                                  <EditableItemNameInput
                                    initialValue={item.itemName || ""}
                                    onSave={(val) =>
                                      updateScope(idx, "itemName", val)
                                    }
                                    className="bg-white border border-bordergray text-[11px] text-darkgray rounded-md px-2 py-2 w-full focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                                  />
                                )}
                                <input
                                  type="text"
                                  value={item.description || ""}
                                  onChange={(e) =>
                                    updateScope(
                                      idx,
                                      "description",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Description"
                                  readOnly={rowLocked}
                                  className={`border text-[11px] text-darkgray rounded-md px-2 py-2 w-full focus:outline-none ${
                                    rowLocked
                                      ? "bg-bg-soft border-bordergray cursor-default"
                                      : "bg-white border-bordergray focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                                  }`}
                                />
                                <input
                                  type="number"
                                  value={item.amount}
                                  onChange={(e) =>
                                    updateScope(idx, "amount", e.target.value)
                                  }
                                  placeholder="₹"
                                  readOnly={rowLocked}
                                  className={`border text-[11px] text-darkgray rounded-md px-2 py-2 w-full focus:outline-none text-right ${
                                    rowLocked
                                      ? "bg-bg-soft border-bordergray cursor-default"
                                      : "bg-white border-bordergray focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeScopeRow(idx)}
                                  className="h-8 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors"
                                  title="Remove row"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>

                              {/* Qty · rate · days meta · per-scope grade */}
                              <div className="flex items-center gap-3 px-0.5 text-[10px] text-text-muted">
                                <span>
                                  <span className="text-text-subtle">
                                    Rate/{item.unit}:{" "}
                                  </span>
                                  <span className="font-semibold">
                                    ₹
                                    {Number(item.rate || 0).toLocaleString(
                                      "en-IN",
                                    )}
                                    /{item.unit}
                                  </span>
                                </span>

                                {Number(item.qty) > 0 && (
                                  <span>
                                    <span className="text-text-subtle">
                                      Quantity:{" "}
                                    </span>
                                    <span className="font-semibold">
                                      {Number(item.qty).toLocaleString("en-IN")}{" "}
                                      {item.unit}
                                    </span>
                                  </span>
                                )}

                                {(item.days ?? "") !== "" && (
                                  <span>
                                    <span className="text-text-subtle">
                                      Duration:{" "}
                                    </span>
                                    <span className="font-semibold">
                                      {item.days}d
                                    </span>
                                  </span>
                                )}
                                {(() => {
                                  // Only offer grades that carry a value for this
                                  // row; keep the currently-selected grade visible
                                  // so the control never shows blank.
                                  const valueGrades =
                                    gradeKeysByIdx[idx] || new Set();
                                  const current = item.grade || "premium";
                                  const rowGrades = gradeOptions.filter(
                                    (g) =>
                                      valueGrades.has(g.key) ||
                                      g.key === current,
                                  );
                                  if (rowGrades.length === 0) return null;
                                  return (
                                    <label className="flex items-center gap-1 ml-auto">
                                      <span className="text-text-subtle">
                                        Grade
                                      </span>
                                      <select
                                        value={current}
                                        onChange={(e) =>
                                          handleScopeGradeChange(
                                            idx,
                                            e.target.value,
                                          )
                                        }
                                        className="bg-white border border-bordergray text-[10px] text-darkgray rounded-md px-1.5 py-1 focus:outline-none focus:border-select-blue cursor-pointer"
                                        title="Quality grade for this scope item"
                                      >
                                        {rowGrades.map((g) => (
                                          <option key={g.key} value={g.key}>
                                            {g.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                  );
                                })()}
                              </div>

                              {/* Material specs */}
                              {(item.materials || []).length > 0 && (
                                <div className="pl-3 border-l-2 border-select-blue/30 space-y-1.5">
                                  {item.materials.map((m, mIdx) => (
                                    <div
                                      key={mIdx}
                                      className={`grid gap-2 items-center ${
                                        rowLocked
                                          ? "grid-cols-[100px_1fr]"
                                          : "grid-cols-[100px_1fr_22px]"
                                      }`}
                                    >
                                      <input
                                        type="text"
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
                                        readOnly={rowLocked}
                                        className={`border text-[10px] text-darkgray rounded-md px-2 py-1.5 w-full focus:outline-none ${
                                          rowLocked
                                            ? "bg-bg-soft border-bordergray cursor-default"
                                            : "bg-white border-bordergray focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                                        }`}
                                      />
                                      <input
                                        type="text"
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
                                        readOnly={rowLocked}
                                        className={`border text-[10px] text-darkgray rounded-md px-2 py-1.5 w-full focus:outline-none ${
                                          rowLocked
                                            ? "bg-bg-soft border-bordergray cursor-default"
                                            : "bg-white border-bordergray focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                                        }`}
                                      />
                                      {!rowLocked && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeMaterial(idx, mIdx)
                                          }
                                          className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors"
                                          title="Remove material"
                                        >
                                          <Trash2 size={11} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-end gap-4 text-[12px]">
              <span className="text-text-muted">
                Subtotal:{" "}
                <span className="font-bold text-text">
                  {formatAmount(totals.subtotal)}
                </span>
              </span>
              <span className="text-text-muted">
                GST:{" "}
                <span className="font-bold text-orange-500">
                  {formatAmount(totals.gst)}
                </span>
              </span>
              <span className="text-text-muted">
                Total:{" "}
                <span className="font-bold text-primary">
                  {formatAmount(totals.grandTotal)}
                </span>
              </span>
            </div>
            {originalTotal > 0 && (
              <div
                className={`mt-2 flex items-center justify-end gap-1.5 text-[11px] font-medium ${
                  overLimit ? "text-red-600" : "text-text-muted"
                }`}
              >
                {overLimit && <AlertTriangle size={12} className="shrink-0" />}
                Original proposal: {formatAmount(originalTotal)} ·{" "}
                {increasePct >= 0 ? "+" : ""}
                {increasePct.toFixed(1)}% vs original
                {overLimit ? ` — exceeds the ${MAX_INCREASE_PCT}% limit` : ""}
              </div>
            )}
          </div>

          <div className="border-t border-border my-5" />

          <div className="mb-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <SectionHeader>Terms & Conditions</SectionHeader>
              <div className="flex flex-wrap items-center gap-2">
                {isResend && (
                  <button
                    type="button"
                    onClick={() => {
                      const categoryInclusions = {};
                      const categoryExclusions = {};
                      const addedInclusions = {};
                      const addedExclusions = {};
                      const categoriesList = getCategoriesList();
                      categoriesList.forEach((cat) => {
                        const global = getGlobalTerms(cat);
                        categoryInclusions[cat] = global.inclusions
                          .filter((t) => t.isDefault)
                          .map((t) => t.text);
                        categoryExclusions[cat] = global.exclusions
                          .filter((t) => t.isDefault)
                          .map((t) => t.text);
                        addedInclusions[cat] = [];
                        addedExclusions[cat] = [];
                      });
                      const flatIn = [];
                      const flatEx = [];
                      categoriesList.forEach((cat) => {
                        flatIn.push(...(categoryInclusions[cat] || []));
                        flatEx.push(...(categoryExclusions[cat] || []));
                      });

                      setFormData((prev) => ({
                        ...prev,
                        inclusions: flatIn,
                        exclusions: flatEx,
                        categoryInclusions,
                        categoryExclusions,
                        addedInclusions,
                        addedExclusions,
                      }));
                      setTermOptions({
                        inclusions: flatIn,
                        exclusions: flatEx,
                      });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-600 text-[11.5px] font-bold hover:bg-amber-100 hover:text-amber-700 hover:shadow-sm transition-all cursor-pointer"
                    title="Restore default Terms & Conditions from the master module"
                  >
                    <RotateCcw size={12} /> Reset to Default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTermsParentModalOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-select-blue bg-select-blue/5 text-select-blue text-[11.5px] font-bold hover:bg-select-blue/10 hover:shadow-sm transition-all cursor-pointer group"
                >
                  <Plus
                    size={14}
                    className="text-select-blue group-hover:scale-110 transition-transform"
                  />
                  <span>Add Conditions</span>
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {getCategoriesMeta().map((cat) => {
                const Icon = cat.icon;
                const activeIncs = formData.categoryInclusions?.[cat.id] || [];
                const activeExcs = formData.categoryExclusions?.[cat.id] || [];
                const totalCount = activeIncs.length + activeExcs.length;
                const isExpanded = !!expandedCategories[cat.id];

                return (
                  <div
                    key={cat.id}
                    className="border border-bordergray rounded-xl overflow-hidden bg-white shadow-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [cat.id]: !prev[cat.id],
                        }))
                      }
                      className="w-full flex items-center justify-between px-4 py-3 bg-bg-soft/40 hover:bg-bg-soft transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={14} className="text-select-blue" />
                        <span className="text-[12px] font-bold text-textcolor">
                          {cat.label}
                        </span>
                        <span className="text-[9.5px] text-text-muted bg-white border border-bordergray px-1.5 py-0.5 rounded-md font-medium">
                          {totalCount} selected
                        </span>
                      </div>
                      <div className="text-text-muted">
                        {isExpanded ? (
                          <ChevronDown
                            size={14}
                            className="text-textcolor/60"
                          />
                        ) : (
                          <ChevronRight
                            size={14}
                            className="text-textcolor/60"
                          />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-4 border-t border-bordergray/50 grid grid-cols-1 md:grid-cols-2 gap-5 bg-white">
                        {/* Included Column (always left) */}
                        <div>
                          <h4 className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase mb-2">
                            Included
                          </h4>
                          <div className="space-y-2">
                            {(() => {
                              const global = getGlobalTerms(cat.id);
                              const defaultIn = global.inclusions
                                .filter((t) => t.isDefault)
                                .map((t) => t.text);
                              const addedIn =
                                formData.addedInclusions?.[cat.id] || [];
                              const visibleIn = Array.from(
                                new Set([...defaultIn, ...addedIn]),
                              );

                              if (visibleIn.length === 0) {
                                return (
                                  <div className="text-[11.5px] text-text-muted py-2 leading-relaxed">
                                    No Included Items available.
                                  </div>
                                );
                              }

                              return (
                                <div
                                  style={{
                                    maxHeight: "152px",
                                    scrollBehavior: "smooth",
                                  }}
                                  className="space-y-2 overflow-y-auto scroll-hidden-bar scroll-smooth"
                                >
                                  {visibleIn.map((item, idx) => {
                                    const isChecked = activeIncs.includes(item);
                                    return (
                                      <div
                                        key={idx}
                                        onClick={() =>
                                          toggleInclusion(item, cat.id)
                                        }
                                        className="flex items-start gap-2.5 cursor-pointer group py-1 px-1.5 rounded hover:bg-bg-soft transition-all select-none text-left"
                                      >
                                        <div className="pt-0.5 shrink-0">
                                          <CustomCheckbox
                                            accent="green"
                                            checked={isChecked}
                                            onChange={() => {}}
                                          />
                                        </div>
                                        <span className="text-[11.5px] text-text-muted group-hover:text-textcolor transition-colors leading-tight font-medium">
                                          {item}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Not Included Column (always right) */}
                        <div>
                          <h4 className="text-[10px] font-bold text-red-500 tracking-wider uppercase mb-2">
                            Not Included
                          </h4>
                          <div className="space-y-2">
                            {(() => {
                              const global = getGlobalTerms(cat.id);
                              const defaultEx = global.exclusions
                                .filter((t) => t.isDefault)
                                .map((t) => t.text);
                              const addedEx =
                                formData.addedExclusions?.[cat.id] || [];
                              const visibleEx = Array.from(
                                new Set([...defaultEx, ...addedEx]),
                              );

                              if (visibleEx.length === 0) {
                                return (
                                  <div className="text-[11.5px] text-text-muted py-2 leading-relaxed">
                                    No Not Included Items available.
                                  </div>
                                );
                              }

                              return (
                                <div
                                  style={{
                                    maxHeight: "152px",
                                    scrollBehavior: "smooth",
                                  }}
                                  className="space-y-2 overflow-y-auto scroll-hidden-bar scroll-smooth"
                                >
                                  {visibleEx.map((item, idx) => {
                                    const isChecked = activeExcs.includes(item);
                                    return (
                                      <div
                                        key={idx}
                                        onClick={() =>
                                          toggleExclusion(item, cat.id)
                                        }
                                        className="flex items-start gap-2.5 cursor-pointer group py-1 px-1.5 rounded hover:bg-bg-soft transition-all select-none text-left"
                                      >
                                        <div className="pt-0.5 shrink-0">
                                          <CustomCheckbox
                                            accent="red"
                                            checked={isChecked}
                                            onChange={() => {}}
                                          />
                                        </div>
                                        <span className="text-[11.5px] text-text-muted group-hover:text-textcolor transition-colors leading-tight font-medium">
                                          {item}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border my-5" />

          <div>
            <SectionHeader>Notes / Terms</SectionHeader>
            <InputField
              name="notes"
              label=""
              type="textarea"
              rows={3}
              value={formData.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Optional notes for the client (payment terms, timelines, etc.)"
            />
          </div>
        </div>

        {/* Preview pane */}
        <div className="overflow-y-auto h-full pl-2 scroll-hidden-bar">
          <p className="text-[10px] uppercase tracking-widest text-text-subtle font-bold mb-2 modal-no-print">
            Live Preview
          </p>
          <div className="quote-print-area rounded-xl border border-border bg-white p-6 shadow-sm">
            <QuotePreview quote={previewQuote} />
          </div>
        </div>
      </div>

      {/* Library Picker — direct pick from saved items */}
      {libraryPickerOpen && (
        <LibraryPickerModal
          onClose={() => setLibraryPickerOpen(false)}
          onPick={handleLibraryPick}
        />
      )}

      {/* Add Conditions Parent Modal */}
      {termsParentModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-9999 animate-fade-in p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-bordergray transform scale-100 transition-all duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-bg-soft border-b border-bordergray">
              <div>
                <h3 className="text-[14px] font-bold text-textcolor">
                  Add Conditions
                </h3>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Select a category to customize Terms & Conditions
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTermsParentModalOpen(false)}
                className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Categories List */}
            <div className="p-5 space-y-2.5">
              {getCategoriesMeta().map((cat) => {
                const Icon = cat.icon;
                const count = getActiveCatCount(cat.id);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setActiveCategoryModal(cat.id);
                      setTermsParentModalOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3.5 rounded-xl border border-bordergray bg-white hover:border-select-blue/30 hover:bg-bg-soft/40 transition-all shadow-xs cursor-pointer group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-select-blue/5 text-select-blue group-hover:bg-select-blue group-hover:text-white transition-all">
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-textcolor group-hover:text-select-blue transition-colors">
                          {cat.label}
                        </p>
                        <p className="text-[10px] text-text-muted mt-0.5">
                          Customize {cat.label.toLowerCase()} clauses
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {count > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-150">
                          {count} selected
                        </span>
                      )}
                      <ChevronRight
                        size={14}
                        className="text-text-muted group-hover:text-textcolor transition-colors"
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end px-6 py-4 bg-bg-soft border-t border-bordergray">
              <button
                type="button"
                onClick={() => setTermsParentModalOpen(false)}
                className="px-4 py-2 bg-white border border-bordergray rounded-xl text-textcolor hover:bg-bg-soft text-[11px] font-bold transition-all shadow-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated category Terms & Conditions modal */}
      {activeCategoryModal && (
        <CategoryTermsModal
          category={activeCategoryModal}
          categoryLabel={
            getCategoriesMeta().find((c) => c.id === activeCategoryModal)
              ?.label || ""
          }
          initialInclusions={
            formData.categoryInclusions?.[activeCategoryModal] || []
          }
          initialExclusions={
            formData.categoryExclusions?.[activeCategoryModal] || []
          }
          addedInclusions={
            formData.addedInclusions?.[activeCategoryModal] || []
          }
          addedExclusions={
            formData.addedExclusions?.[activeCategoryModal] || []
          }
          onApply={(newInclusions, newExclusions) => {
            const global = getGlobalTerms(activeCategoryModal);
            const defaultInTexts = global.inclusions
              .filter((t) => t.isDefault)
              .map((t) => t.text);
            const defaultExTexts = global.exclusions
              .filter((t) => t.isDefault)
              .map((t) => t.text);

            const prevCatIn =
              formData.categoryInclusions?.[activeCategoryModal] || [];
            const prevCatEx =
              formData.categoryExclusions?.[activeCategoryModal] || [];

            const currentSelectedDefaultsIn = prevCatIn.filter((t) =>
              defaultInTexts.includes(t),
            );
            const currentSelectedDefaultsEx = prevCatEx.filter((t) =>
              defaultExTexts.includes(t),
            );

            const updatedCatIn = Array.from(
              new Set([...currentSelectedDefaultsIn, ...newInclusions]),
            );
            const updatedCatEx = Array.from(
              new Set([...currentSelectedDefaultsEx, ...newExclusions]),
            );

            const updatedAddedIn = newInclusions;
            const updatedAddedEx = newExclusions;

            // Reconstruct flat arrays
            const flatIn = [];
            const flatEx = [];
            const categoriesList = getCategoriesList();
            categoriesList.forEach((cat) => {
              if (cat === activeCategoryModal) {
                flatIn.push(...updatedCatIn);
                flatEx.push(...updatedCatEx);
              } else {
                flatIn.push(...(formData.categoryInclusions?.[cat] || []));
                flatEx.push(...(formData.categoryExclusions?.[cat] || []));
              }
            });

            const finalFlatIn = Array.from(new Set(flatIn));
            const finalFlatEx = Array.from(new Set(flatEx));

            setFormData((prev) => ({
              ...prev,
              inclusions: finalFlatIn,
              exclusions: finalFlatEx,
              categoryInclusions: {
                ...prev.categoryInclusions,
                [activeCategoryModal]: updatedCatIn,
              },
              categoryExclusions: {
                ...prev.categoryExclusions,
                [activeCategoryModal]: updatedCatEx,
              },
              addedInclusions: {
                ...prev.addedInclusions,
                [activeCategoryModal]: updatedAddedIn,
              },
              addedExclusions: {
                ...prev.addedExclusions,
                [activeCategoryModal]: updatedAddedEx,
              },
            }));

            // Sync termOptions so they display on the main form
            setTermOptions({
              inclusions: finalFlatIn,
              exclusions: finalFlatEx,
            });

            setActiveCategoryModal(null);
            setTermsParentModalOpen(true);
          }}
          onClose={() => {
            setActiveCategoryModal(null);
            setTermsParentModalOpen(true);
          }}
        />
      )}

      <DestinationPromptModal
        isOpen={destPrompt.isOpen}
        onClose={destPrompt.onCancel}
        itemName={destPrompt.itemName}
        itemCategory={destPrompt.category}
        existingHeadings={destPrompt.existingHeadings}
        headingsWithItem={destPrompt.headingsWithItem}
        onSelect={destPrompt.onSelect}
        onCreateNew={destPrompt.onCreateNew}
        roomPresets={getProposalRoomPresets().map((r) => r.name)}
      />

      {deleteGroupConfirm && (
        <Modal
          title={`Delete ${deleteGroupConfirm}?`}
          onClose={() => setDeleteGroupConfirm(null)}
          footer={
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteGroupConfirm(null)}
                className="px-4 py-2 border border-bordergray rounded-xl text-textcolor hover:bg-bg-soft text-[11px] font-bold transition-all shadow-xs cursor-pointer bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteGroup(deleteGroupConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          }
          maxWidth="max-w-[400px]"
        >
          <p className="text-[12.5px] text-text-muted leading-relaxed">
            Are you sure you want to delete the category{" "}
            <strong>{deleteGroupConfirm}</strong> and all its associated items?
            This action cannot be undone.
          </p>
        </Modal>
      )}

      {toast && (
        <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
};

const Toast = ({ toast, onClose }) => {
  const variants = {
    success: { bg: "bg-emerald-500", icon: <CheckCircle2 size={14} /> },
    error: { bg: "bg-red-500", icon: <AlertTriangle size={14} /> },
    info: { bg: "bg-select-blue", icon: <Info size={14} /> },
  };
  const v = variants[toast.type] || variants.info;
  return (
    <div className="fixed top-6 right-6 z-[10000] animate-[slideIn_0.2s_ease-out]">
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

export default QuoteModal;
