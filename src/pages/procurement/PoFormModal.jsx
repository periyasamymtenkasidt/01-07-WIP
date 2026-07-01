import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { listContracts } from "../../data/contractStorage";
import { listVendors } from "../../data/vendorStorage";
import { createPurchaseOrder } from "../../data/procurementStorage";

// Shared "create purchase order" modal, used by the Purchase Orders tab (blank)
// and the Take-off tab (pre-filled with BOQ material lines + the linked contract).

const blankLine = () => ({ name: "", qty: 1, unit: "nos", rate: 0 });

const PoFormModal = ({
  open,
  onClose,
  onSaved,
  initialLines = null,
  initialContractId = "",
}) => {
  const contracts = listContracts();
  const vendors = listVendors();

  const [contractId, setContractId] = useState(initialContractId);
  const [vendorId, setVendorId] = useState("");
  const [expectedOn, setExpectedOn] = useState("");
  const [lines, setLines] = useState(initialLines?.length ? initialLines : [blankLine()]);

  // Re-seed when opened with new take-off lines / contract.
  useEffect(() => {
    if (!open) return;
    setContractId(initialContractId || "");
    setVendorId("");
    setExpectedOn("");
    setLines(initialLines?.length ? initialLines.map((l) => ({ ...l })) : [blankLine()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const setLine = (i, patch) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (i) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const total = lines.reduce(
    (s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0),
    0,
  );

  const canSave = contractId && lines.some((l) => l.name && l.rate);

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

        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-[12px] font-semibold text-text-muted">
              Project (contract)
              <select
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                className="mt-1 w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white"
              >
                <option value="">Select…</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.clientName} · {c.id}
                  </option>
                ))}
              </select>
            </label>
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
              Expected on
              <input
                type="date"
                value={expectedOn}
                onChange={(e) => setExpectedOn(e.target.value)}
                className="mt-1 w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white"
              />
            </label>
          </div>

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
                  <input
                    type="number"
                    placeholder="Qty"
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })}
                    className="w-16 border border-bordergray rounded-lg px-2 py-1.5 text-[13px]"
                  />
                  <input
                    placeholder="Unit"
                    value={l.unit}
                    onChange={(e) => setLine(i, { unit: e.target.value })}
                    className="w-16 border border-bordergray rounded-lg px-2 py-1.5 text-[13px]"
                  />
                  <input
                    type="number"
                    placeholder="Rate"
                    value={l.rate}
                    onChange={(e) => setLine(i, { rate: e.target.value })}
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
