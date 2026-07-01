import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Award, CheckCircle2, ArrowRight, Link2, Check, Send } from "lucide-react";
import { listVendors } from "../../data/vendorStorage";
import {
  getRfqById,
  recordVendorQuote,
  awardRfq,
  convertRfqToPo,
} from "../../data/rfqStorage";

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
  const vendorName = (vid) => vendors.find((v) => v.id === vid)?.name || "Unknown vendor";

  const seedFromRfq = (r) => {
    const seedRates = {};
    const seedNotes = {};
    (r?.quotes || []).forEach((q) => {
      seedRates[q.vendorId] = {};
      // Match by array position, not name/materialId — every quote's lines
      // are always built via items.map(...) in the same order as rfq.items,
      // so this is exact. Matching by name breaks when two items share a
      // name (e.g. same material, different spec), silently misattributing
      // one item's rate to another and under-counting the displayed total.
      r.items.forEach((item, idx) => {
        const existing = q.lines[idx];
        seedRates[q.vendorId][idx] = existing ? String(existing.rate) : "";
      });
      seedNotes[q.vendorId] = q.notes || "";
    });
    return { seedRates, seedNotes };
  };

  const [seededFor, setSeededFor] = useState(null);
  const [rates, setRates] = useState({}); // { [vendorId]: { [itemIdx]: rateString } }
  const [notes, setNotes] = useState({});
  const [expectedOn, setExpectedOn] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Re-seed the rate grid (during render, not an effect) only when navigating
  // to a different RFQ — NOT on every save/award version bump, otherwise an
  // in-progress edit for one vendor would be wiped out by saving another's.
  if (rfq && seededFor !== rfq.id) {
    const { seedRates, seedNotes } = seedFromRfq(rfq);
    setSeededFor(rfq.id);
    setRates(seedRates);
    setNotes(seedNotes);
  }

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

  const setRate = (vendorId, idx, val) =>
    setRates((r) => ({ ...r, [vendorId]: { ...r[vendorId], [idx]: val } }));

  const vendorTotal = (vendorId) =>
    rfq.items.reduce((sum, item, idx) => {
      const rate = Number(rates[vendorId]?.[idx]) || 0;
      return sum + rate * (Number(item.qty) || 0);
    }, 0);

  const saveQuote = (vendorId) => {
    const lines = rfq.items.map((item, idx) => ({
      materialId: item.materialId,
      name: item.name,
      spec: item.spec,
      qty: item.qty,
      unit: item.unit,
      rate: Number(rates[vendorId]?.[idx]) || 0,
    }));
    recordVendorQuote(rfq.contractId, rfq.id, vendorId, {
      lines,
      notes: notes[vendorId] || "",
    });
    setVersion((v) => v + 1);
  };

  const award = (vendorId) => {
    awardRfq(rfq.contractId, rfq.id, vendorId);
    setVersion((v) => v + 1);
  };

  const convert = () => {
    const po = convertRfqToPo(rfq.contractId, rfq.id, { expectedOn });
    if (po) navigate(`/procurement/po/${po.id}`);
  };

  const copyVendorLink = async () => {
    const url = `${window.location.origin}/vendor-quote/${rfq.id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link to send to vendors:", url);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const quotedTotals = rfq.quotes.filter((q) => q.quotedAt).map((q) => vendorTotal(q.vendorId));
  const lowestTotal = quotedTotals.length > 1 ? Math.min(...quotedTotals) : null;

  return (
    <div className="h-full overflow-y-auto p-6">
      <button
        onClick={() => navigate("/procurement?tab=rfqs")}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor mb-4"
      >
        <ArrowLeft size={14} /> Back to RFQs
      </button>

      <div className="bg-white border border-bordergray rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-bordergray">
          <div>
            <h1 className="text-[15px] font-bold text-textcolor">{rfq.id} — Compare Quotes</h1>
            <p className="text-[11px] text-text-muted">
              {rfq.clientName ? `${rfq.clientName} · ` : ""}
              {rfq.items.length} item{rfq.items.length === 1 ? "" : "s"} ·{" "}
              {rfq.quotes.length} vendor{rfq.quotes.length === 1 ? "" : "s"} invited
            </p>
          </div>
          {rfq.status !== "closed" && (
            <button
              onClick={copyVendorLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold border border-select-blue/30 text-select-blue hover:bg-select-blue/5"
              title="Copy a link vendors can open to submit their own quote"
            >
              {linkCopied ? <Check size={13} /> : <Link2 size={13} />}
              {linkCopied ? "Link copied" : "Copy vendor quote link"}
            </button>
          )}
        </div>

        <div className="p-6 overflow-auto">
          <table className="w-full text-[13px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="text-left font-bold text-text-subtle text-[11px] uppercase px-2 py-2 sticky left-0 bg-white">
                  Item
                </th>
                {rfq.quotes.map((q) => (
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
                  </th>
                ))}
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
                      <input
                        type="number"
                        value={rates[q.vendorId]?.[idx] ?? ""}
                        onChange={(e) => setRate(q.vendorId, idx, e.target.value)}
                        disabled={rfq.status === "closed"}
                        placeholder="Rate"
                        className="w-24 border border-bordergray rounded-lg px-2 py-1 text-[12px] text-center disabled:bg-bg-soft"
                      />
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
                  const isLowest = q.quotedAt && lowestTotal !== null && total === lowestTotal;
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
              <tr>
                <td className="px-2 py-2 sticky left-0 bg-white" />
                {rfq.quotes.map((q) => (
                  <td key={q.vendorId} className="px-3 py-2 text-center space-y-1">
                    {rfq.status !== "closed" && (
                      <button
                        onClick={() => saveQuote(q.vendorId)}
                        className="w-full px-2 py-1.5 rounded-lg text-[11px] font-semibold text-select-blue border border-select-blue/30 hover:bg-select-blue/5"
                      >
                        Save Quote
                      </button>
                    )}
                    {q.quotedAt && rfq.status !== "awarded" && rfq.status !== "closed" && (
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
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-bordergray bg-bg-soft">
            <label className="text-[12px] font-semibold text-text-muted flex items-center gap-2">
              Expected delivery
              <input
                type="date"
                value={expectedOn}
                onChange={(e) => setExpectedOn(e.target.value)}
                className="border border-bordergray rounded-lg px-3 py-2 text-[13px] bg-white"
              />
            </label>
            <button
              onClick={convert}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950"
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
