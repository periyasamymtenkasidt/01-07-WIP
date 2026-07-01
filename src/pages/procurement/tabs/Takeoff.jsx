import { useState, useMemo } from "react";
import { FileBox, ArrowRight, Send } from "lucide-react";
import { listBoqs, getBoq } from "../../../data/boqStorage";
import { buildTakeoffFromBoq } from "../../../data/procurementStorage";
import { getContractByClient } from "../../../data/contractStorage";
import PoFormModal from "../PoFormModal";
import RfqFormModal from "../RfqFormModal";

// Material take-off: pick a BOQ, roll up every material it references into a
// deduped requisition. This is the Purchase Requisition step — staff check off
// which specific materials they actually want to source right now (not every
// material has to move at once), then push only those into an RFQ or PO.

const takeoffKey = (t) => `${t.materialId || ""}|${t.name}|${t.spec || ""}`;

const Takeoff = () => {
  const boqs = listBoqs();
  const [boqId, setBoqId] = useState(boqs[0]?.id || "");
  const [modal, setModal] = useState(false);
  const [rfqModal, setRfqModal] = useState(false);
  // Tracked as exclusions rather than inclusions so a freshly loaded take-off
  // defaults to "everything selected" without needing an effect to seed it —
  // resetting on BOQ change happens during render (React's recommended
  // pattern), not via setState-in-effect.
  const [deselected, setDeselected] = useState(() => new Set());
  const [seededForBoq, setSeededForBoq] = useState(boqId);

  const boq = useMemo(() => (boqId ? getBoq(boqId) : null), [boqId]);
  const takeoff = useMemo(() => (boq ? buildTakeoffFromBoq(boq) : []), [boq]);

  if (boqId !== seededForBoq) {
    setSeededForBoq(boqId);
    setDeselected(new Set());
  }

  const toggleOne = (t) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      const k = takeoffKey(t);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const allSelected = takeoff.length > 0 && deselected.size === 0;
  const toggleAll = () =>
    setDeselected(allSelected ? new Set(takeoff.map(takeoffKey)) : new Set());

  const selectedTakeoff = takeoff.filter((t) => !deselected.has(takeoffKey(t)));

  // If the BOQ's client has a contract, pre-select it on the PO.
  const contractId = useMemo(() => {
    const cid = boq?.client?.id;
    return cid ? getContractByClient(cid)?.id || "" : "";
  }, [boq]);

  const poLines = selectedTakeoff.map((t) => ({
    name: t.name,
    spec: t.spec,
    qty: Math.round(t.estimatedQty) || 1,
    unit: t.unit,
    rate: 0,
    materialId: t.materialId,
  }));

  const rfqLines = selectedTakeoff.map((t) => ({
    name: t.name,
    spec: t.spec,
    qty: Math.round(t.estimatedQty) || 1,
    unit: t.unit,
    materialId: t.materialId,
  }));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <label className="text-[12px] font-semibold text-text-muted flex items-center gap-2">
          BOQ
          <select
            value={boqId}
            onChange={(e) => setBoqId(e.target.value)}
            className="border border-bordergray rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white"
          >
            <option value="">Select a BOQ…</option>
            {boqs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} · {b.title} {b.clientName ? `· ${b.clientName}` : ""}
              </option>
            ))}
          </select>
        </label>
        {takeoff.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">
              {selectedTakeoff.length} of {takeoff.length} selected
            </span>
            <button
              disabled={selectedTakeoff.length === 0}
              onClick={() => setRfqModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-select-blue text-select-blue text-[12px] font-semibold hover:bg-select-blue/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send RFQ <Send size={13} />
            </button>
            <button
              disabled={selectedTakeoff.length === 0}
              onClick={() => setModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Create PO from selection <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>

      {!boq ? (
        <div className="text-center py-12 text-text-subtle">
          <FileBox size={24} className="mx-auto mb-2 opacity-50" />
          Select a BOQ to see its material take-off.
        </div>
      ) : takeoff.length === 0 ? (
        <div className="text-center py-12 text-text-subtle">
          This BOQ has no materials attached to its line items yet.
        </div>
      ) : (
        <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5"
                    title="Select all"
                  />
                </th>
                <th className="text-left font-bold px-4 py-3">Material</th>
                <th className="text-left font-bold px-4 py-3">Spec</th>
                <th className="text-right font-bold px-4 py-3">Est. Qty</th>
                <th className="text-left font-bold px-4 py-3">Unit</th>
                <th className="text-left font-bold px-4 py-3">Used in</th>
              </tr>
            </thead>
            <tbody>
              {takeoff.map((t, i) => {
                const checked = !deselected.has(takeoffKey(t));
                return (
                  <tr
                    key={i}
                    onClick={() => toggleOne(t)}
                    className={`border-t border-bordergray hover:bg-bg-soft/40 cursor-pointer ${checked ? "" : "opacity-50"}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(t)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-textcolor">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{t.spec || "—"}</td>
                    <td className="px-4 py-3 text-right text-textcolor">
                      {Math.round(t.estimatedQty).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{t.unit}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {t.usedIn.join(", ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PoFormModal
        open={modal}
        onClose={() => setModal(false)}
        initialLines={poLines}
        initialContractId={contractId}
      />

      <RfqFormModal
        open={rfqModal}
        onClose={() => setRfqModal(false)}
        initialLines={rfqLines}
        initialContractId={contractId}
      />
    </div>
  );
};

export default Takeoff;
