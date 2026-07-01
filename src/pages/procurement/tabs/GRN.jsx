import { useState, useMemo } from "react";
import { Truck, Check } from "lucide-react";
import {
  listAllPurchaseOrders,
  receivePurchaseOrder,
} from "../../../data/procurementStorage";

// Goods Received Notes — POs awaiting receipt. Receiving a PO marks its lines
// as delivered; once everything is in, the PO flips to "received".

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const GRN = () => {
  const [version, setVersion] = useState(0);
  // version bumps force a localStorage re-read after receiving goods.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = useMemo(() => listAllPurchaseOrders(), [version]);
  const open = all.filter((p) => p.status !== "received");

  const receiveAll = (po) => {
    receivePurchaseOrder(
      po.contractId,
      po.id,
      (po.items || []).map((l) => ({
        materialId: l.materialId,
        name: l.name,
        qty: l.qty,
      })),
    );
    window.dispatchEvent(new Event("leadDataChanged"));
    setVersion((v) => v + 1);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <p className="text-[13px] text-text-muted mb-4">
        {open.length} purchase order{open.length === 1 ? "" : "s"} awaiting goods
        receipt.
      </p>

      {open.length === 0 ? (
        <div className="text-center py-12 text-text-subtle">
          <Truck size={24} className="mx-auto mb-2 opacity-50" />
          Nothing awaiting receipt. All purchase orders are fully received.
        </div>
      ) : (
        <div className="space-y-3">
          {open.map((po) => (
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
                  {(po.items?.length || 0) > 1 ? "s" : ""} · {fmtINR(po.total)}
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
                  onClick={() => receiveAll(po)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700"
                >
                  <Check size={13} /> Receive all
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GRN;
