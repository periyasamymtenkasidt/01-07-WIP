import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, PackageCheck, Printer, Download, ChevronDown, ChevronUp } from "lucide-react";
import {
  getPurchaseOrderById,
} from "../../data/procurementStorage";
import GRNReceiptModal from "./GRNReceiptModal";
import { getVendor } from "../../data/vendorStorage";
import { inrToWords } from "../../utils/numberToWords";
import wipLogo from "../../assets/images/Logo.png";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// Full-page PO detail. The PO is an outward document issued to the vendor, so it
// renders as a print-friendly letterhead document (`po-print-area`) that can be
// printed or saved as PDF via the browser dialog. Interactive controls (back,
// receive, print) sit in `modal-no-print` regions so they're excluded from the
// printout.
const PoDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [expandedGrn, setExpandedGrn] = useState(new Set());
  // version bumps force a localStorage re-read after receiving goods.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const po = useMemo(() => getPurchaseOrderById(id), [id, version]);
  const vendor = useMemo(
    () => (po?.vendorId ? getVendor(po.vendorId) : null),
    [po?.vendorId],
  );

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

  const toggleGrn = (id) =>
    setExpandedGrn((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const CONDITION_STYLE = {
    Good: "bg-emerald-100 text-emerald-700",
    "Short Supplied": "bg-amber-100 text-amber-700",
    Damaged: "bg-red-100 text-red-700",
    Rejected: "bg-red-200 text-red-800",
  };

  const vendorAddress = vendor?.address || "";

  // GST summary. Calculate total GST by summing the tax for each line item
  // based on its actual GST rate (defaulting to 18%).
  const basicTotal = Number(po.total) || 0;
  const totalGst = Math.round((po.items || []).reduce((sum, l) => {
    const qty = Number(l.qty) || 0;
    const rate = Number(l.rate) || 0;
    const gstRate = l.gst !== undefined ? Number(l.gst) : 18;
    return sum + (qty * rate * gstRate) / 100;
  }, 0));
  const cgst = Math.round(totalGst / 2);
  const sgst = totalGst - cgst;
  const grandTotal = basicTotal + totalGst;

  const uniqueGstRates = Array.from(new Set((po.items || []).map(l => l.gst !== undefined ? Number(l.gst) : 18)));
  const isUniformGst = uniqueGstRates.length === 1;
  const uniformGstRate = isUniformGst ? uniqueGstRates[0] : null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Action bar (not printed) ─────────────────────────────────────── */}
      <div className="modal-no-print shrink-0 flex items-center justify-between flex-wrap gap-3 px-6 py-4 bg-overallbg border-b border-bordergray">
        <button
          onClick={() => navigate("/procurement?tab=purchase-orders")}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor"
        >
          <ArrowLeft size={14} /> Back to Purchase Orders
        </button>
        <div className="flex items-center gap-2">
          {po.status !== "received" && (
            <button
              onClick={() => setShowGrnModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700"
            >
              <PackageCheck size={13} /> Record GRN
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-bordergray rounded-lg text-[12px] font-semibold text-textcolor hover:bg-bg-soft"
            title="Save as PDF via the print dialog"
          >
            <Download size={13} /> Save as PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
          >
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      {/* ── Scrollable content area ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {/* ── Printable PO document ────────────────────────────────────────── */}
      <div className="po-print-area bg-white border border-bordergray rounded-2xl shadow-sm p-8 mx-auto max-w-[210mm]">
        {/* Letterhead — WIP Architecture branding */}
        <div className="flex justify-between items-start pb-6 border-b border-black/15">
          {/* Logo + Company info — horizontal layout */}
          <div className="flex items-start gap-4 border border-paleorange rounded-xl px-4 py-3">
            <img
              src={wipLogo}
              alt="WIP"
              className="h-16 w-auto object-contain shrink-0"
              style={{
                filter:
                  "contrast(1.2) saturate(1.15) drop-shadow(0 1px 2px rgba(139, 105, 20, 0.12))",
              }}
            />
            <div className="space-y-0.5 pt-0.5">
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-4 h-px bg-paleorange" />
                <p className="text-[8px] uppercase tracking-[0.2em] text-dark-yellow font-semibold leading-none pt-1.5">
                  Architecture · Interiors
                </p>
              </div>
              <p className="text-[10.5px] text-gray-600 leading-snug pt-1.5">
                303, Manickam Avenue, TTK road,<br></br>Alwarpet, Chennai-600018
                <br></br>
              </p>
              <p className="text-gray-400 italic text-[10px]">
                GSTIN - 33AVZPV7602H1ZX
              </p>
            </div>
          </div>

          {/* Document meta */}
          <div className="text-right leading-none">
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Purchase Order
            </p>
            <p className="text-[15px] font-bold tracking-[0.18em] text-select-blue mt-2 pb-1.5">
              {po.id}
            </p>
            <div className="flex justify-between gap-3 text-[10px] ">
              <dt className="text-text-muted">Order Date</dt>
              <dd className="text-textcolor font-medium">
                {fmtDate(po.createdAt)}
              </dd>
            </div>
            {po.expectedOn && (
              <div className="flex justify-between gap-3 text-[10px] mt-1">
                <dt className="text-text-muted">Committed Delivery Date</dt>
                <dd className="text-textcolor font-medium">
                  {fmtDate(po.expectedOn)}
                </dd>
              </div>
            )}
            <div className="mt-2">
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[po.status] || "bg-gray-100 text-gray-500"}`}
              >
                {String(po.status).replace(/_/g, " ")}
              </span>
            </div>
          </div>
        </div>

        {/* Vendor + order meta cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="rounded-xl border border-bordergray bg-bg-soft/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle mb-1.5">
              Vendor
            </p>
            <p className="text-[13.5px] font-semibold text-textcolor">
              {po.vendorName || vendor?.name || "—"}
            </p>
            <div className="mt-1 space-y-0.5">
              {vendor?.contactPerson && (
                <p className="text-[11px] text-text-muted">
                  {vendor.contactPerson}
                </p>
              )}
              {vendorAddress && (
                <p className="text-[11px] text-text-muted">{vendorAddress}</p>
              )}
              {(vendor?.phone || vendor?.email) && (
                <p className="text-[11px] text-text-muted">
                  {[vendor?.phone, vendor?.email].filter(Boolean).join(" · ")}
                </p>
              )}
              {vendor?.gstin && (
                <p className="text-[11px] text-text-muted">
                  GSTIN: {vendor.gstin}
                </p>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-bordergray bg-bg-soft/30 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle mb-1.5">
              Delivery Address
            </p>
            <dl className="space-y-1.5 text-[11.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Project Location:</dt>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Contact Details:</dt>
              </div>
            </dl>
          </div>
        </div>

        {/* Line items */}
        <div className="mt-6 rounded-xl border border-bordergray overflow-hidden">
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="bg-bg-soft text-text-muted text-[10px] uppercase tracking-wider">
                <th className="text-left font-bold px-3 py-2.5 w-8">#</th>
                <th className="text-left font-bold px-3 py-2.5">Material</th>
                <th className="text-left font-bold px-3 py-2.5">Spec</th>
                <th className="text-right font-bold px-3 py-2.5">Qty</th>
                <th className="text-left font-bold px-3 py-2.5">Unit</th>
                <th className="text-right font-bold px-3 py-2.5">Rate</th>
                <th className="text-center font-bold px-3 py-2.5">GST</th>
                <th className="text-right font-bold px-3 py-2.5">Amount</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((l, i) => (
                <tr key={i} className="border-t border-bordergray">
                  <td className="px-3 py-2.5 tabular-nums text-text-muted">
                    {i + 1}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-textcolor">
                    {l.name}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">
                    {l.spec || "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-textcolor">
                    {l.qty}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{l.unit}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-textcolor">
                    {fmtINR(l.rate)}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-text-muted">
                    {l.gst !== undefined ? `${l.gst}%` : "18%"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold text-textcolor">
                    {fmtINR(l.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer: amount-in-words + note + signature (left) beside the tax
            summary (right) — two columns so the page height stays compact. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-6 items-stretch">
          <div className="flex flex-col">
            <div className="rounded-xl border border-bordergray bg-bg-soft/30 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle mb-1">
                Amount in Words
              </p>
              <p className="text-[12px] font-semibold text-textcolor leading-snug">
                {inrToWords(grandTotal)}
              </p>
            </div>
            
          </div>

          <div className="self-start rounded-xl border border-bordergray overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-bg-soft/40">
              <span className="text-[12px] font-semibold text-text-muted">
                Basic Total (ex-GST)
              </span>
              <span className="text-[12px] font-bold text-textcolor tabular-nums">
                {fmtINR(basicTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-bordergray">
              <span className="text-[12px] text-text-muted">
                {isUniformGst ? `CGST @ ${uniformGstRate / 2}%` : "CGST"}
              </span>
              <span className="text-[12px] text-textcolor tabular-nums">
                {fmtINR(cgst)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-bordergray">
              <span className="text-[12px] text-text-muted">
                {isUniformGst ? `SGST @ ${uniformGstRate / 2}%` : "SGST"}
              </span>
              <span className="text-[12px] text-textcolor tabular-nums">
                {fmtINR(sgst)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-bordergray">
              <span className="text-[12px] font-semibold text-text-muted">
                Total GST
              </span>
              <span className="text-[12px] font-bold text-textcolor tabular-nums">
                {fmtINR(totalGst)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-white">
              <span className="text-[12px] font-bold uppercase tracking-wider">
                Grand Total
              </span>
              <span className="text-[16px] font-bold tabular-nums">
                {fmtINR(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Signature — separate full-width line below the grand total */}
        <div className="flex justify-start mt-12 ">
          <div className="text-center">
            <div className="w-52 border-t border-textcolor/40 pt-1.5 text-[11px] font-semibold text-textcolor">
              Authorised Signatory
            </div>
            <p className="text-[10px] text-text-subtle mt-0.5">
              WIP Architecture
            </p>
          </div>
        </div>
        <p className="text-[10px] text-text-subtle leading-relaxed mt-3 text-center">
          This is a system-generated purchase order
        </p>
      </div>

      {/* ── GRN History (non-print) ──────────────────────────────────────── */}
      {(po.grns || []).length > 0 && (
        <div className="modal-no-print mt-6 mx-auto max-w-[210mm]">
          <h3 className="text-[13px] font-bold text-textcolor mb-3">
            GRN History ({po.grns.length})
          </h3>
          <div className="space-y-2">
            {po.grns.map((grn, i) => {
              const grnId =
                grn.id || `${po.id}-GRN-${String(i + 1).padStart(2, "0")}`;
              const isOpen = expandedGrn.has(grnId);
              return (
                <div
                  key={grnId}
                  className="bg-white border border-bordergray rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleGrn(grnId)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg-soft/50 transition-colors cursor-pointer"
                  >
                    <div>
                      <span className="text-[12px] font-bold text-textcolor">
                        {grnId}
                      </span>
                      <span className="text-[11px] text-text-muted ml-3">
                        {grn.receivedOn
                          ? new Date(grn.receivedOn).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}{" "}
                        · Received by:{" "}
                        <span className="font-semibold text-textcolor">
                          {grn.receivedBy || "—"}
                        </span>
                        {grn.challanNo && ` · DC: ${grn.challanNo}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-text-muted">
                        {grn.receivedItems?.length || 0} item
                        {(grn.receivedItems?.length || 0) !== 1 ? "s" : ""}
                      </span>
                      {isOpen ? (
                        <ChevronUp size={13} className="text-text-muted" />
                      ) : (
                        <ChevronDown size={13} className="text-text-muted" />
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-bordergray">
                      <table className="w-full text-[11.5px]">
                        <thead>
                          <tr className="bg-bg-soft text-text-muted text-[10px] uppercase tracking-wider">
                            <th className="text-left px-4 py-2 font-bold">Material</th>
                            <th className="text-right px-4 py-2 font-bold">Qty</th>
                            <th className="text-left px-4 py-2 font-bold">Condition</th>
                            <th className="text-left px-4 py-2 font-bold">Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(grn.receivedItems || []).map((item, j) => (
                            <tr key={j} className="border-t border-bordergray">
                              <td className="px-4 py-2 font-semibold text-textcolor">
                                {item.name}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-textcolor">
                                {item.qty}{" "}
                                <span className="text-text-muted">{item.unit || ""}</span>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    CONDITION_STYLE[item.condition] ||
                                    "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  {item.condition || "Good"}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-text-muted">
                                {item.remarks || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {grn.remarks && (
                        <div className="px-4 py-2.5 border-t border-bordergray bg-bg-soft/30">
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
        </div>
      )}
      </div>

      {/* GRN Modal — fixed overlay, inside root div so JSX is valid */}
      {showGrnModal && (
        <GRNReceiptModal
          po={po}
          onClose={() => setShowGrnModal(false)}
          onSaved={() => {
            setShowGrnModal(false);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
};

export default PoDetail;