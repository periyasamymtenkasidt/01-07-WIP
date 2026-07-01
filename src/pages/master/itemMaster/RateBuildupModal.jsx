import { useMemo, useState } from "react";
import { X, Plus, Trash2, ArrowRight, Calculator, Info, Edit3 } from "lucide-react";
import { listMaterials } from "../../../data/materialLibrary";
import {
  GRADES,
  blankRecipe,
  blankComponent,
  computeRecipe,
  materialsById,
  seedRecipeFromMaterials,
} from "../../../data/rateBuildup";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

// Rate Build-up — the "overall process" view for one work. Shows how the rate
// is composed from Material Master prices + labour, per quality grade, and how
// it flows to the measured-sqft BOQ cost. Saving sets the work's rate.
const RateBuildupModal = ({ item, onSave, onClose }) => {
  const materials = useMemo(() => listMaterials(), []);
  const matById = useMemo(() => materialsById(materials), [materials]);

  const [recipes, setRecipes] = useState(() => {
    if (item.recipes) return clone(item.recipes);
    const seeded = seedRecipeFromMaterials(item.materials || [], materials, item.unit || "");
    return {
      economy: { ...clone(seeded), overheadPct: 5, marginPct: 10 },
      premium: { ...clone(seeded), overheadPct: 10, marginPct: 20 },
      luxury: { ...clone(seeded), overheadPct: 15, marginPct: 30 },
    };
  });
  // The active grade tab is the single, final selection — it both drives the
  // recipe being edited AND becomes the item's default grade (which sets the
  // saved rate). Defaults to Economy for every scope.
  const [activeGrade, setActiveGrade] = useState(item.defaultGrade || "economy");
  const [newGradeName, setNewGradeName] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTargetKey, setDeleteTargetKey] = useState(null);
  const [editTargetKey, setEditTargetKey] = useState(null);
  const [editGradeName, setEditGradeName] = useState("");

  const dynamicGrades = useMemo(() => {
    const keys = Object.keys(recipes || {});
    const baseLabels = {
      economy: "Economy",
      premium: "Premium",
      luxury: "Luxury",
    };
    return keys.map((k) => {
      const label = baseLabels[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
      return { key: k, label };
    });
  }, [recipes]);

  const active = recipes[activeGrade] || blankRecipe();
  const calc = useMemo(() => computeRecipe(active, matById), [active, matById]);

  const allRates = useMemo(() => {
    const acc = {};
    for (const g of dynamicGrades) {
      acc[g.key] = computeRecipe(recipes?.[g.key], matById).rate;
    }
    return acc;
  }, [recipes, dynamicGrades, matById]);

  const workUnit = item.unit || "unit";

  // ── mutations on the active grade's recipe ──────────────────────────────
  const patchRecipe = (patch) =>
    setRecipes((rs) => ({ ...rs, [activeGrade]: { ...rs[activeGrade], ...patch } }));
  const patchComp = (i, patch) =>
    patchRecipe({
      components: active.components.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    });
  const addComp = () =>
    patchRecipe({ components: [...active.components, blankComponent()] });
  const removeComp = (i) =>
    patchRecipe({ components: active.components.filter((_, idx) => idx !== i) });
  const pickMaterial = (i, materialId) => {
    const m = matById[materialId];
    patchComp(i, {
      materialId,
      name: m?.name || "",
      unit: m?.unit || "",
      rate: m ? Number(m.rate) || 0 : 0,
    });
  };

  const handleAddGrade = (nameStr) => {
    const name = nameStr ? nameStr.trim() : "";
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, "_");
    if (recipes[key]) {
      alert("A grade with this name already exists!");
      return;
    }
    // Clone the active recipe as a baseline for the new grade
    setRecipes((rs) => ({
      ...rs,
      [key]: clone(active),
    }));
    setActiveGrade(key);
  };

  const handleRemoveGrade = (key, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const keys = Object.keys(recipes || {});
    if (keys.length <= 1) {
      alert("Cannot delete grade. At least one quality grade must remain.");
      return;
    }
    setDeleteTargetKey(key);
  };

  const confirmDeleteGrade = () => {
    if (!deleteTargetKey) return;
    const key = deleteTargetKey;
    const keys = Object.keys(recipes || {});
    const nextActive = keys.find((k) => k !== key) || "premium";

    setRecipes((rs) => {
      const next = { ...rs };
      delete next[key];
      return next;
    });

    if (activeGrade === key) {
      setActiveGrade(nextActive);
    }
    setDeleteTargetKey(null);
  };

  const handleStartRename = (key, e) => {
    e.stopPropagation();
    const gObj = dynamicGrades.find((g) => g.key === key);
    const label = gObj ? gObj.label : key;
    setEditTargetKey(key);
    setEditGradeName(label);
  };

  const confirmRenameGrade = () => {
    const oldKey = editTargetKey;
    if (!oldKey) return;
    const name = editGradeName.trim();
    if (!name) return;
    const newKey = name.toLowerCase().replace(/\s+/g, "_");
    if (newKey === oldKey) {
      setEditTargetKey(null);
      return;
    }
    if (recipes[newKey]) {
      alert("A grade with this name already exists!");
      return;
    }

    setRecipes((rs) => {
      const next = { ...rs };
      next[newKey] = next[oldKey];
      delete next[oldKey];
      return next;
    });

    if (activeGrade === oldKey) {
      setActiveGrade(newKey);
    }
    setEditTargetKey(null);
  };

  const save = () => {
    const defaultRecipe = recipes[activeGrade] || blankRecipe();
    const mappedMaterials = (defaultRecipe.components || []).map((c) => {
      const mat = matById[c.materialId];
      const factor = (Number(c.qty) || 0) * (1 + (Number(c.wastagePct) || 0) / 100);
      return {
        name: mat?.name || c.name || "",
        spec: mat?.specifications || "",
        consumptionFormula: `Q * ${Number(factor.toFixed(4))}`,
        rate: mat ? Number(mat.rate) || 0 : Number(c.rate) || 0,
        unit: mat?.unit || c.unit || "",
      };
    });

    onSave({
      ...item,
      recipes,
      defaultGrade: activeGrade,
      rate: Math.round(allRates[activeGrade] || 0),
      materials: mappedMaterials,
    });
  };

  return (
    <>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bordergray">
          <div className="flex items-center gap-2 min-w-0">
            <Calculator size={16} className="text-select-blue shrink-0" />
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-textcolor truncate">
                Rate Build-up
              </h3>
              <p className="text-[11px] text-text-muted truncate">
                {item.description || "Work"} · per {workUnit}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-textcolor">
            <X size={18} />
          </button>
        </div>

        {/* Process strip — the overall flow */}
        <div className="px-6 py-2.5 bg-bg-soft/60 border-b border-bordergray flex items-center gap-2 text-[10.5px] font-semibold text-text-muted flex-wrap">
          {["Material Master", "Recipe", "Rate / " + workUnit, "× survey sqft", "BOQ cost"].map(
            (s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className={i === 2 ? "text-select-blue font-bold" : ""}>{s}</span>
                {i < arr.length - 1 && <ArrowRight size={11} className="text-text-subtle" />}
              </span>
            ),
          )}
        </div>

        {/* Quality Grades Header & Actions */}
        <div className="px-6 pt-3 flex items-center justify-between border-b border-bordergray/40 pb-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
            Quality Grades
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-bordergray text-textcolor bg-white hover:border-select-blue hover:text-select-blue hover:bg-bg-soft cursor-pointer transition-colors"
              title="Add New Grade"
            >
              <Plus size={12} /> Add
            </button>
            <button
              onClick={(e) => handleStartRename(activeGrade, e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-bordergray text-textcolor bg-white hover:border-select-blue hover:text-select-blue hover:bg-bg-soft cursor-pointer transition-colors"
              title="Rename Active Grade"
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              onClick={(e) => handleRemoveGrade(activeGrade, e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-bordergray text-red-600 bg-white hover:border-red-600 hover:bg-red-50 cursor-pointer transition-colors"
              title="Delete Active Grade"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>

        {/* Grade tabs */}
        <div
          className="px-6 pt-2 pb-1 flex items-center gap-1.5 overflow-x-auto flex-nowrap hide-scrollbar"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {dynamicGrades.map((g) => {
            const isActive = g.key === activeGrade;
            return (
              <button
                key={g.key}
                onClick={() => setActiveGrade(g.key)}
                className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-[12px] font-semibold border transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? "bg-active-bg text-select-blue border-select-blue/40 font-bold"
                    : "bg-white text-text-muted border-bordergray hover:bg-bg-soft"
                }`}
              >
                {g.label}
                <span className="text-[11px] tabular-nums opacity-80">
                  {inr(allRates[g.key])}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {/* Components */}
          <div className="rounded-xl border border-bordergray overflow-hidden">
            <div className="grid grid-cols-[2.4fr_1.1fr_1fr_0.8fr_0.7fr_28px] gap-2 px-3 py-2 bg-bg-soft/60 text-[10px] font-bold uppercase tracking-wider text-text-subtle items-center">
              <span className="min-w-0 pl-2 truncate">Material (from Master)</span>
              <span className="min-w-0 text-center truncate">Qty/{workUnit}</span>
              <span className="min-w-0 text-center truncate">Waste%</span>
              <span className="min-w-0 text-right truncate">Rate</span>
              <span className="min-w-0 text-right truncate">Amount</span>
              <span></span>
            </div>
            {active.components.length === 0 ? (
              <p className="text-[12px] text-text-subtle italic px-3 py-3">
                No materials yet. Add the materials this work consumes per {workUnit}.
              </p>
            ) : (
              calc.lines.map((line, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2.4fr_1.1fr_1fr_0.8fr_0.7fr_28px] gap-2 px-3 py-2 border-t border-bordergray items-center text-[12px]"
                >
                  <select
                    value={active.components[i].materialId}
                    onChange={(e) => pickMaterial(i, e.target.value)}
                    className={`w-full min-w-0 border rounded-lg px-2 py-1.5 text-[12px] bg-white ${line.missing ? "border-red-300" : "border-bordergray"}`}
                  >
                    <option value="">Select material…</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — ₹{m.rate}/{m.unit}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={active.components[i].qty}
                    onChange={(e) => patchComp(i, { qty: e.target.value })}
                    className="w-full min-w-0 border border-bordergray rounded-lg px-2 py-1.5 text-center"
                  />
                  <input
                    type="number"
                    value={active.components[i].wastagePct}
                    onChange={(e) => patchComp(i, { wastagePct: e.target.value })}
                    className="w-full min-w-0 border border-bordergray rounded-lg px-2 py-1.5 text-center"
                  />
                  <span className="min-w-0 text-right text-text-muted tabular-nums truncate">
                    {inr(line.rate)}
                    <span className="text-text-subtle">/{line.unit}</span>
                  </span>
                  <span className="min-w-0 text-right font-semibold text-textcolor tabular-nums">
                    {inr(line.amount)}
                  </span>
                  <button
                    onClick={() => removeComp(i)}
                    className="text-text-subtle hover:text-red-500 justify-self-end"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
            <button
              onClick={addComp}
              className="flex items-center gap-1.5 px-3 py-2 border-t border-bordergray text-[12px] font-semibold text-select-blue hover:bg-bg-soft w-full"
            >
              <Plus size={13} /> Add material
            </button>
          </div>

          {/* Labour / overhead / margin */}
          <div className="grid grid-cols-3 gap-3">
            <Field label={`Labour (₹/${workUnit})`}>
              <input
                type="number"
                value={active.labourRate}
                onChange={(e) => patchRecipe({ labourRate: e.target.value })}
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Overhead %">
              <input
                type="number"
                value={active.overheadPct}
                onChange={(e) => patchRecipe({ overheadPct: e.target.value })}
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px]"
              />
            </Field>
            <Field label="Margin %">
              <input
                type="number"
                value={active.marginPct}
                onChange={(e) => patchRecipe({ marginPct: e.target.value })}
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px]"
              />
            </Field>
          </div>

          {/* Build-up summary */}
          <div className="rounded-xl border border-bordergray bg-bg-soft/40 p-4 space-y-1.5 text-[12px]">
            <Row label="Material cost" value={inr(calc.materialCost)} />
            <Row label="+ Labour" value={inr(calc.labour)} />
            <Row label="= Base" value={inr(calc.base)} strong />
            <Row label={`+ Overhead (${active.overheadPct || 0}%)`} value={inr(calc.overhead)} />
            <Row label={`+ Margin (${active.marginPct || 0}%)`} value={inr(calc.margin)} />
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-bordergray">
              <span className="text-[13px] font-bold text-textcolor">
                Rate / {workUnit} ({dynamicGrades.find((g) => g.key === activeGrade)?.label || activeGrade})
              </span>
              <span className="text-[18px] font-black text-select-blue tabular-nums">
                {inr(calc.rate)}
              </span>
            </div>
            {/* Input GST — recovered via ITC, NOT part of the rate above */}
            <div className="mt-2 pt-2 border-t border-dashed border-bordergray flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-text-muted">
                <Info size={11} /> Input GST on materials (ITC)
              </span>
              <span className="text-[11px] text-text-muted tabular-nums">
                {inr(calc.inputGst)} reclaimable
              </span>
            </div>
            <p className="text-[10px] text-text-subtle">
              Recovered via input tax credit — not added to the client rate. The
              client is billed output GST (18%) on the work value separately.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-bordergray">
          <span className="text-[12px] text-text-muted">
            Item rate →{" "}
            <span className="font-bold text-textcolor">
              {inr(allRates[activeGrade])}/{workUnit}
            </span>{" "}
            ({dynamicGrades.find((g) => g.key === activeGrade)?.label || activeGrade})
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:bg-bg-soft"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950"
            >
              Save Build-up
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4 border border-bordergray animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-50 rounded-lg">
                <Trash2 size={20} />
              </div>
              <h4 className="text-[15px] font-bold">Delete Quality Grade</h4>
            </div>
            <p className="text-[12.5px] text-text-muted leading-relaxed">
              Are you sure you want to delete the &ldquo;
              <span className="font-semibold text-textcolor">
                {dynamicGrades.find((g) => g.key === deleteTargetKey)?.label || deleteTargetKey}
              </span>
              &rdquo; quality grade? This will permanently delete its recipe.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteTargetKey(null)}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:bg-bg-soft border border-bordergray cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteGrade}
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-red-600 hover:bg-red-700 cursor-pointer transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Grade Modal */}
      {editTargetKey && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmRenameGrade();
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4 border border-bordergray animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-select-blue">
              <div className="p-2 bg-active-bg rounded-lg">
                <Edit3 size={20} />
              </div>
              <h4 className="text-[15px] font-bold">Rename Quality Grade</h4>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-text-muted block">
                Grade Name
              </label>
              <input
                type="text"
                value={editGradeName}
                onChange={(e) => setEditGradeName(e.target.value)}
                placeholder="e.g. Ultra Premium"
                required
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-select-blue text-textcolor font-medium"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditTargetKey(null)}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:bg-bg-soft border border-bordergray cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-select-blue hover:bg-blue-950 cursor-pointer transition-colors"
              >
                Rename
              </button>
            </div>
          </div>
        </form>
      )}
      {/* Add Grade Modal */}
      {showAddModal && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddGrade(newGradeName);
            setNewGradeName("");
            setShowAddModal(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl space-y-4 border border-bordergray animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-select-blue">
              <div className="p-2 bg-active-bg rounded-lg">
                <Plus size={20} />
              </div>
              <h4 className="text-[15px] font-bold">Add Quality Grade</h4>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-text-muted block">
                Grade Name
              </label>
              <input
                type="text"
                value={newGradeName}
                onChange={(e) => setNewGradeName(e.target.value)}
                placeholder="e.g. Ultra Premium"
                required
                className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:border-select-blue text-textcolor font-medium"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setNewGradeName("");
                  setShowAddModal(false);
                }}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold text-text-muted hover:bg-bg-soft border border-bordergray cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-select-blue hover:bg-blue-950 cursor-pointer transition-colors"
              >
                Add Grade
              </button>
            </div>
          </div>
        </form>
      )}
    </>
  );
};

const Field = ({ label, children }) => (
  <label className="text-[11px] font-semibold text-text-muted block">
    {label}
    <div className="mt-1">{children}</div>
  </label>
);

const Row = ({ label, value, strong }) => (
  <div className="flex items-center justify-between">
    <span className={strong ? "font-bold text-textcolor" : "text-text-muted"}>
      {label}
    </span>
    <span className={`tabular-nums ${strong ? "font-bold text-textcolor" : "text-textcolor"}`}>
      {value}
    </span>
  </div>
);

export default RateBuildupModal;
