import React, { useState, useMemo } from "react";
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
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import {
  listMaterials,
  saveMaterials,
  resetMaterials,
} from "../../../data/materialLibrary";
import { listLibrary } from "../../../data/itemLibrary";
import { listVendors } from "../../../data/vendorStorage";
import { formatAmount } from "../../../utils/formatAmount";
import InputField from "../../../components/InputField";
import SearchableSelect from "../../../components/SearchableSelect";

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
  const [hasChanges, setHasChanges] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // holds material being edited/created
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2400);
  };

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

  const vendors = useMemo(() => listVendors(), []);
  const vendorOptions = useMemo(
    () => vendors.map((v) => ({ value: v.id, label: v.name })),
    [vendors],
  );

  // If the material being edited references a vendor that's since been
  // deleted from Vendor Master, inject its saved name as a synthetic option
  // so the dropdown shows "Acme Supplies" instead of the raw orphaned id.
  const editingVendorId = editing?.vendorId;
  const editingVendorOptions =
    editingVendorId && !vendors.some((v) => v.id === editingVendorId)
      ? [
          { value: editingVendorId, label: editing.vendorName || "Unknown vendor (deleted)" },
          ...vendorOptions,
        ]
      : vendorOptions;

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
      showToast("Material updated (unsaved changes)", "success");
    } else {
      // Create
      const newMat = {
        ...matData,
        id: `mat_${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMaterials((prev) => [newMat, ...prev]);
      showToast("Material added (unsaved changes)", "success");
    }
    setHasChanges(true);
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
        setHasChanges(true);
        showToast("Material deleted (unsaved changes)", "info");
      },
    });
  };

  const handleReset = () => {
    setConfirmDialog({
      title: "Reset Materials to Defaults?",
      message:
        "This will clear all custom materials and restore the default civil materials list.",
      confirmLabel: "Reset Catalog",
      danger: true,
      onConfirm: () => {
        setMaterials(resetMaterials());
        setHasChanges(false);
        showToast("Materials master reset to defaults", "success");
      },
    });
  };

  const persistChanges = () => {
    saveMaterials(materials);
    setHasChanges(false);
    showToast("Material Master saved successfully", "success");
  };

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-bordergray/70 bg-overallbg/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <Layers size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                Material Master
              </h1>
              <p className="text-[12px] text-text-muted mt-0.5">
                Catalog of raw construction materials, bulk pricing, and HSNC
                codes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-bordergray rounded-lg text-[12px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor transition-all cursor-pointer"
            >
              <RotateCcw size={12} /> Reset Catalog
            </button>
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
              className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all cursor-pointer"
            >
              <Plus size={13} /> New Material
            </button>
            {hasChanges && (
              <button
                type="button"
                onClick={persistChanges}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[12px] font-semibold shadow-md transition-all cursor-pointer animate-pulse"
              >
                <CheckCircle2 size={13} strokeWidth={3} /> Save Changes
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BentoStat
            icon={<Layers size={13} />}
            label="Total Materials"
            value={stats.total}
            tint="blue"
          />
          <BentoStat
            icon={<IndianRupee size={13} />}
            label="Avg Unit Price"
            value={formatAmount(stats.avgPrice)}
            tint="orange"
          />
          <BentoStat
            icon={<Package size={13} />}
            label="Cement Variants"
            value={stats.cement}
            tint="purple"
          />
          <BentoStat
            icon={<TrendingUp size={13} />}
            label="Steel & Wire Specs"
            value={stats.steel}
            tint="emerald"
          />
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3 mb-4 flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold text-textcolor">
            Raw Material Specifications
          </p>
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
              className="bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30 w-[280px]"
            />
          </div>
        </div>

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
                  label="Brand / Manufacturer"
                  value={editing.brand || ""}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, brand: e.target.value }))
                  }
                  placeholder="e.g. UltraTech, Tata"
                />
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Material SKU / Code"
                  value={editing.sku || ""}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, sku: e.target.value }))
                  }
                  placeholder="e.g. MAT-CEM-01"
                />
                <div className="flex flex-col">
                  <label className="mb-1 text-[11px] font-semibold text-darkgray">
                    Preferred Vendor
                  </label>
                  <SearchableSelect
                    value={editing.vendorId || ""}
                    onChange={(val) => {
                      const v = vendors.find((vv) => vv.id === val);
                      setEditing((prev) => ({
                        ...prev,
                        vendorId: val,
                        vendorName: v?.name || "",
                      }));
                    }}
                    options={editingVendorOptions}
                    placeholder="Select vendor"
                    className="bg-light-gray border border-bordergray text-[11px] text-darkgray rounded-md px-3 py-2 w-full focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300 placeholder-gray-400"
                  />
                  {!editing.vendorId && editing.vendor && (
                    <p className="text-[10px] text-text-subtle mt-1">
                      Previously: {editing.vendor} — pick a vendor above to link it.
                    </p>
                  )}
                </div>
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
