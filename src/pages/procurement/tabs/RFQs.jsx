import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import { listAllRfqs } from "../../../data/rfqStorage";
import RfqFormModal from "../RfqFormModal";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  sent: "bg-blue-100 text-blue-700",
  quoted: "bg-amber-100 text-amber-700",
  awarded: "bg-purple-100 text-purple-700",
  closed: "bg-emerald-100 text-emerald-700",
};

const RFQs = () => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const refresh = () => setVersion((v) => v + 1);
  // version bumps force a localStorage re-read after create/quote/award/convert.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rfqs = useMemo(() => listAllRfqs(), [version]);

  const lowestQuote = (rfq) => {
    const quoted = rfq.quotes.filter((q) => q.quotedAt);
    if (quoted.length === 0) return null;
    return Math.min(...quoted.map((q) => q.total));
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-text-muted">
          {rfqs.length} RFQ{rfqs.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <Plus size={14} /> New RFQ
        </button>
      </div>

      <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
              <th className="text-left font-bold px-4 py-3">RFQ</th>
              <th className="text-left font-bold px-4 py-3">Project</th>
              <th className="text-center font-bold px-4 py-3">Items</th>
              <th className="text-center font-bold px-4 py-3">Vendors</th>
              <th className="text-right font-bold px-4 py-3">Lowest Quote</th>
              <th className="text-center font-bold px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rfqs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-text-subtle">
                  <Send size={22} className="mx-auto mb-2 opacity-50" />
                  No RFQs yet. Send one from Take-off or create one here.
                </td>
              </tr>
            ) : (
              rfqs.map((r) => {
                const lowest = lowestQuote(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => navigate(`/procurement/rfq/${r.id}`)}
                    className="border-t border-bordergray hover:bg-bg-soft/40 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-semibold text-textcolor">{r.id}</td>
                    <td className="px-4 py-3 text-text-muted">{r.clientName || "—"}</td>
                    <td className="px-4 py-3 text-center text-text-muted">
                      {r.items?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-center text-text-muted">
                      {r.quotes?.length || 0}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-textcolor">
                      {lowest != null ? fmtINR(lowest) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[r.status] || "bg-gray-100 text-gray-500"}`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <RfqFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={refresh}
      />
    </div>
  );
};

export default RFQs;
