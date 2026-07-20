import { useState, useMemo } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { receivePurchaseOrder, generateGrnId } from "../../data/procurementStorage";

const CONDITIONS = ["Good", "Short Supplied", "Damaged", "Rejected"];

const GRNReceiptModal = ({ po, onClose, onSaved }) => {
  // Sum quantities already received across previous GRNs per material
  const receivedSoFar = useMemo(() => {
    const map = {};
    (po.grns || []).forEach((g) =>
      (g.receivedItems || []).forEach((r) => {
        const k = r.materialId ?? r.name;
        map[k] = (map[k] || 0) + (Number(r.qty) || 0);
      }),
    );
    return map;
  }, [po]);

  // Only show items that still have outstanding qty
  const pendingItems = useMemo(
    () =>
      (po.items || []).filter((item) => {
        const k = item.materialId ?? item.name;
        return (receivedSoFar[k] || 0) < (Number(item.qty) || 0);
      }),
    [po, receivedSoFar],
  );

  const [header, setHeader] = useState({
    receivedOn: new Date().toISOString().split("T")[0],
    receivedBy: "",
    challanNo: "",
    remarks: "",
  });

  const [lines, setLines] = useState(() => {
    const init = {};
    (po.items || []).forEach((item) => {
      const k = item.materialId ?? item.name;
      const ordered = Number(item.qty) || 0;
      const prev = (receivedSoFar[k] || 0);
      const remaining = ordered - prev;
      if (remaining > 0) {
        init[k] = { qty: String(remaining), condition: "Good", remarks: "" };
      }
    });
    return init;
  });

  const updateLine = (key, field, value) =>
    setLines((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const grnNo = generateGrnId(po.id, po.grns || []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const receivedItems = pendingItems
      .filter((item) => Number(lines[item.materialId ?? item.name]?.qty) > 0)
      .map((item) => {
        const k = item.materialId ?? item.name;
        return {
          materialId: item.materialId,
          name: item.name,
          qty: Number(lines[k].qty),
          condition: lines[k].condition,
          remarks: lines[k].remarks,
          unit: item.unit,
        };
      });
    if (receivedItems.length === 0) return;
    receivePurchaseOrder(po.contractId, po.id, receivedItems, {
      receivedOn: header.receivedOn,
      receivedBy: header.receivedBy,
      challanNo: header.challanNo,
      remarks: header.remarks,
    });
    window.dispatchEvent(new Event("leadDataChanged"));
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col font-manrope">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bordergray shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-textcolor">Goods Receipt Note</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {grnNo} · {po.id} · {po.vendorName || "—"} · {po.clientName || "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-soft text-text-muted hover:text-textcolor transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Receipt header fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  GRN No
                </label>
                <input
                  value={grnNo}
                  disabled
                  className="w-full text-[12px] border border-bordergray rounded-lg px-3 py-2 bg-bg-soft text-text-muted"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Receipt Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={header.receivedOn}
                  onChange={(e) => setHeader((h) => ({ ...h, receivedOn: e.target.value }))}
                  className="w-full text-[12px] border border-bordergray rounded-lg px-3 py-2 focus:outline-none focus:border-select-blue"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Received By <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  placeholder="Name"
                  value={header.receivedBy}
                  onChange={(e) => setHeader((h) => ({ ...h, receivedBy: e.target.value }))}
                  className="w-full text-[12px] border border-bordergray rounded-lg px-3 py-2 focus:outline-none focus:border-select-blue"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                  Challan / DC No
                </label>
                <input
                  placeholder="Delivery challan ref"
                  value={header.challanNo}
                  onChange={(e) => setHeader((h) => ({ ...h, challanNo: e.target.value }))}
                  className="w-full text-[12px] border border-bordergray rounded-lg px-3 py-2 focus:outline-none focus:border-select-blue"
                />
              </div>
            </div>

            {/* Line items table */}
            <div className="rounded-xl border border-bordergray overflow-x-auto">
              <table className="w-full text-[11.5px] min-w-[700px]">
                <thead>
                  <tr className="bg-bg-soft text-text-muted text-[10px] uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5 font-bold">#</th>
                    <th className="text-left px-3 py-2.5 font-bold">Material</th>
                    <th className="text-right px-3 py-2.5 font-bold">Ordered</th>
                    <th className="text-right px-3 py-2.5 font-bold">Prev. Received</th>
                    <th className="text-right px-3 py-2.5 font-bold">Remaining</th>
                    <th className="text-right px-3 py-2.5 font-bold w-28">Now Receiving</th>
                    <th className="text-left px-3 py-2.5 font-bold w-36">Condition</th>
                    <th className="text-left px-3 py-2.5 font-bold">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingItems.map((item, i) => {
                    const k = item.materialId ?? item.name;
                    const ordered = Number(item.qty) || 0;
                    const prev = receivedSoFar[k] || 0;
                    const remaining = ordered - prev;
                    const line = lines[k] || { qty: "", condition: "Good", remarks: "" };
                    return (
                      <tr key={k} className="border-t border-bordergray hover:bg-bg-soft/40">
                        <td className="px-3 py-2.5 text-text-muted tabular-nums">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-textcolor leading-tight">{item.name}</p>
                          {item.spec && (
                            <p className="text-[10px] text-text-muted mt-0.5">{item.spec}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-textcolor">
                          {ordered} <span className="text-text-muted">{item.unit}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-text-muted">{prev}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-600">
                          {remaining}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={line.qty}
                            onChange={(e) => updateLine(k, "qty", e.target.value)}
                            className="w-full text-[12px] text-right border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-select-blue tabular-nums"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={line.condition}
                            onChange={(e) => updateLine(k, "condition", e.target.value)}
                            className="w-full text-[11.5px] border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-select-blue bg-white"
                          >
                            {CONDITIONS.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            value={line.remarks}
                            onChange={(e) => updateLine(k, "remarks", e.target.value)}
                            placeholder="Optional"
                            className="w-full text-[11.5px] border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-select-blue"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Overall remarks */}
            <div>
              <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Overall Remarks
              </label>
              <textarea
                rows={2}
                value={header.remarks}
                onChange={(e) => setHeader((h) => ({ ...h, remarks: e.target.value }))}
                placeholder="Any general notes about this delivery..."
                className="w-full text-[12px] border border-bordergray rounded-lg px-3 py-2 focus:outline-none focus:border-select-blue resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="shrink-0 px-6 py-4 border-t border-bordergray flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-bordergray text-[12px] font-semibold text-text-muted hover:bg-bg-soft transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              <CheckCircle2 size={13} /> Save GRN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GRNReceiptModal;
