import { useState, useMemo } from "react";
import { Truck, PackageCheck, ChevronDown, ChevronUp } from "lucide-react";
import {
  listAllPurchaseOrders,
  listAllGrns,
} from "../../../data/procurementStorage";
import GRNReceiptModal from "../GRNReceiptModal";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Sum received value for a GRN by matching each received item's qty × PO rate.
const grnValue = (grn) => {
  const rateMap = {};
  (grn.poItems || []).forEach((item) => {
    rateMap[item.materialId ?? item.name] = Number(item.rate) || 0;
  });
  return (grn.receivedItems || []).reduce((sum, r) => {
    const rate = rateMap[r.materialId ?? r.name] || 0;
    return sum + (Number(r.qty) || 0) * rate;
  }, 0);
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const CONDITION_STYLE = {
  Good: "bg-emerald-100 text-emerald-700",
  "Short Supplied": "bg-amber-100 text-amber-700",
  Damaged: "bg-red-100 text-red-700",
  Rejected: "bg-red-200 text-red-800",
};

const GRN = () => {
  const [tab, setTab] = useState("pending");
  const [version, setVersion] = useState(0);
  const [grnModal, setGrnModal] = useState(null);
  const [expanded, setExpanded] = useState(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allPos = useMemo(() => listAllPurchaseOrders(), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allGrns = useMemo(() => listAllGrns(), [version]);

  const pending = allPos.filter((p) => p.status !== "received");

  const toggleExpand = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSaved = () => {
    setGrnModal(null);
    setVersion((v) => v + 1);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5 px-6 py-3 border-b border-bordergray shrink-0">
        <button
          onClick={() => setTab("pending")}
          className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all ${
            tab === "pending"
              ? "bg-active-bg text-select-blue"
              : "text-text-muted hover:text-textcolor"
          }`}
        >
          Pending Receipt{pending.length > 0 ? ` (${pending.length})` : ""}
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all ${
            tab === "history"
              ? "bg-active-bg text-select-blue"
              : "text-text-muted hover:text-textcolor"
          }`}
        >
          GRN History{allGrns.length > 0 ? ` (${allGrns.length})` : ""}
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {/* ── Pending Receipt tab ────────────────────────────────────────── */}
        {tab === "pending" && (
          <>
            {pending.length === 0 ? (
              <div className="text-center py-16 text-text-subtle">
                <Truck size={26} className="mx-auto mb-3 opacity-40" />
                <p className="text-[13px] font-medium">All purchase orders are fully received.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pending.map((po) => {
                  const prevGrns = po.grns?.length || 0;
                  return (
                    <div
                      key={po.id}
                      className="bg-white border border-bordergray rounded-xl p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-textcolor">
                          {po.id} · {po.vendorName || "—"}
                        </p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          {po.clientName} · {po.items?.length || 0} item
                          {(po.items?.length || 0) !== 1 ? "s" : ""} ·{" "}
                          {fmtINR(po.total)}
                          {prevGrns > 0 &&
                            ` · ${prevGrns} GRN${prevGrns > 1 ? "s" : ""} recorded`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            po.status === "partially_received"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {String(po.status).replace(/_/g, " ")}
                        </span>
                        <button
                          onClick={() => setGrnModal(po)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-select-blue hover:bg-blue-950 text-white text-[12px] font-semibold transition-colors cursor-pointer"
                        >
                          <PackageCheck size={13} /> Record GRN
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── GRN History tab ────────────────────────────────────────────── */}
        {tab === "history" && (
          <>
            {allGrns.length === 0 ? (
              <div className="text-center py-16 text-text-subtle">
                <PackageCheck size={26} className="mx-auto mb-3 opacity-40" />
                <p className="text-[13px] font-medium">No GRNs recorded yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {allGrns.map((grn) => {
                  const isOpen = expanded.has(grn.id);
                  return (
                    <div
                      key={grn.id}
                      className="bg-white border border-bordergray rounded-xl overflow-hidden"
                    >
                      {/* Summary row */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(grn.id)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-bg-soft/50 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-textcolor">
                              {grn.id}
                            </span>
                            <span className="text-[11px] text-text-muted">· {grn.poId}</span>
                            <span className="text-[11px] text-text-muted">
                              · {grn.vendorName}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            {grn.clientName} · {fmtDate(grn.receivedOn)} · Received
                            by: <span className="font-semibold text-textcolor">{grn.receivedBy || "—"}</span>
                            {grn.challanNo && ` · DC: ${grn.challanNo}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                          <span className="text-[11px] text-text-muted">
                            {grn.receivedItems?.length || 0} item
                            {(grn.receivedItems?.length || 0) !== 1 ? "s" : ""}
                          </span>
                          <span className="text-[12px] font-bold text-textcolor tabular-nums">
                            {fmtINR(grnValue(grn))}
                          </span>
                          {isOpen ? (
                            <ChevronUp size={14} className="text-text-muted" />
                          ) : (
                            <ChevronDown size={14} className="text-text-muted" />
                          )}
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="border-t border-bordergray">
                          <table className="w-full text-[11.5px]">
                            <thead>
                              <tr className="bg-bg-soft text-text-muted text-[10px] uppercase tracking-wider">
                                <th className="text-left px-4 py-2 font-bold">Material</th>
                                <th className="text-right px-4 py-2 font-bold">Qty Received</th>
                                <th className="text-left px-4 py-2 font-bold">Condition</th>
                                <th className="text-left px-4 py-2 font-bold">Remarks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(grn.receivedItems || []).map((item, i) => (
                                <tr key={i} className="border-t border-bordergray">
                                  <td className="px-4 py-2.5 font-semibold text-textcolor">
                                    {item.name}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-textcolor">
                                    {item.qty}{" "}
                                    <span className="text-text-muted">{item.unit || ""}</span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        CONDITION_STYLE[item.condition] ||
                                        "bg-gray-100 text-gray-600"
                                      }`}
                                    >
                                      {item.condition || "Good"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-text-muted">
                                    {item.remarks || "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {grn.remarks && (
                            <div className="px-4 py-3 border-t border-bordergray bg-bg-soft/30">
                              <p className="text-[11px] text-text-muted">
                                <span className="font-semibold text-textcolor">
                                  Overall Remarks:
                                </span>{" "}
                                {grn.remarks}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* GRN creation modal */}
      {grnModal && (
        <GRNReceiptModal
          po={grnModal}
          onClose={() => setGrnModal(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

export default GRN;
