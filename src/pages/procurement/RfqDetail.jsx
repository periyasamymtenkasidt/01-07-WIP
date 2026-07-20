import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ArrowRight,
  Link2,
  Check,
  Send,
  CalendarDays,
} from "lucide-react";
import { listVendors } from "../../data/vendorStorage";
import {
  getRfqById,
  awardRfq,
  convertRfqToPo,
  updateRfqExpectedDeliveryDate,
} from "../../data/rfqStorage";

const fmtRate = (val) => {
  const n = Number(val);
  if (!val || isNaN(n) || n === 0) return "";
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
};

const RateCell = ({ value }) => (
  <input
    type="text"
    readOnly
    value={fmtRate(value) || "—"}
    className="w-28 border border-bordergray rounded-lg px-2 py-1 text-[12px] text-center bg-bg-soft text-textcolor cursor-default select-text"
  />
);

// Full-page RFQ detail — replaces the old compare modal. Shows an item ×
// vendor rate grid: staff key in quotes received by phone/email, or a vendor
// fills their own row via the public link (see VendorQuoteForm.jsx) which
// writes through the same recordVendorQuote() call. Save a vendor's quote,
// award the winner, then convert the awarded quote straight into a PO.
const RfqDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  // version bumps force a localStorage re-read after save/award/convert.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rfq = useMemo(() => getRfqById(id), [id, version]);
  const vendors = listVendors();
  const vendorName = (vid) =>
    vendors.find((v) => v.id === vid)?.name || "Unknown vendor";

  const [linkCopied, setLinkCopied] = useState(false);

  if (!rfq) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-subtle gap-3">
        <Send size={28} className="opacity-40" />
        <p className="text-[13px]">RFQ "{id}" not found.</p>
        <button
          onClick={() => navigate("/procurement?tab=rfqs")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <ArrowLeft size={13} /> Back to RFQs
        </button>
      </div>
    );
  }

  const vendorTotal = (vendorId) => {
    const q = rfq.quotes.find((q) => q.vendorId === vendorId);
    if (!q?.lines?.length) return 0;
    return rfq.items.reduce((sum, item, idx) => {
      const line = q.lines[idx];
      const rate = Number(line?.rate) || 0;
      const gst = Number(line?.gst) || 0;
      const basic = rate * (Number(item.qty) || 0);
      return sum + basic + (basic * gst) / 100;
    }, 0);
  };

  const award = (vendorId) => {
    awardRfq(rfq.contractId, rfq.id, vendorId);
    setVersion((v) => v + 1);
  };

  const convert = () => {
    const po = convertRfqToPo(rfq.contractId, rfq.id);
    if (po) navigate(`/procurement/po/${po.id}`);
  };

  const copyVendorLink = async () => {
    const url = `${window.location.origin}/vendor-quote/${rfq.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link to share with all vendors:", url);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const quotedTotals = rfq.quotes
    .filter((q) => q.quotedAt)
    .map((q) => vendorTotal(q.vendorId));
  const lowestTotal =
    quotedTotals.length > 1 ? Math.min(...quotedTotals) : null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <button
        onClick={() => navigate("/procurement?tab=rfqs")}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor mb-4"
      >
        <ArrowLeft size={14} /> Back to RFQs
      </button>

      <div className="bg-white border border-bordergray rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-bordergray">
          <div>
            <h1 className="text-[15px] font-bold text-textcolor">
              {rfq.id} — Compare Quotes
            </h1>
            <p className="text-[11px] text-text-muted">
              {rfq.clientName ? `${rfq.clientName} · ` : ""}
              {rfq.items.length} item{rfq.items.length === 1 ? "" : "s"} ·{" "}
              {rfq.quotes.length} vendor{rfq.quotes.length === 1 ? "" : "s"}{" "}
              invited
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold border cursor-pointer ${
                rfq.expectedDeliveryDate
                  ? "border-bordergray bg-bg-soft text-textcolor"
                  : "border-red-200 bg-red-50 text-red-600"
              }`}
              title="Click to change expected delivery date"
            >
              <CalendarDays size={13} className="shrink-0" />
              <span className="shrink-0">
                Expected&nbsp;
                {rfq.expectedDeliveryDate
                  ? new Date(rfq.expectedDeliveryDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : <span className="text-red-500">Not set</span>}
              </span>
              <input
                type="date"
                value={rfq.expectedDeliveryDate || ""}
                onChange={(e) => {
                  updateRfqExpectedDeliveryDate(rfq.contractId, rfq.id, e.target.value);
                  setVersion((v) => v + 1);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </label>
            {rfq.status !== "closed" && (
              <button
                onClick={copyVendorLink}
                title="One link for all vendors — each vendor uses their own PIN to identify themselves"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold border border-select-blue/30 text-select-blue hover:bg-select-blue/5"
              >
                {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
                {linkCopied ? "Link copied" : "Copy vendor link"}
              </button>
            )}
          </div>
        </div>

        <div className="p-6 overflow-auto">
          <table className="w-full text-[13px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left font-bold text-text-subtle text-[11px] uppercase px-2 py-2 sticky left-0 bg-white">
                  Item
                </th>
                {rfq.quotes.map((q) => {
                  const accessCode = vendors.find((v) => v.id === q.vendorId)?.accessCode;
                  return (
                    <th
                      key={q.vendorId}
                      className="text-center font-bold text-textcolor text-[12px] px-3 py-2 min-w-[140px]"
                    >
                      {vendorName(q.vendorId)}
                      {rfq.awardedVendorId === q.vendorId && (
                        <span className="block text-[9px] font-bold text-emerald-600 uppercase mt-0.5">
                          Awarded
                        </span>
                      )}
                      {accessCode && (
                        <span
                          className="block mt-1.5 mx-auto w-fit font-mono text-[11px] tracking-widest font-bold text-select-blue bg-select-blue/8 border border-select-blue/20 px-2 py-0.5 rounded"
                          title="Vendor's permanent access code — share once at onboarding"
                        >
                          {accessCode}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item, idx) => (
                <tr key={idx} className="border-t border-bordergray">
                  <td className="px-2 py-2 text-textcolor font-medium sticky left-0 bg-white">
                    {item.name}
                    <span className="block text-[10px] text-text-subtle">
                      {item.qty} {item.unit}
                    </span>
                  </td>
                  {rfq.quotes.map((q) => (
                    <td key={q.vendorId} className="px-3 py-2 text-center">
                      <RateCell value={q.lines[idx]?.rate ?? ""} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 border-bordergray">
                <td className="px-2 py-2 font-bold text-textcolor sticky left-0 bg-white">
                  Total
                </td>
                {rfq.quotes.map((q) => {
                  const total = vendorTotal(q.vendorId);
                  const isLowest =
                    q.quotedAt && lowestTotal !== null && total === lowestTotal;
                  return (
                    <td key={q.vendorId} className="px-3 py-2 text-center">
                      <span
                        className={`font-extrabold ${isLowest ? "text-emerald-600" : "text-textcolor"}`}
                      >
                        ₹{Math.round(total).toLocaleString("en-IN")}
                      </span>
                    </td>
                  );
                })}
              </tr>
              {(() => {
                const dates = rfq.quotes
                  .filter((q) => q.committedDeliveryDate)
                  .map((q) => q.committedDeliveryDate);
                const earliest = dates.length > 1 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
                return (
                  <tr className="border-t border-bordergray">
                    <td className="px-2 py-2 text-text-muted text-[11px] font-semibold sticky left-0 bg-white whitespace-nowrap">
                      Committed Delivery
                    </td>
                    {rfq.quotes.map((q) => {
                      const isEarliest = earliest && q.committedDeliveryDate === earliest;
                      const meetsExpected =
                        rfq.expectedDeliveryDate &&
                        q.committedDeliveryDate &&
                        q.committedDeliveryDate <= rfq.expectedDeliveryDate;
                      return (
                        <td key={q.vendorId} className="px-3 py-2 text-center">
                          {q.committedDeliveryDate ? (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-lg px-2 py-0.5 border ${
                                isEarliest
                                  ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  : meetsExpected === false
                                  ? "text-red-600 bg-red-50 border-red-200"
                                  : "text-text-muted bg-bg-soft border-bordergray"
                              }`}
                            >
                              <CalendarDays size={11} />
                              {new Date(q.committedDeliveryDate).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-subtle">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })()}
              <tr>
                <td className="px-2 py-2 sticky left-0 bg-white" />
                {rfq.quotes.map((q) => (
                  <td
                    key={q.vendorId}
                    className="px-3 py-2 text-center space-y-1"
                  >
                    {q.quotedAt &&
                      rfq.status !== "awarded" &&
                      rfq.status !== "closed" && (
                        <button
                          onClick={() => award(q.vendorId)}
                          className="w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center gap-1"
                        >
                          <Award size={12} /> Award
                        </button>
                      )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {rfq.status === "awarded" && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-bordergray bg-bg-soft">
            {!rfq.expectedDeliveryDate && (
              <p className="text-[11.5px] text-red-500 font-medium mr-auto">
                Expected Delivery Date is required before converting to PO.
              </p>
            )}
            <button
              onClick={convert}
              disabled={!rfq.expectedDeliveryDate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Convert to PO <ArrowRight size={14} />
            </button>
          </div>
        )}

        {rfq.status === "closed" && (
          <div className="flex items-center gap-2 px-6 py-4 border-t border-bordergray bg-emerald-50 text-emerald-700 text-[13px] font-semibold">
            <CheckCircle2 size={16} /> Converted to Purchase Order {rfq.poId}
          </div>
        )}
      </div>
    </div>
  );
};

export default RfqDetail;