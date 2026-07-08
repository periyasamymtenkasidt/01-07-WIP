import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileX, Send, ArrowLeft, X } from "lucide-react";
import { getRfqById, recordVendorQuote } from "../../data/rfqStorage";
import { listVendors } from "../../data/vendorStorage";
import NumericInput from "../../components/NumericInput";
import wipLogo from "../../assets/images/Logo.png";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Public, no-login page reached via a shared link (copied from the RFQ
// compare screen). A vendor opens it, identifies themselves from the list of
// vendors actually invited on this RFQ (not the full vendor master), keys in
// their rate per material, and submits — which is recorded the same way a
// staff-entered quote is, so it shows up immediately in the compare grid.
const Shell = ({ children }) => (
  <div className="h-screen bg-overallbg font-sans flex flex-col items-center py-10 px-4 overflow-hidden">
    <img src={wipLogo} alt="" className="h-9 mb-6 object-contain shrink-0" />
    <div className="w-full max-w-2xl flex-1 min-h-0">{children}</div>
  </div>
);

// Small success modal that appears after submitting a quote.
const SuccessModal = ({ open, onClose, rfqId, vendorName }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-[fadeInScale_0.25s_ease-out]">
        <div className="flex items-center justify-end px-4 pt-3">
          <button
            onClick={onClose}
            className="text-text-muted hover:text-textcolor transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-1 text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <h3 className="text-[15px] font-bold text-textcolor mb-1">
            Quote Submitted Successfully
          </h3>
          <p className="text-[12.5px] text-text-muted leading-relaxed">
            Your quote for <span className="font-semibold text-textcolor">{rfqId}</span> has been
            recorded{vendorName ? ` for ${vendorName}` : ""}. You can update it
            any time before the request is awarded.
          </p>
        </div>
        <div className="px-6 pb-5 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

const VendorQuoteForm = () => {
  const { rfqId } = useParams();
  const [version, setVersion] = useState(0);
  // version bumps force a re-read of the RFQ after this vendor submits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rfq = useMemo(() => getRfqById(rfqId), [rfqId, version]);
  const vendors = listVendors();

  const invitedVendors = useMemo(() => {
    if (!rfq) return [];
    return rfq.quotes
      .map((q) => vendors.find((v) => v.id === q.vendorId))
      .filter(Boolean);
  }, [rfq, vendors]);

  const [vendorId, setVendorId] = useState("");
  const [rates, setRates] = useState({});
  const [notes, setNotes] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);

  if (!rfq) {
    return (
      <Shell>
        <div className="bg-white border border-bordergray rounded-2xl p-8 text-center">
          <FileX size={26} className="mx-auto mb-3 text-text-subtle" />
          <h1 className="text-[15px] font-bold text-textcolor">Link not found</h1>
          <p className="text-[12.5px] text-text-muted mt-1">
            This quote request link is invalid, or the request no longer exists.
          </p>
        </div>
      </Shell>
    );
  }

  const closed = rfq.status === "closed";

  const selectVendor = (id) => {
    const existing = rfq.quotes.find((q) => q.vendorId === id);
    const seeded = {};
    // Match by array position — lines are always built in the same order as
    // rfq.items, so this is exact (matching by name breaks when two items
    // share a name, e.g. same material in different specs).
    rfq.items.forEach((item, idx) => {
      const line = existing?.lines[idx];
      seeded[idx] = line ? String(line.rate) : "";
    });
    setVendorId(id);
    setRates(seeded);
    setNotes(existing?.notes || "");
    setShowSuccess(false);
  };

  const setRate = (idx, val) => setRates((r) => ({ ...r, [idx]: val }));

  const total = rfq.items.reduce(
    (sum, item, idx) => sum + (Number(rates[idx]) || 0) * (Number(item.qty) || 0),
    0,
  );

  const canSubmit = !closed && rfq.items.some((_, idx) => Number(rates[idx]) > 0);

  const submit = () => {
    if (!canSubmit) return;
    const lines = rfq.items.map((item, idx) => ({
      materialId: item.materialId,
      name: item.name,
      spec: item.spec,
      qty: item.qty,
      unit: item.unit,
      rate: Number(rates[idx]) || 0,
    }));
    recordVendorQuote(rfq.contractId, rfq.id, vendorId, { lines, notes });
    setVersion((v) => v + 1);
    setShowSuccess(true);
  };

  const currentVendorName = vendors.find((v) => v.id === vendorId)?.name || "";

  // Step 1 — identify which invited vendor you are.
  if (!vendorId) {
    return (
      <Shell>
        <div className="bg-white border border-bordergray rounded-2xl overflow-hidden h-full flex flex-col">
          {/* ── Header ── */}
          <div className="px-6 py-4 border-b border-bordergray bg-gradient-to-r from-select-blue/5 to-transparent shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center shrink-0">
                <Send size={14} />
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-textcolor leading-tight">
                  Quote Request {rfq.id}
                </h1>
                <p className="text-[11.5px] text-text-muted">
                  {rfq.clientName ? `Project: ${rfq.clientName} · ` : ""}
                  {rfq.items.length} material{rfq.items.length === 1 ? "" : "s"} requested
                </p>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="p-6 flex-1 min-h-0 overflow-y-auto scroll-hidden-bar">
            <p className="text-[12.5px] text-text-muted mb-4">
              Select your company to continue and submit your quotation.
            </p>
            {invitedVendors.length === 0 ? (
              <p className="text-[12.5px] text-text-subtle">No vendors were invited on this request.</p>
            ) : (
              <div className="space-y-2">
                {invitedVendors.map((v) => {
                  const q = rfq.quotes.find((qq) => qq.vendorId === v.id);
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVendor(v.id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-bordergray hover:border-select-blue/50 hover:bg-bg-soft/50 transition-all text-left"
                    >
                      <span className="text-[13px] font-semibold text-textcolor">{v.name}</span>
                      {q?.quotedAt && (
                        <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                          Already quoted
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-bordergray bg-bg-soft/40 shrink-0">
            <p className="text-[10.5px] text-text-subtle text-center">
              This is a secure quote submission portal. Your rates will only be visible to the requesting team.
            </p>
          </div>
        </div>
      </Shell>
    );
  }

  // Step 2 — fill / review the rate grid.
  return (
    <Shell>
      <div className="bg-white border border-bordergray rounded-2xl overflow-hidden h-full flex flex-col">
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-bordergray bg-gradient-to-r from-select-blue/5 to-transparent shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center shrink-0">
                <Send size={14} />
              </div>
              <div>
                <h1 className="text-[15px] font-bold text-textcolor leading-tight">
                  Quote Request {rfq.id}
                </h1>
                <p className="text-[11.5px] text-text-muted">
                  Quoting as{" "}
                  <span className="font-semibold text-textcolor">{currentVendorName}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVendorId("")}
              className="flex items-center gap-1 text-[11.5px] font-semibold text-text-muted hover:text-textcolor transition-colors"
            >
              <ArrowLeft size={12} /> Not you?
            </button>
          </div>
        </div>

        {closed && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-amber-700 text-[12.5px] font-semibold shrink-0">
            This request has already been awarded and closed — quotes can no longer be changed.
          </div>
        )}

        {/* ── Body — rate grid ── */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto overflow-x-auto scroll-hidden-bar">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
                <th className="text-left font-bold px-3 py-2.5 rounded-l-lg">Material</th>
                <th className="text-right font-bold px-3 py-2.5">Qty</th>
                <th className="text-left font-bold px-3 py-2.5">Unit</th>
                <th className="text-right font-bold px-3 py-2.5">Your Rate (₹)</th>
                <th className="text-right font-bold px-3 py-2.5 rounded-r-lg">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item, idx) => (
                <tr key={idx} className="border-t border-bordergray">
                  <td className="px-3 py-2.5 font-medium text-textcolor">
                    {item.name}
                    {item.spec && <span className="block text-[10.5px] text-text-subtle">{item.spec}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-text-muted">{item.qty}</td>
                  <td className="px-3 py-2.5 text-text-muted">{item.unit}</td>
                  <td className="px-3 py-2.5 text-right">
                    <NumericInput
                      value={rates[idx] ?? ""}
                      onChange={(val) => setRate(idx, val)}
                      disabled={closed}
                      placeholder="0"
                      className="w-24 border border-bordergray rounded-lg px-2 py-1.5 text-[13px] text-right disabled:bg-bg-soft"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-textcolor">
                    {fmtINR((Number(rates[idx]) || 0) * (Number(item.qty) || 0))}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-bordergray">
                <td colSpan={4} className="px-3 py-2.5 text-right font-bold text-textcolor">
                  Total
                </td>
                <td className="px-3 py-2.5 text-right font-extrabold text-textcolor">{fmtINR(total)}</td>
              </tr>
            </tbody>
          </table>

          <label className="block mt-4">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={closed}
              rows={2}
              placeholder="Delivery lead time, validity, terms…"
              className="mt-1 w-full border border-bordergray rounded-lg px-3 py-2 text-[12.5px] disabled:bg-bg-soft resize-none"
            />
          </label>
        </div>

        {/* ── Footer ── */}
        {!closed && (
          <div className="px-6 py-4 border-t border-bordergray bg-bg-soft/40 flex items-center justify-between shrink-0">
            <span className="text-[12px] text-text-muted">
              Total: <span className="font-bold text-textcolor">{fmtINR(total)}</span>
            </span>
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} /> Submit Quote
            </button>
          </div>
        )}

        {closed && (
          <div className="px-6 py-3 border-t border-bordergray bg-bg-soft/40 shrink-0">
            <p className="text-[10.5px] text-text-subtle text-center">
              This request has been closed. No further changes can be made.
            </p>
          </div>
        )}
      </div>

      {/* ── Success Modal ── */}
      <SuccessModal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        rfqId={rfq.id}
        vendorName={currentVendorName}
      />
    </Shell>
  );
};

export default VendorQuoteForm;
