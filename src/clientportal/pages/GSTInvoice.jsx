import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FileText, Printer, Eye } from "lucide-react";

const GSTInvoice = () => {
  const { client, milestones, formatAmount } = useOutletContext();
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Filter milestones that are paid to display generated invoices
  const paidMilestones = milestones.filter((m) => m.status === "paid");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 flex-1 text-left">
      <div className="border-b border-gray-100 pb-3 flex justify-between items-center">
        <h3 className="text-[14px] font-bold text-darkgray uppercase tracking-wider">GST Invoices</h3>
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100">
          {paidMilestones.length} Generated
        </span>
      </div>

      {paidMilestones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-gray-100 shadow-inner">
            <FileText className="text-gray-400" size={24} />
          </div>
          <p className="text-[14px] font-bold text-text mb-1">No Invoices Available</p>
          <p className="text-[13px] text-text-muted">
            Invoices will be automatically generated and made available for download here once milestone payments are completed.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {paidMilestones.map((m) => {
            const base = m.base ?? Math.round(m.total / 1.18);
            const gstAmt = m.gstAmt ?? Math.round(base * 0.18);
            const cgst = Math.round(gstAmt / 2);
            const sgst = Math.round(gstAmt / 2);
            const invoiceNo = `WIP-INV-2026-${String(m.id).padStart(3, "0")}`;

            return (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-bordergray rounded-[20px] shadow-sm hover:border-blue-100 hover:bg-palewhite transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                    <FileText size={18} />
                  </div>
                  <div className="text-left">
                    <h4 className="font-extrabold text-darkgray text-sm leading-snug">
                      {invoiceNo}
                    </h4>
                    <p className="text-[11px] text-text-subtle mt-0.5">
                      Milestone: {m.name} · Paid Date: {m.paidDate || "15.05.2026"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 mt-4 sm:mt-0 justify-between sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-extrabold text-darkgray">
                      {formatAmount(m.total)}
                    </p>
                    <p className="text-[10px] text-emerald-600 font-bold">
                      GST Included (18%)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedInvoice({ ...m, invoiceNo, base, gstAmt, cgst, sgst })}
                      className="py-2 px-3.5 bg-palewhite hover:bg-bg-soft text-grey hover:text-darkgray border border-bordergray hover:border-border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Eye size={13} />
                      View Invoice
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-8 shadow-2xl border border-slate-100 relative max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none">
            {/* Printable Invoice Sheet */}
            <div id="invoice-sheet" className="space-y-6 text-left">
              {/* Header */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-5">
                <div>
                  <h2 className="text-xl font-extrabold text-darkgray">Work In Progress</h2>
                  <p className="text-xs text-text-subtle mt-1">Interior Design & Project Management Solutions</p>
                  <p className="text-xs text-text-subtle">GSTIN: 29AAFCS9821M1ZC</p>
                </div>
                <div className="text-right">
                  <span className="px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold text-[10px] uppercase">
                    Tax Invoice
                  </span>
                  <p className="text-[13px] font-bold text-darkgray mt-2">{selectedInvoice.invoiceNo}</p>
                  <p className="text-xs text-text-subtle mt-0.5">Date: {selectedInvoice.paidDate || "15.05.2026"}</p>
                </div>
              </div>

              {/* Bill To & Bill From */}
              <div className="grid grid-cols-2 gap-6 text-xs">
                <div>
                  <p className="font-bold text-grey uppercase tracking-wider mb-2">Billed To</p>
                  <p className="font-bold text-darkgray text-[13px]">{client.clientName}</p>
                  <p className="text-text-subtle mt-1">{client.location || "Bengaluru, Karnataka"}</p>
                  <p className="text-text-subtle">Phone: {client.phone || "—"}</p>
                  <p className="text-text-subtle">Email: {client.email || "—"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-grey uppercase tracking-wider mb-2">Payment Mode</p>
                  <p className="font-bold text-darkgray">Bank Transfer (NEFT/RTGS)</p>
                  <p className="text-text-subtle mt-1">Ref: {selectedInvoice.paymentReference || "TXN587123984"}</p>
                  <p className="text-text-subtle">Bank: {selectedInvoice.paymentBank || "HDFC Bank"}</p>
                </div>
              </div>

              {/* Table of items */}
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-y border-slate-100 font-bold text-slate-700">
                    <th className="py-2.5 px-3 text-left">Description</th>
                    <th className="py-2.5 px-3 text-right">Taxable Value</th>
                    <th className="py-2.5 px-3 text-right">CGST (9%)</th>
                    <th className="py-2.5 px-3 text-right">SGST (9%)</th>
                    <th className="py-2.5 px-3 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-100 text-darkgray">
                    <td className="py-4 px-3 font-semibold text-left">
                      Interior Design Works Milestone: {selectedInvoice.name}
                    </td>
                    <td className="py-4 px-3 text-right font-medium">{formatAmount(selectedInvoice.base)}</td>
                    <td className="py-4 px-3 text-right font-medium">{formatAmount(selectedInvoice.cgst)}</td>
                    <td className="py-4 px-3 text-right font-medium">{formatAmount(selectedInvoice.sgst)}</td>
                    <td className="py-4 px-3 text-right font-extrabold text-dark-blue">{formatAmount(selectedInvoice.total)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Total Calculation */}
              <div className="flex justify-end pt-4">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Taxable Value</span>
                    <span className="font-medium text-darkgray">{formatAmount(selectedInvoice.base)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-subtle">Total GST (18%)</span>
                    <span className="font-medium text-darkgray">{formatAmount(selectedInvoice.gstAmt)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-sm">
                    <span className="text-darkgray">Grand Total</span>
                    <span className="text-dark-blue font-extrabold">{formatAmount(selectedInvoice.total)}</span>
                  </div>
                </div>
              </div>

              {/* Footer Declaration */}
              <div className="border-t border-slate-100 pt-4 text-[10px] text-text-subtle leading-relaxed">
                <p className="font-bold">Declaration:</p>
                <p>We declare that this invoice shows the actual price of the goods or services described and that all particulars are true and correct.</p>
                <p className="mt-2 text-center text-slate-400">This is a computer-generated tax invoice and requires no physical signature.</p>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex gap-3 mt-8 print:hidden">
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="flex-1 py-2.5 border border-bordergray hover:bg-slate-50 rounded-full text-xs font-bold text-grey transition-all"
              >
                Close
              </button>
              <button
                onClick={handlePrint}
                className="flex-1 py-2.5 bg-purple hover:bg-dark-blue text-white rounded-full text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GSTInvoice;
