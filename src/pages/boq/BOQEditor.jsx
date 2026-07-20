import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Copy,
  Trash2,
  Plus,
  ChevronDown,
  ChevronRight,
  FileText,
  Check,
  X,
  Send,
  MoreVertical,
  Hash,
  Layers,
  Wallet,
  Percent,
  Calendar,
  StickyNote,
  Sparkles,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calculator,
  Building2,
  User,
  BookOpen,
  GripVertical,
  Search,
  RotateCcw,
  Link2,
  Edit3,
  ShieldCheck,
  PackageCheck,
  Package,
  Ruler,
  Eye,
  History,
  List,
  MapPin,
  Loader2,
} from "lucide-react";
import {
  createBoq,
  getBoq,
  saveBoq,
  deleteBoq,
  duplicateBoq,
  computeItemAmount,
  computeItemQty,
  computeBoqTotals,
  computeRateAnalysis,
  resolveGstTreatment,
  validateBoqForSend,
  blankItem,
  blankSection,
  blankRateAnalysisRow,
  blankRevisionComparison,
  seedRateAnalysisFromMaterials,
  diffBoqRevisions,
  DIMENSIONAL_UNITS,
  DEFAULT_BOQ_APPROVAL,
  BOQ_TYPES,
  ITEM_TYPES,
  BILLING_TYPES,
  SCOPE_TYPES,
  EXECUTION_BY,
} from "../../data/boqStorage";
import { getCurrentUser } from "../../auth/currentUser";
import { getOrgProfile } from "../../data/orgProfile";
import { getPresetKeys } from "../../data/QuotePresets";
import {
  createFinalQuoteFromBoq,
  sendFinalQuote,
  validateFinalQuote,
} from "../../data/finalQuoteStorage";
import Modal from "../../components/Modal";
import NumericInput from "../../components/NumericInput";
import QuotePreview from "../../components/QuotePreview";
import { UNITS, HSN_SUGGESTIONS } from "../../data/boqUnits";
import { getAllClients, clientToBoqFields } from "../../data/clientStorage";
import {
  listLibrary,
  libraryToItem,
  incrementUsage,
} from "../../data/itemLibrary";
import { listMaterials } from "../../data/materialLibrary";
import BOQPreview, {
  MaterialSheetPreview,
  MeasurementSheetPreview,
  MasterSheetPreview,
} from "./BOQPreview";
import { formatAmount } from "../../utils/formatAmount";
import ItemFormModal from "../../components/ItemFormModal";
import CategorySelect from "../../components/CategorySelect";
import {
  BulletListEditor,
  CollapsiblePanel,
  CommercialValue,
  ConfirmDialog,
  Field,
  Row,
  SendValidationDialog,
  SignoffCheck,
  SignoffField,
  Toast,
} from "../../components/boq/BOQEditorPrimitives";
import { getScheduleConfig } from "../../data/scheduleConfig";
import { roomColor } from "../../data/categoryColors";
import {
  getContractByClient,
  linkBoqToContract,
} from "../../data/contractStorage";
import {
  computeRecipe,
  materialsById as mkMatById,
  recipeToMaterials,
  recipeBuildupForRateAnalysis,
  defaultWastageFor,
} from "../../data/rateBuildup";
import { getDesignFlow, buildBoq } from "../../data/designFlowStorage";
import {
  getElementMeasurement,
  getSiteServiceTrack,
} from "../../data/surveyMeasureStorage";
import { getAllSites, getSite } from "../../data/siteStorage";

const inputBase =
  "bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle";

const compactInput =
  "bg-white border border-bordergray text-[11.5px] text-textcolor rounded-md px-2 py-1.5 w-full focus:outline-none focus:border-select-blue focus:ring-1 focus:ring-select-blue/20 placeholder:text-text-subtle";

const STATUS_STYLES = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  sent: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  approved: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  revised: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  issued_for_tender: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  signed: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  issued_for_procurement: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
  procurement: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
};

// Feature flag — hide the Economy / Premium / Luxury grade selector in the
// BOQ line-item view. Set to true to bring it back.
const SHOW_GRADE_SELECTOR = false;

const LOCKED_STATUSES = [
  "sent",
  "approved",
  "issued_for_tender",
  "signed",
  "issued_for_procurement",
  "procurement",
];
const isLockedStatus = (status) => LOCKED_STATUSES.includes(status);
const SIGNOFF_LOCKED_STATUSES = [
  "signed",
  "issued_for_procurement",
  "procurement",
];
const isSignoffLockedStatus = (status) =>
  SIGNOFF_LOCKED_STATUSES.includes(status);

const DEFAULT_APPROVAL = DEFAULT_BOQ_APPROVAL;

const mergeApproval = (approval = {}) => ({
  ...DEFAULT_APPROVAL,
  ...approval,
  checklist: {
    ...DEFAULT_APPROVAL.checklist,
    ...(approval.checklist || {}),
  },
});

const createAuditEntry = ({
  boq,
  action,
  label,
  actor,
  details = "",
  at = new Date().toISOString(),
}) => ({
  id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  action,
  label,
  actor: actor || "System",
  details,
  at,
  status: boq?.status || "draft",
  revision: boq?.revision || 1,
});

const appendAuditTrail = (boq, entry) => [
  ...(boq?.auditTrail || []),
  createAuditEntry({ boq, ...entry }),
];

const createRevisionComparison = (boq, nextRevision) => ({
  previousRevision: boq?.revision || 1,
  currentRevision: nextRevision,
  createdAt: new Date().toISOString(),
  summary: {
    sectionsAdded: 0,
    sectionsRemoved: 0,
    itemsAdded: 0,
    itemsRemoved: 0,
    itemsChanged: 0,
    quantityDelta: 0,
    amountDelta: 0,
  },
  changes: [],
  reason: "",
});

const DEFAULT_PROCUREMENT = {
  issued: false,
  issuedAt: "",
  issuedBy: "",
  contractId: "",
};

const countMaterials = (record) =>
  (record?.sections || []).reduce(
    (sum, section) =>
      sum +
      (section.items || []).reduce(
        (itemSum, item) => itemSum + (item.materials || []).length,
        0,
      ),
    0,
  );

const ARCH_WORK_CATEGORIES = [
  { value: "Preliminary & General", label: "Preliminary & General", description: "Site setup, mobilisation, surveying, temporary facilities", suggestions: ["Site clearance & demarcation", "Survey & setting-out", "Site office & facilities", "Scaffolding", "Safety provisions"] },
  { value: "Earthwork & Excavation", label: "Earthwork & Excavation", description: "Bulk excavation, backfilling, compaction, dewatering", suggestions: ["Bulk excavation", "Excavation for foundations", "Backfilling & compaction", "Dewatering"] },
  { value: "Foundation & Substructure", label: "Foundation & Substructure", description: "PCC, footings, raft slab, pile caps, anti-termite", suggestions: ["PCC (blinding)", "Isolated footings", "Raft slab", "Retaining wall", "Anti-termite treatment"] },
  { value: "RCC & Structural Works", label: "RCC & Structural Works", description: "Columns, beams, slabs, staircase, shear walls, structural steel", suggestions: ["RCC columns", "RCC beams & slabs", "Staircase", "Shear wall / lift pit", "Structural steel"] },
  { value: "Masonry & Block Work", label: "Masonry & Block Work", description: "Brick/block walls, lintels, parapet, partition walls", suggestions: ["Brick masonry", "AAC block masonry", "Lintel beams", "Parapet wall", "Cavity wall"] },
  { value: "Waterproofing", label: "Waterproofing", description: "Terrace, basement, toilet, external wall waterproofing", suggestions: ["Terrace waterproofing", "Basement waterproofing", "Toilet waterproofing", "Water tank lining"] },
  { value: "Roof & Terrace", label: "Roof & Terrace", description: "Screed, insulation, tile/slab finish, coping, drainage", suggestions: ["Roof screed & slope", "Terrace tile / paver", "Roof insulation", "Coping / parapet cap", "Roof drainage"] },
  { value: "External Facade & Cladding", label: "External Facade & Cladding", description: "External plaster, stone/tile cladding, glazing, ACP", suggestions: ["External cement plaster", "Stone / tile cladding", "Curtain wall glazing", "ACP cladding", "Louvres & sunshades"] },
  { value: "Internal Finishes", label: "Internal Finishes", description: "Plastering, flooring, wall tiles, skirting, dado", suggestions: ["Internal plaster", "Vitrified tile flooring", "Wall tile dado", "Marble / granite flooring", "Skirting"] },
  { value: "Ceiling Works", label: "Ceiling Works", description: "RCC soffit finish, false ceiling, cornice, coping", suggestions: ["RCC soffit plaster / paint", "Gypsum false ceiling", "GI grid false ceiling", "Cornices & mouldings"] },
  { value: "Painting & Surface Finishing", label: "Painting & Surface Finishing", description: "Internal/external painting, texture, primer, polish", suggestions: ["Internal emulsion paint", "External weathercoat", "Texture finish", "Primer coat", "Enamel paint"] },
  { value: "Doors, Windows & Glazing", label: "Doors, Windows & Glazing", description: "Door frames, shutters, windows, hardware, glass", suggestions: ["Wooden door frame & shutter", "Steel door", "Aluminium window", "UPVC window", "Glass partition"] },
  { value: "Carpentry & Joinery", label: "Carpentry & Joinery", description: "Built-in joinery, panelling, shelving, handrails", suggestions: ["Wall panelling", "Built-in wardrobes", "Staircase railing", "Skirting board", "Shelving"] },
  { value: "Plumbing & Sanitary", label: "Plumbing & Sanitary", description: "Water supply, drainage, sanitary fixtures, tanks", suggestions: ["CPVC water supply", "PVC drainage", "Sanitary fixtures", "Hot water system", "Overhead / sump tank"] },
  { value: "Electrical Works", label: "Electrical Works", description: "LT panel, wiring, conduits, light fixtures, earthing", suggestions: ["LT panel & DB", "Concealed conduit & wiring", "Power outlets & switches", "Light fixtures", "Earthing & lightning protection"] },
  { value: "HVAC & Ventilation", label: "HVAC & Ventilation", description: "AHU, FCU, ducting, diffusers, VRF, split units", suggestions: ["Split AC units", "AHU & FCU", "GI ducting", "Diffusers & grilles", "VRF system"] },
  { value: "Fire Protection", label: "Fire Protection", description: "Sprinklers, hydrants, fire alarm, suppression system", suggestions: ["Sprinkler system", "Fire hydrant", "Fire alarm & detection", "Suppression system", "Pressurisation"] },
  { value: "Lifts & Vertical Transport", label: "Lifts & Vertical Transport", description: "Passenger/service lifts, escalators, hydraulic platforms", suggestions: ["Passenger lift", "Service / goods lift", "Hydraulic platform", "Escalator"] },
  { value: "External Works", label: "External Works", description: "Roads, pathways, storm water, compound wall, landscaping", suggestions: ["Compound wall & gate", "Internal roads & parking", "Storm water drain", "Landscaping & irrigation", "External lighting"] },
  { value: "Miscellaneous", label: "Miscellaneous", description: "Signage, handrails, safety items, site clean-up", suggestions: ["Signage & numbering", "Handrails & guardrails", "Access control", "Site clean-up", "As-built documentation"] },
];

const BOQEditor = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();

  const [boq, setBoq] = useState(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  // { blocks, warnings } from validateBoqForSend, shown in SendValidationDialog.
  const [sendValidation, setSendValidation] = useState(null);
  const [showSeedPicker, setShowSeedPicker] = useState(false);
  const [showSurveyPicker, setShowSurveyPicker] = useState(false);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  // Section id currently adding a line item through the full Item Form modal.
  const [itemFormSection, setItemFormSection] = useState(null);
  // { sectionId, itemId } of the line item currently being edited in the modal.
  const [editingItem, setEditingItem] = useState(null);
  const [itemSearch, setItemSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  // Prebuilt final-quote object awaiting admin review in the preview modal, and
  // whether a publish is in flight. The quote is built once, previewed, then
  // published as the very same object (no second quote id).
  const [finalQuotePreview, setFinalQuotePreview] = useState(null);
  const [publishingFinalQuote, setPublishingFinalQuote] = useState(false);
  // Session dismissal for the two header advisories (locked-status + stale
  // survey). Reset on reload; the banners reappear if their condition still
  // holds next visit.
  const [showLockNotice, setShowLockNotice] = useState(true);
  const [showSurveyStaleNotice, setShowSurveyStaleNotice] = useState(true);
  const [showMasterSheet, setShowMasterSheet] = useState(false);
  const [showMeasurementSheet, setShowMeasurementSheet] = useState(false);
  const [showMaterialSheet, setShowMaterialSheet] = useState(false);
  const [showSheetsMenu, setShowSheetsMenu] = useState(false);
  const [showArchSectionPicker, setShowArchSectionPicker] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState(null);
  const [groupMode, setGroupMode] = useState("section"); // "section" | "room" | "work"
  // Items inserted from the library are compact-by-default; user can expand
  // any of them to override rate / HSN / GST. Tracked by item id.
  const [expandedLinked, setExpandedLinked] = useState({});
  // Editor body view: "scope" (sections + line items) | "rate" (consolidated
  // rate-analysis worksheet across every item). Rate analysis is no longer only
  // an inline per-item panel — it gets its own tab for building up & validating
  // all unit rates together before the BOQ is finalized.
  const [editorTab, setEditorTab] = useState("scope");

  // Load or create
  useEffect(() => {
    if (id === "new" || !id) {
      const seed = searchParams.get("preset");
      const fresh = createBoq({ basedOnPreset: seed || null });
      saveBoq(fresh);
      // Replace URL so refresh keeps the same BOQ id
      navigate(`/boq/${fresh.id}`, { replace: true });
      setBoq(fresh);
      // Expand first section by default
      if (fresh.sections.length > 0) {
        setExpanded({ [fresh.sections[0].id]: true });
      }
      return;
    }
    const existing = getBoq(id);
    if (existing) {
      setBoq(existing);
      if (existing.sections?.[0]) {
        setExpanded({ [existing.sections[0].id]: true });
      }
    } else {
      // No matching BOQ — bounce to list
      navigate("/boq", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-save on change
  useEffect(() => {
    if (!boq) return;
    const t = setTimeout(() => saveBoq(boq), 400);
    return () => clearTimeout(t);
  }, [boq]);

  // Service track (Interiors/Architecture) of this BOQ, resolved via its linked
  // site. The extended item-detail fields (floor, work category, drawing ref,
  // brand/finish, item/billing/scope type, execution) are architecture concerns;
  // interior BOQs keep the line-item view lean and hide them. Standalone BOQs
  // (no site) default to showing them so no data is silently hidden.
  const isInteriorBoq = useMemo(() => {
    const siteID = boq?.project?.siteID;
    if (!siteID) return false;
    const site = getSite(siteID);
    return site ? getSiteServiceTrack(site) === "Interiors" : false;
  }, [boq?.project?.siteID]);

  // Architecture BOQs start from a blank section only — their quantities come
  // from approved design/GFC drawings and the survey take-off, not from the
  // Item Master library or interior Proposal-Master presets. So the empty-state
  // "Add Section from Library" / "Seed from Preset" shortcuts are hidden.
  const isArchitectureBoq = useMemo(() => {
    const siteID = boq?.project?.siteID;
    if (!siteID) return false;
    const site = getSite(siteID);
    return site ? getSiteServiceTrack(site) === "Architecture" : false;
  }, [boq?.project?.siteID]);

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateInternal = (changes) =>
    setBoq((prev) => ({
      ...prev,
      ...(typeof changes === "function" ? changes(prev) : changes),
    }));

  const canEditBoq = (record = boq) => !isLockedStatus(record?.status);
  const canEditSignoff = (record = boq) =>
    !isSignoffLockedStatus(record?.status);

  // Client-approval gate: the commit steps (tender / signed / procurement)
  // require the client to have accepted a final quote in the portal.
  // A final quote must be generated and approved before any of these steps.
  const isClientApprovalPending = (record = boq) =>
    record?.clientRequest?.type !== "accepted";

  // Auto-transition sent → approved when the client accepts the final quote
  useEffect(() => {
    if (boq?.status !== "sent" || boq?.clientRequest?.type !== "accepted") return;
    const now = new Date().toISOString();
    updateInternal((prev) => {
      const approval = mergeApproval(prev.approval);
      return {
        status: "approved",
        approval: {
          ...approval,
          approvedAt: approval.approvedAt || now,
          clientAcceptedAt: approval.clientAcceptedAt || now,
          clientAcceptedBy:
            approval.clientAcceptedBy ||
            prev.clientRequest?.respondedBy ||
            prev.client?.name ||
            "Client",
        },
        auditTrail: appendAuditTrail(prev, {
          action: "approved",
          label: "Auto-Approved",
          actor:
            prev.clientRequest?.respondedBy ||
            prev.client?.name ||
            "Client",
          details:
            "Automatically approved after client accepted the final quote.",
          at: now,
        }),
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boq?.status, boq?.clientRequest?.type]);

  const showClientApprovalToast = () => {
    if (!boq?.finalQuote) {
      showToast(
        "Generate and send a final quote to the client first — use the Final Quote button above.",
        "info",
      );
    } else {
      showToast(
        "The client hasn't approved the final quote yet — you can't proceed until they accept it in the portal.",
        "info",
      );
    }
  };

  const showLockedToast = () =>
    showToast("Create a revision before editing this issued BOQ.", "info");
  const showSignoffLockedToast = () =>
    showToast(
      "Create a revision before changing approved signoff details.",
      "info",
    );

  const update = (changes) =>
    setBoq((prev) => (canEditBoq(prev) ? { ...prev, ...changes } : prev));

  const updateClient = (changes) =>
    setBoq((prev) =>
      canEditBoq(prev)
        ? { ...prev, client: { ...prev.client, ...changes } }
        : prev,
    );

  const updateProject = (changes) =>
    setBoq((prev) =>
      canEditBoq(prev)
        ? { ...prev, project: { ...prev.project, ...changes } }
        : prev,
    );

  const updateApproval = (changes) =>
    setBoq((prev) => {
      if (!canEditSignoff(prev)) return prev;
      const current = mergeApproval(prev.approval);
      return {
        ...prev,
        approval: {
          ...current,
          ...(typeof changes === "function" ? changes(current) : changes),
        },
      };
    });

  const updateApprovalChecklist = (key, checked) =>
    updateApproval((approval) => ({
      checklist: {
        ...approval.checklist,
        [key]: checked,
      },
    }));

  const addSection = () => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    setBoq((prev) => {
      if (!canEditBoq(prev)) return prev;
      const sec = blankSection(`Section ${(prev.sections?.length || 0) + 1}`);
      const next = { ...prev, sections: [...(prev.sections || []), sec] };
      setExpanded((p) => ({ ...p, [sec.id]: true }));
      // Immediately open the Item Form modal so the user adds the first
      // line item without an extra click. "Add Scope" = section + first item.
      setItemFormSection(sec.id);
      return next;
    });
  };

  const addSectionNamed = (name, category) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    setBoq((prev) => {
      if (!canEditBoq(prev)) return prev;
      const sec = { ...blankSection(name), category: category || name };
      setExpanded((p) => ({ ...p, [sec.id]: true }));
      return { ...prev, sections: [...(prev.sections || []), sec] };
    });
    showToast(`"${name}" section added`, "success");
  };

  const updateSection = (sid, changes) => {
    setBoq((prev) => ({
      ...prev,
      sections: canEditBoq(prev)
        ? prev.sections.map((s) => (s.id === sid ? { ...s, ...changes } : s))
        : prev.sections,
    }));
  };

  const removeSection = (sid) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    setBoq((prev) => ({
      ...prev,
      sections: canEditBoq(prev)
        ? prev.sections.filter((s) => s.id !== sid)
        : prev.sections,
    }));
    showToast("Section removed", "info");
  };

  const duplicateSection = (sid) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    setBoq((prev) => {
      if (!canEditBoq(prev)) return prev;
      const idx = prev.sections.findIndex((s) => s.id === sid);
      if (idx < 0) return prev;
      const src = prev.sections[idx];
      const clone = {
        ...JSON.parse(JSON.stringify(src)),
        id: `${src.id}_c${Date.now().toString(36).slice(-3)}`,
        name: `${src.name} (Copy)`,
        items: (src.items || []).map((it) => ({
          ...it,
          id: `${it.id}_c${Date.now().toString(36).slice(-3)}`,
        })),
      };
      const sections = [...prev.sections];
      sections.splice(idx + 1, 0, clone);
      setExpanded((p) => ({ ...p, [clone.id]: true }));
      return { ...prev, sections };
    });
    showToast("Section duplicated", "success");
  };

  // Seed a form-added item's rate analysis straight from its Item Master
  // build-up recipe — materials + per-unit qty + wastage + labour/overhead%/
  // margin% — so a manually added library item shows the same rate analysis a
  // generated one does. Keeps an already-worked rate analysis (existing material
  // rows) untouched, and no-ops for free-text items with no recipe.
  const seedItemRateAnalysis = (form, base) => {
    const existing = base.rateAnalysis;
    if (existing?.materialItems?.length) return existing;
    const lib = form.masterId
      ? listLibrary().find((l) => l.id === form.masterId)
      : null;
    const recipe = lib?.recipes?.[lib.defaultGrade || "economy"] || null;
    if (!recipe) return existing || {};
    const matById = mkMatById(listMaterials());
    return seedRateAnalysisFromMaterials(
      existing,
      recipeToMaterials(recipe, matById),
      form.unit || lib.unit || "nos",
      { buildup: recipeBuildupForRateAnalysis(recipe) },
    );
  };

  // Convert the form's flat shape into the BOQ line-item shape (with the
  // nested dimensions object). Shared by both add and edit flows.
  const formToBoqItem = (form, base = {}) => {
    const L = Number(form.length) || 0;
    const B = Number(form.breadth) || 0;
    const H = Number(form.height) || 0;
    return {
      ...base,
      masterId: form.masterId ?? base.masterId ?? null,
      description: form.description || "",
      spec: form.spec || "",
      hsn: form.hsn || "",
      workCode: form.workCode || "",
      qty: Number(form.qty) || 1,
      unit: form.unit || "nos",
      rate: Number(form.rate) || 0,
      gstPercent: Number(form.gstPercent) || 18,
      hierarchy: base.hierarchy || {},
      details: base.details || {},
      dimensions: {
        enabled: L > 0 || B > 0 || H > 0,
        length: L,
        breadth: B,
        height: H,
      },
      materials: form.materials ? form.materials.map((m) => ({ ...m })) : [],
      measurementRows: base.measurementRows || [],
      rateAnalysis: seedItemRateAnalysis(form, base),
      vendorComparisons: base.vendorComparisons || [],
    };
  };

  // Convert a BOQ line-item back into the flat form shape so the Item Form
  // modal can be opened with the row's current values pre-filled.
  const boqItemToForm = (item) => ({
    id: item.id,
    masterId: item.masterId || null,
    description: item.description || "",
    spec: item.spec || "",
    category: item.category || "",
    hsn: item.hsn || "",
    workCode: item.workCode || "",
    unit: item.unit || "nos",
    length: item.dimensions?.length || 0,
    breadth: item.dimensions?.breadth || 0,
    height: item.dimensions?.height || 0,
    qty: Number(item.qty) || 0,
    rate: Number(item.rate) || 0,
    gstPercent: Number(item.gstPercent) || 18,
    materials: item.materials ? item.materials.map((m) => ({ ...m })) : [],
  });

  // Save handler for "Add Line Item" — appends a new BOQ item to the section.
  const handleItemFormSave = (form) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    const sid = itemFormSection;
    if (!sid) return;
    const newItem = formToBoqItem(form, {
      ...blankItem(),
      source: "manual",
      isVariation: !!boq.siteID,
    });
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sid ? { ...s, items: [...(s.items || []), newItem] } : s,
      ),
    }));
    setExpanded((p) => ({ ...p, [sid]: true }));
    if (form.masterId) incrementUsage(form.masterId);
    setItemFormSection(null);
    showToast("Item added", "success");
  };

  // Save handler for clicking an existing row — updates the item in place.
  const handleItemEditSave = (form) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    if (!editingItem) return;
    const { sectionId, itemId } = editingItem;
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((it) =>
                it.id === itemId ? formToBoqItem(form, it) : it,
              ),
            }
          : s,
      ),
    }));
    setEditingItem(null);
    showToast("Item updated", "success");
  };

  // Quick-quote shortcut: create a new section pre-populated with all library
  // items in the chosen category. Each item carries `masterId` so it renders
  // compact-by-default (just qty/dims editable, rate/HSN hidden behind Override).
  const addSectionFromCategory = (label, categoryValue, libItems) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    const sec = blankSection(label);
    sec.category = categoryValue;
    sec.items = libItems.map((lib) => ({
      ...blankItem(),
      ...libraryToItem(lib),
      source: "manual",
      isVariation: !!boq.siteID,
    }));
    setBoq((prev) => ({
      ...prev,
      sections: [...(prev.sections || []), sec],
    }));
    libItems.forEach((lib) => incrementUsage(lib.id));
    setExpanded((p) => ({ ...p, [sec.id]: true }));
    setShowSectionPicker(false);
    showToast(
      `${label} section added with ${libItems.length} item${libItems.length === 1 ? "" : "s"}`,
      "success",
    );
  };

  const updateItem = (sid, iid, changes) => {
    setBoq((prev) => ({
      ...prev,
      sections: canEditBoq(prev)
        ? prev.sections.map((s) =>
            s.id === sid
              ? {
                  ...s,
                  items: s.items.map((it) =>
                    it.id === iid ? { ...it, ...changes } : it,
                  ),
                }
              : s,
          )
        : prev.sections,
    }));
  };

  const removeItem = (sid, iid) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    setBoq((prev) => ({
      ...prev,
      sections: canEditBoq(prev)
        ? prev.sections.map((s) =>
            s.id === sid
              ? { ...s, items: s.items.filter((it) => it.id !== iid) }
              : s,
          )
        : prev.sections,
    }));
  };

  const duplicateItem = (sid, iid) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    setBoq((prev) => ({
      ...prev,
      sections: canEditBoq(prev)
        ? prev.sections.map((s) => {
            if (s.id !== sid) return s;
            const idx = s.items.findIndex((it) => it.id === iid);
            if (idx < 0) return s;
            const src = s.items[idx];
            const clone = {
              ...JSON.parse(JSON.stringify(src)),
              id: `${src.id}_c${Date.now().toString(36).slice(-3)}`,
            };
            const items = [...s.items];
            items.splice(idx + 1, 0, clone);
            return { ...s, items };
          })
        : prev.sections,
    }));
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    saveBoq(boq);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    showToast("All changes saved", "success");
  };

  const finalizeSend = () => {
    // Stamp the firm's current org profile onto the BOQ so this document's
    // header/GSTIN/bank details never silently change if the profile is
    // edited later — drafts always read the live profile, sent docs don't.
    updateInternal((prev) => {
      const approval = mergeApproval(prev.approval);
      const now = new Date().toISOString();
      const actor =
        getCurrentUser()?.name || approval.preparedBy || "User";
      // Diff this revision's sections against the last snapshot (the previous
      // revision) so the change register is populated the moment this BOQ is sent.
      const prevSnapshot = (prev.revisionHistory || []).slice(-1)[0];
      const diff =
        prevSnapshot?.sections
          ? diffBoqRevisions(prevSnapshot.sections, prev.sections)
          : null;
      return {
        status: "sent",
        orgSnapshot: getOrgProfile(),
        approval: {
          ...approval,
          preparedAt: approval.preparedAt || now,
          sentAt: now,
        },
        ...(diff && {
          revisionComparison: {
            ...blankRevisionComparison(),
            ...(prev.revisionComparison || {}),
            previousRevision: prevSnapshot.revision ?? null,
            currentRevision: prev.revision ?? null,
            ...diff,
          },
        }),
        auditTrail: appendAuditTrail(prev, {
          action: "sent",
          label: "Marked Sent",
          actor,
          details: "BOQ issued to client and locked for controlled revision.",
          at: now,
        }),
      };
    });
    setSendValidation(null);
    showToast("BOQ marked as sent", "success");
  };

  const handleSend = () => {
    const { blocks, warnings } = validateBoqForSend(boq);
    if (blocks.length > 0 || warnings.length > 0) {
      setSendValidation({ blocks, warnings });
      return;
    }
    finalizeSend();
  };

  const finalizeApprove = () => {
    updateInternal((prev) => {
      const approval = mergeApproval(prev.approval);
      const now = new Date().toISOString();
      const actor =
        getCurrentUser()?.name ||
        approval.approvedBy ||
        approval.reviewedBy ||
        "User";
      // Populate the change register if not already done at send-time (e.g. for
      // BOQs approved directly without a prior sent step).
      const prevSnapshot = (prev.revisionHistory || []).slice(-1)[0];
      const hasDiff =
        (prev.revisionComparison?.changes || []).length > 0;
      const diff =
        !hasDiff && prevSnapshot?.sections
          ? diffBoqRevisions(prevSnapshot.sections, prev.sections)
          : null;
      return {
        status: "approved",
        approval: {
          ...approval,
          reviewedAt: approval.reviewedAt || now,
          approvedAt: now,
        },
        ...(diff && {
          revisionComparison: {
            ...blankRevisionComparison(),
            ...(prev.revisionComparison || {}),
            previousRevision: prevSnapshot.revision ?? null,
            currentRevision: prev.revision ?? null,
            ...diff,
          },
        }),
        auditTrail: appendAuditTrail(prev, {
          action: "approved",
          label: "Approved",
          actor,
          details: "BOQ approval completed for this revision.",
          at: now,
        }),
      };
    });
    showToast("BOQ approved", "success");
  };

  const handleApprove = () => {
    const approval = mergeApproval(boq.approval);
    const checklistComplete = Object.values(approval.checklist).every(Boolean);
    const missingPeople = [
      !approval.reviewedBy && "reviewer",
      !approval.approvedBy && "approver",
    ].filter(Boolean);

    if (!checklistComplete || missingPeople.length > 0) {
      setConfirmDialog({
        title: "Approve with incomplete signoff?",
        message: [
          missingPeople.length > 0
            ? `Missing ${missingPeople.join(" and ")} name.`
            : "",
          !checklistComplete ? "Review checklist is not fully complete." : "",
        ]
          .filter(Boolean)
          .join(" "),
        confirmLabel: "Approve Anyway",
        onConfirm: finalizeApprove,
      });
      return;
    }

    finalizeApprove();
  };

  const handleSign = () => {
    if (isClientApprovalPending()) {
      showClientApprovalToast();
      return;
    }
    updateInternal((prev) => {
      const approval = mergeApproval(prev.approval);
      const now = new Date().toISOString();
      return {
        status: "signed",
        approval: {
          ...approval,
          clientAcceptedBy:
            approval.clientAcceptedBy || prev.client?.name || "Client",
          clientAcceptedAt: approval.clientAcceptedAt || now,
        },
        auditTrail: appendAuditTrail(prev, {
          action: "signed",
          label: "Client Signed",
          actor: approval.clientAcceptedBy || prev.client?.name || "Client",
          details: "Client acceptance recorded.",
          at: now,
        }),
      };
    });
    showToast("BOQ marked as signed", "success");
  };

  // Generate the client-facing FINAL QUOTE from this approved BOQ and publish it
  // to the client portal (writes into the shared quotes_<parentId> store). The
  // BOQ is the internal cost build-up; this is the priced document the client
  // actually receives. Gated on the BOQ clearing its send-readiness blocks and a
  // client being linked (validateFinalQuote covers both).
  const handleGenerateFinalQuote = () => {
    const { blocks } = validateFinalQuote(boq);
    if (blocks.length > 0) {
      showToast(blocks[0], "error");
      return;
    }
    // Build the quote once and show the admin the full rendered document for
    // review. The same object is what gets published on confirm — no second
    // quote id is generated.
    setFinalQuotePreview(createFinalQuoteFromBoq(boq));
  };

  // Publish the reviewed quote to the client portal. Runs only after the admin
  // has seen the preview and confirmed in the modal.
  const confirmPublishFinalQuote = () => {
    if (!finalQuotePreview || publishingFinalQuote) return;
    setPublishingFinalQuote(true);
    const res = sendFinalQuote(boq, finalQuotePreview);
    setPublishingFinalQuote(false);
    if (!res.ok) {
      showToast(res.error || "Could not generate the final quote.", "error");
      return;
    }
    // Stamp the generated quote onto the BOQ + audit trail so the link is
    // traceable. Metadata only — it doesn't touch scope, so it's safe even on a
    // locked/approved BOQ.
    updateInternal((prev) => ({
      finalQuote: {
        quoteId: res.quote.quoteId,
        generatedAt: res.quote.sentAt,
        grandTotal: res.quote.grandTotal,
        parentId: res.parentId,
      },
      auditTrail: appendAuditTrail(prev, {
        action: "final_quote_generated",
        label: "Final Quote Generated",
        actor: getCurrentUser()?.name || mergeApproval(prev.approval).approvedBy || "User",
        details: `Client quote ${res.quote.quoteId} published to the client portal.`,
      }),
    }));
    setFinalQuotePreview(null);
    showToast(
      `Final quote ${res.quote.quoteId} published to client`,
      "success",
    );
  };

  // Dismiss the in-BOQ client-response banner (mark the notification handled).
  // The record itself stays in the audit trail / approval signoff.
  const acknowledgeClientRequest = () => {
    updateInternal((prev) => ({
      clientRequest: { ...(prev.clientRequest || {}), acknowledged: true },
    }));
  };

  const handleIssueForProcurement = () => {
    if (isClientApprovalPending()) {
      showClientApprovalToast();
      return;
    }
    const materialCount = countMaterials(boq);
    if (materialCount === 0) {
      showToast("Add BOQ materials before issuing for procurement.", "info");
      return;
    }

    const contract = boq.client?.id ? getContractByClient(boq.client.id) : null;

    setConfirmDialog({
      title: "Issue for procurement?",
      message: contract?.id
        ? `This will lock ${boq.id} as the procurement basis and link it to contract ${contract.id}.`
        : `This will lock ${boq.id} as the procurement basis. No signed contract found — you can link one later.`,
      confirmLabel: "Issue Procurement",
      onConfirm: () => {
        const now = new Date().toISOString();
        if (contract?.id) linkBoqToContract(contract.id, boq.id);
        updateInternal((prev) => {
          const approval = mergeApproval(prev.approval);
          const issuedBy =
            approval.clientAcceptedBy ||
            approval.approvedBy ||
            prev.client?.name ||
            "Authorized user";
          return {
            status: "issued_for_procurement",
            procurement: {
              ...DEFAULT_PROCUREMENT,
              ...(prev.procurement || {}),
              issued: true,
              issuedAt: now,
              issuedBy,
              contractId: contract?.id || null,
            },
            auditTrail: appendAuditTrail(prev, {
              action: "issued_for_procurement",
              label: "Issued for Procurement",
              actor: issuedBy,
              details: contract?.id
                ? `Linked to contract ${contract.id} for RFQ and PO takeoff.`
                : "Issued for RFQ and PO takeoff. No contract linked yet.",
              at: now,
            }),
          };
        });
        showToast("BOQ issued for procurement", "success");
      },
    });
  };

  const handleCreateRevision = () => {
    const nextRevision = Number(boq.revision || 1) + 1;
    setConfirmDialog({
      title: "Create editable revision?",
      message: `${boq.id} Rev ${boq.revision || 1} is ${boq.status}. This will unlock a new draft revision while preserving the same BOQ record.`,
      confirmLabel: "Create Revision",
      onConfirm: () => {
        updateInternal({
          status: "draft",
          revision: nextRevision,
          orgSnapshot: null,
          procurement: DEFAULT_PROCUREMENT,
          approval: {
            ...DEFAULT_APPROVAL,
            preparedBy: mergeApproval(boq.approval).preparedBy,
            reviewedBy: mergeApproval(boq.approval).reviewedBy,
            approvedBy: mergeApproval(boq.approval).approvedBy,
            clientAcceptedBy: mergeApproval(boq.approval).clientAcceptedBy,
          },
          revisedFrom: {
            status: boq.status,
            revision: boq.revision || 1,
            at: new Date().toISOString(),
            approval: mergeApproval(boq.approval),
            procurement: boq.procurement || DEFAULT_PROCUREMENT,
          },
          revisionHistory: [
            ...(boq.revisionHistory || []),
            {
              revision: boq.revision || 1,
              status: boq.status,
              at: new Date().toISOString(),
              sections: JSON.parse(JSON.stringify(boq.sections || [])),
              approval: mergeApproval(boq.approval),
            },
          ],
          revisionComparison: createRevisionComparison(boq, nextRevision),
          auditTrail: appendAuditTrail(boq, {
            action: "revision_created",
            label: "Revision Created",
            actor: getCurrentUser()?.name || "User",
            details: `Revision ${nextRevision} opened from ${boq.status}.`,
          }),
        });
        showToast(`Revision ${nextRevision} created`, "success");
      },
    });
  };

  const handleDuplicate = () => {
    const next = duplicateBoq(boq.id);
    if (next) {
      navigate(`/boq/${next.id}`);
      showToast(`Duplicated as ${next.id}`, "success");
    }
  };

  const handleSyncHsnFromMaster = () => {
    const library = listLibrary();
    // Build two lookups: by masterId (exact) and by description (fuzzy fallback)
    const masterById = {};
    const masterByDesc = {};
    for (const l of library) {
      if (l.id) masterById[l.id] = l;
      if (l.description) masterByDesc[l.description.toLowerCase().trim()] = l;
    }

    let updated = 0;
    const newSections = (boq.sections || []).map((s) => ({
      ...s,
      items: (s.items || []).map((it) => {
        const master =
          (it.masterId ? masterById[it.masterId] : null) ||
          masterByDesc[(it.description || "").toLowerCase().trim()];
        const masterHsn = master?.hsn || "";
        if (masterHsn && it.hsn !== masterHsn) {
          updated++;
          return { ...it, hsn: masterHsn };
        }
        return it;
      }),
    }));

    if (updated > 0) {
      updateInternal({ sections: newSections });
    }
    showToast(
      updated > 0
        ? `HSN synced for ${updated} item${updated === 1 ? "" : "s"} from Item Master`
        : "No items matched Item Master entries with HSN set",
      updated > 0 ? "success" : "info",
    );
  };

  const handleGenerateFromSurvey = () => {
    const siteID = boq.siteID || boq.project?.siteID;
    if (!siteID) {
      setShowSurveyPicker(true);
      return;
    }
    runGenerateFromSurvey(siteID);
  };

  const runGenerateFromSurvey = (siteID) => {
    const flow = getDesignFlow(siteID);
    if (!flow?.siteBasis) {
      showToast("No frozen survey found for this site.", "info");
      return;
    }
    const surveyBoq = buildBoq(flow);
    if (!surveyBoq?.areas?.length) {
      showToast("Survey has no measured items to generate from.", "info");
      return;
    }
    const totalItems = surveyBoq.areas.reduce((s, a) => s + a.rows.length, 0);
    setConfirmDialog({
      title: "Generate from Survey",
      message: `Populate ${surveyBoq.areas.length} section(s) with ${totalItems} item(s) from the frozen site survey. Existing manual sections are preserved.`,
      confirmLabel: "Generate",
      onConfirm: () => {
        const existingSections = boq.sections || [];
        const surveyAreaNames = new Set(surveyBoq.areas.map((a) => a.area));
        const library = listLibrary();
        const masterById = Object.fromEntries(library.map((l) => [l.id, l]));
        const masterByDesc = Object.fromEntries(
          library
            .filter((l) => l.description)
            .map((l) => [l.description.toLowerCase().trim(), l]),
        );
        const resolveHsn = (row, existing) => {
          if (row.selectedMaterial?.hsn) return row.selectedMaterial.hsn;
          const masterId = row.masterId || existing?.masterId;
          const master =
            (masterId ? masterById[masterId] : null) ||
            masterByDesc[(row.name || "").toLowerCase().trim()];
          return master?.hsn || existing?.hsn || "";
        };
        const generatedSections = surveyBoq.areas.map((area) => {
          const existingSection = existingSections.find(
            (s) => s.name === area.area,
          );
          const matchedIds = new Set();
          const items = area.rows.map((row) => {
            const existing = (existingSection?.items || []).find(
              (it) =>
                (row.scopeItemId && it.scopeItemId === row.scopeItemId) ||
                it.description === row.name,
            );
            if (existing) matchedIds.add(existing.id);
            const d = getElementMeasurement(
              flow.siteBasis?.measurements,
              area.area,
              row,
            );
            const hasDims = [d.length, d.breadth ?? d.width, d.height].some(
              (v) => Number(v) > 0,
            );
            const newItem = blankItem();
            return {
              ...newItem,
              ...existing,
              id: existing?.id || newItem.id,
              scopeItemId: row.scopeItemId || existing?.scopeItemId || null,
              masterId: row.masterId || existing?.masterId || null,
              description: row.name,
              spec:
                row.selectedMaterial?.specifications ||
                row.selectedMaterial?.spec ||
                existing?.spec ||
                "",
              hsn: resolveHsn(row, existing),
              qty: row.measuredQty,
              unit: row.unit,
              rate: row.rate,
              gstPercent:
                row.selectedMaterial?.gstPercent ?? existing?.gstPercent ?? 18,
              discount: existing?.discount || { type: "percent", value: 0 },
              materials: row.materials || existing?.materials || [],
              dimensions: {
                enabled: hasDims,
                length: Number(d.length) || 0,
                breadth: Number(d.breadth ?? d.width) || 0,
                height: Number(d.height) || 0,
                nos: Number(d.nos) || 1,
              },
              siteSurveySource: true,
              siteID,
              quotedQty: row.quotedQty,
              quotedAmount: row.quotedAmount,
              measuredQty: row.measuredQty,
              siteMeasuredQty: row.measuredQty,
              surveyVariance: row.variance,
            };
          });
          return {
            id: existingSection?.id || blankSection().id,
            name: area.area,
            category: area.area,
            items: [
              ...items,
              ...(existingSection?.items || []).filter(
                (it) => !matchedIds.has(it.id) && !it.siteSurveySource,
              ),
            ],
          };
        });
        const merged = [
          ...generatedSections,
          ...existingSections.filter((s) => !surveyAreaNames.has(s.name)),
        ];
        updateInternal({
          sections: merged,
          siteID,
          surveyFrozenAt: flow.siteBasis?.frozenAt || null,
          quotedTotal: surveyBoq.quotedTotal,
          measuredTotal: surveyBoq.total,
        });
        showToast(
          `Generated ${surveyBoq.areas.length} section(s) with ${totalItems} item(s) from survey`,
          "success",
        );
      },
    });
  };

  const handleDelete = () => {
    setConfirmDialog({
      title: "Delete this BOQ?",
      message: `${boq.id} will be permanently removed. This cannot be undone.`,
      confirmLabel: "Delete BOQ",
      danger: true,
      onConfirm: () => {
        deleteBoq(boq.id);
        navigate("/boq");
      },
    });
  };

  const seedFromPreset = (presetKey) => {
    if (!canEditBoq()) {
      showLockedToast();
      return;
    }
    const next = createBoq({
      title: boq.title,
      client: boq.client,
      project: boq.project,
      basedOnPreset: presetKey,
    });
    // Keep the same ID so we don't orphan storage
    saveBoq({ ...next, id: boq.id, createdAt: boq.createdAt });
    setBoq({ ...next, id: boq.id, createdAt: boq.createdAt });
    setShowSeedPicker(false);
    showToast(`Loaded ${presetKey} preset`, "success");
  };

  // Keyboard shortcut: Cmd/Ctrl + S to save, Esc to close dialogs/preview.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (boq) handleSave();
      }
      if (e.key === "Escape") {
        setConfirmDialog(null);
        setSendValidation(null);
        setShowPreview(false);
        setShowSeedPicker(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boq]);

  const totals = useMemo(() => (boq ? computeBoqTotals(boq) : null), [boq]);

  // Average Margin % and PCE % across every item that carries an enabled rate
  // build-up — a quick read on the commercial loading applied across the BOQ.
  const raAverages = useMemo(() => {
    const items = (boq?.sections || []).flatMap((s) => s.items || []);
    const withRa = items.filter((it) => it.rateAnalysis?.enabled);
    if (withRa.length === 0)
      return { marginPct: 0, pcePct: 0, marginAmt: 0, pceAmt: 0, count: 0 };
    const sum = (key) =>
      withRa.reduce((s, it) => s + (Number(it.rateAnalysis?.[key]) || 0), 0);
    // Total ₹ margin / PCE across the BOQ = Σ (per-unit amount × item qty),
    // derived from each item's computed rate analysis.
    const amt = (key) =>
      withRa.reduce((s, it) => {
        const ra = computeRateAnalysis(it.rateAnalysis, it.unit);
        return s + (Number(ra?.[key]) || 0) * computeItemQty(it);
      }, 0);
    return {
      marginPct: sum("marginPercent") / withRa.length,
      pcePct: sum("pcePercent") / withRa.length,
      marginAmt: amt("marginAmount"),
      pceAmt: amt("pceAmount"),
      count: withRa.length,
    };
  }, [boq]);

  const roomBreakdown = useMemo(() => {
    if (!boq?.sections?.length) return [];
    const groups = {};
    for (const sec of boq.sections) {
      const key = sec.category || sec.name || "Other";
      if (!groups[key])
        groups[key] = {
          category: key,
          sectionIds: [],
          net: 0,
          gst: 0,
          itemCount: 0,
        };
      groups[key].sectionIds.push(sec.id);
      for (const item of sec.items || []) {
        const r = computeItemAmount(item);
        groups[key].net += r.net;
        groups[key].gst += r.gst;
        groups[key].itemCount += 1;
      }
    }
    return Object.values(groups).sort((a, b) => b.net - a.net);
  }, [boq?.sections]);

  const scrollToSection = (sectionId) => {
    document
      .getElementById(`section-${sectionId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const gst = useMemo(() => (boq ? resolveGstTreatment(boq) : null), [boq]);
  const itemCount = useMemo(
    () =>
      (boq?.sections || []).reduce((s, sec) => s + (sec.items?.length || 0), 0),
    [boq],
  );

  const roomGroups = useMemo(() => {
    const groups = [];
    const map = {};
    for (const sec of boq?.sections || []) {
      const key = sec.category || sec.name || "Uncategorized";
      if (!map[key]) {
        map[key] = { label: key, items: [] };
        groups.push(map[key]);
      }
      for (const item of sec.items || []) {
        map[key].items.push({ ...item, _from: sec.name });
      }
    }
    return groups;
  }, [boq]);

  const workGroups = useMemo(() => {
    const groups = [];
    const map = {};
    for (const sec of boq?.sections || []) {
      for (const item of sec.items || []) {
        const key = item.description || "Uncategorized";
        if (!map[key]) {
          map[key] = { label: key, items: [] };
          groups.push(map[key]);
        }
        map[key].items.push({ ...item, _from: sec.category || sec.name });
      }
    }
    return groups;
  }, [boq]);

  if (!boq) {
    return <div className="p-8 text-text-muted text-sm">Loading BOQ…</div>;
  }

  const status = STATUS_STYLES[boq.status] || STATUS_STYLES.draft;
  const isLocked = isLockedStatus(boq.status);
  const approval = mergeApproval(boq.approval);
  const isSignoffLocked = isSignoffLockedStatus(boq.status);
  // Commit steps (tender / signed / procurement) are gated until the client
  // has accepted a final quote. Show different tooltips based on whether a
  // quote has been generated yet.
  const awaitingClient = isClientApprovalPending();
  const gatedBtn = awaitingClient ? "opacity-50 cursor-not-allowed" : "";
  const gateTitle = awaitingClient
    ? !boq?.finalQuote
      ? "Generate and send a final quote to the client first"
      : "Waiting for client approval of the final quote"
    : undefined;

  return (
    <div className="bg-overallbg font-sans h-full overflow-hidden flex flex-col">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-overallbg/80 backdrop-blur-xl border-b border-bordergray/70 shrink-0">
        <div className="px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate("/boq")}
              className="h-9 w-9 flex items-center justify-center rounded-lg border border-bordergray bg-white text-text-muted hover:text-textcolor hover:bg-bg-soft"
              title="Back to list"
            >
              <ArrowLeft size={15} />
            </button>
            <div className="h-10 w-10 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-md shadow-select-blue/20">
              <FileText size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold tracking-widest uppercase text-select-blue bg-select-blue/10 px-1.5 py-0.5 rounded-md border border-select-blue/20">
                  {boq.id}
                </span>
                <span
                  className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md border ${status.bg} ${status.text} ${status.border}`}
                >
                  {boq.status.replace(/_/g, " ")}
                </span>
              </div>
              <input
                type="text"
                value={boq.title}
                onChange={(e) => update({ title: e.target.value })}
                disabled={isLocked}
                placeholder="Untitled BOQ"
                className="text-[16px] font-bold text-textcolor bg-transparent border-0 focus:outline-none focus:ring-0 px-0 py-0 mt-0.5 min-w-[200px] hover:bg-white/40 rounded transition-colors disabled:hover:bg-transparent disabled:cursor-default"
              />
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-text-subtle">{boq.sections.length} sections</span>
                <span className="text-text-subtle/40 text-[10px]">·</span>
                <span className="text-[10px] text-text-subtle">{itemCount} items</span>
                <span className="text-text-subtle/40 text-[10px]">·</span>
                <span className="text-[10px] text-text-subtle">Rev {boq.revision}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSheetsMenu((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
              >
                <Layers size={12} /> Sheets <ChevronDown size={11} className="text-text-muted" />
              </button>
              {showSheetsMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSheetsMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-bordergray bg-white shadow-lg py-1 overflow-hidden">
                    {[
                      { label: "Master Sheet", icon: <Layers size={13} />, action: () => { setShowMasterSheet(true); setShowSheetsMenu(false); } },
                      { label: "Measurement Sheet", icon: <Ruler size={13} />, action: () => { setShowMeasurementSheet(true); setShowSheetsMenu(false); } },
                      { label: "Material Sheet", icon: <Package size={13} />, action: () => { setShowMaterialSheet(true); setShowSheetsMenu(false); } },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={item.action}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-textcolor hover:bg-bg-soft text-left"
                      >
                        <span className="text-text-muted">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
              title="Preview client-ready document & print / save as PDF"
            >
              <FileText size={12} /> Preview / Print
            </button>
            {boq.status === "draft" && (
              <button
                type="button"
                onClick={handleSend}
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-500 text-white rounded-lg text-[11.5px] font-semibold hover:bg-blue-600 transition-all shadow-sm"
              >
                <Send size={12} /> Mark Sent
              </button>
            )}
            {[
              "sent",
              "approved",
              "signed",
              "issued_for_procurement",
            ].includes(boq.status) && (
              <button
                type="button"
                onClick={handleGenerateFinalQuote}
                className="flex items-center gap-1.5 px-3 py-2 bg-teal-500 text-white rounded-lg text-[11.5px] font-semibold hover:bg-teal-600 transition-all shadow-sm"
                title="Generate the client-facing final quote from this BOQ and publish it to the client portal"
              >
                <Wallet size={12} /> Final Quote
              </button>
            )}
            {["approved", "signed"].includes(boq.status) && (
              awaitingClient ? (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Info size={12} /> Awaiting client approval
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleIssueForProcurement}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white rounded-lg text-[11.5px] font-semibold hover:bg-indigo-600 transition-all shadow-sm"
                >
                  <PackageCheck size={12} /> Issue Procurement
                </button>
              )
            )}
            {isLocked && isClientApprovalPending() && (
              <button
                type="button"
                onClick={handleCreateRevision}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-[11.5px] font-semibold hover:bg-amber-600 transition-all shadow-sm"
              >
                <RotateCcw size={12} /> Create Revision
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isLocked}
              className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer rounded-lg text-[11.5px] font-semibold transition-all shadow-md ${
                isLocked
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed shadow-none"
                  : savedFlash
                    ? "bg-emerald-500 text-white"
                    : "bg-linear-to-br from-select-blue to-primary text-white hover:scale-[1.02]"
              }`}
            >
              {savedFlash ? <Check size={12} /> : <Save size={12} />}
              {savedFlash ? "Saved" : "Save"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-9 w-20 flex items-center justify-center gap-1.5  text-[11.5px] px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-all"
              title="Delete this BOQ"
            >
              <Trash2 size={12} />  Delete
            </button>
          </div>
        </div>

        {isLocked && showLockNotice && (
          <div className="px-6 pb-3">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
              <div className="flex items-start gap-2">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                <p className="text-[11.5px] leading-relaxed">
                  {boq.status === "signed" ? (
                    <>
                      This BOQ is <b>signed</b>. Editing is locked — click{" "}
                      <b>Issue Procurement</b> in the toolbar to proceed, or{" "}
                      <b>Create Revision</b> to reopen it for editing.
                    </>
                  ) : boq.status === "issued_for_procurement" ? (
                    <>
                      This BOQ has been <b>issued for procurement</b>. It is
                      read-only to protect the controlled version. Create a
                      revision if changes are needed.
                    </>
                  ) : boq.status === "procurement" ? (
                    <>
                      This BOQ is under active <b>procurement</b>. It is
                      read-only to protect the controlled version. Create a
                      revision if changes are needed.
                    </>
                  ) : (
                    <>
                      This BOQ is <b>{boq.status}</b>
                      . It is read-only to protect the controlled version.
                      Create a revision to make changes.
                    </>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowLockNotice(false)}
                className="ml-auto shrink-0 -mr-0.5 -mt-0.5 rounded-md p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                title="Dismiss"
                aria-label="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

      </div>

      <div className="px-6 py-5 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col scroll-hidden-bar">
        {boq.clientRequest && !boq.clientRequest.acknowledged && (
          <div
            className={`mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12px] ${
              boq.clientRequest.type === "accepted"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            {boq.clientRequest.type === "accepted" ? (
              <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
            ) : (
              <Info size={15} className="mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold">
                {boq.clientRequest.type === "accepted"
                  ? "Client accepted the quote"
                  : "Client requested changes"}
                {boq.clientRequest.quoteId
                  ? ` · ${boq.clientRequest.quoteId}`
                  : ""}
              </p>
              <p className="mt-0.5 leading-relaxed">
                <span className="font-semibold">
                  {boq.clientRequest.by || "Client"}
                </span>
                {boq.clientRequest.type === "accepted"
                  ? " accepted this quote in the portal."
                  : " requested changes in the portal."}
                {boq.clientRequest.at &&
                  ` (${new Date(boq.clientRequest.at).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })})`}
              </p>
              {boq.clientRequest.type === "changes_requested" &&
                boq.clientRequest.comment && (
                  <p className="mt-1.5 rounded-lg bg-white/60 border border-amber-200 px-2.5 py-1.5 italic">
                    “{boq.clientRequest.comment}”
                  </p>
                )}
            </div>
            <button
              type="button"
              onClick={acknowledgeClientRequest}
              className={`ml-auto shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                boq.clientRequest.type === "accepted"
                  ? "text-emerald-700 hover:bg-emerald-100"
                  : "text-amber-800 hover:bg-amber-100"
              }`}
              title="Dismiss this notification"
            >
              Dismiss
            </button>
          </div>
        )}
        {boq.surveyStale && showSurveyStaleNotice && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              The linked site survey was unlocked after this BOQ was generated.
              Treat these quantities as stale until the survey is frozen and the
              BOQ is regenerated.
            </span>
            <button
              type="button"
              onClick={() => setShowSurveyStaleNotice(false)}
              className="ml-auto shrink-0 -mr-1 -mt-1 rounded-md p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700 transition-colors"
              title="Dismiss"
              aria-label="Dismiss notice"
            >
              <X size={14} />
            </button>
          </div>
        )}
        {boq.siteID && Number.isFinite(Number(boq.quotedTotal)) && (() => {
          const overTolerance = Number(boq.surveyVariance) > Number(boq.surveyToleranceAmount || 15000);
          const stats = [
            { label: "Proposal Quoted", value: boq.quotedTotal, signed: false, tone: "text-select-blue", accent: "border-select-blue/60" },
            { label: "Current BOQ", value: totals.grandTotal, signed: false, tone: "text-purple-700", accent: "border-purple-400" },
            { label: "Survey Difference", value: boq.surveyVariance, signed: true, tone: overTolerance ? "text-red-600" : "text-emerald-700", accent: overTolerance ? "border-red-400" : "border-emerald-500" },
          ];
          return (
            <div className="mb-4 flex items-stretch gap-2.5">
              {stats.map((stat) => {
                const amount = Number(stat.value) || 0;
                const prefix = stat.signed && amount > 0 ? "+" : "";
                return (
                  <div key={stat.label} className={`flex-1 flex flex-col justify-center px-3.5 py-2 bg-white rounded-lg border-l-[3px] shadow-sm ${stat.accent}`}>
                    <p className="text-[8.5px] font-bold uppercase tracking-widest text-text-subtle">{stat.label}</p>
                    <p className={`text-[14px] font-bold tabular-nums leading-tight mt-0.5 ${stat.tone}`}>{prefix}{formatAmount(amount)}</p>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {/* ── Editor tabs: Scope of Work | Rate Analysis ─────────────────── */}
        <div className="mb-4 flex items-center gap-1 border-b border-bordergray">
          {[
            {
              key: "scope",
              label: "Scope of Work",
              icon: <Layers size={13} />,
            },
            {
              key: "rate",
              label: "Rate Analysis",
              icon: <Calculator size={13} />,
            },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setEditorTab(t.key)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[12px] font-semibold transition-colors ${
                editorTab === t.key
                  ? "border-select-blue text-select-blue"
                  : "border-transparent text-text-muted hover:text-textcolor"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {editorTab === "scope" && (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            {/* ── Left: Sections + line items ─────────────────────────────── */}
            <main className="space-y-5 min-w-0 lg:overflow-y-auto lg:pr-2 lg:pb-6 scroll-hidden-bar">
              {/* Client & Project meta */}
              <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-5 py-3 border-b border-bordergray flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-select-blue" />
                    <h3 className="text-[12px] font-bold text-textcolor">
                      Client & Project
                    </h3>
                    {boq.client?.id && (
                      <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Linked · {boq.client.id}
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Field icon={<User size={11} />} label="Client Name">
                    <input
                      type="text"
                      value={boq.client?.name || ""}
                      onChange={(e) => updateClient({ name: e.target.value })}
                      disabled={isLocked}
                      placeholder="Mr / Ms…"
                      className={`${inputBase} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </Field>
                  <Field icon={<Hash size={11} />} label="GSTIN">
                    <input
                      type="text"
                      value={boq.client?.gstin || ""}
                      onChange={(e) => updateClient({ gstin: e.target.value })}
                      disabled={isLocked}
                      placeholder="22AAAAA0000A1Z5"
                      className={`${inputBase} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </Field>
                  <Field
                    icon={<Building2 size={11} />}
                    label="Client State"
                    hint="Used for GST place of supply when there's no GSTIN"
                  >
                    <input
                      type="text"
                      value={boq.client?.state || ""}
                      onChange={(e) => updateClient({ state: e.target.value })}
                      disabled={isLocked}
                      placeholder="e.g. Tamil Nadu"
                      className={`${inputBase} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </Field>
                  <Field
                    icon={<Building2 size={11} />}
                    label="Project / Property"
                  >
                    <input
                      type="text"
                      value={boq.project?.name || ""}
                      onChange={(e) => updateProject({ name: e.target.value })}
                      disabled={isLocked}
                      placeholder="e.g. Sharma Residence"
                      className={`${inputBase} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </Field>
                  <Field icon={<Calendar size={11} />} label="Validity">
                    <input
                      type="text"
                      value={boq.validity || ""}
                      onChange={(e) => update({ validity: e.target.value })}
                      disabled={isLocked}
                      placeholder="30 days from issue"
                      className={`${inputBase} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </Field>
                  <Field icon={<FileText size={11} />} label="BOQ Type">
                    <select
                      value={boq.boqType || "client"}
                      onChange={(e) => update({ boqType: e.target.value })}
                      disabled={isLocked}
                      className={`${inputBase} cursor-pointer disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    >
                      {BOQ_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    icon={<ShieldCheck size={11} />}
                    label="Warranty / Defect Liability"
                  >
                    <input
                      type="text"
                      value={boq.warrantyText || ""}
                      onChange={(e) => update({ warrantyText: e.target.value })}
                      disabled={isLocked}
                      placeholder="e.g. 12 months on hardware, 60 days defect liability"
                      className={`${inputBase} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </Field>
                  {(boq.client?.phone ||
                    boq.client?.email ||
                    boq.project?.address) && (
                    <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-muted bg-bg-soft/60 border border-bordergray rounded-lg px-3 py-2">
                      {boq.client?.phone && <span>📞 {boq.client.phone}</span>}
                      {boq.client?.email && <span>✉️ {boq.client.email}</span>}
                      {boq.project?.address && (
                        <span>📍 {boq.project.address}</span>
                      )}
                      {boq.project?.propertyType && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-select-blue bg-white px-1.5 py-0.5 rounded border border-bordergray">
                          {boq.project.propertyType}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* Sections */}
              <section className="space-y-4">
                {boq.sections.length === 0 && (
                  <EmptySectionsState
                    onAdd={isLocked ? handleCreateRevision : addSection}
                    onAddFromTemplate={
                      isLocked
                        ? handleCreateRevision
                        : isArchitectureBoq
                          ? () => setShowArchSectionPicker(true)
                          : () => setShowSectionPicker(true)
                    }
                    isArchitecture={isArchitectureBoq}
                  />
                )}

                {/* Find-in-BOQ search */}
                {boq.sections.length > 0 && (
                  <div className="sticky top-0 z-20 bg-overallbg py-1.5">
                  <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] px-3 py-2 flex items-center gap-2">
                    <Search
                      size={13}
                      className="text-text-subtle shrink-0 ml-1"
                    />
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Find in BOQ — search section, item description, HSN, material…"
                      className="flex-1 bg-transparent border-0 text-[12px] text-textcolor placeholder:text-text-subtle focus:outline-none focus:ring-0 px-1 py-1"
                    />
                    {itemSearch && (
                      <>
                        <span className="text-[10px] font-semibold text-text-muted bg-bg-soft px-2 py-0.5 rounded-md">
                          {(() => {
                            const q = itemSearch.toLowerCase();
                            const matchCount = boq.sections.reduce(
                              (s, sec) =>
                                s +
                                (sec.items || []).filter(
                                  (it) =>
                                    (it.description || "")
                                      .toLowerCase()
                                      .includes(q) ||
                                    (it.hsn || "").toLowerCase().includes(q) ||
                                    (it.materials || []).some(
                                      (m) =>
                                        (m.name || "")
                                          .toLowerCase()
                                          .includes(q) ||
                                        (m.spec || "")
                                          .toLowerCase()
                                          .includes(q),
                                    ),
                                ).length,
                              0,
                            );
                            return `${matchCount} match${matchCount === 1 ? "" : "es"}`;
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setItemSearch("")}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-textcolor hover:bg-bg-soft"
                          title="Clear search"
                        >
                          <X size={12} />
                        </button>
                      </>
                    )}
                    <span className="h-4 w-px bg-bordergray shrink-0 mx-1" />
                    <div className="flex items-center gap-0.5 bg-bg-soft rounded-md p-0.5 shrink-0">
                      {[
                        {
                          mode: "section",
                          label: "Section",
                          icon: <Hash size={11} />,
                        },
                        {
                          mode: "room",
                          label: "Room",
                          icon: <Building2 size={11} />,
                        },
                        {
                          mode: "work",
                          label: "Work",
                          icon: <Layers size={11} />,
                        },
                        {
                          mode: "all",
                          label: "All Items",
                          icon: <List size={11} />,
                        },
                      ].map(({ mode, label, icon }) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setGroupMode(mode)}
                          title={`Group by ${label}`}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-semibold transition-all ${
                            groupMode === mode
                              ? "bg-white text-textcolor shadow-sm"
                              : "text-text-muted hover:text-textcolor"
                          }`}
                        >
                          {icon}
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  </div>
                )}

                {/* All Items flat list — read-only */}
                {groupMode === "all" &&
                  boq.sections.length > 0 &&
                  (() => {
                    const allItems = boq.sections.flatMap((sec, sIdx) =>
                      (sec.items || []).map((item, iIdx) => ({
                        item,
                        secLabel: sec.name || `Section ${sIdx + 1}`,
                        ref: `${sIdx + 1}.${iIdx + 1}`,
                      })),
                    );
                    const grandNet = allItems.reduce((s, { item }) => {
                      const a = computeItemAmount(item);
                      return s + a.net;
                    }, 0);
                    return (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200/70 rounded-xl text-[11px] text-amber-800">
                          <Info size={12} className="shrink-0" />
                          <span>
                            All Items view is read-only —{" "}
                            <button
                              type="button"
                              onClick={() => setGroupMode("section")}
                              className="font-bold underline underline-offset-2"
                            >
                              switch to Section view
                            </button>{" "}
                            to edit.
                          </span>
                        </div>
                        <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
                          <table className="w-full text-[12px]">
                            <thead>
                              <tr className="bg-bg-soft/60 border-b border-bordergray text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                                <th className="px-3 py-2 text-center w-16">
                                  #
                                </th>
                                <th className="px-3 py-2 text-center w-32">
                                  Section
                                </th>
                                <th className="px-3 py-2 text-center">
                                  Description
                                </th>
                                <th className="px-3 py-2 text-center w-20">
                                  Qty
                                </th>
                                <th className="px-3 py-2 text-center w-16">
                                  Unit
                                </th>
                                <th className="px-3 py-2 text-center w-28">
                                  Rate (₹)
                                </th>
                                <th className="px-3 py-2 text-center w-32">
                                  Amount (₹)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {allItems.map(({ item, secLabel, ref }, i) => {
                                const amt = computeItemAmount(item);
                                const qty = computeItemQty(item);
                                return (
                                  <tr
                                    key={item.id || i}
                                    className="border-t border-bordergray hover:bg-bg-soft/30"
                                  >
                                    <td className="px-3 py-2 text-center text-[10.5px] font-bold text-text-muted tabular-nums">
                                      {ref}
                                    </td>
                                    <td className="px-3 py-2 text-center text-[10.5px] text-text-muted">
                                      {secLabel}
                                    </td>
                                    <td className="px-3 py-2 text-textcolor">
                                      {item.description || (
                                        <span className="text-text-subtle italic">
                                          No description
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">
                                      {qty.toFixed(2).replace(/\.00$/, "")}
                                    </td>
                                    <td className="px-3 py-2 text-center text-text-muted">
                                      {item.unit || "—"}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums">
                                      {formatAmount(item.rate || 0)}
                                    </td>
                                    <td className="px-3 py-2 text-center tabular-nums font-semibold">
                                      {formatAmount(amt.net)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-bordergray bg-bg-soft/40">
                                <td
                                  colSpan={6}
                                  className="px-3 py-2 text-[10.5px] font-bold text-text-muted text-right"
                                >
                                  Grand Total
                                </td>
                                <td className="px-3 py-2 text-center tabular-nums font-bold text-textcolor">
                                  {formatAmount(grandNet)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    );
                  })()}

                {/* Room / Work grouped view — read-only */}
                {(groupMode === "room" || groupMode === "work") &&
                  boq.sections.length > 0 &&
                  (() => {
                    const groups =
                      groupMode === "room" ? roomGroups : workGroups;
                    return (
                      <>
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200/70 rounded-xl text-[11px] text-amber-800">
                          <Info size={12} className="shrink-0" />
                          <span>
                            Grouped view is read-only —{" "}
                            <button
                              type="button"
                              onClick={() => setGroupMode("section")}
                              className="font-bold underline underline-offset-2"
                            >
                              switch to Section view
                            </button>{" "}
                            to edit.
                          </span>
                        </div>
                        {groups.map((group, gIdx) => {
                          const c = roomColor(group.label);
                          const groupTotal = group.items.reduce(
                            (s, it) => s + computeItemAmount(it).total,
                            0,
                          );
                          return (
                            <div
                              key={`${groupMode}_${gIdx}`}
                              className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden"
                            >
                              <div className="px-4 py-3 border-b border-bordergray flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`h-7 w-7 flex items-center justify-center rounded-lg ${c.bg}`}
                                  >
                                    <span
                                      className={`h-2.5 w-2.5 rounded-full ${c.dot}`}
                                    />
                                  </span>
                                  <span className="text-[13px] font-bold text-textcolor truncate">
                                    {group.label || "Uncategorized"}
                                  </span>
                                  <span className="text-[10px] text-text-muted bg-bg-soft px-1.5 py-0.5 rounded border border-bordergray shrink-0">
                                    {group.items.length} item
                                    {group.items.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <span className="text-[13px] font-bold text-textcolor tabular-nums shrink-0">
                                  {formatAmount(groupTotal)}
                                </span>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                  <thead>
                                    <tr className="bg-bg-soft/60 border-b border-bordergray text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                                      <th className="px-3 py-2 text-center w-32">
                                        {groupMode === "room"
                                          ? "Section"
                                          : "Room / Area"}
                                      </th>
                                      <th className="px-3 py-2 text-center">
                                        Description
                                      </th>
                                      <th className="px-3 py-2 text-center w-20">
                                        Qty
                                      </th>
                                      <th className="px-3 py-2 text-center w-16">
                                        Unit
                                      </th>
                                      <th className="px-3 py-2 text-center w-24">
                                        Rate (₹)
                                      </th>
                                      <th className="px-3 py-2 text-center w-28">
                                        Amount (₹)
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.items.map((item, iIdx) => {
                                      const amt = computeItemAmount(item);
                                      const qty = computeItemQty(item);
                                      return (
                                        <tr
                                          key={item.id || iIdx}
                                          className="border-t border-bordergray hover:bg-bg-soft/30"
                                        >
                                          <td className="px-3 py-2 text-center text-[10.5px] text-text-muted">
                                            {item._from || "—"}
                                          </td>
                                          <td className="px-3 py-2 text-textcolor">
                                            {item.description || (
                                              <span className="text-text-subtle italic">
                                                No description
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-center tabular-nums">
                                            {qty
                                              .toFixed(2)
                                              .replace(/\.00$/, "")}
                                          </td>
                                          <td className="px-3 py-2 text-center text-text-muted">
                                            {item.unit}
                                          </td>
                                          <td className="px-3 py-2 text-center tabular-nums">
                                            {formatAmount(item.rate || 0)}
                                          </td>
                                          <td className="px-3 py-2 text-center tabular-nums font-semibold">
                                            {formatAmount(amt.total)}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                  <tfoot>
                                    <tr className="border-t-2 border-bordergray bg-bg-soft/40">
                                      <td
                                        colSpan={5}
                                        className="px-3 py-2 text-[10.5px] font-bold text-text-muted text-center"
                                      >
                                        Subtotal
                                      </td>
                                      <td className="px-3 py-2 text-center tabular-nums font-bold text-textcolor">
                                        {formatAmount(groupTotal)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}

                {/* Section-wise view */}
                {groupMode === "section" &&
                  boq.sections.map((section, sIdx) => {
                    const c = roomColor(section.category);
                    const isOpen = expanded[section.id] !== false;
                    const sectionTotal = (section.items || []).reduce(
                      (s, it) => s + computeItemAmount(it).total,
                      0,
                    );

                    // Apply item search filter
                    const q = itemSearch.trim().toLowerCase();
                    const itemMatchesSearch = (it) => {
                      if (!q) return true;
                      return (
                        (it.description || "").toLowerCase().includes(q) ||
                        (it.hsn || "").toLowerCase().includes(q) ||
                        (it.materials || []).some(
                          (m) =>
                            (m.name || "").toLowerCase().includes(q) ||
                            (m.spec || "").toLowerCase().includes(q),
                        )
                      );
                    };
                    const sectionMatchesName =
                      q && (section.name || "").toLowerCase().includes(q);
                    const visibleItems = q
                      ? section.items.filter(itemMatchesSearch)
                      : section.items;
                    // Hide the entire section if a search is active AND nothing inside matches
                    if (q && visibleItems.length === 0 && !sectionMatchesName) {
                      return null;
                    }
                    return (
                      <div
                        key={section.id}
                        id={`section-${section.id}`}
                        className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden"
                      >
                        {/* Section header */}
                        <div
                          className={`px-4 py-3 border-b border-bordergray flex items-center justify-between gap-3 bg-linear-to-r ${c.bg.replace("bg-", "from-")}/40 to-white`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((p) => ({
                                  ...p,
                                  [section.id]: !isOpen,
                                }))
                              }
                              className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:bg-white"
                              title={isOpen ? "Collapse" : "Expand"}
                            >
                              {isOpen ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </button>
                            <span className="text-[10px] font-bold text-text-muted bg-white px-1.5 py-0.5 rounded border border-bordergray tabular-nums">
                              {String(sIdx + 1).padStart(2, "0")}
                            </span>
                            <span
                              className={`h-7 w-7 flex items-center justify-center rounded-lg ${c.bg}`}
                            >
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${c.dot}`}
                              />
                            </span>
                            <input
                              type="text"
                              value={section.name}
                              onChange={(e) =>
                                updateSection(section.id, {
                                  name: e.target.value,
                                })
                              }
                              disabled={isLocked}
                              placeholder="Section name"
                              className="text-[13px] font-bold text-textcolor bg-transparent border-0 focus:outline-none focus:bg-white focus:rounded focus:px-2 focus:py-1 px-0 py-1 transition-all min-w-0 flex-1 disabled:cursor-default disabled:focus:bg-transparent"
                            />
                            <CategorySelect
                              value={section.category}
                              onChange={(v) =>
                                updateSection(section.id, { category: v })
                              }
                              disabled={isLocked}
                              placeholder="Room…"
                              className="text-[10.5px] font-semibold bg-white border border-bordergray rounded-md px-1.5 py-1 text-text-muted focus:outline-none focus:border-select-blue cursor-pointer"
                            />
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="hidden sm:flex flex-col items-end">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-subtle">
                                Section Total
                              </span>
                              <span className="text-[13px] font-bold text-textcolor tabular-nums">
                                {formatAmount(sectionTotal)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={
                                isLocked
                                  ? handleCreateRevision
                                  : () => duplicateSection(section.id)
                              }
                              className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:bg-white hover:text-textcolor"
                              title={
                                isLocked
                                  ? "Create a revision to duplicate this section"
                                  : "Duplicate section"
                              }
                            >
                              <Copy size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={
                                isLocked
                                  ? handleCreateRevision
                                  : () => removeSection(section.id)
                              }
                              className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                              title={
                                isLocked
                                  ? "Create a revision to delete this section"
                                  : "Delete section"
                              }
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Items table */}
                        {isOpen && (
                          <>
                            {visibleItems.length > 0 && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-[12px]">
                                  <thead>
                                    <tr className="bg-bg-soft/60 border-b border-bordergray text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                                      <th className="px-2 py-2 text-center w-8">
                                        #
                                      </th>
                                      <th className="px-2 py-2 text-center w-[42%] min-w-[260px]">
                                        Description
                                      </th>
                                      <th className="px-2 py-2 text-center w-20">
                                        Qty
                                      </th>
                                      <th className="px-2 py-2 text-center w-20">
                                        Unit
                                      </th>
                                      <th className="px-2 py-2 text-center w-24">
                                        Rate (₹)
                                      </th>
                                      <th className="px-2 py-2 text-center w-28">
                                        Amount (₹)
                                      </th>
                                      <th className="px-2 py-2 w-24"></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleItems.map((item) => {
                                      const realIdx = section.items.findIndex(
                                        (i) => i.id === item.id,
                                      );
                                      const isLinked = !!item.masterId;
                                      const isCompact =
                                        isLinked && !expandedLinked[item.id];
                                      return (
                                        <ItemRow
                                          key={item.id}
                                          item={item}
                                          idx={realIdx}
                                          sectionId={section.id}
                                          onUpdate={(changes) =>
                                            updateItem(
                                              section.id,
                                              item.id,
                                              changes,
                                            )
                                          }
                                          onRemove={() =>
                                            removeItem(section.id, item.id)
                                          }
                                          onDuplicate={() =>
                                            duplicateItem(section.id, item.id)
                                          }
                                          onEdit={() =>
                                            setEditingItem({
                                              sectionId: section.id,
                                              itemId: item.id,
                                            })
                                          }
                                          accent={c}
                                          isLinked={isLinked}
                                          isCompact={isCompact}
                                          onToggleCompact={() =>
                                            setExpandedLinked((p) => ({
                                              ...p,
                                              [item.id]: !p[item.id],
                                            }))
                                          }
                                          hideArchDetails={isInteriorBoq}
                                          showTakeoffMeta={isArchitectureBoq}
                                          disabled={isLocked}
                                        />
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            {q &&
                              visibleItems.length === 0 &&
                              sectionMatchesName && (
                                <div className="px-4 py-3 bg-bg-soft/30 text-[11px] text-text-muted border-t border-bordergray">
                                  Section name matched "{itemSearch}" — no items
                                  in this section matched.
                                </div>
                              )}

                            <div className="px-4 py-3 border-t border-bordergray bg-bg-soft/30 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={
                                    isLocked
                                      ? handleCreateRevision
                                      : () => setItemFormSection(section.id)
                                  }
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-select-blue hover:bg-white border border-transparent hover:border-bordergray transition-all"
                                >
                                  <Plus size={12} /> Add Line Item
                                </button>
                              </div>
                              {section.items.length === 0 && (
                                <span className="text-[10.5px] text-text-subtle">
                                  Empty section — add your first item
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}

                {groupMode === "section" && boq.sections.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {isArchitectureBoq && (
                      <button
                        type="button"
                        onClick={isLocked ? handleCreateRevision : () => setShowArchSectionPicker(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-dashed border-bordergray text-[12px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/40 transition-all"
                      >
                        <Building2 size={13} /> Add Work Package
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={isLocked ? handleCreateRevision : addSection}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-dashed border-bordergray text-[12px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/40 transition-all"
                    >
                      <Plus size={13} /> Blank Section
                    </button>
                  </div>
                )}
              </section>
            </main>

            {/* ── Right: Summary, terms, notes ────────────────────────────── */}
            <aside className="space-y-5 lg:overflow-y-auto lg:pr-1 lg:pb-6 scroll-hidden-bar">
              {/* Totals */}
              <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
                <div className="px-4 py-3 border-b border-bordergray flex items-center gap-2 bg-linear-to-r from-select-blue/5 to-white">
                  <Wallet size={13} className="text-select-blue" />
                  <h3 className="text-[12px] font-bold text-textcolor">
                    Summary
                  </h3>
                </div>
                <div className="p-4 space-y-2 text-[11.5px]">
                  <Row
                    label="Gross Subtotal"
                    value={formatAmount(totals.subtotal)}
                  />
                  {totals.lineDiscounts > 0 && (
                    <Row
                      label="Line discounts"
                      value={`- ${formatAmount(totals.lineDiscounts)}`}
                      accent="text-red-500"
                    />
                  )}
                  <Row
                    label="Taxable amount"
                    value={formatAmount(totals.taxable)}
                  />

                  {/* BOQ-level discount */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-text-muted flex items-center gap-1">
                      <Percent size={11} /> BOQ Discount
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={boq.discount?.value || 0}
                        onChange={(e) =>
                          update({
                            discount: {
                              ...boq.discount,
                              value: Number(e.target.value) || 0,
                            },
                          })
                        }
                        disabled={isLocked}
                        className="w-16 text-right tabular-nums bg-bg-soft border border-bordergray rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-select-blue"
                      />
                      <select
                        value={boq.discount?.type || "percent"}
                        onChange={(e) =>
                          update({
                            discount: {
                              ...boq.discount,
                              type: e.target.value,
                            },
                          })
                        }
                        disabled={isLocked}
                        className="bg-bg-soft border border-bordergray rounded px-1 py-1 text-[10.5px] font-semibold text-text-muted cursor-pointer"
                      >
                        <option value="percent">%</option>
                        <option value="flat">₹</option>
                      </select>
                    </div>
                  </div>
                  {totals.boqDiscountAmt > 0 && (
                    <Row
                      label="Discount value"
                      value={`- ${formatAmount(totals.boqDiscountAmt)}`}
                      accent="text-red-500"
                    />
                  )}

                  <Row
                    label="After Discount"
                    value={formatAmount(totals.afterBoqDiscount)}
                  />

                  {/* Contingency is BOQ-level; labour is included in Item Master rates. */}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-text-muted flex items-center gap-1">
                      <Percent size={11} /> Contingency
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={boq.contingencyPercent || 0}
                        onChange={(e) =>
                          update({
                            contingencyPercent: Number(e.target.value) || 0,
                          })
                        }
                        disabled={isLocked}
                        className="w-16 text-right tabular-nums bg-bg-soft border border-bordergray rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-select-blue"
                      />
                      <span className="text-[10.5px] font-semibold text-text-muted">
                        %
                      </span>
                    </div>
                  </div>
                  {totals.contingencyAmt > 0 && (
                    <Row
                      label="Contingency value"
                      value={formatAmount(totals.contingencyAmt)}
                    />
                  )}
                  {totals.contingencyAmt > 0 && (
                    <Row
                      label="Taxable (incl. contingency)"
                      value={formatAmount(totals.baseForGst)}
                    />
                  )}

                  {/* Average commercial loading across items with a rate build-up */}
                  <div className="border-t border-bordergray pt-2 mt-2 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-muted flex items-center gap-1">
                        <Percent size={11} /> Avg Margin %
                      </span>
                      <span className="font-semibold text-textcolor tabular-nums">
                        {raAverages.count > 0
                          ? `${raAverages.marginPct.toFixed(1)}% · ${formatAmount(raAverages.marginAmt)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-muted flex items-center gap-1">
                        <Percent size={11} /> Avg PCE %
                      </span>
                      <span className="font-semibold text-textcolor tabular-nums">
                        {raAverages.count > 0
                          ? `${raAverages.pcePct.toFixed(1)}% · ${formatAmount(raAverages.pceAmt)}`
                          : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-bordergray pt-2 mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                        Commercial controls
                      </span>
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted">
                        <input
                          type="checkbox"
                          checked={!!boq.commercial?.taxInclusive}
                          onChange={(e) =>
                            update({
                              commercial: {
                                ...(boq.commercial || {}),
                                taxInclusive: e.target.checked,
                              },
                            })
                          }
                          disabled={isLocked}
                          className="h-3 w-3 accent-select-blue"
                        />
                        Tax inclusive
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ["retentionPercent", "Retention %", "%"],
                        ["mobilizationAdvance", "Mobilization", "₹"],
                        ["freightTransport", "Freight", "₹"],
                        ["loadingUnloading", "Loading", "₹"],
                        ["roundOff", "Round-off", "₹"],
                      ].map(([key, label, suffix]) => (
                        <label key={key} className="block">
                          <span className="mb-0.5 block text-[9.5px] font-semibold text-text-subtle">
                            {label}
                          </span>
                          <div className="relative">
                            <input
                              type="number"
                              value={boq.commercial?.[key] || 0}
                              onChange={(e) =>
                                update({
                                  commercial: {
                                    ...(boq.commercial || {}),
                                    [key]: Number(e.target.value) || 0,
                                  },
                                })
                              }
                              disabled={isLocked}
                              className={`${compactInput} pr-6 text-right tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-text-subtle">
                              {suffix}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                    {(totals.freightTransport > 0 ||
                      totals.loadingUnloading > 0) && (
                      <Row
                        label="Commercial additions"
                        value={formatAmount(totals.commercialAdditions)}
                      />
                    )}
                    {totals.roundOff !== 0 && (
                      <Row
                        label="Round-off"
                        value={formatAmount(totals.roundOff)}
                      />
                    )}
                    {totals.retentionAmt > 0 && (
                      <Row
                        label={`Retention (${totals.retentionPercent}%)`}
                        value={formatAmount(totals.retentionAmt)}
                      />
                    )}
                    {totals.mobilizationAdvanceAmt > 0 && (
                      <Row
                        label="After mobilization advance"
                        value={formatAmount(totals.netPayableAfterAdvance)}
                      />
                    )}
                    <textarea
                      value={boq.commercial?.priceEscalationClause || ""}
                      onChange={(e) =>
                        update({
                          commercial: {
                            ...(boq.commercial || {}),
                            priceEscalationClause: e.target.value,
                          },
                        })
                      }
                      disabled={isLocked}
                      rows={2}
                      placeholder="Price escalation clause"
                      className={`${compactInput} resize-none disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </div>

                  <div className="border-t border-bordergray pt-2 space-y-1">
                    {Object.entries(totals.gstByRate || {})
                      .filter(([, v]) => v > 0)
                      .map(([rate, v]) =>
                        gst.interState ? (
                          <Row
                            key={rate}
                            label={`IGST @ ${rate}%`}
                            value={formatAmount(v)}
                            accent="text-orange-500"
                          />
                        ) : (
                          <div key={rate}>
                            <Row
                              label={`CGST @ ${Number(rate) / 2}%`}
                              value={formatAmount(v / 2)}
                              accent="text-orange-500"
                            />
                            <Row
                              label={`SGST @ ${Number(rate) / 2}%`}
                              value={formatAmount(v / 2)}
                              accent="text-orange-500"
                            />
                          </div>
                        ),
                      )}
                    {totals.totalGst > 0 && (
                      <Row
                        label="Total GST"
                        value={formatAmount(totals.totalGst)}
                        accent="text-orange-500 font-bold"
                      />
                    )}
                    {totals.totalGst > 0 && gst.assumed && (
                      <p className="flex items-start gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-1">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                        GST treatment assumed — confirm the client's state for
                        accurate IGST vs CGST+SGST.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 -mx-4 -mb-4 px-4 py-3 bg-linear-to-br from-select-blue to-primary text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider opacity-80">
                        Grand Total
                      </span>
                      <span className="text-[18px] font-bold tabular-nums">
                        {formatAmount(totals.grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Room Breakdown */}
              {roomBreakdown.length > 0 && (
                <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-bordergray flex items-center gap-2 bg-linear-to-r from-violet-50 to-white">
                    <Layers size={13} className="text-violet-600" />
                    <h3 className="text-[12px] font-bold text-textcolor">
                      Room Breakdown
                    </h3>
                    <span className="ml-auto text-[10px] text-text-subtle font-medium">
                      {roomBreakdown.length} rooms
                    </span>
                  </div>
                  <div className="p-3 space-y-1">
                    {roomBreakdown.map((room) => {
                      const pct =
                        totals.taxable > 0
                          ? (room.net / totals.taxable) * 100
                          : 0;
                      const c = roomColor(room.category);
                      return (
                        <button
                          key={room.category}
                          type="button"
                          onClick={() => scrollToSection(room.sectionIds[0])}
                          className="w-full rounded-xl px-3 py-2.5 text-left hover:bg-bg-soft transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`}
                              />
                              <span className="text-[12px] font-semibold text-textcolor truncate">
                                {room.category}
                              </span>
                              <span className="text-[10px] text-text-subtle shrink-0">
                                {room.itemCount}
                              </span>
                            </div>
                            <span className="text-[12px] font-bold text-textcolor tabular-nums shrink-0">
                              {formatAmount(room.net)}
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-bg-soft overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${c.bar}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                    {roomBreakdown.length > 1 && (
                      <div className="mt-2 flex items-center justify-between border-t border-bordergray pt-2.5 px-3">
                        <span className="text-[10.5px] font-bold text-text-muted uppercase tracking-wide">
                          Total (pre-GST)
                        </span>
                        <span className="text-[13px] font-bold text-textcolor tabular-nums">
                          {formatAmount(totals.taxable)}
                        </span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Notes */}
              <CollapsiblePanel
                title="Notes / Terms"
                icon={<StickyNote size={13} className="text-select-blue" />}
              >
                <div className="p-3">
                  <textarea
                    value={boq.notes || ""}
                    onChange={(e) => update({ notes: e.target.value })}
                    disabled={isLocked}
                    rows={5}
                    placeholder="Special terms, exclusions, site conditions, etc."
                    className={`${compactInput} resize-none leading-relaxed`}
                  />
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="Approval Signoff"
                icon={<ShieldCheck size={13} className="text-select-blue" />}
                meta={boq.status === "draft" ? "before issue" : boq.status}
                defaultOpen={boq.status !== "draft"}
              >
                <div className="p-3 space-y-3">
                  {isSignoffLocked && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10.5px] font-semibold text-emerald-700">
                      Signed approval metadata is locked for this revision.
                    </p>
                  )}
                  {boq.procurement?.issued && (
                    <p className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10.5px] font-semibold text-indigo-700">
                      Issued for procurement by{" "}
                      {boq.procurement.issuedBy || "Authorized user"} on{" "}
                      {formatSignoffDate(boq.procurement.issuedAt)}
                      {boq.procurement.contractId
                        ? ` · Contract ${boq.procurement.contractId}`
                        : ""}
                      .
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    <SignoffField
                      label="Prepared by"
                      value={approval.preparedBy}
                      date={approval.preparedAt}
                      disabled={isSignoffLocked}
                      onChange={(value) =>
                        updateApproval({ preparedBy: value })
                      }
                    />
                    <SignoffField
                      label="Reviewed by"
                      value={approval.reviewedBy}
                      date={approval.reviewedAt}
                      disabled={isSignoffLocked}
                      onChange={(value) =>
                        updateApproval({ reviewedBy: value })
                      }
                    />
                    <SignoffField
                      label="Approved by"
                      value={approval.approvedBy}
                      date={approval.approvedAt}
                      disabled={isSignoffLocked}
                      onChange={(value) =>
                        updateApproval({ approvedBy: value })
                      }
                    />
                    <SignoffField
                      label="Client acceptance"
                      value={approval.clientAcceptedBy}
                      date={approval.clientAcceptedAt}
                      disabled={isSignoffLocked}
                      onChange={(value) =>
                        updateApproval({ clientAcceptedBy: value })
                      }
                    />
                  </div>

                  <div className="rounded-xl border border-bordergray bg-bg-soft/40 p-2.5">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      Review checklist
                    </p>
                    <div className="grid grid-cols-1 gap-1.5">
                      <SignoffCheck
                        label="Measurements checked"
                        checked={approval.checklist.measurementsChecked}
                        disabled={isSignoffLocked}
                        onChange={(checked) =>
                          updateApprovalChecklist(
                            "measurementsChecked",
                            checked,
                          )
                        }
                      />
                      <SignoffCheck
                        label="Rates and quantities checked"
                        checked={approval.checklist.ratesChecked}
                        disabled={isSignoffLocked}
                        onChange={(checked) =>
                          updateApprovalChecklist("ratesChecked", checked)
                        }
                      />
                      <SignoffCheck
                        label="GST and tax summary checked"
                        checked={approval.checklist.taxChecked}
                        disabled={isSignoffLocked}
                        onChange={(checked) =>
                          updateApprovalChecklist("taxChecked", checked)
                        }
                      />
                      <SignoffCheck
                        label="Terms and exclusions checked"
                        checked={approval.checklist.termsChecked}
                        disabled={isSignoffLocked}
                        onChange={(checked) =>
                          updateApprovalChecklist("termsChecked", checked)
                        }
                      />
                    </div>
                  </div>

                  <textarea
                    value={approval.remarks}
                    onChange={(e) =>
                      updateApproval({ remarks: e.target.value })
                    }
                    onFocus={() => {
                      if (isSignoffLocked) showSignoffLockedToast();
                    }}
                    disabled={isSignoffLocked}
                    rows={3}
                    placeholder="Internal approval remarks"
                    className={`${compactInput} resize-none leading-relaxed disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  />
                  <AuditTrailList
                    items={boq.auditTrail || []}
                    revisionHistory={boq.revisionHistory || []}
                    revisionComparison={boq.revisionComparison || null}
                    onViewSnapshot={setViewingSnapshot}
                  />
                </div>
              </CollapsiblePanel>
            </aside>
          </div>
        )}

        {editorTab === "rate" && (
          <RateAnalysisTab
            boq={boq}
            disabled={isLocked}
            onUpdateItem={updateItem}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast key={toast.id} toast={toast} onClose={() => setToast(null)} />
      )}

      {/* Confirm dialog */}
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

      {/* Send validation — blocks (must fix) or warnings (can override) */}
      {sendValidation && (
        <SendValidationDialog
          blocks={sendValidation.blocks}
          warnings={sendValidation.warnings}
          onCancel={() => setSendValidation(null)}
          onSendAnyway={finalizeSend}
        />
      )}

      {/* Seed picker modal */}
      {showSeedPicker && (
        <SeedPicker
          onClose={() => setShowSeedPicker(false)}
          onPick={seedFromPreset}
        />
      )}

      {/* Survey site picker — shown when BOQ has no siteID yet */}
      {showSurveyPicker && (
        <SurveyLinker
          onClose={() => setShowSurveyPicker(false)}
          onPick={(siteID) => {
            setShowSurveyPicker(false);
            runGenerateFromSurvey(siteID);
          }}
        />
      )}

      {/* Section template picker — interior */}
      {showSectionPicker && (
        <SectionTemplatePicker
          onClose={() => setShowSectionPicker(false)}
          onAddBlank={() => {
            setShowSectionPicker(false);
            addSection();
          }}
          onAddFromCategory={addSectionFromCategory}
        />
      )}

      {/* Architecture work-package section picker */}
      {showArchSectionPicker && (
        <ArchSectionTemplatePicker
          onClose={() => setShowArchSectionPicker(false)}
          onAddSection={(name, category) => {
            setShowArchSectionPicker(false);
            addSectionNamed(name, category);
          }}
          onAddBlank={() => {
            setShowArchSectionPicker(false);
            addSection();
          }}
        />
      )}

      {/* Master sheet overlay — internal consolidated pack */}
      {showMasterSheet && (
        <MasterSheetPreview
          boq={boq}
          onClose={() => setShowMasterSheet(false)}
        />
      )}

      {/* Measurement sheet overlay */}
      {showMeasurementSheet && (
        <MeasurementSheetPreview
          boq={boq}
          onClose={() => setShowMeasurementSheet(false)}
        />
      )}

      {/* Material sheet overlay */}
      {showMaterialSheet && (
        <MaterialSheetPreview
          boq={boq}
          onClose={() => setShowMaterialSheet(false)}
        />
      )}

      {/* Revision snapshot viewer */}
      {viewingSnapshot && (
        <RevisionSnapshotModal
          snapshot={viewingSnapshot}
          currentSections={boq?.sections}
          onClose={() => setViewingSnapshot(null)}
        />
      )}

      {/* Print preview overlay */}
      {showPreview && (
        <BOQPreview boq={boq} onClose={() => setShowPreview(false)} />
      )}

      {/* Final-quote review — admin previews the client-facing document and
          confirms before it is published to the client portal. */}
      {finalQuotePreview && (
        <Modal
          title="Final Quote"
          subtitle={`Review ${finalQuotePreview.quoteId} for ${finalQuotePreview.recipientName || "the client"} before publishing it to the client portal.`}
          onClose={
            publishingFinalQuote ? undefined : () => setFinalQuotePreview(null)
          }
          maxWidth="max-w-[820px]"
          footer={
            <div className="flex flex-wrap justify-between items-center gap-3">
              <p className="text-[11px] text-text-muted max-w-[46ch]">
                Publishing makes this quote visible to the client and records it
                against {boq.id} (Rev {boq.revision}).
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFinalQuotePreview(null)}
                  disabled={publishingFinalQuote}
                  className="px-5 py-2.5 rounded-lg border border-bordergray text-sm font-medium text-text-muted hover:bg-bg-soft transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPublishFinalQuote}
                  disabled={publishingFinalQuote}
                  className="min-w-[190px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {publishingFinalQuote ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Publishing…
                    </>
                  ) : (
                    <>
                      <Wallet size={14} /> Publish to Client
                    </>
                  )}
                </button>
              </div>
            </div>
          }
        >
          <div className="rounded-xl border border-bordergray bg-white p-6 shadow-sm">
            <QuotePreview quote={finalQuotePreview} />
          </div>
        </Modal>
      )}

      {/* Full Item Form modal — opened by "Add Line Item" in any section */}
      {itemFormSection && (
        <ItemFormModal
          initial={{}}
          onSave={handleItemFormSave}
          onClose={() => setItemFormSection(null)}
          title="Add Line Item"
          submitLabel="Add to Section"
          showCategory={false}
          showTags={false}
          discipline={isArchitectureBoq ? "architecture" : "interior"}
        />
      )}

      {/* Edit existing line item in the same full form */}
      {editingItem &&
        (() => {
          const sec = boq.sections.find((s) => s.id === editingItem.sectionId);
          const it = sec?.items.find((i) => i.id === editingItem.itemId);
          if (!it) return null;
          return (
            <ItemFormModal
              initial={boqItemToForm(it)}
              onSave={handleItemEditSave}
              onClose={() => setEditingItem(null)}
              title="Edit Line Item"
              submitLabel="Save Changes"
              showCategory={false}
              showTags={false}
              discipline={isArchitectureBoq ? "architecture" : "interior"}
            />
          );
        })()}
    </div>
  );
};

// ─── Item row ───────────────────────────────────────────────────────────────
const ItemRow = ({
  item,
  idx,
  onUpdate,
  onRemove,
  onDuplicate,
  onEdit,
  isLinked,
  isCompact,
  onToggleCompact,
  hideArchDetails = false,
  showTakeoffMeta = false,
  disabled = false,
}) => {
  const r = computeItemAmount(item);
  const computedQty = computeItemQty(item);
  const rateAnalysis = computeRateAnalysis(item.rateAnalysis, item.unit);
  const effectiveRate =
    item.rateAnalysis?.enabled && item.rateAnalysis?.useFinalRate
      ? rateAnalysis.roundedFinalRate
      : Number(item.rate) || 0;
  const hasSurveyDrift =
    item.siteSurveySource &&
    Math.abs(computedQty - (Number(item.siteMeasuredQty) || 0)) > 0.001;
  const dimInfo = DIMENSIONAL_UNITS[item.unit];
  const dimsEnabled = item.dimensions?.enabled;
  const canUseDims = !!dimInfo;
  const isArea = dimInfo?.kind === "area";
  const hasDimValues =
    canUseDims &&
    (Number(item.dimensions?.length) > 0 ||
      Number(item.dimensions?.breadth) > 0 ||
      Number(item.dimensions?.height) > 0);
  const showDims = canUseDims && (dimsEnabled || hasDimValues);
  const unitLabel = UNITS.find((u) => u.code === item.unit)?.label || item.unit;
  const [detailsOpen, setDetailsOpen] = useState(
    () =>
      isLinked ||
      !!item.spec ||
      !!item.hsn ||
      (item.materials || []).length > 0 ||
      (item.measurementRows || []).length > 0 ||
      !!item.rateAnalysis?.enabled ||
      (item.vendorComparisons || []).length > 0,
  );

  // Resolve HSN from Item Master when item is linked — scope-of-work HSN
  // lives on the library record, not on the material rows.
  const masterHsn = useMemo(
    () =>
      item.masterId
        ? listLibrary().find((l) => l.id === item.masterId)?.hsn || ""
        : "",
    [item.masterId],
  );

  // Auto-populate item.hsn from Item Master on first render if still empty.
  useEffect(() => {
    if (!item.hsn && masterHsn && !disabled) {
      onUpdate({ hsn: masterHsn });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterHsn]);

  const effectiveHsn = item.hsn || masterHsn;

  const updateDim = (changes) =>
    onUpdate({ dimensions: { ...(item.dimensions || {}), ...changes } });

  const badges = (
    <div className="flex flex-wrap items-center gap-1">
      {isLinked && (
        <button
          type="button"
          onClick={onToggleCompact}
          disabled={disabled}
          className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-select-blue/10 text-select-blue px-1.5 py-0.5 rounded border border-select-blue/20 hover:bg-select-blue/20 disabled:cursor-not-allowed"
          title="Show item details"
        >
          <Link2 size={9} /> Library
        </button>
      )}
      {item.siteSurveySource && (
        <span
          className={`inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
            hasSurveyDrift
              ? "border border-amber-200 bg-amber-50 text-amber-700"
              : "border border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
          title={
            hasSurveyDrift
              ? `Editor quantity differs from site measurement (${item.siteMeasuredQty})`
              : "Quantity matches the frozen site survey"
          }
        >
          {hasSurveyDrift ? (
            <AlertTriangle size={9} />
          ) : (
            <ShieldCheck size={9} />
          )}
          {hasSurveyDrift ? "Survey drift" : "Site measured"}
        </span>
      )}
      {item.isVariation && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
          <AlertTriangle size={9} /> Variation
        </span>
      )}
      {(item.measurementRows || []).length > 0 && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
          <Ruler size={9} /> Measurement
        </span>
      )}
      {item.rateAnalysis?.enabled && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
          <Calculator size={9} /> RA
        </span>
      )}
    </div>
  );

  const compactMainRow = (
    <tr className="border-b border-bordergray bg-select-blue/[0.03] hover:bg-active-bg/20">
      <td className="px-2 py-2 align-top text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            className="text-text-subtle cursor-grab"
            title="Drag (coming soon)"
          >
            <GripVertical size={11} />
          </button>
          <span className="text-[10.5px] font-bold text-text-muted tabular-nums">
            {String(idx + 1).padStart(2, "0")}
          </span>
        </div>
      </td>
      <td className="px-2 py-2 align-top w-[42%] min-w-[260px]">
        <div className="space-y-1">
          <textarea
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            disabled={disabled}
            placeholder="Item description"
            className={`${compactInput} font-medium resize-none disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
            rows={2}
          />
          <input
            type="text"
            value={effectiveHsn}
            onChange={(e) => onUpdate({ hsn: e.target.value })}
            disabled={disabled}
            placeholder="HSN code"
            className={`${compactInput} tabular-nums text-[10.5px] disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
          />
          {badges}
        </div>
        {item.siteSurveySource && (
          <p className="mt-0.5 text-[10px] text-text-subtle">
            Quoted: {Number(item.quotedQty || 0).toLocaleString("en-IN")}{" "}
            {unitLabel}
            {" | "}
            {formatAmount(item.quotedAmount || 0)}
          </p>
        )}
      </td>
      <td className="px-2 py-2 align-top text-center">
        {showDims ? (
          <input
            type="text"
            value={computedQty.toFixed(2).replace(/\.00$/, "")}
            readOnly
            className={`${compactInput} text-center tabular-nums font-semibold cursor-default`}
          />
        ) : (
          <input
            type="number"
            value={item.qty}
            onChange={(e) => onUpdate({ qty: e.target.value })}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={`${compactInput} text-center tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
          />
        )}
      </td>
      <td className="px-2 py-2 align-top text-center">
        <span className="text-[11px] font-semibold text-text-muted">
          {unitLabel}
        </span>
      </td>
      <td className="px-2 py-2 align-top text-center">
        <span className="text-[12px] font-bold text-textcolor tabular-nums">
          {Number(effectiveRate || 0).toLocaleString("en-IN")}
        </span>
      </td>
      <td className="px-2 py-2 align-top text-center">
        <p className="text-[12px] font-bold text-textcolor tabular-nums">
          {formatAmount(r.net)}
        </p>
        {r.gst > 0 && (
          <p className="text-[9.5px] text-orange-500 tabular-nums">
            + {formatAmount(r.gst)}
          </p>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onToggleCompact}
            className="h-7 px-2 flex items-center justify-center rounded-md border border-bordergray text-[10px] font-semibold text-text-muted hover:text-select-blue hover:border-select-blue/30 bg-white"
            title="Show details"
          >
            Details
          </button>
          <button
            type="button"
            onClick={onEdit}
            disabled={disabled}
            className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-white"
            title="Edit in full form"
          >
            <Edit3 size={11} />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={disabled}
            className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            title="Duplicate row"
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
            title="Remove row"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </td>
    </tr>
  );

  if (isCompact) {
    return (
      <>
        {compactMainRow}
        {showTakeoffMeta && (
          <TakeoffMetaStrip item={item} onUpdate={onUpdate} disabled={disabled} />
        )}
        {showDims && (
          <DimensionEditor
            item={item}
            dimInfo={dimInfo}
            isArea={isArea}
            computedQty={computedQty}
            r={r}
            updateDim={updateDim}
            unitLabel={unitLabel}
            disabled={disabled}
          />
        )}
      </>
    );
  }

  return (
    <>
      <tr className="border-b border-bordergray hover:bg-bg-soft/40">
        <td className="px-2 py-2 align-top text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              type="button"
              className="text-text-subtle cursor-grab"
              title="Drag (coming soon)"
            >
              <GripVertical size={11} />
            </button>
            <span className="text-[10.5px] font-bold text-text-muted tabular-nums">
              {String(idx + 1).padStart(2, "0")}
            </span>
          </div>
        </td>
        <td className="px-2 py-2 align-top w-[42%] min-w-[260px] max-w-[520px]">
          <div className="space-y-1">
            <textarea
              value={item.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              disabled={disabled}
              placeholder="Item description"
              className={`${compactInput} font-medium resize-none disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
              rows={2}
            />
            <input
              type="text"
              value={effectiveHsn}
              onChange={(e) => onUpdate({ hsn: e.target.value })}
              disabled={disabled}
              placeholder="HSN code"
              className={`${compactInput} tabular-nums text-[10.5px] disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
            />
            {badges}
          </div>
        </td>
        <td className="px-2 py-2 align-top text-center">
          {showDims ? (
            <input
              type="text"
              value={computedQty.toFixed(2).replace(/\.00$/, "")}
              readOnly
              className={`${compactInput} text-center tabular-nums font-semibold cursor-default`}
            />
          ) : (
            <input
              type="number"
              value={item.qty}
              onChange={(e) => onUpdate({ qty: e.target.value })}
              onFocus={(e) => e.target.select()}
              disabled={disabled}
              className={`${compactInput} text-center tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
            />
          )}
        </td>
        <td className="px-2 py-2 align-top text-center">
          <select
            value={item.unit}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            disabled={disabled}
            className={`${compactInput} cursor-pointer disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
          >
            {UNITS.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2 align-top text-center">
          <input
            type="number"
            value={item.rate}
            onChange={(e) => onUpdate({ rate: e.target.value })}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            className={`${compactInput} text-center tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
          />
          {item.rateAnalysis?.enabled && item.rateAnalysis?.useFinalRate && (
            <p className="mt-1 text-[9.5px] font-semibold text-emerald-600">
              Using RA: {formatAmount(effectiveRate)}
            </p>
          )}
        </td>
        <td className="px-2 py-2 align-top text-center">
          <p className="text-[12px] font-bold text-textcolor tabular-nums">
            {formatAmount(r.net)}
          </p>
          {r.gst > 0 && (
            <p className="text-[9.5px] text-orange-500 tabular-nums">
              + {formatAmount(r.gst)}
            </p>
          )}
        </td>
        <td className="px-2 py-2 align-top">
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setDetailsOpen((p) => !p)}
              className={`h-7 px-2 flex items-center justify-center rounded-md border text-[10px] font-semibold transition-colors ${
                detailsOpen
                  ? "border-select-blue/30 bg-select-blue/10 text-select-blue"
                  : "border-bordergray bg-white text-text-muted hover:text-select-blue hover:border-select-blue/30"
              }`}
              title={detailsOpen ? "Hide details" : "Show item details"}
            >
              Details
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={disabled}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-white"
              title="Edit in full form"
            >
              <Edit3 size={11} />
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              disabled={disabled}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              title="Duplicate row"
            >
              <Copy size={11} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
              title="Remove row"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </td>
      </tr>

      {/* Dimension calculator row */}
      {showDims && (
        <DimensionEditor
          item={item}
          dimInfo={dimInfo}
          isArea={isArea}
          computedQty={computedQty}
          r={r}
          updateDim={updateDim}
          unitLabel={unitLabel}
          disabled={disabled}
        />
      )}

      {/* Architecture take-off metadata strip — always visible for arch BOQs */}
      {showTakeoffMeta && (
        <TakeoffMetaStrip item={item} onUpdate={onUpdate} disabled={disabled} />
      )}

      {detailsOpen && (
        <ItemDetailsRow
          item={item}
          onUpdate={onUpdate}
          hideArchDetails={hideArchDetails}
          hideTakeoffFields={showTakeoffMeta}
          disabled={disabled}
        />
      )}
    </>
  );
};

// Always-visible metadata strip shown below the main item row for architecture
// BOQs. Surfaces the take-off fields (hierarchy + drawing ref/rev/spec) inline
// so they're visible without opening the Details panel.
const TakeoffMetaStrip = ({ item, onUpdate, disabled }) => {
  const h = item.hierarchy || {};
  const d = item.details || {};
  const pH = (k, v) =>
    onUpdate({ hierarchy: { ...(item.hierarchy || {}), [k]: v } });
  const pD = (k, v) =>
    onUpdate({ details: { ...(item.details || {}), [k]: v } });

  const chip =
    "w-full bg-white border border-bordergray text-[10.5px] text-textcolor rounded px-2 py-1 focus:outline-none focus:border-select-blue/50 placeholder:text-text-subtle disabled:bg-bg-soft disabled:cursor-not-allowed";
  const lbl =
    "block text-[8.5px] font-bold uppercase tracking-wider text-text-subtle mb-0.5";

  const fields = [
    ["Block / Tower", h.blockTower, (v) => pH("blockTower", v), "Block A"],
    ["Floor", h.floor, (v) => pH("floor", v), "G/F"],
    ["Room / Area", h.roomArea, (v) => pH("roomArea", v), "Lobby"],
    ["Work Category", h.workCategory, (v) => pH("workCategory", v), "Civil"],
    ["Sub-Category", h.subCategory, (v) => pH("subCategory", v), "Masonry"],
    ["Drawing Ref", d.drawingRefNo, (v) => pD("drawingRefNo", v), "DWG-101"],
    ["Drawing Rev", d.drawingRevision, (v) => pD("drawingRevision", v), "R2"],
    ["Spec Code", d.specificationCode, (v) => pD("specificationCode", v), "SP-CIV-04"],
  ];

  return (
    <tr className="border-b border-select-blue/10 bg-select-blue/[0.025]">
      <td colSpan={7} className="px-3 py-2">
        <div className="grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-4 lg:grid-cols-8">
          {fields.map(([label, value, onChange, placeholder]) => (
            <label key={label} className="block">
              <span className={lbl}>{label}</span>
              <input
                type="text"
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className={chip}
              />
            </label>
          ))}
        </div>
      </td>
    </tr>
  );
};

const ItemDetailsRow = ({
  item,
  onUpdate,
  hideArchDetails = false,
  hideTakeoffFields = false,
  disabled = false,
}) => {
  // Look up the Item Master entry so we can offer grade re-pricing.
  const libItem = useMemo(
    () =>
      item.masterId
        ? listLibrary().find((l) => l.id === item.masterId) || null
        : null,
    [item.masterId],
  );

  // Grades present in the Item Master recipe (economy / premium / luxury / custom).
  const libGrades = useMemo(() => {
    if (!libItem?.recipes) return [];
    const baseLabels = {
      economy: "Economy",
      premium: "Premium",
      luxury: "Luxury",
    };
    return Object.keys(libItem.recipes).map((k) => ({
      key: k,
      label:
        baseLabels[k] ||
        k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
    }));
  }, [libItem]);

  // Pre-compute the derived rate for every available grade so we can show
  // price chips without re-running computeRecipe on every click.
  const libGradeRates = useMemo(() => {
    if (!libItem?.recipes) return {};
    const matLookup = mkMatById(listMaterials());
    const acc = {};
    for (const k of Object.keys(libItem.recipes)) {
      acc[k] = computeRecipe(libItem.recipes[k], matLookup).rate;
    }
    return acc;
  }, [libItem]);

  const currentGrade = item.grade || "economy";
  const hierarchy = item.hierarchy || {};
  const details = item.details || {};
  const patchHierarchy = (values) =>
    onUpdate({ hierarchy: { ...hierarchy, ...values } });
  const patchDetails = (values) =>
    onUpdate({ details: { ...details, ...values } });

  const applyGrade = (grade) => {
    if (!libItem?.recipes?.[grade]) return;
    const matLookup = mkMatById(listMaterials());
    const calc = computeRecipe(libItem.recipes[grade], matLookup);
    const newMaterials = recipeToMaterials(libItem.recipes[grade], matLookup);
    onUpdate({ grade, rate: Math.round(calc.rate), materials: newMaterials });
  };

  return (
    <tr className="border-b border-bordergray bg-bg-soft/30">
      <td colSpan={7} className="px-4 py-3">
        {/* Grade selector — only shown for library-linked items with multiple grades */}
        {SHOW_GRADE_SELECTOR && libGrades.length > 1 && (
          <div className="mb-3 flex items-center gap-2 flex-wrap rounded-lg bg-active-bg/40 border border-select-blue/20 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-select-blue flex items-center gap-1 shrink-0">
              <Sparkles size={10} /> Grade
            </span>
            {libGrades.map(({ key, label }) => {
              const rate = libGradeRates[key];
              const isActive = currentGrade === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => !disabled && applyGrade(key)}
                  disabled={disabled}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10.5px] font-semibold transition-all disabled:cursor-not-allowed ${
                    isActive
                      ? "bg-select-blue text-white border-select-blue shadow-sm"
                      : "bg-white border-bordergray text-text-muted hover:border-select-blue/50 hover:text-select-blue"
                  }`}
                >
                  {label}
                  {rate > 0 && (
                    <span
                      className={`text-[9.5px] tabular-nums ${
                        isActive ? "text-white/80" : "text-text-subtle"
                      }`}
                    >
                      ₹{Math.round(rate).toLocaleString("en-IN")}
                    </span>
                  )}
                </button>
              );
            })}
            <span className="ml-auto text-[9.5px] text-text-subtle hidden sm:block">
              Sets rate + materials from Item Master recipe
            </span>
          </div>
        )}

        {/* Architecture-only item metadata (floor, work category, drawing ref,
            brand/finish, item/billing/scope type, execution, remarks & spec).
            Interior BOQs keep the line-item view lean and hide this block.
            Location/drawing fields are hidden here when TakeoffMetaStrip
            is already showing them inline above the item row. */}
        {!hideArchDetails && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              {!hideTakeoffFields && (
                <Field icon={<Building2 size={11} />} label="Floor">
                  <input
                    type="text"
                    value={hierarchy.floor || ""}
                    onChange={(e) => patchHierarchy({ floor: e.target.value })}
                    disabled={disabled}
                    placeholder="Ground floor"
                    className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  />
                </Field>
              )}
              {!hideTakeoffFields && (
                <Field icon={<MapPin size={11} />} label="Room / Area">
                  <input
                    type="text"
                    value={hierarchy.roomArea || ""}
                    onChange={(e) => patchHierarchy({ roomArea: e.target.value })}
                    disabled={disabled}
                    placeholder="Living room"
                    className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  />
                </Field>
              )}
              {!hideTakeoffFields && (
                <Field icon={<BookOpen size={11} />} label="Work Category">
                  <input
                    type="text"
                    value={hierarchy.workCategory || ""}
                    onChange={(e) =>
                      patchHierarchy({ workCategory: e.target.value })
                    }
                    disabled={disabled}
                    placeholder="Civil / Carpentry / Electrical"
                    className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  />
                </Field>
              )}
              {!hideTakeoffFields && (
                <Field icon={<List size={11} />} label="Sub-category">
                  <input
                    type="text"
                    value={hierarchy.subCategory || ""}
                    onChange={(e) =>
                      patchHierarchy({ subCategory: e.target.value })
                    }
                    disabled={disabled}
                    placeholder="Wardrobe / false ceiling"
                    className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  />
                </Field>
              )}
              {!hideTakeoffFields && (
                <Field icon={<FileText size={11} />} label="Drawing Ref / Rev">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={details.drawingRefNo || ""}
                      onChange={(e) =>
                        patchDetails({ drawingRefNo: e.target.value })
                      }
                      disabled={disabled}
                      placeholder="DRG-101"
                      className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                    <input
                      type="text"
                      value={details.drawingRevision || ""}
                      onChange={(e) =>
                        patchDetails({ drawingRevision: e.target.value })
                      }
                      disabled={disabled}
                      placeholder="R2"
                      className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                    />
                  </div>
                </Field>
              )}
              <Field icon={<Package size={11} />} label="Brand / Make / Model">
                <input
                  type="text"
                  value={details.brandMakeModel || ""}
                  onChange={(e) =>
                    patchDetails({ brandMakeModel: e.target.value })
                  }
                  disabled={disabled}
                  placeholder="Hettich / Asian Paints"
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                />
              </Field>
              <Field
                icon={<Sparkles size={11} />}
                label="Finish / Color / Grade"
              >
                <input
                  type="text"
                  value={details.finishColorGrade || ""}
                  onChange={(e) =>
                    patchDetails({ finishColorGrade: e.target.value })
                  }
                  disabled={disabled}
                  placeholder="Matte white / BWP"
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                />
              </Field>
              <Field icon={<PackageCheck size={11} />} label="Item Type">
                <select
                  value={details.itemType || ITEM_TYPES[2]}
                  onChange={(e) => patchDetails({ itemType: e.target.value })}
                  disabled={disabled}
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                >
                  {ITEM_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field icon={<Calculator size={11} />} label="Billing Type">
                <select
                  value={details.billingType || BILLING_TYPES[1]}
                  onChange={(e) =>
                    patchDetails({ billingType: e.target.value })
                  }
                  disabled={disabled}
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                >
                  {BILLING_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field icon={<ShieldCheck size={11} />} label="Scope Type">
                <select
                  value={details.scopeType || SCOPE_TYPES[0]}
                  onChange={(e) => patchDetails({ scopeType: e.target.value })}
                  disabled={disabled}
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                >
                  {SCOPE_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field icon={<User size={11} />} label="Execution By">
                <select
                  value={details.executionBy || EXECUTION_BY[0]}
                  onChange={(e) =>
                    patchDetails({ executionBy: e.target.value })
                  }
                  disabled={disabled}
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                >
                  {EXECUTION_BY.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </Field>
              <Field icon={<StickyNote size={11} />} label="Item Remarks">
                <input
                  type="text"
                  value={details.remarks || ""}
                  onChange={(e) => patchDetails({ remarks: e.target.value })}
                  disabled={disabled}
                  placeholder="Client/internal remark"
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <Field icon={<FileText size={11} />} label="Specification">
                <textarea
                  value={item.spec || ""}
                  onChange={(e) => onUpdate({ spec: e.target.value })}
                  disabled={disabled}
                  placeholder="Brand, model, finish, quality notes"
                  className={`${compactInput} resize-none disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  rows={2}
                />
              </Field>
            </div>
          </>
        )}
        {/* Scope-of-work details is intentionally lean now: Rate Analysis has
            its own editor tab; the Measurement Sheet is viewed via the header
            "Measurement Sheet" button; Vendor Comparison moved to Procurement.
            Only the material breakdown remains inline here. */}
        <MaterialEditor item={item} onUpdate={onUpdate} disabled={disabled} />
      </td>
    </tr>
  );
};

// Mirrors the formula parser in procurementStorage so the editor's takeoff
// numbers always match what procurement computes. Format: "Q * <factor>".
const parseConsumeFormula = (formula) => {
  const text = String(formula || "").replace(/\s+/g, "");
  const m = text.match(/^(?:Q|Qty)\*([0-9]+(?:\.[0-9]+)?)$/i);
  return m ? Number(m[1]) : null;
};

const MaterialEditor = ({ item, onUpdate, disabled = false }) => {
  const [open, setOpen] = useState((item.materials || []).length > 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [materialQuery, setMaterialQuery] = useState("");
  const materials = item.materials || [];
  const libraryMaterials = useMemo(() => listMaterials(), []);

  const update = (mats) => onUpdate({ materials: mats });

  const pickMaterial = (material) => {
    update([
      ...materials,
      {
        id: material.id || null,
        materialId: material.id || null,
        name: material.name || "",
        spec: material.specifications || material.spec || "",
        unit: material.unit || item.unit || "nos",
        qty: 1,
        wastagePct: 0,
        rate: Number(material.rate) || 0,
        consumptionMode: "per_unit",
        hsn: material.hsn || "",
        gstPercent: Number(material.gstPercent) || 0,
      },
    ]);
    setOpen(true);
    setPickerOpen(false);
    setMaterialQuery("");
  };
  const change = (idx, key, v) =>
    update(materials.map((m, i) => (i === idx ? { ...m, [key]: v } : m)));
  const patch = (idx, values) =>
    update(materials.map((m, i) => (i === idx ? { ...m, ...values } : m)));
  const remove = (idx) => update(materials.filter((_, i) => i !== idx));
  const itemQty = computeItemQty(item);

  // Prefer explicit qty/wastagePct fields (written by this editor and by
  // RateBuildupModal). Fall back to consumptionFormula which encodes
  // qty × (1 + waste%) as a single multiplier — same logic as procurementStorage.
  const materialCalc = (material) => {
    const hasExplicitQty =
      material.consumptionMode === "per_unit" ||
      material.qty != null ||
      material.perUnitQty != null ||
      material.consumptionQty != null;
    let perUnitQty, wastagePct;
    if (!hasExplicitQty) {
      const factor = parseConsumeFormula(material.consumptionFormula);
      perUnitQty = factor !== null ? factor : 1;
      wastagePct = 0;
    } else {
      const raw = Number(
        material.qty ?? material.perUnitQty ?? material.consumptionQty ?? 1,
      );
      perUnitQty = Number.isFinite(raw) && raw >= 0 ? raw : 1;
      wastagePct = Math.max(0, Number(material.wastagePct) || 0);
    }
    const takeoffQty = itemQty * perUnitQty * (1 + wastagePct / 100);
    const amount = takeoffQty * (Number(material.rate) || 0);
    return { perUnitQty, wastagePct, takeoffQty, amount };
  };

  // Sum of material costs per unit of work — shown as a read-only reference
  // so the user knows the material floor before adding labour and overhead.
  const derivedRate =
    itemQty > 0
      ? materials.reduce((sum, m) => sum + materialCalc(m).amount / itemQty, 0)
      : 0;
  const filteredMaterials = useMemo(() => {
    const query = materialQuery.trim().toLowerCase();
    if (!query) return libraryMaterials;
    return libraryMaterials.filter((material) =>
      [
        material.name,
        material.specifications,
        material.spec,
        material.unit,
        material.hsn,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [libraryMaterials, materialQuery]);

  return (
    <div className="mt-3 rounded-xl border border-bordergray bg-white px-3 py-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-muted hover:text-select-blue"
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Materials & Specifications
          {materials.length > 0 && (
            <span className="text-[9.5px] font-bold text-select-blue bg-white px-1.5 py-0.5 rounded border border-bordergray">
              {materials.length}
            </span>
          )}
          {!open && materials.length > 0 && (
            <span className="text-[10px] text-text-subtle truncate max-w-[400px] ml-1">
              {materials
                .map((m) => `${m.name}${m.spec ? ` (${m.spec})` : ""}`)
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </button>
        {open && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (disabled) return;
                setPickerOpen((prev) => !prev);
                setMaterialQuery("");
              }}
              disabled={disabled}
              className="flex items-center gap-1 text-[10.5px] font-semibold text-select-blue hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Package size={11} /> Pick from Library
            </button>
            {pickerOpen && !disabled && (
              <div className="absolute right-0 z-30 mt-2 w-[360px] max-w-[calc(100vw-3rem)] rounded-xl border border-bordergray bg-white shadow-xl p-2">
                <div className="flex items-center gap-1.5 border border-bordergray rounded-lg px-2 py-1.5">
                  <Search size={12} className="text-text-subtle shrink-0" />
                  <input
                    value={materialQuery}
                    onChange={(e) => setMaterialQuery(e.target.value)}
                    placeholder="Search material library..."
                    className="w-full text-[11.5px] text-textcolor outline-none placeholder:text-text-subtle"
                    autoFocus
                  />
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                  {filteredMaterials.length === 0 ? (
                    <p className="px-2 py-3 text-[11px] text-text-subtle text-center">
                      No materials found in library.
                    </p>
                  ) : (
                    filteredMaterials.map((material, materialIdx) => (
                      <button
                        key={
                          material.id ||
                          `${material.name}-${material.specifications}-${materialIdx}`
                        }
                        type="button"
                        onClick={() => pickMaterial(material)}
                        className="w-full text-left rounded-lg px-2 py-2 hover:bg-bg-soft border border-transparent hover:border-bordergray"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11.5px] font-semibold text-textcolor truncate">
                              {material.name || "Unnamed material"}
                            </p>
                            <p className="text-[10.5px] text-text-muted line-clamp-2">
                              {material.specifications || material.spec || "-"}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-semibold text-select-blue tabular-nums">
                              {Number(material.rate) > 0
                                ? formatAmount(material.rate)
                                : "-"}
                            </p>
                            <p className="text-[10px] text-text-subtle">
                              {material.unit || "unit"}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {open && (
        <div className="mt-2 space-y-1.5 pl-5">
          {materials.length === 0 && (
            <p className="text-[10.5px] text-text-subtle">
              No materials specified. Pick from the Material Library to bring in
              the name, specification, unit, and rate.
            </p>
          )}
          {materials.length > 0 && (
            <div className="hidden md:grid grid-cols-[130px_1fr_70px_76px_70px_92px_28px] gap-2 mb-0.5 px-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                Material
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                Specification
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                Unit
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                Qty / Unit
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                Waste %
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
                Rate (₹)
              </span>
              <span />
            </div>
          )}
          {materials.map((m, idx) => {
            const unit = m.unit || item.unit || "nos";
            return (
              <div
                key={idx}
                className="grid grid-cols-1 md:grid-cols-[130px_1fr_70px_76px_70px_92px_28px] gap-2 items-start"
              >
                <textarea
                  value={m.name}
                  onChange={(e) => change(idx, "name", e.target.value)}
                  disabled={disabled}
                  placeholder="Plywood"
                  className={`${compactInput} font-medium resize-none disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  rows={1}
                />
                <textarea
                  value={m.spec}
                  onChange={(e) => change(idx, "spec", e.target.value)}
                  disabled={disabled}
                  placeholder="BWP 19mm Greenply"
                  className={`${compactInput} resize-none disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  rows={1}
                />
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => change(idx, "unit", e.target.value)}
                  disabled={disabled}
                  placeholder="Unit"
                  className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  title="Material unit"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m.qty ?? m.perUnitQty ?? m.consumptionQty ?? 1}
                  onChange={(e) =>
                    patch(idx, {
                      qty: Number(e.target.value) || 0,
                      consumptionMode: "per_unit",
                    })
                  }
                  disabled={disabled}
                  placeholder="Qty/unit"
                  className={`${compactInput} text-right tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  title="Material quantity consumed per BOQ unit"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m.wastagePct ?? 0}
                  onChange={(e) =>
                    patch(idx, {
                      wastagePct: Number(e.target.value) || 0,
                      consumptionMode: "per_unit",
                    })
                  }
                  disabled={disabled}
                  placeholder="Waste %"
                  className={`${compactInput} text-right tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  title="Wastage percentage"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={m.rate || 0}
                  onChange={(e) =>
                    change(idx, "rate", Number(e.target.value) || 0)
                  }
                  disabled={disabled}
                  placeholder="Rate"
                  className={`${compactInput} text-right tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove material"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
          {materials.length > 0 && derivedRate > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap border-t border-bordergray/50 pt-2">
              <span className="text-[10px] text-text-muted">
                Material cost:{" "}
                <span className="font-bold text-textcolor tabular-nums">
                  {formatAmount(derivedRate)}
                </span>
                /unit
              </span>

              <span className="text-[9.5px] text-text-subtle">
                excludes labour & overhead
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const rateRowAmount = (row) => {
  const quantity = Number(row.quantity) || 0;
  const wastage = Number(row.wastagePercent) || 0;
  const qww = Number(row.quantityWithWastage) || quantity * (1 + wastage / 100);
  return qww * (Number(row.rate) || 0);
};

// Read-only quantity-with-wastage = qty × (1 + waste%). Mirrors boqStorage.
const rateRowQww = (row) => {
  const quantity = Number(row.quantity) || 0;
  const wastage = Number(row.wastagePercent) || 0;
  return Number(row.quantityWithWastage) || quantity * (1 + wastage / 100);
};

// Digits and at most one decimal point only — nothing else (no letters, "e",
// signs, or a second dot). Used to gate the Rate/unit & Waste% text fields.
const DECIMAL_ONLY = /^\d*\.?\d*$/;

// One shared 9-column grid drives the whole sheet — the column header, the A/B
// group bands, the editable item rows, and the C→F calculation cascade all line
// up under the same template so it reads like the printed rate-analysis sheet.
// Rate/unit sits right after Unit and holds the row's rate directly (the
// separate Rate column was folded into it); the row-delete action gets its own
// trailing column.
//  Sl · Description · Unit · Rate/unit · Qty · Waste% · QWW · Amount · ×
const RA_COLS =
  "grid grid-cols-[24px_minmax(110px,1fr)_52px_82px_60px_56px_60px_84px_40px] gap-px items-stretch";

const raCellInput =
  "bg-white text-[11px] text-textcolor px-1.5 py-1.5 w-full h-full focus:outline-none focus:ring-1 focus:ring-select-blue/40 placeholder:text-text-subtle disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed";

// A read-only money / number cell inside the sheet grid.
const RaValueCell = ({ children, className = "", strong = false, title }) => (
  <div
    title={title}
    className={`flex items-center justify-end bg-white px-2 py-1.5 text-[11px] tabular-nums ${
      strong ? "font-bold text-textcolor" : "text-text-muted"
    } ${className}`}
  >
    {children}
  </div>
);

// Description cell for Material rows — a pick-or-type combobox over the Material
// Master. Selecting fills unit/rate/HSN/GST and seeds wastage; free typing keeps
// the row as a custom (unlinked) entry. The menu is fixed-positioned so it isn't
// clipped by the sheet's horizontal scroll container.
const MaterialPickerCell = ({
  row,
  disabled,
  materials,
  onChange,
  onSelect,
}) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const inputRef = useRef(null);
  const linked = !!row.materialId;

  const filtered = useMemo(() => {
    const q = (row.description || "").trim().toLowerCase();
    const list = q
      ? materials.filter(
          (m) =>
            m.name.toLowerCase().includes(q) ||
            (m.specifications || "").toLowerCase().includes(q),
        )
      : materials;
    return list.slice(0, 8);
  }, [row.description, materials]);

  const openMenu = () => {
    if (disabled) return;
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setRect(r);
    setOpen(true);
  };

  return (
    <div className="relative flex h-full items-center">
      {linked && (
        <Link2
          size={11}
          className="pointer-events-none absolute left-1.5 text-select-blue"
        />
      )}
      <input
        ref={inputRef}
        type="text"
        value={row.description || ""}
        // Typing diverges from the master entry, so drop the link.
        onChange={(e) => {
          onChange({ description: e.target.value, materialId: "" });
          openMenu();
        }}
        onFocus={openMenu}
        disabled={disabled}
        placeholder="Search material or type custom…"
        className={`${raCellInput} ${linked ? "pl-6" : ""}`}
        title={linked ? "Linked to Material Master" : undefined}
      />
      {open && rect && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 max-h-56 overflow-y-auto rounded-lg border border-bordergray bg-white shadow-2xl"
            style={{
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 248),
            }}
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[10.5px] text-text-subtle">
                No master match — keep typing to use as a custom item.
              </p>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-2 border-b border-bordergray/50 px-2.5 py-1.5 text-left last:border-0 hover:bg-active-bg/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold text-textcolor">
                      {m.name}
                    </span>
                    {m.specifications && (
                      <span className="block truncate text-[9.5px] text-text-muted">
                        {m.specifications}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tabular-nums text-select-blue">
                    {formatAmount(m.rate)}/{m.unit}
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Editable item row (material or contract). idx is the running Sl within block.
// When `materials` is supplied, the Description cell becomes a Master picker.
const RaItemRow = ({
  row,
  idx,
  disabled,
  onChange,
  onRemove,
  materials,
  unitOptions = [],
}) => (
  <div className={`${RA_COLS} border-t border-bordergray/60`}>
    <div className="flex items-center justify-center bg-white text-[10px] font-semibold tabular-nums text-text-subtle">
      {idx + 1}
    </div>
    {materials ? (
      <MaterialPickerCell
        row={row}
        disabled={disabled}
        materials={materials}
        onChange={onChange}
        onSelect={(m) =>
          onChange({
            materialId: m.id,
            description: m.name,
            unit: m.unit || "",
            rate: Number(m.rate) || 0,
            hsn: m.hsn || "",
            gstPercent: Number(m.gstPercent) || 0,
            wastagePercent: defaultWastageFor(m.name),
          })
        }
      />
    ) : (
      <input
        type="text"
        value={row.description || ""}
        onChange={(e) => onChange({ description: e.target.value })}
        disabled={disabled}
        placeholder="Description"
        className={raCellInput}
      />
    )}
    <select
      value={row.unit || ""}
      onChange={(e) => onChange({ unit: e.target.value })}
      disabled={disabled}
      title="Unit"
      className={`${raCellInput} cursor-pointer`}
    >
      {!row.unit && <option value="">Unit</option>}
      {row.unit && !unitOptions.some((u) => u.code === row.unit) && (
        <option value={row.unit}>{row.unit}</option>
      )}
      {unitOptions.map((u) => (
        <option key={u.code} value={u.code}>
          {u.label}
        </option>
      ))}
    </select>
    <input
      type="text"
      inputMode="decimal"
      value={row.rate ?? ""}
      onChange={(e) => {
        if (DECIMAL_ONLY.test(e.target.value))
          onChange({ rate: e.target.value });
      }}
      disabled={disabled}
      title="Rate per unit"
      placeholder="0"
      className={`${raCellInput} text-right`}
    />
    <input
      type="text"
      inputMode="decimal"
      value={row.quantity ?? ""}
      onChange={(e) => {
        if (DECIMAL_ONLY.test(e.target.value))
          onChange({ quantity: e.target.value });
      }}
      disabled={disabled}
      placeholder="0"
      className={`${raCellInput} text-right`}
    />
    <input
      type="text"
      inputMode="decimal"
      value={row.wastagePercent ?? ""}
      onChange={(e) => {
        if (DECIMAL_ONLY.test(e.target.value))
          onChange({ wastagePercent: e.target.value });
      }}
      disabled={disabled}
      placeholder="0"
      className={`${raCellInput} text-right`}
    />
    <div
      className="flex items-center justify-end bg-bg-soft/60 px-2 py-1.5 text-[11px] tabular-nums text-text-muted"
      title="Quantity with wastage"
    >
      {rateRowQww(row).toFixed(2)}
    </div>
    <RaValueCell strong>{formatAmount(rateRowAmount(row))}</RaValueCell>
    <div className="flex items-center justify-center bg-white">
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="h-6 w-6 flex items-center justify-center rounded-md text-text-muted hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
        title="Remove row"
      >
        <Trash2 size={11} />
      </button>
    </div>
  </div>
);

// Group band header (A. Material Items / B. Contract Items) — just the block
// label and its Add action. The block total sits in the footer below its rows.
const RaGroupHeader = ({ letter, title, onAdd, disabled }) => (
  <div className={`${RA_COLS} border-t border-bordergray bg-active-bg/50`}>
    <div className="flex items-center justify-center">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-select-blue/15 text-[9px] font-bold text-select-blue">
        {letter}
      </span>
    </div>
    <div className="col-span-8 flex items-center gap-2 px-1.5 py-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-primary">
        {title}
      </span>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="flex items-center gap-0.5 text-[10px] font-semibold text-select-blue hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={10} /> Add
      </button>
    </div>
  </div>
);

// Block subtotal row — the block's total Amount, shown below its item rows.
// Rate/sqft is intentionally left blank (only per-row rates carry meaning).
const RaGroupFooter = ({ label, subtotal }) => (
  <div className={`${RA_COLS} border-t border-bordergray bg-bg-soft`}>
    <div className="col-span-7 flex items-center justify-end px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-grey">
      {label}
    </div>
    <RaValueCell strong className="bg-bg-soft">
      {formatAmount(subtotal)}
    </RaValueCell>
    <div className="bg-bg-soft" />
  </div>
);

// A cascade row (C / D / E / F). Renders the label across the middle columns,
// an optional inline % editor, and the resulting value in the Amount column.
const RaCascadeRow = ({
  letter,
  label,
  value,
  tint = "",
  strong = false,
  percentValue,
  onPercentChange,
  disabled,
}) => (
  <div className={`${RA_COLS} border-t border-bordergray/70 ${tint}`}>
    <div className="flex items-center justify-center">
      {letter && (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-select-blue/15 text-[9px] font-bold text-select-blue">
          {letter}
        </span>
      )}
    </div>
    <div className="col-span-6 flex items-center gap-2 px-1.5 py-1.5">
      <span
        className={`text-[11px] ${strong ? "font-bold text-textcolor" : "font-semibold text-text-muted"}`}
      >
        {label}
      </span>
      {onPercentChange && (
        <span className="inline-flex items-center gap-0.5">
          <input
            type="text"
            inputMode="decimal"
            value={percentValue ?? ""}
            onChange={(e) => {
              if (DECIMAL_ONLY.test(e.target.value))
                onPercentChange(e.target.value);
            }}
            disabled={disabled}
            placeholder="0"
            className="w-12 rounded border border-bordergray bg-white px-1 py-0.5 text-right text-[10.5px] tabular-nums focus:outline-none focus:ring-1 focus:ring-select-blue/40 disabled:bg-bg-soft disabled:cursor-not-allowed"
          />
          <span className="text-[10px] font-semibold text-text-muted">%</span>
        </span>
      )}
    </div>
    <RaValueCell strong={strong} className={tint || "bg-white"}>
      {formatAmount(value)}
    </RaValueCell>
    <div className={tint || "bg-white"} />
  </div>
);

// Consolidated Rate Analysis worksheet — every line item across all sections in
// one place, so unit rates can be built up and validated together before the
// BOQ is finalized. Reuses the same per-item RateAnalysisEditor shown inline in
// Scope of Work, wired to the same updateItem path, so edits stay in sync across
// both tabs (there's one source of truth per item).
const RateAnalysisTab = ({ boq, onUpdateItem, disabled = false }) => {
  const sections = (boq.sections || []).filter(
    (s) => (s.items || []).length > 0,
  );
  const allItems = sections.flatMap((s) => s.items || []);
  const enabledCount = allItems.filter((it) => it.rateAnalysis?.enabled).length;

  if (allItems.length === 0) {
    return (
      <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto scroll-hidden-bar">
        <div className="rounded-2xl border border-dashed border-bordergray bg-white px-6 py-12 text-center">
          <Calculator size={22} className="mx-auto mb-2 text-text-subtle" />
          <p className="text-[13px] font-semibold text-textcolor">
            No line items yet
          </p>
          <p className="mt-1 text-[11.5px] text-text-muted">
            Add scope items first, then build up their rates here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:flex-1 lg:min-h-0 space-y-5 lg:overflow-y-auto lg:pr-2 lg:pb-6 scroll-hidden-bar">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-select-blue/20 bg-select-blue/[0.03] px-4 py-3">
        <div className="flex items-center gap-2">
          <Calculator size={15} className="text-select-blue" />
          <div>
            <p className="text-[12.5px] font-bold text-textcolor">
              Rate Analysis
            </p>
            <p className="text-[11px] text-text-muted">
              Build up and validate unit rates for every line item before
              finalizing.
            </p>
          </div>
        </div>
        <span className="rounded-lg border border-bordergray bg-white px-2.5 py-1 text-[11px] font-semibold text-text-muted">
          {enabledCount}/{allItems.length} with rate analysis
        </span>
      </div>

      {sections.map((section) => (
        <section key={section.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded bg-select-blue" />
            <h3 className="text-[12px] font-bold text-textcolor">
              {section.name || section.title || "Untitled Section"}
            </h3>
            <span className="text-[10.5px] text-text-subtle">
              {section.items.length} item{section.items.length > 1 ? "s" : ""}
            </span>
          </div>
          {section.items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-bordergray bg-bg-soft/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-textcolor">
                    {item.description || "Untitled item"}
                  </p>
                  {item.spec && (
                    <p className="truncate text-[10.5px] text-text-muted">
                      {item.spec}
                    </p>
                  )}
                </div>
                <span className="shrink-0 rounded-lg border border-bordergray bg-white px-2.5 py-1 text-[11px] font-bold text-textcolor tabular-nums">
                  {formatAmount(item.rate || 0)} / {item.unit || "unit"}
                </span>
              </div>
              <RateAnalysisEditor
                item={item}
                onUpdate={(changes) =>
                  onUpdateItem(section.id, item.id, changes)
                }
                disabled={disabled}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
};

const RateAnalysisEditor = ({ item, onUpdate, disabled = false }) => {
  const current = computeRateAnalysis(item.rateAnalysis, item.unit);
  const [open, setOpen] = useState(!!current.enabled);
  const unitLabel = current.unit || item.unit || "unit";
  const ro = disabled || !current.enabled;
  // Material Master catalog, read once — powers the Material Items picker.
  const materials = useMemo(() => listMaterials(), []);

  // Unit dropdown options for the sheet rows: the standard BOQ units, plus any
  // extra units actually used across the Item Master and Material Master so the
  // list stays in sync with the masters instead of a fixed hard-coded set.
  const unitOptions = useMemo(() => {
    const seen = new Map(UNITS.map((u) => [u.code, u.label]));
    for (const m of materials) {
      const code = (m.unit || "").trim();
      if (code && !seen.has(code)) seen.set(code, code);
    }
    for (const l of listLibrary()) {
      const code = (l.unit || "").trim();
      if (code && !seen.has(code)) seen.set(code, code);
    }
    return [...seen.entries()].map(([code, label]) => ({ code, label }));
  }, [materials]);

  const applyRa = (values) => {
    const next = computeRateAnalysis({ ...current, ...values }, item.unit);
    onUpdate({
      rateAnalysis: next,
      ...(next.enabled && next.useFinalRate
        ? { rate: next.roundedFinalRate }
        : {}),
    });
  };
  const changeRows = (key, rows) => applyRa({ [key]: rows });
  const patchRow = (key, idx, values) =>
    changeRows(
      key,
      (current[key] || []).map((row, i) =>
        i === idx ? { ...row, ...values } : row,
      ),
    );
  const addRow = (key) =>
    changeRows(key, [
      ...(current[key] || []),
      { ...blankRateAnalysisRow(), unit: item.unit || "" },
    ]);
  const removeRow = (key, idx) =>
    changeRows(
      key,
      (current[key] || []).filter((_, i) => i !== idx),
    );

  return (
    <div className="mt-3 rounded-xl border border-bordergray bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-muted hover:text-select-blue"
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          Rate Analysis
          {current.enabled && (
            <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {formatAmount(current.roundedFinalRate)} / {unitLabel}
            </span>
          )}
        </button>
        <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-muted">
          <input
            type="checkbox"
            checked={!!current.enabled}
            onChange={(e) => {
              applyRa({ enabled: e.target.checked });
              setOpen(true);
            }}
            disabled={disabled}
            className="h-3.5 w-3.5 accent-select-blue"
          />
          Enable
        </label>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {/* Work identity — short name + specification straight from the item. */}
          {(item.description || item.spec) && (
            <div className="rounded-lg border border-bordergray/70 bg-bg-soft/30 px-3 py-2">
              {item.description && (
                <p className="text-[11.5px] font-bold text-textcolor">
                  {item.description}
                </p>
              )}
              {item.spec && (
                <p className="mt-1 text-[10px] leading-relaxed text-text-muted">
                  {item.spec}
                </p>
              )}
            </div>
          )}

          {/* RA quantity + unit — the basis the per-unit rate is divided by. */}
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-bordergray/70 bg-bg-soft/30 px-3 py-2">
            <Field icon={<Hash size={10} />} label="RA Qty">
              <NumericInput
                value={current.raQuantity || ""}
                onChange={(val) => applyRa({ raQuantity: Number(val) || 0 })}
                disabled={ro}
                placeholder="0"
                className={`${compactInput} w-24 text-right tabular-nums disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
              />
            </Field>
            <Field icon={<Ruler size={10} />} label="Unit">
              {(() => {
                const raUnit = current.unit || item.unit || "";
                return (
                  <select
                    value={raUnit}
                    onChange={(e) => applyRa({ unit: e.target.value })}
                    disabled={ro}
                    className={`${compactInput} w-24 cursor-pointer disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
                  >
                    {!raUnit && <option value="">Unit</option>}
                    {raUnit && !unitOptions.some((u) => u.code === raUnit) && (
                      <option value={raUnit}>{raUnit}</option>
                    )}
                    {unitOptions.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                );
              })()}
            </Field>
          </div>

          {/* ── The sheet ─────────────────────────────────────────────── */}
          <div className="overflow-x-auto rounded-lg border border-bordergray">
            <div className="min-w-[640px]">
              {/* Column header */}
              <div
                className={`${RA_COLS} bg-primary/5 text-[8.5px] font-bold uppercase tracking-wider text-text-muted`}
              >
                <span className="flex items-center justify-center py-1.5">
                  Sl
                </span>
                <span className="flex items-center px-1.5 py-1.5">
                  Description
                </span>
                <span className="flex items-center px-1.5 py-1.5">Unit</span>
                <span className="flex items-center justify-end px-1.5 py-1.5">
                  Rate/{unitLabel}
                </span>
                <span className="flex items-center justify-end px-1.5 py-1.5">
                  Qty
                </span>
                <span className="flex items-center justify-end px-1.5 py-1.5">
                  Waste%
                </span>
                <span className="flex items-center justify-end px-1.5 py-1.5">
                  QWW
                </span>
                <span className="flex items-center justify-end px-1.5 py-1.5">
                  Amount
                </span>
                <span className="py-1.5" />
              </div>

              {/* A — Material Items */}
              <RaGroupHeader
                letter="A"
                title="Material Items"
                onAdd={() => addRow("materialItems")}
                disabled={ro}
              />
              {(current.materialItems || []).length === 0 ? (
                <div className={`${RA_COLS} border-t border-bordergray/60`}>
                  <div className="col-span-9 bg-white px-3 py-2 text-[10px] text-text-subtle">
                    No material items — click <b>Add</b> on the band above.
                  </div>
                </div>
              ) : (
                (current.materialItems || []).map((row, idx) => (
                  <RaItemRow
                    key={row.id || idx}
                    row={row}
                    idx={idx}
                    disabled={ro}
                    materials={materials}
                    unitOptions={unitOptions}
                    onChange={(values) =>
                      patchRow("materialItems", idx, values)
                    }
                    onRemove={() => removeRow("materialItems", idx)}
                  />
                ))
              )}
              <RaGroupFooter
                label="Material Items total"
                subtotal={current.subtotalMaterials}
              />

              {/* B — Contract Items */}
              <RaGroupHeader
                letter="B"
                title="Contract Items"
                onAdd={() => addRow("contractItems")}
                disabled={ro}
              />
              {(current.contractItems || []).length === 0 ? (
                <div className={`${RA_COLS} border-t border-bordergray/60`}>
                  <div className="col-span-9 bg-white px-3 py-2 text-[10px] text-text-subtle">
                    No contract items — click <b>Add</b> on the band above.
                  </div>
                </div>
              ) : (
                (current.contractItems || []).map((row, idx) => (
                  <RaItemRow
                    key={row.id || idx}
                    row={row}
                    idx={idx}
                    disabled={ro}
                    unitOptions={unitOptions}
                    onChange={(values) =>
                      patchRow("contractItems", idx, values)
                    }
                    onRemove={() => removeRow("contractItems", idx)}
                  />
                ))
              )}
              <RaGroupFooter
                label="Contract Items total"
                subtotal={current.subtotalContracts}
              />

              {/* Price Calculation band */}
              <div
                className={`${RA_COLS} border-t-2 border-bordergray bg-primary/5`}
              >
                <div className="col-span-9 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-text-muted">
                  Price Calculation
                </div>
              </div>

              {/* Optional cost lines that aren't material/contract rows */}
              {current.subtotalConsumables > 0 && (
                <RaCascadeRow
                  letter=""
                  label="Consumables"
                  value={current.subtotalConsumables}
                />
              )}
              {/* Labour — mapped from the build-up and shown as a cost line. */}
              <RaCascadeRow
                letter=""
                label="Labour (lump sum)"
                value={current.labourRate}
              />

              {/* C — Total of Material + Contracts (A+B) */}
              <RaCascadeRow
                letter="C"
                label="Total of Material + Contracts (A+B)"
                value={current.directCost}
                tint="bg-active-bg/30"
                strong
              />
              {/* D — Cost per unit */}
              <RaCascadeRow
                letter="D"
                label={`Cost per unit (C / ${current.raQuantity || 0} ${unitLabel})`}
                value={current.costPerUnit}
                tint="bg-active-bg/20"
                strong
              />
              {/* Overhead — mapped from the build-up (read-only). Its % shows in
                  the label; the value comes from the Item Master recipe. */}
              <RaCascadeRow
                letter=""
                label={`Overhead (${current.overheadPercent || 0}%)`}
                value={current.overheadAmount}
              />
              {/* E — Contract PCE (D × E%) */}
              <RaCascadeRow
                letter="E"
                label="Contract PCE — adds to basic cost"
                value={current.rateBeforeMargin}
                tint="bg-active-bg/20"
                strong
                percentValue={current.pcePercent}
                onPercentChange={(v) => applyRa({ pcePercent: v })}
                disabled={ro}
              />
              {/* F — Margin (mapped from the build-up, read-only). On selling
                  price: final rate = basic cost ÷ (1 − margin%). */}
              <RaCascadeRow
                letter="F"
                label={`Margin — on selling price (${current.marginPercent || 0}%)`}
                value={current.roundedFinalRate}
                tint="bg-active-bg/60"
                strong
              />
            </div>
          </div>

          {/* Final rate highlight — mirrors the Summary Grand Total bar */}
          <div className="flex items-center justify-between gap-3 rounded-lg bg-linear-to-br from-select-blue to-primary px-3 py-2.5 text-white shadow-sm">
            <span className="text-[10.5px] font-bold uppercase tracking-wider opacity-80">
              Final Rate / {unitLabel}
            </span>
            <span className="text-[18px] font-bold tabular-nums">
              {formatAmount(current.roundedFinalRate)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const ClientPicker = ({ current, onPick, onClear, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
  };

  // Read clients lazily when the dropdown is open. Reading inside useMemo keeps
  // it reactive to query changes without needing a separate state setter.
  const filtered = useMemo(() => {
    if (!open) return [];
    const all = getAllClients();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.clientID || "").toLowerCase().includes(q) ||
        (c.clientEmail || "").toLowerCase().includes(q),
    );
  }, [open, query]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open ? () => setOpen(false) : handleOpen}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {current?.id ? "Change Client" : "Select Existing Client"}
      </button>
      {current?.id && (
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          className="ml-1 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] text-text-subtle hover:text-red-500 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Unlink client"
        >
          <X size={11} />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-[340px] bg-white rounded-xl border border-bordergray shadow-2xl z-50 overflow-hidden">
            <div className="p-2 border-b border-bordergray">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, ID, or email"
                  className="w-full bg-bg-soft border border-transparent rounded-lg pl-7 pr-2 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30"
                  autoFocus
                />
              </div>
            </div>
            <div className="max-h-[320px] overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-[11px] text-text-subtle text-center py-6">
                  No clients found
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.clientID}
                    type="button"
                    onClick={() => {
                      onPick(c);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="w-full text-left px-3 py-2.5 border-b border-bordergray/60 hover:bg-active-bg/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-bold text-textcolor truncate">
                        {c.clientName}
                      </p>
                      <span className="text-[9.5px] font-semibold text-select-blue bg-select-blue/10 px-1.5 py-0.5 rounded border border-select-blue/20 shrink-0">
                        {c.clientID}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-text-muted mt-0.5 truncate">
                      {c.clientEmail || c.clientPhone || "—"}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {c.location && (
                        <span className="text-[9.5px] font-semibold text-text-muted bg-bg-soft px-1.5 py-0.5 rounded">
                          {c.location}
                        </span>
                      )}
                      {c.locationSecondary && (
                        <span className="text-[9.5px] text-text-subtle truncate">
                          {c.locationSecondary}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-2 border-t border-bordergray bg-bg-soft/40">
              <p className="text-[10px] text-text-subtle">
                Picking a client auto-fills name, contact, property type, and
                address into this BOQ.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const DimensionEditor = ({
  item,
  dimInfo,
  isArea,
  computedQty,
  r,
  updateDim,
  unitLabel,
  disabled = false,
}) => (
  <tr className="bg-active-bg/20 border-b border-bordergray">
    <td colSpan={7} className="px-3 py-3">
      <div className="flex items-start gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-select-blue mt-2">
          <Calculator size={11} /> Measurement
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <DimInput
            label="Length (L)"
            suffix={dimInfo?.suffix}
            value={item.dimensions?.length || 0}
            onChange={(v) => updateDim({ length: v })}
            disabled={disabled}
          />
          {isArea && (
            <>
              <span className="text-text-subtle font-bold mt-2">×</span>
              <DimInput
                label="Depth (D)"
                suffix={dimInfo?.suffix}
                value={item.dimensions?.breadth ?? item.dimensions?.width ?? 0}
                onChange={(v) => updateDim({ breadth: v })}
                disabled={disabled}
              />
              <span className="text-text-subtle font-bold mt-2">×</span>
              <DimInput
                label="Height (H)"
                suffix={dimInfo?.suffix}
                value={item.dimensions?.height || 0}
                onChange={(v) => updateDim({ height: v })}
                disabled={disabled}
              />
            </>
          )}
          <span className="text-text-subtle font-bold mt-2">=</span>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
              Total Qty
            </span>
            <span className="bg-white border border-select-blue/30 rounded-md px-3 py-1.5 text-right">
              <span className="text-[14px] font-bold text-select-blue tabular-nums leading-tight">
                {computedQty.toFixed(2).replace(/\.00$/, "")}{" "}
                <span className="text-[10px] text-text-muted font-normal">
                  {unitLabel}
                </span>
              </span>
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5 text-[10.5px] text-text-muted mt-1">
          <span>
            Rate{" "}
            <span className="font-bold tabular-nums text-textcolor">
              ₹{Number(item.rate || 0).toLocaleString("en-IN")}
            </span>{" "}
            / {unitLabel} · Line{" "}
            <span className="font-bold tabular-nums text-textcolor">
              {formatAmount(r.net)}
            </span>
          </span>
        </div>
      </div>
    </td>
  </tr>
);

const DimInput = ({ label, suffix, value, onChange, disabled = false }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
      {label}
    </span>
    <span className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.select()}
        disabled={disabled}
        placeholder="0"
        title={label}
        className={`${compactInput} w-20 text-right tabular-nums ${suffix ? "pr-7" : "pr-2"} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
      />
      {suffix && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] text-text-subtle font-semibold pointer-events-none">
          {suffix}
        </span>
      )}
    </span>
  </label>
);

// ─── Small components ──────────────────────────────────────────────────────
const formatSignoffDate = (iso) => {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const AuditTrailList = ({
  items = [],
  revisionHistory = [],
  revisionComparison = null,
  onViewSnapshot,
}) => {
  const latest = [...items].reverse();
  // The stored revisionComparison applies to the current revision — show its
  // summary alongside the "sent" or "approved" entry for that same revision.
  const diffRevision = revisionComparison?.currentRevision ?? null;
  const hasDiff =
    diffRevision !== null && (revisionComparison?.changes || []).length > 0;

  return (
    <div className="rounded-xl border border-bordergray bg-white">
      <div className="flex items-center justify-between border-b border-bordergray px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
          Approval History
        </span>
        <span className="rounded bg-bg-soft px-1.5 py-0.5 text-[9.5px] font-bold text-text-subtle">
          {items.length}
        </span>
      </div>
      {latest.length === 0 ? (
        <p className="px-3 py-3 text-[10.5px] text-text-subtle">
          No workflow events recorded yet.
        </p>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {latest.map((entry) => {
            const snap =
              entry.action === "revision_created"
                ? revisionHistory.find((r) => r.revision === entry.revision)
                : null;
            // Show the diff summary on the sent/approved entry for the matching revision
            const showDiff =
              hasDiff &&
              entry.revision === diffRevision &&
              (entry.action === "sent" || entry.action === "approved");
            const s = revisionComparison?.summary || {};
            return (
              <div
                key={entry.id}
                className="border-b border-bordergray/70 px-3 py-2 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-textcolor">
                      {entry.label}
                    </p>
                    <p className="text-[10px] text-text-muted">
                      {entry.actor} · Rev {entry.revision} · {entry.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {snap && onViewSnapshot && (
                      <button
                        type="button"
                        onClick={() => onViewSnapshot(snap)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold text-select-blue hover:bg-active-bg border border-select-blue/30"
                        title={`View Rev ${snap.revision} content`}
                      >
                        <Eye size={9} /> View Rev {snap.revision}
                      </button>
                    )}
                    <span className="text-[9.5px] font-semibold text-text-subtle">
                      {formatSignoffDate(entry.at)}
                    </span>
                  </div>
                </div>
                {entry.details && (
                  <p className="mt-1 text-[10px] leading-snug text-text-subtle">
                    {entry.details}
                  </p>
                )}
                {showDiff && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.itemsAdded > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        +{s.itemsAdded} added
                      </span>
                    )}
                    {s.itemsRemoved > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-red-50 text-red-600 border border-red-100">
                        −{s.itemsRemoved} removed
                      </span>
                    )}
                    {s.itemsChanged > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                        ~{s.itemsChanged} changed
                      </span>
                    )}
                    {s.amountDelta !== 0 && (
                      <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold border ${s.amountDelta > 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-orange-50 text-orange-700 border-orange-100"}`}>
                        {s.amountDelta > 0 ? "+" : ""}
                        ₹{Math.abs(Math.round(s.amountDelta)).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const RevisionSnapshotModal = ({ snapshot, currentSections, onClose }) => {
  const [activeTab, setActiveTab] = useState("snapshot");
  const totalItems = (snapshot.sections || []).reduce(
    (s, sec) => s + (sec.items?.length || 0),
    0,
  );
  // Compute what changed between this snapshot (prev) and the current live
  // sections (next) — only when currentSections is provided and differs.
  const diff = useMemo(
    () =>
      currentSections && snapshot.sections
        ? diffBoqRevisions(snapshot.sections, currentSections)
        : null,
    [snapshot.sections, currentSections],
  );
  const hasChanges = diff && diff.changes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-overallbg">
      {/* Header */}
      <div className="modal-no-print flex items-center justify-between gap-3 border-b border-bordergray bg-white px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <History size={15} className="text-text-muted" />
          <span className="text-[13px] font-bold text-textcolor">
            Revision {snapshot.revision} Snapshot
          </span>
          <span className="rounded-full bg-bg-soft px-2 py-0.5 text-[10px] font-semibold text-text-muted border border-bordergray capitalize">
            {snapshot.status}
          </span>
          <span className="text-[10.5px] text-text-subtle">
            · {snapshot.sections?.length || 0} sections · {totalItems} items
          </span>
          {hasChanges && (
            <span className="rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 text-[9.5px] font-bold">
              {diff.changes.length} change{diff.changes.length !== 1 ? "s" : ""} since this revision
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] text-text-subtle">
            {snapshot.at
              ? new Date(snapshot.at).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })
              : ""}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft"
          >
            <X size={12} /> Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      {hasChanges && (
        <div className="modal-no-print flex border-b border-bordergray bg-white px-4 shrink-0">
          {[
            { id: "snapshot", label: "Snapshot" },
            { id: "changes", label: `Change Register (${diff.changes.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-[11.5px] font-semibold border-b-2 -mb-px transition-colors ${
                activeTab === t.id
                  ? "border-select-blue text-select-blue"
                  : "border-transparent text-text-muted hover:text-textcolor"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "changes" && diff ? (
          <div className="mx-auto max-w-4xl">
            {/* Summary row */}
            <div className="mb-4 flex flex-wrap gap-2">
              {diff.summary.sectionsAdded > 0 && (
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  +{diff.summary.sectionsAdded} section{diff.summary.sectionsAdded !== 1 ? "s" : ""} added
                </span>
              )}
              {diff.summary.sectionsRemoved > 0 && (
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
                  −{diff.summary.sectionsRemoved} section{diff.summary.sectionsRemoved !== 1 ? "s" : ""} removed
                </span>
              )}
              {diff.summary.itemsAdded > 0 && (
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  +{diff.summary.itemsAdded} item{diff.summary.itemsAdded !== 1 ? "s" : ""} added
                </span>
              )}
              {diff.summary.itemsRemoved > 0 && (
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-red-50 text-red-600 border border-red-100">
                  −{diff.summary.itemsRemoved} item{diff.summary.itemsRemoved !== 1 ? "s" : ""} removed
                </span>
              )}
              {diff.summary.itemsChanged > 0 && (
                <span className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                  ~{diff.summary.itemsChanged} item{diff.summary.itemsChanged !== 1 ? "s" : ""} changed
                </span>
              )}
              {diff.summary.amountDelta !== 0 && (
                <span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${diff.summary.amountDelta > 0 ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-orange-50 text-orange-700 border-orange-100"}`}>
                  Net change {diff.summary.amountDelta > 0 ? "+" : ""}
                  ₹{Math.abs(Math.round(diff.summary.amountDelta)).toLocaleString("en-IN")}
                </span>
              )}
            </div>

            {/* Change register table */}
            <div className="rounded-xl border border-bordergray bg-white overflow-hidden">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted bg-bg-soft border-b border-bordergray">
                    <th className="px-4 py-2 text-left w-20">Change</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-left w-32">Section</th>
                    <th className="px-4 py-2 text-right w-24">Old Amount</th>
                    <th className="px-4 py-2 text-right w-24">New Amount</th>
                    <th className="px-4 py-2 text-right w-24">Δ Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.changes.map((c, ci) => {
                    const typeStyle =
                      c.type === "added"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : c.type === "removed"
                        ? "bg-red-50 text-red-600 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200";
                    const typeLabel =
                      c.type === "added" ? "Added" : c.type === "removed" ? "Removed" : "Changed";
                    const prevAmt = c.type === "added" ? 0 : (c.prevAmount ?? c.amount ?? 0);
                    const nextAmt = c.type === "removed" ? 0 : (c.nextAmount ?? c.amount ?? 0);
                    const delta = nextAmt - prevAmt;
                    return (
                      <tr
                        key={c.itemId || ci}
                        className="border-b border-bordergray/60 last:border-b-0 hover:bg-bg-soft/30"
                      >
                        <td className="px-4 py-2">
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold border ${typeStyle}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <p className="font-medium text-textcolor">{c.description || "—"}</p>
                          {c.type === "changed" && c.fields?.map((f) => (
                            <p key={f.field} className="text-[10px] text-text-muted mt-0.5">
                              {f.field}:{" "}
                              <span className="line-through text-red-500">
                                {typeof f.oldValue === "number" ? Number(f.oldValue).toLocaleString("en-IN") : f.oldValue}
                              </span>
                              {" → "}
                              <span className="text-emerald-600 font-semibold">
                                {typeof f.newValue === "number" ? Number(f.newValue).toLocaleString("en-IN") : f.newValue}
                              </span>
                            </p>
                          ))}
                        </td>
                        <td className="px-4 py-2 text-text-muted">{c.section || "—"}</td>
                        <td className="px-4 py-2 text-right text-text-muted tabular-nums">
                          {prevAmt > 0 ? `₹${Math.round(prevAmt).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-textcolor tabular-nums">
                          {nextAmt > 0 ? `₹${Math.round(nextAmt).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className={`px-4 py-2 text-right font-semibold tabular-nums ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-text-muted"}`}>
                          {delta !== 0
                            ? `${delta > 0 ? "+" : ""}₹${Math.round(delta).toLocaleString("en-IN")}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !snapshot.sections || snapshot.sections.length === 0 ? (
            <div className="text-center py-16 text-text-subtle text-[13px]">
              No sections were captured in this snapshot.
            </div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-4">
              {snapshot.sections.map((sec, si) => (
                <div
                  key={sec.id || si}
                  className="rounded-xl border border-bordergray bg-white overflow-hidden"
                >
                  <div className="flex items-center gap-2 bg-bg-soft px-4 py-2.5 border-b border-bordergray">
                    <span className="text-[11px] font-bold text-textcolor">
                      {sec.name || "Untitled Section"}
                    </span>
                    {sec.category && (
                      <span className="text-[10px] text-text-muted">
                        · {sec.category}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-text-subtle">
                      {sec.items?.length || 0} items
                    </span>
                  </div>
                  {!sec.items || sec.items.length === 0 ? (
                    <p className="px-4 py-3 text-[11px] text-text-subtle">
                      No items.
                    </p>
                  ) : (
                    <table className="w-full text-[11.5px]">
                      <thead>
                        <tr className="text-[10px] text-text-muted uppercase tracking-wide border-b border-bordergray">
                          <th className="px-4 py-2 text-center font-semibold w-8">#</th>
                          <th className="px-4 py-2 text-center font-semibold">Description</th>
                          <th className="px-4 py-2 text-center font-semibold">Qty</th>
                          <th className="px-4 py-2 text-center font-semibold">Unit</th>
                          <th className="px-4 py-2 text-center font-semibold">Rate</th>
                          <th className="px-4 py-2 text-center font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sec.items.map((item, ii) => {
                          const qty = computeItemQty(item);
                          const amt = qty * (Number(item.rate) || 0);
                          return (
                            <tr
                              key={item.id || ii}
                              className="border-b border-bordergray/60 last:border-b-0 hover:bg-bg-soft/40"
                            >
                              <td className="px-4 py-2 text-text-subtle">{ii + 1}</td>
                              <td className="px-4 py-2">
                                <p className="font-medium text-textcolor">
                                  {item.description || "—"}
                                </p>
                                {item.spec && (
                                  <p className="text-[10px] text-text-muted mt-0.5">
                                    {item.spec}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-2 text-right text-textcolor">
                                {Number(qty).toFixed(2)}
                              </td>
                              <td className="px-4 py-2 text-text-muted">{item.unit || "—"}</td>
                              <td className="px-4 py-2 text-right text-textcolor">
                                {Number(item.rate || 0).toLocaleString("en-IN")}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-textcolor">
                                {amt.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};

const SeedPicker = ({ onClose, onPick }) => {
  const [query, setQuery] = useState("");
  const keys = getPresetKeys();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => k.toLowerCase().includes(q));
  }, [keys, query]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-select-blue" />
            <h3 className="text-[13px] font-bold text-textcolor">
              Seed BOQ from Preset
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
        <div className="p-4">
          <p className="text-[11.5px] text-text-muted mb-3">
            Choose a Proposal Master preset to auto-create sections and a
            starting line item per area. You can refine each line with detailed
            quantities and rates after.
          </p>
          <div className="relative mb-3">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search presets (e.g. 2BHK, Villa)"
              className="w-full bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-gray-400 focus:outline-none focus:bg-white focus:border-select-blue/30"
              autoFocus
            />
          </div>
          {filtered.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-6">
              No presets match "{query}"
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => onPick(k)}
                  className="text-left px-3 py-2.5 rounded-lg border border-bordergray hover:border-select-blue hover:bg-active-bg/30 transition-all"
                >
                  <p className="text-[12px] font-bold text-textcolor">{k}</p>
                  <p className="text-[10.5px] text-text-muted mt-0.5">
                    Load typical scope
                  </p>
                </button>
              ))}
            </div>
          )}
          <p className="text-[10.5px] text-gray-400 mt-3 flex items-center gap-1">
            <AlertTriangle size={10} /> Seeding replaces existing sections in
            this BOQ.
          </p>
        </div>
      </div>
    </div>
  );
};

const SectionTemplatePicker = ({ onClose, onAddBlank, onAddFromCategory }) => {
  const [selected, setSelected] = useState(null); // { value, label, icon, items }
  const [picked, setPicked] = useState({}); // { itemId: true } within selected category

  const items = listLibrary();

  const cats = getScheduleConfig().rooms.map((r) => {
    const matching = items.filter((it) => it.category === r.name);
    const total = matching.reduce((s, it) => s + (Number(it.rate) || 0), 0);
    return { value: r.name, label: r.name, items: matching, total };
  });

  // Drill into a category: pre-check every item so the default = full bundle.
  const enterCategory = (cat) => {
    const map = {};
    cat.items.forEach((it) => {
      map[it.id] = true;
    });
    setPicked(map);
    setSelected(cat);
  };

  const backToCategories = () => {
    setSelected(null);
    setPicked({});
  };

  const togglePick = (id) => setPicked((p) => ({ ...p, [id]: !p[id] }));

  const toggleAll = () => {
    if (!selected) return;
    const allOn = selected.items.every((it) => picked[it.id]);
    if (allOn) setPicked({});
    else {
      const m = {};
      selected.items.forEach((it) => (m[it.id] = true));
      setPicked(m);
    }
  };

  const pickedItems = selected
    ? selected.items.filter((it) => picked[it.id])
    : [];
  const pickedTotal = pickedItems.reduce(
    (s, it) => s + (Number(it.rate) || 0),
    0,
  );

  const handleConfirm = () => {
    if (!selected || pickedItems.length === 0) return;
    onAddFromCategory(selected.label, selected.value, pickedItems);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between bg-linear-to-r from-select-blue/5 to-white">
          <div className="flex items-center gap-2">
            {selected ? (
              <button
                type="button"
                onClick={backToCategories}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-bordergray bg-white text-text-muted hover:text-textcolor hover:bg-bg-soft"
                title="Back to categories"
              >
                <ArrowLeft size={13} />
              </button>
            ) : (
              <span className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
                <Sparkles size={14} />
              </span>
            )}
            <div>
              <h3 className="text-[14px] font-bold text-textcolor">
                {selected
                  ? `${selected.label} — pick items`
                  : "Add Section from Library"}
              </h3>
              <p className="text-[10.5px] text-text-muted">
                {selected
                  ? `Uncheck any items you don't need for this client`
                  : "Pick a category to see its items — you can refine selection on the next step"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {!selected ? (
          // ── Category grid ─────────────────────────────────────────────
          <div className="overflow-y-auto flex-1 p-4">
            <div className="grid grid-cols-2 gap-2.5">
              {cats.map((cat) => {
                const c = roomColor(cat.value);
                const disabled = cat.items.length === 0;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => enterCategory(cat)}
                    className={`text-left px-3 py-3 rounded-xl border transition-all ${
                      disabled
                        ? "border-bordergray bg-bg-soft/40 opacity-50 cursor-not-allowed"
                        : `${c.bg} ${c.border} hover:scale-[1.02] hover:shadow-md`
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0`}
                        >
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${c.dot}`}
                          />
                        </span>
                        <div className="min-w-0">
                          <p className={`text-[12.5px] font-bold ${c.text}`}>
                            {cat.label}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {cat.items.length === 0
                              ? "No items in library"
                              : `${cat.items.length} item${cat.items.length === 1 ? "" : "s"}`}
                          </p>
                        </div>
                      </div>
                      {cat.items.length > 0 && (
                        <span className="text-[10px] font-bold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray shrink-0">
                          ₹{Math.round(cat.total).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    {cat.items.length > 0 && (
                      <p className="text-[9.5px] text-text-muted mt-1.5 line-clamp-2">
                        {cat.items
                          .slice(0, 4)
                          .map((it) =>
                            it.description.split(" ").slice(0, 4).join(" "),
                          )
                          .join(" · ")}
                        {cat.items.length > 4 &&
                          ` +${cat.items.length - 4} more`}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="my-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-subtle">
              <span className="flex-1 h-px bg-bordergray" />
              or build manually
              <span className="flex-1 h-px bg-bordergray" />
            </div>

            <button
              type="button"
              onClick={onAddBlank}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-bordergray text-[12px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/30 transition-all"
            >
              <Plus size={13} /> Add Blank Section
            </button>
          </div>
        ) : (
          // ── Item checklist for selected category ───────────────────────
          <div className="overflow-y-auto flex-1 flex flex-col">
            <div className="px-4 py-2.5 border-b border-bordergray bg-bg-soft/40 flex items-center justify-between">
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-1.5 text-[11.5px] font-semibold text-select-blue hover:text-primary"
              >
                {selected.items.every((it) => picked[it.id]) ? (
                  <>
                    <X size={11} /> Deselect all
                  </>
                ) : (
                  <>
                    <Check size={11} /> Select all
                  </>
                )}
              </button>
              <span className="text-[10.5px] text-text-muted">
                <b className="text-textcolor">{pickedItems.length}</b> of{" "}
                {selected.items.length} selected
              </span>
            </div>

            <div className="p-3 space-y-1.5 flex-1">
              {selected.items.map((it) => {
                const c = roomColor(it.category);
                const isPicked = !!picked[it.id];
                const unitLabel =
                  UNITS.find((u) => u.code === it.unit)?.label || it.unit;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => togglePick(it.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                      isPicked
                        ? "border-select-blue bg-active-bg/40 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                        : "border-bordergray bg-white hover:border-select-blue/30 hover:bg-bg-soft/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 h-5 w-5 flex items-center justify-center rounded-md border shrink-0 ${
                          isPicked
                            ? "bg-select-blue border-select-blue text-white"
                            : "bg-white border-bordergray"
                        }`}
                      >
                        {isPicked && <Check size={11} strokeWidth={3} />}
                      </span>
                      <span className={`h-2 w-2 rounded-full mt-2 ${c.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-textcolor leading-snug">
                          {it.description}
                        </p>
                        {(it.materials || []).length > 0 && (
                          <p className="text-[10px] text-text-muted mt-0.5 truncate">
                            {it.materials
                              .map(
                                (m) =>
                                  `${m.name}${m.spec ? ` (${m.spec})` : ""}`,
                              )
                              .join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-subtle">
                          {it.hsn && <span>HSN {it.hsn}</span>}
                          <span>GST {it.gstPercent}%</span>
                          {(it.usage || 0) > 0 && (
                            <span className="text-select-blue/70">
                              ↗ used {it.usage}×
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[13px] font-bold text-textcolor tabular-nums">
                          ₹{Number(it.rate || 0).toLocaleString("en-IN")}
                        </span>
                        <span className="text-[9.5px] text-text-subtle">
                          / {unitLabel}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-bordergray bg-bg-soft/50 flex items-center justify-between flex-wrap gap-2">
          {selected ? (
            <>
              <p className="text-[10.5px] text-text-muted">
                {pickedItems.length === 0
                  ? "Select at least one item"
                  : `Adds new "${selected.label}" section · est. ₹${Math.round(pickedTotal).toLocaleString("en-IN")} (at qty 1)`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={backToCategories}
                  className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={pickedItems.length === 0}
                  className="px-4 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                  <Plus size={12} /> Add{" "}
                  {pickedItems.length > 0 &&
                    `${pickedItems.length} item${pickedItems.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-text-muted flex items-center gap-1">
              <Info size={10} /> Items are inserted as <b>linked</b> snapshots —
              collapsed by default, click <b>Override</b> on any row to change
              rate/HSN/GST for this BOQ.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const EmptySectionsState = ({
  onAdd,
  onAddFromTemplate,
  isArchitecture = false,
}) => (
  <div className="bg-white rounded-2xl border border-dashed border-bordergray text-center py-12 px-6">
    <div className="h-14 w-14 rounded-2xl bg-linear-to-br from-select-blue/10 to-active-bg flex items-center justify-center mx-auto mb-3 border border-bordergray">
      {isArchitecture ? (
        <Building2 size={20} className="text-select-blue" />
      ) : (
        <Layers size={20} className="text-select-blue" />
      )}
    </div>
    <p className="text-[14px] font-bold text-textcolor">Start your BOQ</p>
    <p className="text-[12px] text-text-muted mt-1 max-w-sm mx-auto">
      {isArchitecture
        ? "Add a work package section (Civil, MEP, Finishes, etc.) or a blank section — quantities come from approved drawings and the site survey take-off."
        : "Pick a category to auto-create a section with all matching items from the Item Master, or seed a whole BOQ from a Proposal Master preset."}
    </p>
    <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
      {isArchitecture ? (
        <button
          type="button"
          onClick={onAddFromTemplate}
          className="flex items-center gap-1.5 px-3 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md shadow-select-blue/20 hover:shadow-lg"
        >
          <Building2 size={13} /> Add Work Package Section
        </button>
      ) : null}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray rounded-lg text-[12px] font-semibold text-text-muted hover:bg-bg-soft"
      >
        <Plus size={13} /> Blank Section
      </button>
    </div>
  </div>
);

const ArchSectionTemplatePicker = ({ onClose, onAddSection, onAddBlank }) => (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-bold text-textcolor">Add Work Package</h3>
          <p className="text-[10.5px] text-text-muted mt-0.5">
            Select a package — line items are added from approved GFC drawings
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-1.5">
        {ARCH_WORK_CATEGORIES.map((cat, idx) => {
          const c = roomColor(cat.value);
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => onAddSection(cat.label, cat.value)}
              className="w-full text-left rounded-xl border border-bordergray bg-white hover:border-select-blue/40 hover:shadow-sm transition-all group overflow-hidden"
            >
              <div className={`px-3 py-2.5 flex items-center gap-2.5 bg-linear-to-r ${c.bg.replace("bg-", "from-")}/40 to-white`}>
                <span className="text-[10px] font-bold text-text-muted bg-white px-1.5 py-0.5 rounded border border-bordergray tabular-nums shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className={`h-6 w-6 flex items-center justify-center rounded-md shrink-0 ${c.bg}`}>
                  <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                </span>
                <span className="text-[12.5px] font-bold text-textcolor group-hover:text-select-blue transition-colors min-w-0 truncate flex-1">
                  {cat.label}
                </span>
                <span className="text-[10px] text-text-subtle hidden sm:block truncate max-w-[220px] shrink-0">
                  {cat.description}
                </span>
              </div>
            </button>
          );
        })}

        <div className="pt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-text-subtle">
          <span className="flex-1 h-px bg-bordergray" />
          or
          <span className="flex-1 h-px bg-bordergray" />
        </div>

        <button
          type="button"
          onClick={onAddBlank}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-bordergray text-[12px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/30 transition-all"
        >
          <Plus size={13} /> Blank Section
        </button>
      </div>
    </div>
  </div>
);

const SurveyLinker = ({ onClose, onPick }) => {
  const sites = useMemo(() => {
    return getAllSites()
      .map((s) => {
        const flow = getDesignFlow(s.siteID);
        if (!flow?.siteBasis) return null;
        return { siteID: s.siteID, name: s.clientName || s.siteID };
      })
      .filter(Boolean);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-bordergray w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-bordergray">
          <div>
            <p className="text-[14px] font-bold text-textcolor">
              Link a Site Survey
            </p>
            <p className="text-[11.5px] text-text-muted mt-0.5">
              Pick a site with a frozen survey to generate from
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-subtle hover:bg-bg-soft"
          >
            <X size={15} />
          </button>
        </div>
        <div className="px-3 py-3 max-h-72 overflow-y-auto">
          {sites.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-text-subtle">
              No sites with frozen surveys found.
            </p>
          ) : (
            <div className="space-y-1">
              {sites.map((s) => (
                <button
                  key={s.siteID}
                  type="button"
                  onClick={() => onPick(s.siteID)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-active-bg transition-colors"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-textcolor">
                      {s.name}
                    </p>
                    <p className="text-[11px] text-text-muted">{s.siteID}</p>
                  </div>
                  <Ruler size={14} className="text-text-subtle shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BOQEditor;
