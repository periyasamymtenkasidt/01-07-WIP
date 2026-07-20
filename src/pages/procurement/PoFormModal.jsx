import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, PackageCheck, Check } from "lucide-react";
import { listBoqs } from "../../data/boqStorage";
import { listVendors } from "../../data/vendorStorage";
import { createPurchaseOrder } from "../../data/procurementStorage";
import NumericInput from "../../components/NumericInput";

const ELIGIBLE_STATUS = "issued_for_procurement";

const blankLine = () => ({ name: "", qty: 1, unit: "nos", rate: 0 });

const PoFormModal = ({
  open,
  onClose,
  onSaved,
  initialLines = null,
  initialContractId = "",
}) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eligibleBoqs = useMemo(() => listBoqs().filter((b) => b.status === ELIGIBLE_STATUS), [open]);
  const vendors = listVendors();

  const [contractId, setContractId] = useState(initialContractId);
  const [selectedBoq, setSelectedBoq] = useState(null);
  const [vendorId, setVendorId] = useState("");
  const [expectedOn, setExpectedOn] = useState("");
  const [lines, setLines] = useState(initialLines?.length ? initialLines : [blankLine()]);

  useEffect(() => {
    if (!open) return;
    setContractId(initialContractId || "");
    setSelectedBoq(null);
    setVendorId("");
    setExpectedOn("");
    setLines(initialLines?.length ? initialLines.map((l) => ({ ...l })) : [blankLine()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const today = new Date().toISOString().split("T")[0];

  const setLine = (i, patch) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const total = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0),
    0,
  );

  const deliveryDateValid = !expectedOn || expectedOn >= today;
  const canSave = contractId && lines.some((l) => l.name && l.rate) && deliveryDateValid;

  const handleSelectBoq = (boq) => {
    setSelectedBoq(boq);
    setContractId(boq.contractId || "");
  };

  const save = () => {
    if (!canSave) return;
    const vendor = vendors.find((v) => v.id === vendorId);
    createPurchaseOrder(contractId, {
      vendorId,
      vendorName: vendor?.name || "",
      expectedOn,
      items: lines
        .filter((l) => l.name)
        .map((l) => ({
          name: l.name,
          spec: l.spec || "",
          qty: Number(l.qty) || 0,
          unit: l.unit || "nos",
          rate: Number(l.rate) || 0,
          materialId: l.materialId || null,
        })),
    });
    window.dispatchEvent(new Event("leadDataChanged"));
    onSaved?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bordergray">
          <h3 className="text-[15px] font-bold text-textcolor">
            Create Purchase Order
          </h3>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-textcolor"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* BOQ selection — table when standalone; locked chip when pre-filled */}
          {initialContractId ? (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
              <PackageCheck size={13} className="text-indigo-600 shrink-0" />
              <span className="text-[12px] text-text-muted font-semibold">Contract</span>
              <span className="text-[12px] font-bold text-indigo-700">{initialContractId}</span>
            </div>
          ) : (
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wider text-text-subtle mb-2">
                Select BOQ
              </p>
              {eligibleBoqs.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2 rounded-xl border border-bordergray bg-bg-soft/40 text-center">
                  <PackageCheck size={26} className="text-text-subtle opacity-40" />
                  <p className="text-[12px] font-semibold text-text-muted">
                    No BOQs issued for procurement yet
                  </p>
                  <p className="text-[11px] text-text-subtle max-w-xs">
                    A BOQ must be completed and issued for procurement from the
                    BOQ editor before it appears here.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-bordergray overflow-hidden">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="bg-bg-soft text-text-muted text-[10px] uppercase tracking-wider">
                        <th className="text-left font-bold px-4 py-2.5">BOQ ID</th>
                        <th className="text-left font-bold px-4 py-2.5">Title</th>
                        <th className="text-left font-bold px-4 py-2.5">Client</th>
                        <th className="px-4 py-2.5 w-24" />
                      </tr>
                    </thead>
                    <tbody>
                      {eligibleBoqs.map((b) => {
                        const isSelected = selectedBoq?.id === b.id;
                        return (
                          <tr
                            key={b.id}
                            onClick={() => handleSelectBoq(b)}
                            className={`border-t border-bordergray cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-indigo-50"
                                : "hover:bg-bg-soft/50"
                            }`}
                          >
                            <td className="px-4 py-2.5 font-mono text-[11px] text-text-muted whitespace-nowrap">
                              {b.id}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-textcolor">
                              {b.title || "Untitled BOQ"}
                            </td>
                            <td className="px-4 py-2.5 text-text-muted">
                              {b.clientName || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {isSelected ? (
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-indigo-600">
                                  <Check size={11} /> Selected
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-select-blue hover:underline">
                                  Select →
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Vendor + date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[12px] font-semibold text-text-muted">
              Vendor
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="mt-1 w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white"
              >
                <option value="">Select…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-semibold text-text-muted">
              Committed Delivery Date
              <input
                type="date"
                min={today}
                value={expectedOn}
                onChange={(e) => setExpectedOn(e.target.value)}
                className={`mt-1 w-full border rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white ${
                  !deliveryDateValid ? "border-red-300 bg-red-50" : "border-bordergray"
                }`}
              />
              {!deliveryDateValid && (
                <p className="mt-1 text-[11px] text-red-500 font-normal">
                  Delivery date cannot be in the past.
                </p>
              )}
            </label>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-bold uppercase tracking-wider text-text-subtle">
                Line items
              </p>
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-[12px] font-semibold text-select-blue hover:underline"
              >
                <Plus size={13} /> Add line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="Material"
                    value={l.name}
                    onChange={(e) => setLine(i, { name: e.target.value })}
                    className="flex-1 border border-bordergray rounded-lg px-2.5 py-1.5 text-[13px]"
                  />
                  <NumericInput
                    placeholder="Qty"
                    value={l.qty}
                    onChange={(val) => setLine(i, { qty: val })}
                    className="w-16 border border-bordergray rounded-lg px-2 py-1.5 text-[13px]"
                  />
                  <input
                    placeholder="Unit"
                    value={l.unit}
                    onChange={(e) => setLine(i, { unit: e.target.value })}
                    className="w-16 border border-bordergray rounded-lg px-2 py-1.5 text-[13px]"
                  />
                  <NumericInput
                    placeholder="Rate"
                    value={l.rate}
                    onChange={(val) => setLine(i, { rate: val })}
                    className="w-24 border border-bordergray rounded-lg px-2 py-1.5 text-[13px]"
                  />
                  <button
                    onClick={() => removeLine(i)}
                    className="text-text-subtle hover:text-red-500 shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-bordergray">
          <span className="text-[13px] text-text-muted">
            Total:{" "}
            <span className="font-bold text-textcolor">
              ₹{Math.round(total).toLocaleString("en-IN")}
            </span>
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
              disabled={!canSave}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40"
            >
              Create PO
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PoFormModal;
