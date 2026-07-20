import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, FileX, Send } from "lucide-react";
import { getRfqById, recordVendorQuote } from "../../data/rfqStorage";
import { listVendors, getVendorByAccessCode } from "../../data/vendorStorage";
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

// Confirmation modal before submitting.
const ConfirmModal = ({ open, onClose, onConfirm, rfqId }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-[fadeInScale_0.25s_ease-out]">
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-[15px] font-bold text-textcolor mb-2">
            Submit Quotation?
          </h3>
          <p className="text-[12.5px] text-text-muted leading-relaxed">
            Are you sure you want to submit this quotation for{" "}
            <span className="font-semibold text-textcolor">{rfqId}</span>? Once
            submitted, it will be shared with the procurement team.
          </p>
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:bg-bg-soft transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 transition-colors"
          >
            Confirm & Submit
          </button>
        </div>
      </div>
    </div>
  );
};

const VendorQuoteForm = () => {
  const { rfqId } = useParams();
  const rfq = useMemo(() => getRfqById(rfqId), [rfqId]);
  const vendors = listVendors();

  const [vendorId, setVendorId] = useState("");
  const [rates, setRates] = useState({});
  const [gsts, setGsts] = useState({});
  const [notes, setNotes] = useState("");
  const [committedDeliveryDate, setCommittedDeliveryDate] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  if (!rfq) {
    return (
      <Shell>
        <div className="bg-white border border-bordergray rounded-2xl p-8 text-center">
          <FileX size={26} className="mx-auto mb-3 text-text-subtle" />
          <h1 className="text-[15px] font-bold text-textcolor">
            Link not found
          </h1>
          <p className="text-[12.5px] text-text-muted mt-1">
            This quote request link is invalid, or the request no longer exists.
          </p>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <Shell>
        <div className="bg-white border border-bordergray rounded-2xl p-8 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3 text-emerald-500" />
          <h1 className="text-[15px] font-bold text-textcolor">
            Quote Submitted
          </h1>
          <p className="text-[12.5px] text-text-muted mt-2">
            Your quotation for{" "}
            <span className="font-semibold text-textcolor">{rfq.id}</span> has
            been received. The procurement team will be in touch.
          </p>
        </div>
      </Shell>
    );
  }

  const closed = rfq.status === "closed";

  const selectVendor = (id) => {
    const existing = rfq.quotes.find((q) => q.vendorId === id);
    const seededRates = {};
    const seededGsts = {};
    // Match by array position — lines are always built in the same order as
    // rfq.items, so this is exact (matching by name breaks when two items
    // share a name, e.g. same material in different specs).
    rfq.items.forEach((item, idx) => {
      const line = existing?.lines[idx];
      seededRates[idx] = line ? String(line.rate) : "";
      seededGsts[idx] = line ? String(line.gst ?? 18) : "18";
    });
    setVendorId(id);
    setRates(seededRates);
    setGsts(seededGsts);
    setNotes(existing?.notes || "");
  };

  const setRate = (idx, val) => setRates((r) => ({ ...r, [idx]: val }));
  const setGst = (idx, val) => setGsts((g) => ({ ...g, [idx]: val }));

  const total = rfq.items.reduce((sum, item, idx) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(rates[idx]) || 0;
    const gst = Number(gsts[idx]) || 0;
    return sum + qty * rate * (1 + gst / 100);
  }, 0);

  const today = new Date().toISOString().split("T")[0];
  const deliveryDateValid = !!committedDeliveryDate && committedDeliveryDate >= today;

  const canSubmit =
    !closed &&
    rfq.items.some((_, idx) => Number(rates[idx]) > 0) &&
    deliveryDateValid;

  const submit = () => {
    if (!canSubmit) return;
    setShowConfirm(true);
  };

  const handleConfirmSubmit = () => {
    setShowConfirm(false);
    const lines = rfq.items.map((item, idx) => ({
      materialId: item.materialId,
      name: item.name,
      spec: item.spec,
      qty: item.qty,
      unit: item.unit,
      rate: Number(rates[idx]) || 0,
      gst: Number(gsts[idx]) || 0,
    }));
    recordVendorQuote(rfq.contractId, rfq.id, vendorId, { lines, notes, committedDeliveryDate });
    setSubmitted(true);
  };

  const currentVendorName = vendors.find((v) => v.id === vendorId)?.name || "";

  const handlePinSubmit = (e) => {
    e.preventDefault();
    const matched = getVendorByAccessCode(pin);
    if (!matched) {
      setPinError("Invalid code. Please check and try again.");
      return;
    }
    const invited = rfq.quotes.find((q) => q.vendorId === matched.id);
    if (!invited) {
      setPinError("Your company is not invited on this quote request.");
      return;
    }
    setPinError("");
    selectVendor(matched.id);
  };

  // Step 1 — vendor identifies themselves with their PIN.
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
                  {rfq.items.length} material{rfq.items.length === 1 ? "" : "s"}{" "}
                  requested
                </p>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="p-6 flex-1 flex flex-col justify-center items-center gap-5">
            <div className="text-center">
              <p className="text-[13px] font-semibold text-textcolor">Enter your access code</p>
              <p className="text-[11.5px] text-text-muted mt-1">
                Your access code was shared by the procurement team when you were onboarded.
              </p>
            </div>
            <form onSubmit={handlePinSubmit} className="w-full max-w-xs space-y-3">
              <input
                type="text"
                value={pin}
                onChange={(e) => { setPin(e.target.value.toUpperCase()); setPinError(""); }}
                placeholder="e.g. GRE-4821"
                maxLength={8}
                autoFocus
                className="w-full text-center font-mono tracking-[0.3em] text-[18px] font-bold border border-bordergray rounded-xl px-4 py-3 bg-white focus:outline-none focus:border-select-blue uppercase"
              />
              {pinError && (
                <p className="text-[11.5px] text-red-500 text-center font-medium">{pinError}</p>
              )}
              <button
                type="submit"
                disabled={pin.trim().length < 6}
                className="w-full py-2.5 bg-select-blue hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[13px] font-semibold transition-colors"
              >
                Continue
              </button>
            </form>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-3 border-t border-bordergray bg-bg-soft/40 shrink-0">
            <p className="text-[10.5px] text-text-subtle text-center">
              This is a secure quote submission portal. Your rates will only be
              visible to the requesting team.
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
                  <span className="font-semibold text-textcolor">
                    {currentVendorName}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {closed && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-100 text-amber-700 text-[12.5px] font-semibold shrink-0">
            This request has already been awarded and closed — quotes can no
            longer be changed.
          </div>
        )}

        {/* ── Body — rate grid ── */}
        <div className="p-6 flex-1 min-h-0 overflow-y-auto overflow-x-auto scroll-hidden-bar">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
                <th className="text-left font-bold px-3 py-2.5 rounded-l-lg">
                  Material
                </th>
                <th className="text-right font-bold px-3 py-2.5">Qty</th>
                <th className="text-left font-bold px-3 py-2.5">Unit</th>
                <th className="text-right font-bold px-3 py-2.5">
                  Your Rate (₹)
                </th>
                <th className="text-center font-bold px-3 py-2.5">GST (%)</th>
                <th className="text-right font-bold px-3 py-2.5 rounded-r-lg">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item, idx) => {
                const qty = Number(item.qty) || 0;
                const rate = Number(rates[idx]) || 0;
                const gst = Number(gsts[idx]) || 0;
                const amount = qty * rate * (1 + gst / 100);

                return (
                  <tr key={idx} className="border-t border-bordergray">
                    <td className="px-3 py-2.5 font-medium text-textcolor">
                      {item.name}
                      {item.spec && (
                        <span className="block text-[10.5px] text-text-subtle">
                          {item.spec}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right text-text-muted">
                      {item.qty}
                    </td>
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
                    <td className="px-3 py-2.5 text-center">
                      <NumericInput
                        value={gsts[idx] ?? ""}
                        onChange={(val) => setGst(idx, val)}
                        disabled={closed}
                        placeholder="18"
                        className="w-16 border border-bordergray rounded-lg px-2 py-1.5 text-[13px] text-center disabled:bg-bg-soft"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-textcolor">
                      {fmtINR(amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-bordergray">
                <td
                  colSpan={5}
                  className="px-3 py-2.5 text-right font-bold text-textcolor"
                >
                  Total (incl. GST)
                </td>
                <td className="px-3 py-2.5 text-right font-extrabold text-textcolor">
                  {fmtINR(total)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Expected Delivery Date
              </span>
              <input
                type="date"
                value={rfq.expectedDeliveryDate || ""}
                readOnly
                className="mt-1 w-full border border-bordergray rounded-lg px-3 py-2 text-[12.5px] bg-bg-soft text-text-muted cursor-default select-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Committed Delivery Date <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                required
                min={today}
                value={committedDeliveryDate}
                onChange={(e) => setCommittedDeliveryDate(e.target.value)}
                disabled={closed}
                className={`mt-1 w-full border rounded-lg px-3 py-2 text-[12.5px] disabled:bg-bg-soft focus:outline-none focus:border-select-blue ${
                  committedDeliveryDate && !deliveryDateValid
                    ? "border-red-300 bg-red-50"
                    : "border-bordergray"
                }`}
              />
              {committedDeliveryDate && !deliveryDateValid && (
                <p className="mt-1 text-[11px] text-red-500 font-normal">
                  Delivery date cannot be in the past.
                </p>
              )}
            </label>
          </div>

          <label className="block mt-3">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
              Notes (optional)
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={closed}
              rows={2}
              placeholder="Validity, terms…"
              className="mt-1 w-full border border-bordergray rounded-lg px-3 py-2 text-[12.5px] disabled:bg-bg-soft resize-none"
            />
          </label>
        </div>

        {/* ── Footer ── */}
        {!closed && (
          <div className="px-6 py-4 border-t border-bordergray bg-bg-soft/40 flex items-center justify-between shrink-0">
            <span className="text-[12px] text-text-muted">
              Total:{" "}
              <span className="font-bold text-textcolor">{fmtINR(total)}</span>
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

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmSubmit}
        rfqId={rfq.id}
      />
    </Shell>
  );
};

export default VendorQuoteForm; 