import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Package } from "lucide-react";
import { listAllPurchaseOrders } from "../../../data/procurementStorage";
import PoFormModal from "../PoFormModal";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

const FILTERS = [
  { id: "active", label: "Active", test: (p) => p.status !== "received" },
  { id: "received", label: "Received", test: (p) => p.status === "received" },
  { id: "all", label: "All", test: () => true },
];

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState("active");
  // version bumps force a localStorage re-read after creating a PO.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pos = useMemo(() => listAllPurchaseOrders(), [version]);

  const activeCount = pos.filter(FILTERS[0].test).length;
  const filtered = pos.filter(FILTERS.find((f) => f.id === filter).test);
  const totalValue = filtered.reduce((s, p) => s + (Number(p.total) || 0), 0);

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all ${
                filter === f.id
                  ? "bg-active-bg text-select-blue"
                  : "text-text-muted hover:text-textcolor"
              }`}
            >
              {f.label}
              {f.id === "active" && activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          ))}
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <Plus size={14} /> Create PO
        </button>
      </div>

      <p className="text-[13px] text-text-muted mb-3">
        {filtered.length} purchase order{filtered.length === 1 ? "" : "s"} ·{" "}
        <span className="font-semibold text-textcolor">{fmtINR(totalValue)}</span>
      </p>

      <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
              <th className="text-left font-bold px-4 py-3">PO</th>
              <th className="text-left font-bold px-4 py-3">Project</th>
              <th className="text-left font-bold px-4 py-3">Vendor</th>
              <th className="text-center font-bold px-4 py-3">Items</th>
              <th className="text-right font-bold px-4 py-3">Total</th>
              <th className="text-center font-bold px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-subtle">
                  <Package size={22} className="mx-auto mb-2 opacity-50" />
                  No purchase orders in this view.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/procurement/po/${p.id}`)}
                  className="border-t border-bordergray hover:bg-bg-soft/40 cursor-pointer"
                >
                  <td className="px-4 py-3 font-semibold text-textcolor">
                    {p.id}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{p.clientName || "—"}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {p.vendorName || "—"}
                  </td>
                  <td className="px-4 py-3 text-center text-text-muted">
                    {p.items?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-textcolor">
                    {fmtINR(p.total)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[p.status] || "bg-gray-100 text-gray-500"}`}
                    >
                      {String(p.status).replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <PoFormModal
        open={modal}
        onClose={() => setModal(false)}
        onSaved={() => setVersion((v) => v + 1)}
      />
    </div>
  );
};

export default PurchaseOrders;
