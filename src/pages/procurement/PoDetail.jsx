import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Check, Truck } from "lucide-react";
import { getPurchaseOrderById, receivePurchaseOrder } from "../../data/procurementStorage";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Full-page PO detail — replaces having no click-through from the Purchase
// Orders list. Shows the line items, GRN (receipt) history, and lets staff
// mark the whole PO received without leaving the page.
const PoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  // version bumps force a localStorage re-read after receiving goods.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const po = useMemo(() => getPurchaseOrderById(id), [id, version]);

  if (!po) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-subtle gap-3">
        <Package size={28} className="opacity-40" />
        <p className="text-[13px]">Purchase order "{id}" not found.</p>
        <button
          onClick={() => navigate("/procurement?tab=purchase-orders")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <ArrowLeft size={13} /> Back to Purchase Orders
        </button>
      </div>
    );
  }

  const receiveAll = () => {
    receivePurchaseOrder(
      po.contractId,
      po.id,
      (po.items || []).map((l) => ({ materialId: l.materialId, name: l.name, qty: l.qty })),
    );
    window.dispatchEvent(new Event("leadDataChanged"));
    setVersion((v) => v + 1);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <button
        onClick={() => navigate("/procurement?tab=purchase-orders")}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor mb-4"
      >
        <ArrowLeft size={14} /> Back to Purchase Orders
      </button>

      <div className="bg-white border border-bordergray rounded-xl p-5 mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[16px] font-bold text-textcolor">{po.id}</h1>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[po.status] || "bg-gray-100 text-gray-500"}`}
            >
              {String(po.status).replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-[12px] text-text-muted">
            {po.clientName || "—"} · Vendor: {po.vendorName || "—"}
          </p>
          <p className="text-[11px] text-text-subtle mt-1">
            Created {fmtDate(po.createdAt)} · Expected {fmtDate(po.expectedOn)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-text-subtle font-semibold">Total</p>
          <p className="text-[18px] font-bold text-textcolor">{fmtINR(po.total)}</p>
          {po.status !== "received" && (
            <button
              onClick={receiveAll}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700"
            >
              <Check size={13} /> Receive all
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-bordergray rounded-xl overflow-hidden mb-5">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
              <th className="text-left font-bold px-4 py-3">Material</th>
              <th className="text-left font-bold px-4 py-3">Spec</th>
              <th className="text-right font-bold px-4 py-3">Qty</th>
              <th className="text-left font-bold px-4 py-3">Unit</th>
              <th className="text-right font-bold px-4 py-3">Rate</th>
              <th className="text-right font-bold px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(po.items || []).map((l, i) => (
              <tr key={i} className="border-t border-bordergray">
                <td className="px-4 py-3 font-semibold text-textcolor">{l.name}</td>
                <td className="px-4 py-3 text-text-muted">{l.spec || "—"}</td>
                <td className="px-4 py-3 text-right text-textcolor">{l.qty}</td>
                <td className="px-4 py-3 text-text-muted">{l.unit}</td>
                <td className="px-4 py-3 text-right text-textcolor">{fmtINR(l.rate)}</td>
                <td className="px-4 py-3 text-right font-bold text-textcolor">{fmtINR(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-bordergray rounded-xl p-4">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-subtle mb-3 flex items-center gap-1.5">
          <Truck size={13} /> Goods Received History
        </h3>
        {(po.grns || []).length === 0 ? (
          <p className="text-[12px] text-text-subtle">Nothing received against this PO yet.</p>
        ) : (
          <div className="space-y-2">
            {po.grns.map((g, i) => (
              <div key={i} className="text-[12px] text-text-muted border-t border-bordergray pt-2 first:border-t-0 first:pt-0">
                <span className="font-semibold text-textcolor">{fmtDate(g.receivedOn)}</span> —{" "}
                {g.receivedItems.map((r) => `${r.name} (${r.qty})`).join(", ")}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoDetail;
