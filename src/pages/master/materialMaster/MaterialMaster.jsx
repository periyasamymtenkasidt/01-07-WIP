import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Layers,
  Plus,
  Search,
  Trash2,
  Edit3,
  X,
  Hash,
  Package,
  TrendingUp,
  Tag,
  IndianRupee,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { listMaterials, saveMaterials } from "../../../data/materialLibrary";
import { listLibrary } from "../../../data/itemLibrary";
import { formatAmount } from "../../../utils/formatAmount";
import InputField from "../../../components/InputField";

const MATERIAL_UNITS = [
  { code: "bag", label: "Bag (Cement)" },
  { code: "kg", label: "Kilogram (Steel/Wire)" },
  { code: "ton", label: "Metric Ton (Steel)" },
  { code: "brass", label: "Brass (Sand/Aggregate)" },
  { code: "cum", label: "Cubic Meter (Concrete)" },
  { code: "piece", label: "Piece (Brick/Block)" },
  { code: "sqft", label: "Square Feet (Plywood/Tiles)" },
  { code: "rmt", label: "Running Meter" },
  { code: "nos", label: "Numbers" },
];

const MaterialMaster = () => {
  const [materials, setMaterials] = useState(() => listMaterials());
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // holds material being edited/created
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  };

  // Auto-save: persist the catalog to storage on every change. Skips the very
  // first render so the initial load isn't re-written needlessly.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveMaterials(materials);
  }, [materials]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => {
      if (!q) return true;
      return (
        (m.name || "").toLowerCase().includes(q) ||
        (m.hsn || "").toLowerCase().includes(q) ||
        (m.specifications || "").toLowerCase().includes(q) ||
        (m.brand || "").toLowerCase().includes(q) ||
        (m.category || "").toLowerCase().includes(q) ||
        (m.vendorName || m.vendor || "").toLowerCase().includes(q)
      );
    });
  }, [materials, query]);

  // Derived (not stored) — counts how many Item Master recipes reference
  // each material, by scanning every grade's components. Avoids a stored
  // usageCount counter that would need increment/decrement wiring at every
  // recipe edit site.
  const usageCounts = useMemo(() => {
    const map = new Map();
    listLibrary().forEach((item) => {
      Object.values(item.recipes || {}).forEach((recipe) => {
        (recipe?.components || []).forEach((c) => {
          if (c.materialId) {
            map.set(c.materialId, (map.get(c.materialId) || 0) + 1);
          }
        });
      });
    });
    return map;
  }, []);

  const stats = useMemo(() => {
    const totalCount = materials.length;
    const avgPrice =
      totalCount > 0
        ? Math.round(
            materials.reduce((s, m) => s + (Number(m.rate) || 0), 0) /
              totalCount,
          )
        : 0;
    const cementCount = materials.filter((m) =>
      m.name.toLowerCase().includes("cement"),
    ).length;
    const steelCount = materials.filter(
      (m) =>
        m.name.toLowerCase().includes("steel") ||
        m.name.toLowerCase().includes("wire"),
    ).length;

    return {
      total: totalCount,
      avgPrice,
      cement: cementCount,
      steel: steelCount,
    };
  }, [materials]);

  const handleSave = (e) => {
    e.preventDefault();
    if (!editing.name || !editing.rate || !editing.hsn) {
      alert("Please fill in Name, Rate, and HSN code.");
      return;
    }

    const gstInput = editing.gstPercent;
    const gstPercent =
      gstInput === "" || gstInput === null || gstInput === undefined || Number.isNaN(Number(gstInput))
        ? 18
        : Number(gstInput);

    const matData = {
      ...editing,
      rate: Number(editing.rate) || 0,
      gstPercent,
    };

    if (editing.id) {
      // Edit
      const prevRecord = materials.find((m) => m.id === editing.id);
      const rateChanged =
        prevRecord && Number(prevRecord.rate) !== Number(matData.rate);
      setMaterials((prev) =>
        prev.map((m) =>
          m.id === editing.id
            ? {
                ...m,
                ...matData,
                ...(rateChanged
                  ? {
                      previousRate: prevRecord.rate,
                      rateChangedAt: new Date().toISOString(),
                    }
                  : {}),
                updatedAt: new Date().toISOString(),
              }
            : m,
        ),
      );
      showToast("Material updated", "success");
    } else {
      // Create
      const newMat = {
        ...matData,
        id: `mat_${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMaterials((prev) => [newMat, ...prev]);
      showToast("Material added", "success");
    }
    setEditing(null);
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      title: `Delete "${item.name}"?`,
      message:
        "This will remove the raw material from your master list. Reusable items using this specification remain unchanged.",
      confirmLabel: "Delete Material",
      danger: true,
      onConfirm: () => {
        setMaterials((prev) => prev.filter((m) => m.id !== item.id));
        showToast("Material deleted", "info");
      },
    });
  };

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto">
      {/* Single sticky toolbar — stats (left) + search & actions (right). No
          page title/description: the active Master tab already names this page. */}
      <div className="px-6 py-3 border-b border-bordergray/70 bg-overallbg/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-[11.5px]">
            <StatChip
              icon={<Layers size={12} className="text-blue-500" />}
              value={stats.total}
              label="materials"
            />
            <span className="h-3 w-px bg-bordergray" />
            <StatChip
              icon={<IndianRupee size={12} className="text-orange-500" />}
              value={formatAmount(stats.avgPrice)}
              label="avg price"
            />
            <span className="h-3 w-px bg-bordergray" />
            <StatChip
              icon={<Package size={12} className="text-purple-500" />}
              value={stats.cement}
              label="cement"
            />
            <span className="h-3 w-px bg-bordergray" />
            <StatChip
              icon={<TrendingUp size={12} className="text-emerald-500" />}
              value={stats.steel}
              label="steel & wire"
            />
            {query && (
              <>
                <span className="h-3 w-px bg-bordergray" />
                <span className="font-semibold text-select-blue tabular-nums">
                  {filtered.length} match{filtered.length === 1 ? "" : "es"}
                </span>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-[11px] font-semibold text-select-blue hover:underline"
                >
                  Clear
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or HSN code"
                className="bg-white border border-bordergray rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:border-select-blue/40 w-[200px] lg:w-[240px]"
              />
            </div>
            <span
              title="Changes are saved automatically"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold text-text-muted bg-bg-soft border border-bordergray"
            >
              <CheckCircle2 size={13} /> Auto-saved
            </span>
            <button
              type="button"
              onClick={() =>
                setEditing({
                  name: "",
                  specifications: "",
                  rate: "",
                  unit: "bag",
                  hsn: "",
                  gstPercent: 18,
                })
              }
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Plus size={13} /> New Material
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">

        {/* Grid List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-bordergray text-center py-16 px-6">
            <Layers size={20} className="text-select-blue mx-auto mb-3" />
            <p className="text-[14px] font-bold text-textcolor">
              No materials found
            </p>
            <p className="text-[12px] text-text-muted mt-1 max-w-sm mx-auto">
              Create a new material record to register details.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((m) => {
              const unitObj = MATERIAL_UNITS.find((u) => u.code === m.unit);
              const unitLabel = unitObj ? unitObj.label.split(" (")[0] : m.unit;

              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-bordergray p-4 flex flex-col justify-between hover:shadow-md hover:border-select-blue/30 transition-all group"
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="text-[13px] font-bold text-textcolor line-clamp-2 leading-snug">
                        {m.name}
                      </h4>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditing(m)}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-text-muted hover:text-select-blue hover:bg-bg-soft"
                          title="Edit"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          className="h-6 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {m.category && (
                        <span className="bg-select-blue/5 text-select-blue text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {m.category}
                        </span>
                      )}
                      {m.brand && (
                        <span className="text-[10px] font-bold text-textcolor">
                          {m.brand}
                        </span>
                      )}
                    </div>

                    {m.specifications && (
                      <p className="text-[11px] text-text-muted mt-1.5 leading-normal line-clamp-2">
                        {m.specifications}
                      </p>
                    )}

                    {(m.sku || m.vendorName || m.vendor) && (
                      <div className="mt-2.5 pt-2 border-t border-dashed border-bordergray/60 grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px] text-text-muted">
                        {m.sku && (
                          <div className="truncate">
                            SKU: <span className="font-semibold text-textcolor">{m.sku}</span>
                          </div>
                        )}
                        {(m.vendorName || m.vendor) && (
                          <div className="truncate">
                            Vendor: <span className="font-semibold text-textcolor">{m.vendorName || m.vendor}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-text-muted mt-3 flex-wrap">
                      <span className="flex items-center gap-0.5">
                        <Hash size={9} /> HSN: {m.hsn || "—"}
                      </span>
                      <span>GST: {m.gstPercent}%</span>
                      <span className="bg-bg-soft px-1.5 py-0.5 rounded text-textcolor font-medium">
                        Per {unitLabel}
                      </span>
                      {usageCounts.get(m.id) > 0 && (
                        <span className="bg-select-blue/5 text-select-blue px-1.5 py-0.5 rounded font-medium">
                          Used in {usageCounts.get(m.id)} item{usageCounts.get(m.id) === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-bordergray pt-3 mt-4">
                    <span className="text-[10px] text-text-subtle font-medium">
                      Standard Rate
                    </span>
                    <span className="text-[15px] font-extrabold text-textcolor tabular-nums">
                      {m.previousRate != null &&
                        Number(m.previousRate) !== Number(m.rate) && (
                          <span className="text-[10px] text-text-subtle font-normal line-through mr-1">
                            ₹{Number(m.previousRate).toLocaleString("en-IN")}
                          </span>
                        )}
                      ₹{m.rate.toLocaleString("en-IN")}
                      <span className="text-[10px] text-text-muted font-normal">
                        {" "}
                        / {m.unit}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between bg-bg-soft">
              <h3 className="text-[13px] font-extrabold text-textcolor uppercase tracking-wide">
                {editing.id ? "Edit Master Material" : "Register New Material"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-6 w-6 flex items-center justify-center rounded-full text-text-muted hover:bg-bordergray hover:text-textcolor transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <InputField
                label="Material Name"
                value={editing.name}
                onChange={(e) =>
                  setEditing((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Portland Cement Grade 53"
                required
              />

              <InputField
                label="Specifications"
                value={editing.specifications || ""}
                onChange={(e) =>
                  setEditing((prev) => ({
                    ...prev,
                    specifications: e.target.value,
                  }))
                }
                placeholder="e.g. 53 Grade, OPC, UltraTech or ACC"
              />

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  type="select"
                  label="Category"
                  value={editing.category || "General"}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, category: e.target.value }))
                  }
                  options={["General", "Civil", "Carpentry", "Electrical", "Plumbing", "Painting", "Flooring"]}
                  placeholder="Select Category"
                />
                <InputField
                  label="Material SKU / Code"
                  value={editing.sku || ""}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  placeholder="e.g. MAT-CEM-01"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  type="select"
                  label="Unit"
                  value={editing.unit}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, unit: e.target.value }))
                  }
                  options={MATERIAL_UNITS.map((u) => u.code)}
                  placeholder="Select Unit"
                  required
                />

                <InputField
                  type="number"
                  label="Rate (₹)"
                  value={editing.rate}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, rate: e.target.value }))
                  }
                  placeholder="e.g. 450"
                  required
                />
              </div>

              {editing.id &&
                (() => {
                  const original = materials.find((m) => m.id === editing.id);
                  const rateDirty =
                    original &&
                    editing.rate !== "" &&
                    Number(editing.rate) !== Number(original.rate);
                  const affected = usageCounts.get(editing.id) || 0;
                  if (!rateDirty || affected === 0) return null;
                  return (
                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                      Used in {affected} item recipe{affected === 1 ? "" : "s"} — their
                      catalog rate will update to reflect this on next view/save.
                    </p>
                  );
                })()}

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="HSN / HSNC Code"
                  value={editing.hsn}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, hsn: e.target.value }))
                  }
                  placeholder="e.g. 2523"
                  required
                />
                <InputField
                  type="number"
                  label="GST Percentage (%)"
                  value={editing.gstPercent}
                  onChange={(e) =>
                    setEditing((prev) => ({
                      ...prev,
                      gstPercent: e.target.value,
                    }))
                  }
                  placeholder="e.g. 18"
                />
              </div>
            </div>

            <div className="px-5 py-3 border-t border-bordergray bg-bg-soft flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-4 py-2 border border-bordergray bg-white rounded-lg text-[12px] font-semibold text-text-muted hover:text-textcolor"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all"
              >
                {editing.id ? "Save Changes" : "Create Material"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dialog Confirmation */}
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

      {/* Toast notifications */}
      {toast && (
        <div className="fixed top-6 right-6 z-50">
          <div
            className={`text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md ${
              toast.type === "error"
                ? "bg-red-500"
                : toast.type === "info"
                  ? "bg-select-blue"
                  : "bg-emerald-500"
            }`}
          >
            <CheckCircle2 size={14} className="shrink-0" />
            <p className="text-[12px] font-medium flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-white/80 hover:text-white shrink-0"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact inline stat — value + muted label with a leading icon. Replaces the
// large bento cards so the header stays a single tight bar.
const StatChip = ({ icon, value, label }) => (
  <span className="inline-flex items-center gap-1.5">
    {icon}
    <span className="font-bold text-textcolor tabular-nums">{value}</span>
    <span className="text-text-muted">{label}</span>
  </span>
);

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onCancel}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
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

export default MaterialMaster;