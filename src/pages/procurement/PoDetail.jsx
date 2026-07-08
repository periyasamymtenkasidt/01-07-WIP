import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  Check,
  Truck,
  Printer,
  Download,
} from "lucide-react";
import {
  getPurchaseOrderById,
  receivePurchaseOrder,
} from "../../data/procurementStorage";
import { getVendor } from "../../data/vendorStorage";
import { getOrgProfile } from "../../data/orgProfile";
import { inrToWords } from "../../utils/numberToWords";

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
  // version bumps force a localStorage re-read after receiving goods.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const po = useMemo(() => getPurchaseOrderById(id), [id, version]);
  const vendor = useMemo(
    () => (po?.vendorId ? getVendor(po.vendorId) : null),
    [po?.vendorId],
  );
  const org = useMemo(() => getOrgProfile(), []);

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
      (po.items || []).map((l) => ({
        materialId: l.materialId,
        name: l.name,
        qty: l.qty,
      })),
    );
    window.dispatchEvent(new Event("leadDataChanged"));
    setVersion((v) => v + 1);
  };

  const orgAddress = [org.addressLine, org.city, org.state]
    .filter(Boolean)
    .join(", ");
  const vendorAddress = vendor?.address || "";

  // GST summary. PO lines carry no per-line tax, so tax is applied on the basic
  // ordered value at the standard 18% and split into CGST + SGST halves
  // (intra-state). Rounded halves so the parts always sum to the shown total.
  const GST_RATE = 18;
  const basicTotal = Number(po.total) || 0;
  const cgst = Math.round((basicTotal * (GST_RATE / 2)) / 100);
  const sgst = Math.round((basicTotal * (GST_RATE / 2)) / 100);
  const totalGst = cgst + sgst;
  const grandTotal = basicTotal + totalGst;

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* ── Action bar (not printed) ─────────────────────────────────────── */}
      <div className="modal-no-print flex items-center justify-between flex-wrap gap-3 mb-4">
        <button
          onClick={() => navigate("/procurement?tab=purchase-orders")}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor"
        >
          <ArrowLeft size={14} /> Back to Purchase Orders
        </button>
        <div className="flex items-center gap-2">
          {po.status !== "received" && (
            <button
              onClick={receiveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12px] font-semibold hover:bg-emerald-700"
            >
              <Check size={13} /> Receive all
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

      {/* ── Printable PO document ────────────────────────────────────────── */}
      <div className="po-print-area bg-white border border-bordergray rounded-2xl shadow-sm p-8 mx-auto max-w-[210mm]">
        {/* Letterhead */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-select-blue pb-5">
          <div className="flex items-start gap-3.5">
            {org.logoDataUrl ? (
              <img
                src={org.logoDataUrl}
                alt={org.name}
                className="h-14 w-14 rounded-lg object-contain border border-bordergray"
              />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-select-blue text-white flex items-center justify-center font-bold text-[20px]">
                {(org.name || "—").trim().charAt(0)}
              </div>
            )}
            <div className="space-y-0.5">
              <h1 className="text-[18px] font-bold text-textcolor leading-tight">
                {org.name}
              </h1>
              {org.tagline && (
                <p className="text-[10.5px] text-text-muted">{org.tagline}</p>
              )}
              {orgAddress && (
                <p className="text-[10.5px] text-text-muted pt-1">{orgAddress}</p>
              )}
              <p className="text-[10.5px] text-text-muted">
                {org.phone}
                {org.email ? ` · ${org.email}` : ""}
              </p>
              {org.gstin && (
                <p className="text-[10.5px] text-text-muted">GSTIN: {org.gstin}</p>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Purchase Order
            </p>
            <p className="text-[17px] font-bold text-select-blue tabular-nums mt-1">
              {po.id}
            </p>
            <span
              className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLE[po.status] || "bg-gray-100 text-gray-500"}`}
            >
              {String(po.status).replace(/_/g, " ")}
            </span>
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
              Order Details
            </p>
            <dl className="space-y-1.5 text-[11.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Order Date</dt>
                <dd className="text-textcolor font-medium">
                  {fmtDate(po.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Expected Delivery</dt>
                <dd className="text-textcolor font-medium">
                  {fmtDate(po.expectedOn)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-muted">Project</dt>
                <dd className="text-textcolor font-medium">
                  {po.clientName || "—"}
                </dd>
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
                  <td className="px-3 py-2.5 text-text-muted">{l.spec || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-textcolor">
                    {l.qty}
                  </td>
                  <td className="px-3 py-2.5 text-text-muted">{l.unit}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-textcolor">
                    {fmtINR(l.rate)}
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
            <p className="text-[10px] text-text-subtle leading-relaxed mt-3">
              This is a system-generated purchase order. Please supply the above
              materials to the project site by the expected delivery date.
            </p>
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
                CGST @ {GST_RATE / 2}%
              </span>
              <span className="text-[12px] text-textcolor tabular-nums">
                {fmtINR(cgst)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-bordergray">
              <span className="text-[12px] text-text-muted">
                SGST @ {GST_RATE / 2}%
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
        <div className="flex justify-start mt-12">
          <div className="text-center">
            <div className="w-52 border-t border-textcolor/40 pt-1.5 text-[11px] font-semibold text-textcolor">
              Authorised Signatory
            </div>
            <p className="text-[10px] text-text-subtle mt-0.5">{org.name}</p>
          </div>
        </div>
      </div>

      {/* ── Goods received history (internal — not printed) ──────────────── */}
      <div className="modal-no-print bg-white border border-bordergray rounded-xl p-4 mt-5 mx-auto max-w-[210mm]">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-text-subtle mb-3 flex items-center gap-1.5">
          <Truck size={13} /> Goods Received History
        </h3>
        {(po.grns || []).length === 0 ? (
          <p className="text-[12px] text-text-subtle">
            Nothing received against this PO yet.
          </p>
        ) : (
          <div className="space-y-2">
            {po.grns.map((g, i) => (
              <div
                key={i}
                className="text-[12px] text-text-muted border-t border-bordergray pt-2 first:border-t-0 first:pt-0"
              >
                <span className="font-semibold text-textcolor">
                  {fmtDate(g.receivedOn)}
                </span>{" "}
                — {g.receivedItems.map((r) => `${r.name} (${r.qty})`).join(", ")}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PoDetail;
