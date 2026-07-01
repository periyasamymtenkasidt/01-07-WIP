import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileX, Send, ArrowLeft } from "lucide-react";
import { getRfqById, recordVendorQuote } from "../../data/rfqStorage";
import { listVendors } from "../../data/vendorStorage";
import wipLogo from "../../assets/images/Logo.png";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Public, no-login page reached via a shared link (copied from the RFQ
// compare screen). A vendor opens it, identifies themselves from the list of
// vendors actually invited on this RFQ (not the full vendor master), keys in
// their rate per material, and submits — which is recorded the same way a
// staff-entered quote is, so it shows up immediately in the compare grid.
const Shell = ({ children }) => (
  <div className="min-h-screen bg-overallbg font-sans flex flex-col items-center py-10 px-4">
    <img src={wipLogo} alt="" className="h-9 mb-6 object-contain" />
    <div className="w-full max-w-2xl">{children}</div>
  </div>
);

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
  const [justSubmitted, setJustSubmitted] = useState(false);

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
    setJustSubmitted(false);
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
    setJustSubmitted(true);
  };

  // Step 1 — identify which invited vendor you are.
  if (!vendorId) {
    return (
      <Shell>
        <div className="bg-white border border-bordergray rounded-2xl p-6">
          <h1 className="text-[15px] font-bold text-textcolor">Quote Request {rfq.id}</h1>
          <p className="text-[12.5px] text-text-muted mt-1 mb-5">
            {rfq.clientName ? `Project: ${rfq.clientName} · ` : ""}
            {rfq.items.length} material{rfq.items.length === 1 ? "" : "s"} requested.
            Select your company to continue.
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
      </Shell>
    );
  }

  // Step 2 — fill / review the rate grid.
  return (
    <Shell>
      <div className="bg-white border border-bordergray rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-bordergray flex items-center justify-between">
          <div>
            <h1 className="text-[15px] font-bold text-textcolor">Quote Request {rfq.id}</h1>
            <p className="text-[11.5px] text-text-muted">
              Quoting as <span className="font-semibold text-textcolor">{vendors.find((v) => v.id === vendorId)?.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVendorId("")}
            className="flex items-center gap-1 text-[11.5px] font-semibold text-text-muted hover:text-textcolor"
          >
            <ArrowLeft size={12} /> Not you?
          </button>
        </div>

        {justSubmitted && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-100 text-emerald-700 text-[12.5px] font-semibold flex items-center gap-2">
            <CheckCircle2 size={15} /> Quote submitted. You can update it below any time before it's awarded.
          </div>
        )}

        {closed && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-amber-700 text-[12.5px] font-semibold">
            This request has already been awarded and closed — quotes can no longer be changed.
          </div>
        )}

        <div className="p-6 overflow-x-auto">
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
                    <input
                      type="number"
                      value={rates[idx] ?? ""}
                      onChange={(e) => setRate(idx, e.target.value)}
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

        {!closed && (
          <div className="px-6 py-4 border-t border-bordergray flex items-center justify-end">
            <button
              onClick={submit}
              disabled={!canSubmit}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send size={14} /> Submit Quote
            </button>
          </div>
        )}
      </div>
    </Shell>
  );
};

export default VendorQuoteForm;
