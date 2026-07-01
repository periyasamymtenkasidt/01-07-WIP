import { useEffect, useMemo, useState } from "react";
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
  Hash,
  Layers,
  Wallet,
  IndianRupee,
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
  resolveGstTreatment,
  validateBoqForSend,
  blankItem,
  blankSection,
  DIMENSIONAL_UNITS,
} from "../../data/boqStorage";
import { getOrgProfile } from "../../data/orgProfile";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import { getPresetKeys } from "../../data/QuotePresets";
import { UNITS, HSN_SUGGESTIONS, GST_OPTIONS } from "../../data/boqUnits";
import { getAllClients, clientToBoqFields } from "../../data/clientStorage";
import {
  listLibrary,
  libraryToItem,
  incrementUsage,
} from "../../data/itemLibrary";
import BOQPreview from "./BOQPreview";
import { formatAmount } from "../../utils/formatAmount";
import ItemFormModal from "../../components/ItemFormModal";
import CategorySelect from "../../components/CategorySelect";
import { getScheduleConfig } from "../../data/scheduleConfig";
import { roomColor } from "../../data/categoryColors";

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
  signed: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
};

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
  const [libraryPickerSection, setLibraryPickerSection] = useState(null);
  const [showSectionPicker, setShowSectionPicker] = useState(false);
  // Section id currently adding a line item through the full Item Form modal.
  const [itemFormSection, setItemFormSection] = useState(null);
  // { sectionId, itemId } of the line item currently being edited in the modal.
  const [editingItem, setEditingItem] = useState(null);
  const [itemSearch, setItemSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  // Items inserted from the library are compact-by-default; user can expand
  // any of them to override rate / HSN / GST. Tracked by item id.
  const [expandedLinked, setExpandedLinked] = useState({});

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

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const update = (changes) => setBoq((prev) => ({ ...prev, ...changes }));

  const updateClient = (changes) =>
    setBoq((prev) => ({ ...prev, client: { ...prev.client, ...changes } }));

  const updateProject = (changes) =>
    setBoq((prev) => ({ ...prev, project: { ...prev.project, ...changes } }));

  const addSection = () => {
    setBoq((prev) => {
      const sec = blankSection(`Section ${(prev.sections?.length || 0) + 1}`);
      const next = { ...prev, sections: [...(prev.sections || []), sec] };
      setExpanded((p) => ({ ...p, [sec.id]: true }));
      // Immediately open the Item Form modal so the user adds the first
      // line item without an extra click. "Add Scope" = section + first item.
      setItemFormSection(sec.id);
      return next;
    });
  };

  const updateSection = (sid, changes) => {
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sid ? { ...s, ...changes } : s,
      ),
    }));
  };

  const removeSection = (sid) => {
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s.id !== sid),
    }));
    showToast("Section removed", "info");
  };

  const duplicateSection = (sid) => {
    setBoq((prev) => {
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
      qty: Number(form.qty) || 1,
      unit: form.unit || "nos",
      rate: Number(form.rate) || 0,
      gstPercent: Number(form.gstPercent) || 18,
      dimensions: {
        enabled: L > 0 || B > 0 || H > 0,
        length: L,
        breadth: B,
        height: H,
        nos: base.dimensions?.nos || 1,
      },
      materials: form.materials ? form.materials.map((m) => ({ ...m })) : [],
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

  const insertLibraryItems = (sid, libItems) => {
    const newItems = libItems.map((lib) => ({
      ...blankItem(),
      ...libraryToItem(lib),
      source: "manual",
      isVariation: !!boq.siteID,
    }));
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sid ? { ...s, items: [...(s.items || []), ...newItems] } : s,
      ),
    }));
    libItems.forEach((lib) => incrementUsage(lib.id));
    setExpanded((p) => ({ ...p, [sid]: true }));
    showToast(
      `Inserted ${libItems.length} item${libItems.length === 1 ? "" : "s"} from library`,
      "success",
    );
  };

  const updateItem = (sid, iid, changes) => {
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sid
          ? {
              ...s,
              items: s.items.map((it) =>
                it.id === iid ? { ...it, ...changes } : it,
              ),
            }
          : s,
      ),
    }));
  };

  const removeItem = (sid, iid) => {
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sid
          ? { ...s, items: s.items.filter((it) => it.id !== iid) }
          : s,
      ),
    }));
  };

  const duplicateItem = (sid, iid) => {
    setBoq((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
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
      }),
    }));
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    saveBoq(boq);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    showToast("All changes saved", "success");
  };

  const finalizeSend = () => {
    // Stamp the firm's current org profile onto the BOQ so this document's
    // header/GSTIN/bank details never silently change if the profile is
    // edited later — drafts always read the live profile, sent docs don't.
    update({ status: "sent", orgSnapshot: getOrgProfile() });
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

  const handleApprove = () => {
    update({ status: "approved" });
    showToast("BOQ approved", "success");
  };

  const handleDuplicate = () => {
    const next = duplicateBoq(boq.id);
    if (next) {
      navigate(`/boq/${next.id}`);
      showToast(`Duplicated as ${next.id}`, "success");
    }
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
        setLibraryPickerSection(null);
        setShowSeedPicker(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boq]);

  const totals = useMemo(() => (boq ? computeBoqTotals(boq) : null), [boq]);
  const gst = useMemo(
    () => (boq ? resolveGstTreatment(boq) : null),
    [boq],
  );
  const itemCount = useMemo(
    () =>
      (boq?.sections || []).reduce((s, sec) => s + (sec.items?.length || 0), 0),
    [boq],
  );

  if (!boq) {
    return <div className="p-8 text-text-muted text-sm">Loading BOQ…</div>;
  }

  const status = STATUS_STYLES[boq.status] || STATUS_STYLES.draft;

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto pb-32">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-overallbg/80 backdrop-blur-xl border-b border-bordergray/70">
        <div className="px-6 py-3 flex items-center justify-between flex-wrap gap-3">
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
                  {boq.status}
                </span>
                <span className="text-[10px] text-text-subtle">
                  Rev {boq.revision}
                </span>
              </div>
              <input
                type="text"
                value={boq.title}
                onChange={(e) => update({ title: e.target.value })}
                placeholder="Untitled BOQ"
                className="text-[16px] font-bold text-textcolor bg-transparent border-0 focus:outline-none focus:ring-0 px-0 py-0 mt-0.5 min-w-[200px] hover:bg-white/40 rounded transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowSeedPicker(true)}
              className="flex items-center gap-1.5 px-2.5 py-2 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all"
              title="Seed from a Proposal Master preset"
            >
              <Sparkles size={12} /> Seed from Preset
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              className="flex items-center gap-1.5 px-2.5 py-2 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all"
            >
              <Copy size={12} /> Duplicate
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-2.5 py-2 bg-white border border-red-200 rounded-lg text-[11.5px] font-semibold text-red-500 hover:bg-red-50 transition-all"
            >
              <Trash2 size={12} />
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray rounded-lg text-[11.5px] font-semibold text-textcolor hover:bg-bg-soft transition-all"
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
            {boq.status === "sent" && (
              <button
                type="button"
                onClick={handleApprove}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg text-[11.5px] font-semibold hover:bg-emerald-600 transition-all shadow-sm"
              >
                <CheckCircle2 size={12} /> Mark Approved
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer rounded-lg text-[11.5px] font-semibold transition-all shadow-md ${
                savedFlash
                  ? "bg-emerald-500 text-white"
                  : "bg-linear-to-br from-select-blue to-primary text-white hover:scale-[1.02]"
              }`}
            >
              {savedFlash ? <Check size={12} /> : <Save size={12} />}
              {savedFlash ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        {/* Stats banner */}
        <div className="px-6 pb-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BentoStat
            icon={<Layers size={13} />}
            label="Sections"
            value={boq.sections.length}
            tint="blue"
          />
          <BentoStat
            icon={<Hash size={13} />}
            label="Line Items"
            value={itemCount}
            tint="purple"
          />
          <BentoStat
            icon={<Wallet size={13} />}
            label="Subtotal"
            value={formatAmount(totals.afterBoqDiscount)}
            tint="orange"
          />
          <BentoStat
            icon={<IndianRupee size={13} />}
            label="Grand Total"
            value={formatAmount(totals.grandTotal)}
            tint="emerald"
          />
        </div>
      </div>

      <div className="px-6 py-5">
        {boq.surveyStale && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>
              The linked site survey was unlocked after this BOQ was generated.
              Treat these quantities as stale until the survey is frozen and the
              BOQ is regenerated.
            </span>
          </div>
        )}
        {boq.siteID && Number.isFinite(Number(boq.quotedTotal)) && (
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-select-blue/20 bg-select-blue/[0.03] p-3 md:grid-cols-4">
            <CommercialValue
              label="Proposal quoted"
              value={boq.quotedTotal}
              tone="text-select-blue"
            />
            <CommercialValue
              label="Frozen measured"
              value={boq.measuredTotal}
              tone="text-textcolor"
            />
            <CommercialValue
              label="Current BOQ"
              value={totals.grandTotal}
              tone="text-purple-700"
            />
            <CommercialValue
              label="Survey difference"
              value={boq.surveyVariance}
              signed
              tone={
                Number(boq.surveyVariance) > Number(boq.surveyToleranceAmount || 15000)
                  ? "text-red-600"
                  : "text-emerald-700"
              }
            />
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5">
          {/* ── Left: Sections + line items ─────────────────────────────── */}
          <main className="space-y-5 min-w-0">
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
                <ClientPicker
                  current={boq.client}
                  onPick={(c) => {
                    const mapped = clientToBoqFields(c);
                    update({
                      client: { ...boq.client, ...mapped.client },
                      project: { ...boq.project, ...mapped.project },
                    });
                    showToast(`Linked to ${c.clientName}`, "success");
                  }}
                  onClear={() => {
                    update({ client: {}, project: {} });
                    showToast("Client link cleared", "info");
                  }}
                />
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Field icon={<User size={11} />} label="Client Name">
                  <input
                    type="text"
                    value={boq.client?.name || ""}
                    onChange={(e) => updateClient({ name: e.target.value })}
                    placeholder="Mr / Ms…"
                    className={inputBase}
                  />
                </Field>
                <Field icon={<Hash size={11} />} label="GSTIN">
                  <input
                    type="text"
                    value={boq.client?.gstin || ""}
                    onChange={(e) => updateClient({ gstin: e.target.value })}
                    placeholder="22AAAAA0000A1Z5"
                    className={inputBase}
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
                    placeholder="e.g. Tamil Nadu"
                    className={inputBase}
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
                    placeholder="e.g. Sharma Residence"
                    className={inputBase}
                  />
                </Field>
                <Field icon={<Calendar size={11} />} label="Validity">
                  <input
                    type="text"
                    value={boq.validity || ""}
                    onChange={(e) => update({ validity: e.target.value })}
                    placeholder="30 days from issue"
                    className={inputBase}
                  />
                </Field>
                <Field icon={<ShieldCheck size={11} />} label="Warranty / Defect Liability">
                  <input
                    type="text"
                    value={boq.warrantyText || ""}
                    onChange={(e) => update({ warrantyText: e.target.value })}
                    placeholder="e.g. 12 months on hardware, 60 days defect liability"
                    className={inputBase}
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
                  onAdd={addSection}
                  onAddFromTemplate={() => setShowSectionPicker(true)}
                  onSeed={() => setShowSeedPicker(true)}
                />
              )}

              {/* Find-in-BOQ search */}
              {boq.sections.length > 0 && (
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
                                      (m.spec || "").toLowerCase().includes(q),
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
                </div>
              )}

              {boq.sections.map((section, sIdx) => {
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
                            updateSection(section.id, { name: e.target.value })
                          }
                          placeholder="Section name"
                          className="text-[13px] font-bold text-textcolor bg-transparent border-0 focus:outline-none focus:bg-white focus:rounded focus:px-2 focus:py-1 px-0 py-1 transition-all min-w-0 flex-1"
                        />
                        <CategorySelect
                          value={section.category}
                          onChange={(v) =>
                            updateSection(section.id, { category: v })
                          }
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
                          onClick={() => duplicateSection(section.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:bg-white hover:text-textcolor"
                          title="Duplicate section"
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(section.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                          title="Delete section"
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
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="bg-bg-soft/60 border-b border-bordergray text-[9.5px] font-bold uppercase tracking-wider text-text-muted">
                                  <th className="px-2 py-2 text-left w-8">#</th>
                                  <th className="px-2 py-2 text-left w-[35%] min-w-[220px]">
                                    Description
                                  </th>
                                  <th className="px-2 py-2 text-left w-20">
                                    HSN
                                  </th>
                                  <th className="px-2 py-2 text-right w-20">
                                    Qty
                                  </th>
                                  <th className="px-2 py-2 text-left w-20">
                                    Unit
                                  </th>
                                  <th className="px-2 py-2 text-right w-24">
                                    Rate (₹)
                                  </th>
                                  <th className="px-2 py-2 text-right w-16">
                                    GST %
                                  </th>
                                  <th className="px-2 py-2 text-right w-28">
                                    Amount (₹)
                                  </th>
                                  <th className="px-2 py-2 w-12"></th>
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
                                        updateItem(section.id, item.id, changes)
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
                              Section name matched "{itemSearch}" — no items in
                              this section matched.
                            </div>
                          )}

                        <div className="px-4 py-3 border-t border-bordergray bg-bg-soft/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setItemFormSection(section.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-select-blue hover:bg-white border border-transparent hover:border-bordergray transition-all"
                            >
                              <Plus size={12} /> Add Line Item
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLibraryPickerSection(section.id)
                              }
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-text-muted hover:text-select-blue hover:bg-white border border-bordergray transition-all"
                              title="Insert from Item Master library"
                            >
                              <BookOpen size={11} /> Insert from Library
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

              {boq.sections.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSectionPicker(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl bg-white border border-dashed border-select-blue/40 text-[12px] font-semibold text-select-blue hover:bg-active-bg/40 transition-all"
                  >
                    <Sparkles size={13} /> Add Section from Library
                  </button>
                  <button
                    type="button"
                    onClick={addSection}
                    className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-2xl border border-dashed border-bordergray text-[12px] font-semibold text-text-muted hover:border-select-blue hover:text-select-blue hover:bg-active-bg/40 transition-all"
                  >
                    <Plus size={13} /> Blank Section
                  </button>
                </div>
              )}
            </section>
          </main>

          {/* ── Right: Summary, terms, notes ────────────────────────────── */}
          <aside className="space-y-5">
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

                {/* Labour & contingency — % markups on the discounted base */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-text-muted flex items-center gap-1">
                    <Percent size={11} /> Labour
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={boq.laborPercent || 0}
                      onChange={(e) =>
                        update({ laborPercent: Number(e.target.value) || 0 })
                      }
                      className="w-16 text-right tabular-nums bg-bg-soft border border-bordergray rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-select-blue"
                    />
                    <span className="text-[10.5px] font-semibold text-text-muted">%</span>
                  </div>
                </div>
                {totals.laborAmt > 0 && (
                  <Row label="Labour value" value={formatAmount(totals.laborAmt)} />
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-text-muted flex items-center gap-1">
                    <Percent size={11} /> Contingency
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={boq.contingencyPercent || 0}
                      onChange={(e) =>
                        update({ contingencyPercent: Number(e.target.value) || 0 })
                      }
                      className="w-16 text-right tabular-nums bg-bg-soft border border-bordergray rounded px-1.5 py-1 text-[11px] focus:outline-none focus:border-select-blue"
                    />
                    <span className="text-[10.5px] font-semibold text-text-muted">%</span>
                  </div>
                </div>
                {totals.contingencyAmt > 0 && (
                  <Row label="Contingency value" value={formatAmount(totals.contingencyAmt)} />
                )}
                {(totals.laborAmt > 0 || totals.contingencyAmt > 0) && (
                  <Row
                    label="Taxable (incl. labour/contingency)"
                    value={formatAmount(totals.baseForGst)}
                  />
                )}

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

            {/* Payment milestones */}
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-bordergray flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-select-blue" />
                  <h3 className="text-[12px] font-bold text-textcolor">
                    Payment Milestones
                  </h3>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted bg-bg-soft px-1.5 py-0.5 rounded">
                    5-stage standard
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        paymentTerms: PAYMENT_MILESTONES.map((m) => ({
                          id: m.id,
                          label: m.name,
                          percent: m.pct,
                        })),
                      })
                    }
                    className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-select-blue"
                    title="Reset to standard 5-stage milestone schedule"
                  >
                    <RotateCcw size={11} /> Reset
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update({
                        paymentTerms: [
                          ...(boq.paymentTerms || []),
                          { label: "", percent: 0 },
                        ],
                      })
                    }
                    className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary"
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
              </div>
              <div className="p-3 space-y-2">
                {(boq.paymentTerms || []).map((m, idx) => {
                  const amt =
                    (totals.grandTotal * (Number(m.percent) || 0)) / 100;
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-[1fr_60px_24px] gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={m.label}
                        onChange={(e) =>
                          update({
                            paymentTerms: boq.paymentTerms.map((p, i) =>
                              i === idx ? { ...p, label: e.target.value } : p,
                            ),
                          })
                        }
                        placeholder="On signing"
                        className={compactInput}
                      />
                      <div className="relative">
                        <input
                          type="number"
                          value={m.percent}
                          onChange={(e) =>
                            update({
                              paymentTerms: boq.paymentTerms.map((p, i) =>
                                i === idx
                                  ? {
                                      ...p,
                                      percent: Number(e.target.value) || 0,
                                    }
                                  : p,
                              ),
                            })
                          }
                          className={`${compactInput} text-right pr-5`}
                        />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-text-subtle">
                          %
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            paymentTerms: boq.paymentTerms.filter(
                              (_, i) => i !== idx,
                            ),
                          })
                        }
                        className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={11} />
                      </button>
                      <p className="col-span-3 text-[9.5px] text-text-subtle tabular-nums -mt-1">
                        ≈ {formatAmount(Math.round(amt))}
                      </p>
                    </div>
                  );
                })}
                {(boq.paymentTerms || []).length > 0 && (
                  <div className="pt-1 border-t border-bordergray flex justify-between text-[10.5px]">
                    <span className="text-text-muted">Total %</span>
                    <span
                      className={`font-bold tabular-nums ${
                        boq.paymentTerms.reduce(
                          (s, m) => s + (Number(m.percent) || 0),
                          0,
                        ) === 100
                          ? "text-emerald-600"
                          : "text-orange-500"
                      }`}
                    >
                      {boq.paymentTerms.reduce(
                        (s, m) => s + (Number(m.percent) || 0),
                        0,
                      )}
                      %
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Notes */}
            <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
              <div className="px-4 py-3 border-b border-bordergray flex items-center gap-2">
                <StickyNote size={13} className="text-select-blue" />
                <h3 className="text-[12px] font-bold text-textcolor">
                  Notes / Terms
                </h3>
              </div>
              <div className="p-3">
                <textarea
                  value={boq.notes || ""}
                  onChange={(e) => update({ notes: e.target.value })}
                  rows={5}
                  placeholder="Special terms, exclusions, site conditions, etc."
                  className={`${compactInput} resize-none leading-relaxed`}
                />
              </div>
            </section>

            {/*  Included */}
            <BulletListEditor
              title="Included"
              icon={<CheckCircle2 size={13} className="text-emerald-600" />}
              accent="emerald"
              items={boq.inclusions || []}
              placeholder="e.g. 3D visualization of all rooms"
              onChange={(next) => update({ inclusions: next })}
            />

            {/* Not Included */}
            <BulletListEditor
              title="Not Included"
              icon={<X size={13} className="text-red-500" />}
              accent="red"
              items={boq.exclusions || []}
              placeholder="e.g. Civil work — demolition, plumbing"
              onChange={(next) => update({ exclusions: next })}
            />
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
                  {boq.id} · {boq.status}
                </p>
                <p className="text-[10.5px] text-text-muted">
                  {itemCount} items · {boq.sections.length} sections
                </p>
              </div>
            </div>
            <div className="h-8 w-px bg-bordergray hidden sm:block" />
            <FooterStat
              label="Subtotal"
              value={formatAmount(totals.afterBoqDiscount)}
            />
            {totals.totalGst > 0 && (
              <FooterStat
                label="GST"
                value={formatAmount(totals.totalGst)}
                accent="text-orange-500"
              />
            )}
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

      {/* Item Master picker modal */}
      {libraryPickerSection && (
        <LibraryPicker
          onClose={() => setLibraryPickerSection(null)}
          onInsert={(items) => {
            insertLibraryItems(libraryPickerSection, items);
            setLibraryPickerSection(null);
          }}
        />
      )}

      {/* Section template picker */}
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

      {/* Print preview overlay */}
      {showPreview && (
        <BOQPreview boq={boq} onClose={() => setShowPreview(false)} />
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
  accent,
  isLinked,
  isCompact,
  onToggleCompact,
}) => {
  const r = computeItemAmount(item);
  const computedQty = computeItemQty(item);
  const hasSurveyDrift =
    item.siteSurveySource &&
    Math.abs(computedQty - (Number(item.siteMeasuredQty) || 0)) > 0.001;
  const dimInfo = DIMENSIONAL_UNITS[item.unit];
  const dimsEnabled = item.dimensions?.enabled;
  const canUseDims = !!dimInfo;
  const isArea = dimInfo?.kind === "area";
  const unitLabel = UNITS.find((u) => u.code === item.unit)?.label || item.unit;

  const updateDim = (changes) =>
    onUpdate({ dimensions: { ...(item.dimensions || {}), ...changes } });

  const toggleDimensions = () => {
    if (!canUseDims) return;
    updateDim({ enabled: !dimsEnabled });
  };

  // ── Compact row (linked items, before user clicks Override) ─────────────
  const compactMainRow = (
    <tr className="border-b border-bordergray hover:bg-active-bg/20 group bg-select-blue/[0.03]">
      <td className="px-2 py-2 align-top">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-text-subtle opacity-0 group-hover:opacity-100 cursor-grab"
            title="Drag (coming soon)"
          >
            <GripVertical size={11} />
          </button>
          <span className="text-[10.5px] font-bold text-text-muted tabular-nums">
            {String(idx + 1).padStart(2, "0")}
          </span>
        </div>
      </td>
      <td colSpan={2} className="px-2 py-2 align-top max-w-[480px]">
        <div className="flex items-start gap-1.5 w-full min-w-0">
          <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-select-blue/10 text-select-blue px-1.5 py-0.5 rounded mt-0.5 shrink-0 border border-select-blue/20">
            <Link2 size={9} /> Library
          </span>
          <textarea
            value={item.description}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder="Item description"
            className={`${compactInput} font-medium resize-none`}
            rows={2}
          />
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
              {hasSurveyDrift ? <AlertTriangle size={9} /> : <ShieldCheck size={9} />}
              {hasSurveyDrift ? "Survey drift" : "Site measured"}
            </span>
          )}
          {item.isVariation && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              <AlertTriangle size={9} /> Variation
            </span>
          )}
        </div>
        <p className="text-[9.5px] text-text-muted mt-1 ml-1">
          HSN{" "}
          <span className="font-semibold text-textcolor">
            {item.hsn || "—"}
          </span>
          {" · "}₹
          <span className="font-semibold text-textcolor tabular-nums">
            {Number(item.rate || 0).toLocaleString("en-IN")}
          </span>
          /{unitLabel}
          {" · "}
          GST{" "}
          <span className="font-semibold text-textcolor">
            {item.gstPercent || 0}%
          </span>
        </p>
        {item.siteSurveySource && (
          <p className="mt-0.5 ml-1 text-[9.5px] text-text-subtle">
            Quoted: {Number(item.quotedQty || 0).toLocaleString("en-IN")} {unitLabel}
            {" · "}{formatAmount(item.quotedAmount || 0)}
            {" · "}Frozen measured: {Number(item.siteMeasuredQty || 0).toLocaleString("en-IN")} {unitLabel}
          </p>
        )}
        {(item.materials || []).length > 0 && (
          <p className="text-[9.5px] text-text-subtle mt-0.5 ml-1 truncate">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${accent.dot}`}
            />
            {item.materials
              .map((m) => `${m.name}${m.spec ? ` (${m.spec})` : ""}`)
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        {dimsEnabled ? (
          <div className="bg-active-bg/40 border border-select-blue/20 rounded-md px-2 py-1.5 text-right">
            <p className="text-[12px] font-bold text-select-blue tabular-nums">
              {computedQty.toFixed(2).replace(/\.00$/, "")}
            </p>
            <p className="text-[9px] text-text-subtle">from dims</p>
          </div>
        ) : (
          <input
            type="number"
            value={item.qty}
            onChange={(e) => onUpdate({ qty: e.target.value })}
            onFocus={(e) => e.target.select()}
            className={`${compactInput} text-right tabular-nums`}
          />
        )}
        {canUseDims && (
          <button
            type="button"
            onClick={toggleDimensions}
            className={`mt-1 w-full flex items-center justify-center gap-1 text-[9.5px] font-semibold rounded-md py-1 border transition-all ${
              dimsEnabled
                ? "bg-select-blue/10 border-select-blue/30 text-select-blue"
                : "bg-white border-bordergray text-text-muted hover:border-select-blue/40 hover:text-select-blue"
            }`}
            title={
              dimsEnabled
                ? "Use direct quantity"
                : "Calculate from L × D × H × Nos"
            }
          >
            <Calculator size={10} />
            {dimsEnabled ? "Using dims" : "L×D×H"}
          </button>
        )}
      </td>
      <td className="px-2 py-2 align-top">
        <span className="text-[11px] font-semibold text-text-muted">
          {unitLabel}
        </span>
      </td>
      <td colSpan={2} className="px-2 py-2 align-top text-center">
        <button
          type="button"
          onClick={onToggleCompact}
          className="text-[10px] font-semibold text-text-muted hover:text-select-blue border border-bordergray hover:border-select-blue/30 rounded-md px-2 py-1 flex items-center gap-1 mx-auto transition-all"
          title="Override rate / HSN / GST from library defaults"
        >
          <Edit3 size={10} /> Override
        </button>
      </td>
      <td className="px-2 py-2 align-top text-right">
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
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-white"
            title="Edit in full form"
          >
            <Edit3 size={11} />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-textcolor hover:bg-white"
            title="Duplicate row"
          >
            <Copy size={11} />
          </button>
          <button
            type="button"
            onClick={onRemove}
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
        {dimsEnabled && canUseDims && (
          <DimensionEditor
            item={item}
            dimInfo={dimInfo}
            isArea={isArea}
            computedQty={computedQty}
            r={r}
            updateDim={updateDim}
            unitLabel={unitLabel}
          />
        )}
      </>
    );
  }

  return (
    <>
      <tr className="border-b border-bordergray hover:bg-bg-soft/40 group">
        <td className="px-2 py-2 align-top">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="text-text-subtle opacity-0 group-hover:opacity-100 cursor-grab"
              title="Drag (coming soon)"
            >
              <GripVertical size={11} />
            </button>
            <span className="text-[10.5px] font-bold text-text-muted tabular-nums">
              {String(idx + 1).padStart(2, "0")}
            </span>
          </div>
        </td>
        <td className="px-2 py-2 align-top w-[35%] min-w-[220px] max-w-[400px]">
          <div className="flex items-start gap-1.5 w-full min-w-0">
            {isLinked && (
              <button
                type="button"
                onClick={onToggleCompact}
                className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider bg-select-blue/10 text-select-blue px-1.5 py-0.5 rounded mt-1 shrink-0 border border-select-blue/20 hover:bg-select-blue/20"
                title="Collapse — hide HSN/Rate/GST overrides"
              >
                <Link2 size={9} /> Library
              </button>
            )}
            {item.siteSurveySource && (
              <span
                className={`mt-1 inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                  hasSurveyDrift
                    ? "border border-amber-200 bg-amber-50 text-amber-700"
                    : "border border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
                title={`Frozen site quantity: ${item.siteMeasuredQty}`}
              >
                {hasSurveyDrift ? <AlertTriangle size={9} /> : <ShieldCheck size={9} />}
                {hasSurveyDrift ? "Survey drift" : "Site measured"}
              </span>
            )}
            {item.isVariation && (
              <span className="mt-1 inline-flex shrink-0 items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                <AlertTriangle size={9} /> Variation
              </span>
            )}
            <textarea
              value={item.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Item description"
              className={`${compactInput} font-medium resize-none`}
              rows={2}
            />
          </div>
          <textarea
            value={item.spec || ""}
            onChange={(e) => onUpdate({ spec: e.target.value })}
            placeholder="Brand / model / finish (e.g. Hettich soft-close, Greenply BWP 19mm)"
            className={`${compactInput} mt-1 text-text-muted italic resize-none`}
            rows={1}
          />
          {(item.materials || []).length > 0 && (
            <p className="text-[9.5px] text-text-subtle mt-1 truncate">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle ${accent.dot}`}
              />
              {item.materials
                .map((m) => `${m.name}${m.spec ? ` (${m.spec})` : ""}`)
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </td>
        <td className="px-2 py-2 align-top">
          <input
            type="text"
            value={item.hsn || ""}
            onChange={(e) => onUpdate({ hsn: e.target.value })}
            placeholder="9403"
            list={`hsn-list-${item.id}`}
            className={`${compactInput} tabular-nums`}
          />
          <datalist id={`hsn-list-${item.id}`}>
            {HSN_SUGGESTIONS.map((h) => (
              <option key={h.code} value={h.code}>
                {h.desc}
              </option>
            ))}
          </datalist>
        </td>
        <td className="px-2 py-2 align-top">
          {dimsEnabled ? (
            <div className="bg-active-bg/40 border border-select-blue/20 rounded-md px-2 py-1.5 text-right">
              <p className="text-[12px] font-bold text-select-blue tabular-nums">
                {computedQty.toFixed(2).replace(/\.00$/, "")}
              </p>
              <p className="text-[9px] text-text-subtle">from dimensions</p>
            </div>
          ) : (
            <input
              type="number"
              value={item.qty}
              onChange={(e) => onUpdate({ qty: e.target.value })}
              onFocus={(e) => e.target.select()}
              className={`${compactInput} text-right tabular-nums`}
            />
          )}
        </td>
        <td className="px-2 py-2 align-top">
          <select
            value={item.unit}
            onChange={(e) => onUpdate({ unit: e.target.value })}
            className={`${compactInput} cursor-pointer`}
          >
            {UNITS.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </select>
          {canUseDims && (
            <button
              type="button"
              onClick={toggleDimensions}
              className={`mt-1 w-full flex items-center justify-center gap-1 text-[9.5px] font-semibold rounded-md py-1 border transition-all ${
                dimsEnabled
                  ? "bg-select-blue/10 border-select-blue/30 text-select-blue"
                  : "bg-white border-bordergray text-text-muted hover:border-select-blue/40 hover:text-select-blue"
              }`}
              title={
                dimsEnabled
                  ? "Use direct quantity"
                  : "Calculate from L × D × Nos"
              }
            >
              <Calculator size={10} />
              {dimsEnabled ? "Using dims" : "Use L×D"}
            </button>
          )}
        </td>
        <td className="px-2 py-2 align-top">
          <input
            type="number"
            value={item.rate}
            onChange={(e) => onUpdate({ rate: e.target.value })}
            onFocus={(e) => e.target.select()}
            className={`${compactInput} text-right tabular-nums`}
          />
        </td>
        <td className="px-2 py-2 align-top">
          <select
            value={item.gstPercent}
            onChange={(e) => onUpdate({ gstPercent: Number(e.target.value) })}
            className={`${compactInput} cursor-pointer text-right`}
          >
            {GST_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}%
              </option>
            ))}
          </select>
        </td>
        <td className="px-2 py-2 align-top text-right">
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
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-select-blue hover:bg-white"
              title="Edit in full form"
            >
              <Edit3 size={11} />
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-textcolor hover:bg-white"
              title="Duplicate row"
            >
              <Copy size={11} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
              title="Remove row"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </td>
      </tr>

      {/* Dimension calculator row */}
      {dimsEnabled && canUseDims && (
        <DimensionEditor
          item={item}
          dimInfo={dimInfo}
          isArea={isArea}
          computedQty={computedQty}
          r={r}
          updateDim={updateDim}
          unitLabel={unitLabel}
        />
      )}

      {/* Materials editor row */}
      <MaterialEditor item={item} onUpdate={onUpdate} />
    </>
  );
};

const MaterialEditor = ({ item, onUpdate }) => {
  const [open, setOpen] = useState((item.materials || []).length > 0);
  const materials = item.materials || [];

  const update = (mats) => onUpdate({ materials: mats });

  const add = () => {
    update([...materials, { name: "", spec: "" }]);
    setOpen(true);
  };
  const change = (idx, key, v) =>
    update(materials.map((m, i) => (i === idx ? { ...m, [key]: v } : m)));
  const remove = (idx) => update(materials.filter((_, i) => i !== idx));

  return (
    <tr className="border-b border-bordergray bg-bg-soft/30">
      <td colSpan={9} className="px-3 py-1.5">
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
            <button
              type="button"
              onClick={add}
              className="flex items-center gap-1 text-[10.5px] font-semibold text-select-blue hover:text-primary"
            >
              <Plus size={11} /> Add Material
            </button>
          )}
        </div>
        {open && (
          <div className="mt-2 space-y-1.5 pl-5">
            {materials.length === 0 && (
              <p className="text-[10.5px] text-text-subtle">
                No materials specified. Add brand, spec, or finish details (e.g.
                "Plywood — BWP 19mm Greenply") to lock in the quality bar.
              </p>
            )}
            {materials.map((m, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[140px_1fr_28px] gap-2 items-center"
              >
                <textarea
                  value={m.name}
                  onChange={(e) => change(idx, "name", e.target.value)}
                  placeholder="Plywood"
                  className={`${compactInput} font-medium resize-none`}
                  rows={1}
                />
                <textarea
                  value={m.spec}
                  onChange={(e) => change(idx, "spec", e.target.value)}
                  placeholder="BWP 19mm Greenply"
                  className={`${compactInput} resize-none`}
                  rows={1}
                />
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                  title="Remove material"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
};

const ClientPicker = ({ current, onPick, onClear }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const handleOpen = () => {
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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor"
      >
        {current?.id ? "Change Client" : "Select Existing Client"}
      </button>
      {current?.id && (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-bordergray bg-white text-[11px] text-text-subtle hover:text-red-500 hover:border-red-200"
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
}) => (
  <tr className="bg-active-bg/20 border-b border-bordergray">
    <td colSpan={9} className="px-3 py-3">
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
          />
          {isArea && (
            <>
              <span className="text-text-subtle font-bold mt-2">×</span>
              <DimInput
                label="Depth (D)"
                suffix={dimInfo?.suffix}
                value={item.dimensions?.breadth ?? item.dimensions?.width ?? 0}
                onChange={(v) => updateDim({ breadth: v })}
              />
              <span className="text-text-subtle font-bold mt-2">×</span>
              <DimInput
                label="Height (H)"
                suffix={dimInfo?.suffix}
                value={item.dimensions?.height || 0}
                onChange={(v) => updateDim({ height: v })}
              />
            </>
          )}
          <span className="text-text-subtle font-bold mt-2">×</span>
          <DimInput
            label="Nos"
            value={item.dimensions?.nos || 1}
            onChange={(v) => updateDim({ nos: v })}
          />
          <span className="text-text-subtle font-bold mt-2">=</span>
          <div className="flex flex-col items-end bg-white border border-select-blue/30 rounded-md px-3 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
              Total Qty
            </span>
            <span className="text-[14px] font-bold text-select-blue tabular-nums leading-tight">
              {computedQty.toFixed(2).replace(/\.00$/, "")}{" "}
              <span className="text-[10px] text-text-muted font-normal">
                {unitLabel}
              </span>
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-col items-end gap-0.5 text-[10.5px] text-text-muted mt-1">
          <span className="text-[9.5px] text-text-subtle">
            Tip: leave a dimension at 0 to skip it (e.g. floor = L × B, wall = L
            × H).
          </span>
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

const DimInput = ({ label, suffix, value, onChange }) => (
  <div className="relative">
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => e.target.select()}
      placeholder="0"
      title={label}
      className={`${compactInput} w-20 text-right tabular-nums ${suffix ? "pr-7" : "pr-2"}`}
    />
    {suffix && (
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9.5px] text-text-subtle font-semibold pointer-events-none">
        {suffix}
      </span>
    )}
    <span className="absolute -top-1.5 left-2 text-[8px] font-bold uppercase tracking-wider text-text-subtle bg-active-bg/20 px-0.5">
      {label}
    </span>
  </div>
);

// ─── Small components ──────────────────────────────────────────────────────
const Field = ({ icon, label, hint, children }) => (
  <div>
    <label className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
      <span className="flex items-center gap-1">
        <span className="text-select-blue">{icon}</span>
        {label}
      </span>
      {hint && (
        <span className="text-[9.5px] font-normal text-text-subtle normal-case tracking-normal">
          {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

const BulletListEditor = ({
  title,
  icon,
  items,
  placeholder,
  accent,
  onChange,
}) => {
  const bullet =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-600";
  const headerTint =
    accent === "emerald"
      ? "from-emerald-50/60 to-white"
      : "from-red-50/60 to-white";
  const add = () => onChange([...(items || []), ""]);
  const updateItem = (idx, v) =>
    onChange(items.map((it, i) => (i === idx ? v : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
      <div
        className={`px-4 py-3 border-b border-bordergray bg-linear-to-r ${headerTint} flex items-center justify-between`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-[12px] font-bold text-textcolor">{title}</h3>
          <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
            {(items || []).length}
          </span>
        </div>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      <div className="p-3 space-y-2">
        {(items || []).map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 group">
            <span
              className={`mt-2 h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${bullet}`}
            >
              {accent === "emerald" ? (
                <Check size={9} strokeWidth={3} />
              ) : (
                <X size={9} strokeWidth={3} />
              )}
            </span>
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(idx, e.target.value)}
              placeholder={placeholder}
              className="bg-bg-soft border border-transparent text-[11.5px] text-textcolor rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:bg-white focus:border-select-blue/40 placeholder:text-text-subtle"
            />
            <button
              type="button"
              onClick={() => remove(idx)}
              className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
              title="Remove"
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {(!items || items.length === 0) && (
          <button
            type="button"
            onClick={add}
            className="w-full text-[11px] text-text-subtle border border-dashed border-bordergray rounded-lg py-3 hover:border-select-blue hover:text-select-blue transition-colors"
          >
            + Add your first entry
          </button>
        )}
      </div>
    </section>
  );
};

const Row = ({ label, value, accent = "text-textcolor" }) => (
  <div className="flex items-center justify-between">
    <span className="text-text-muted">{label}</span>
    <span className={`tabular-nums ${accent}`}>{value}</span>
  </div>
);

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

const CommercialValue = ({ label, value, signed = false, tone = "text-textcolor" }) => {
  const amount = Number(value) || 0;
  const prefix = signed && amount > 0 ? "+" : "";
  return (
    <div className="rounded-lg border border-bordergray bg-white px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`mt-0.5 text-[13px] font-bold tabular-nums ${tone}`}>
        {prefix}{formatAmount(amount)}
      </p>
    </div>
  );
};

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
      <p className="text-[16px] font-bold text-textcolor tabular-nums leading-tight">
        {value}
      </p>
    </div>
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
    <div className="fixed top-6 right-6 z-50">
      <div
        className={`${v.bg} text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md`}
      >
        <span className="shrink-0">{v.icon}</span>
        <p className="text-[12px] font-medium flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white shrink-0"
        >
          <X size={16} />
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
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
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
          className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
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

// Shown when "Mark Sent" is pressed and validateBoqForSend() finds issues.
// Blocks have no confirm action (status doesn't change until fixed);
// warnings get a "Send anyway" override. Mirrors ConfirmDialog's styling.
const SendValidationDialog = ({ blocks, warnings, onCancel, onSendAnyway }) => {
  const hasBlocks = blocks.length > 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
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
              hasBlocks ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
            }`}
          >
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-textcolor">
              {hasBlocks ? "Can't mark this BOQ as sent" : "Send with warnings?"}
            </h3>
            <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
              {hasBlocks
                ? "Fix these before sending:"
                : "These won't block sending, but worth checking first:"}
            </p>
          </div>
        </div>
        <div className="px-5 pb-2 space-y-1.5 max-h-[260px] overflow-y-auto">
          {blocks.map((b, i) => (
            <div
              key={`b${i}`}
              className="flex items-start gap-2 text-[11.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{b}</span>
            </div>
          ))}
          {warnings.map((w, i) => (
            <div
              key={`w${i}`}
              className="flex items-start gap-2 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
            >
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
          >
            {hasBlocks ? "Close" : "Cancel"}
          </button>
          {!hasBlocks && (
            <button
              type="button"
              onClick={onSendAnyway}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm bg-select-blue hover:bg-primary"
            >
              Send anyway
            </button>
          )}
        </div>
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

const LibraryPicker = ({ onClose, onInsert }) => {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState({});

  const items = listLibrary();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "all" && it.category !== category) return false;
      if (!q) return true;
      return (
        (it.description || "").toLowerCase().includes(q) ||
        (it.hsn || "").toLowerCase().includes(q) ||
        (it.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [items, query, category]);

  const cats = useMemo(() => {
    const counts = items.reduce((acc, it) => {
      acc[it.category] = (acc[it.category] || 0) + 1;
      return acc;
    }, {});
    const rooms = getScheduleConfig().rooms.map((r) => r.name);
    return [
      { value: "all", label: "All", count: items.length },
      ...rooms.map((name) => ({
        value: name,
        label: name,
        count: counts[name] || 0,
      })),
    ].filter((c) => c.count > 0 || c.value === "all");
  }, [items]);

  const toggle = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const selectedItems = items.filter((it) => selected[it.id]);
  const handleInsert = () => {
    if (selectedItems.length === 0) return;
    onInsert(selectedItems);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between bg-linear-to-r from-select-blue/5 to-white">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
              <BookOpen size={14} />
            </span>
            <div>
              <h3 className="text-[14px] font-bold text-textcolor">
                Insert from Item Master
              </h3>
              <p className="text-[10.5px] text-text-muted">
                Pick one or more items — they'll be added to this section with
                materials, HSN, and rate filled in
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

        <div className="px-4 py-3 border-b border-bordergray flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {cats.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`px-2.5 py-1 rounded-md text-[10.5px] font-semibold transition-all border ${
                  category === c.value
                    ? "bg-active-bg text-select-blue border-select-blue/30"
                    : "bg-transparent text-text-muted hover:bg-bg-soft border-transparent"
                }`}
              >
                {c.label} <span className="opacity-60">{c.count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, HSN, tag"
              className="bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30 w-[240px]"
              autoFocus
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen size={28} className="text-text-subtle mx-auto mb-2" />
              <p className="text-[12px] font-semibold text-textcolor">
                No matches
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                Try a different search or category.
              </p>
            </div>
          ) : (
            filtered.map((it) => {
              const c = roomColor(it.category);
              const isSelected = !!selected[it.id];
              const unitLabel =
                UNITS.find((u) => u.code === it.unit)?.label || it.unit;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? "border-select-blue bg-active-bg/40 shadow-[0_1px_3px_rgba(30,58,138,0.08)]"
                      : "border-bordergray hover:border-select-blue/30 hover:bg-bg-soft/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 h-5 w-5 flex items-center justify-center rounded-md border shrink-0 ${
                        isSelected
                          ? "bg-select-blue border-select-blue text-white"
                          : "bg-white border-bordergray"
                      }`}
                    >
                      {isSelected && <Check size={11} strokeWidth={3} />}
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
                              (m) => `${m.name}${m.spec ? ` (${m.spec})` : ""}`,
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
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-bordergray bg-bg-soft flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-text-muted">
            {selectedIds.length === 0
              ? "Select items to insert"
              : `${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} selected · total ₹${selectedItems
                  .reduce((s, it) => s + (Number(it.rate) || 0), 0)
                  .toLocaleString("en-IN")} (at qty 1)`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInsert}
              disabled={selectedIds.length === 0}
              className="px-4 py-1.5 rounded-lg bg-linear-to-br from-select-blue to-primary text-white text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              <Plus size={12} /> Insert{" "}
              {selectedIds.length > 0 && `(${selectedIds.length})`}
            </button>
          </div>
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

const EmptySectionsState = ({ onAdd, onAddFromTemplate, onSeed }) => (
  <div className="bg-white rounded-2xl border border-dashed border-bordergray text-center py-12 px-6">
    <div className="h-14 w-14 rounded-2xl bg-linear-to-br from-select-blue/10 to-active-bg flex items-center justify-center mx-auto mb-3 border border-bordergray">
      <Layers size={20} className="text-select-blue" />
    </div>
    <p className="text-[14px] font-bold text-textcolor">Start your BOQ</p>
    <p className="text-[12px] text-text-muted mt-1 max-w-sm mx-auto">
      Pick a category to auto-create a section with all matching items from the
      Item Master, or seed a whole BOQ from a Proposal Master preset.
    </p>
    <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={onAddFromTemplate}
        className="flex items-center gap-1.5 px-3 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md shadow-select-blue/20 hover:shadow-lg"
      >
        <Sparkles size={13} /> Add Section from Library
      </button>
      <button
        type="button"
        onClick={onSeed}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray rounded-lg text-[12px] font-semibold text-textcolor hover:bg-bg-soft"
      >
        <FileText size={13} /> Seed from Preset
      </button>
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

export default BOQEditor;
