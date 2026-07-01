import React, { useState, useEffect } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";

const PaymentMilestones = () => {
  const {
    client,
    milestones,
    setMilestones,
    totalContract,
    totalCollected,
    paidCount,
    formatAmount,
    site,
    updateSite,
    addClientNotification
  } = useOutletContext();

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const highlightId = searchParams.get("highlight");

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentBank, setPaymentBank] = useState("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  const handleOpenPayment = (m) => {
    setSelectedMilestone(m);
    setPaymentReference("");
    setPaymentBank("");
    setIsPaymentSuccess(false);
    setPaymentModalOpen(true);
  };

  useEffect(() => {
    if (highlightId && milestones && milestones.length > 0) {
      const targetMilestone = milestones.find((m) => m.id === highlightId);
      if (targetMilestone && targetMilestone.status !== "paid") {
        handleOpenPayment(targetMilestone);
      }
    }
  }, [highlightId, milestones]);

  const handleSubmitPayment = (e) => {
    e.preventDefault();
    if (!paymentReference || !paymentBank) return;

    setIsSubmittingPayment(true);
    setTimeout(() => {
      setIsSubmittingPayment(false);
      setIsPaymentSuccess(true);
      
      const today = new Date();
      const paidDate = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;
      
      const updated = milestones.map((m) =>
        m.id === selectedMilestone.id ? { ...m, status: "paid", paidDate, paymentReference, paymentBank } : m
      );
      
      setMilestones(updated);
      localStorage.setItem(`clientMilestones_${client.clientID}`, JSON.stringify(updated));

      // Handle revision activation if this milestone is a revision milestone
      if (selectedMilestone.isRevision && site && updateSite) {
        let updatedRevisions = [...(site.revisions || [])];
        let activatedRevNumber = "";
        let updatedDrawings = [...(site.drawings || [])];

        if (selectedMilestone.pendingRevisionData) {
          const newRev = {
            ...selectedMilestone.pendingRevisionData,
            status: "Pending",
            paymentStatus: "Paid",
            isPaid: true,
            amount: selectedMilestone.base || selectedMilestone.total
          };
          updatedRevisions.push(newRev);
          activatedRevNumber = newRev.revisionNumber;

          // Update drawing status if applicable
          if (newRev.drawingId) {
            updatedDrawings = updatedDrawings.map(d => {
              if (d.id === newRev.drawingId) {
                return {
                  ...d,
                  status: "Under Review",
                  reviewer: "Client",
                  reviewDate: paidDate,
                  reviewComments: newRev.notes || "Changes requested (paid revision)."
                };
              }
              return d;
            });
          }
        } else if (selectedMilestone.revisionId) {
          // Fallback compatibility
          updatedRevisions = updatedRevisions.map(r => {
            if (r.id === selectedMilestone.revisionId) {
              activatedRevNumber = r.revisionNumber;
              return {
                ...r,
                status: "Pending",
                paymentStatus: "Paid"
              };
            }
            return r;
          });
        }

        const dateStr = new Date().toLocaleDateString("en-IN");
        const timestampStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        const systemComment = {
          id: `comm-sys-pay-ms-${Date.now()}`,
          author: "System",
          text: `💳 **Payment Received via Milestones:** Paid revision payment of ${formatAmount(selectedMilestone.total)} cleared for Revision ${activatedRevNumber || ''}. Revision request created and redesign work assigned to design team.`,
          timestamp: `${paidDate} ${timestampStr}`,
          attachments: []
        };

        const updatedSite = {
          ...site,
          designStatus: "In Progress", // Move back to redesign
          drawings: updatedDrawings,
          revisions: updatedRevisions,
          discussionHistory: [...(site.discussionHistory || []), systemComment],
          activities: [
            {
              id: `act-pay-ms-${Date.now()}`,
              text: `Payment cleared for Revision ${activatedRevNumber || ''}. Revision created and work moved to Redesign.`,
              user: "System",
              timestamp: `${timestampStr} ${paidDate}`
            },
            ...(site.activities || [])
          ]
        };
        updateSite(updatedSite);

        if (addClientNotification) {
          addClientNotification(
            "Revision Payment Confirmed",
            `Payment cleared for Revision ${activatedRevNumber || ''}. Revision created and designers assigned.`,
            "success"
          );
        }
      }

      if (updated.every((m) => m.status === "paid")) {
        const savedClients = localStorage.getItem("newClientsData");
        let newClients = savedClients ? JSON.parse(savedClients) : [];
        const idx = newClients.findIndex((c) => c.clientID === client.clientID);
        if (idx >= 0) {
          newClients[idx] = { ...newClients[idx], paymentStatus: "completed" };
        }
        localStorage.setItem("newClientsData", JSON.stringify(newClients));
      }
      
      setTimeout(() => {
        setPaymentModalOpen(false);
      }, 1000);
    }, 1500);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between">
      <div>
        {/* Summary progress card - Textual Only */}
        <div className="mb-6 p-5 rounded-[16px] bg-[#E9E9FF]/20 border border-border text-left">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">
                Total Payable (incl. GST)
              </p>
              <p className="text-[22px] font-bold text-dark-blue font-sans">
                {formatAmount(totalContract)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-0.5">
                Collected
              </p>
              <p className="text-[22px] font-bold text-emerald-600 font-sans">
                {formatAmount(totalCollected)}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-[12px] text-text-muted">
            <span>Milestones Progression</span>
            <span className="font-bold text-darkgray">{paidCount} of {milestones.length} Paid</span>
          </div>
        </div>

        {/* Milestone rows */}
        <div className="flex flex-col gap-3.5 text-left">
          {milestones.map((m, idx) => {
            const isPaid = m.status === "paid";
            const prevRegularMilestones = milestones.slice(0, idx).filter(pm => !pm.isRevision);
            const isPreviousPaid = m.isRevision || prevRegularMilestones.length === 0 || prevRegularMilestones[prevRegularMilestones.length - 1].status === "paid";
            const base = m.base ?? m.amount ?? 0;
            const gstAmt = m.gstAmt ?? Math.round(base * 0.18);
            const total = m.total ?? base + gstAmt;
            const revisionNum = m.revisionNum || String(m.pendingRevisionData?.revisionNumber || "").replace(/v/i, "");

            return (
              <div
                key={m.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-[16px] border transition-all ${
                  m.id === highlightId
                    ? "ring-2 ring-purple shadow-[0_0_15px_rgba(147,51,234,0.45)] border-purple bg-purple/5"
                    : isPaid
                      ? "bg-emerald-50/40 border-emerald-100"
                      : !isPreviousPaid
                        ? "bg-gray-50/70 border-gray-100 opacity-60 cursor-not-allowed select-none"
                        : "bg-white border-border hover:border-blue-100 hover:bg-palewhite"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold border-2 ${
                      isPaid
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-white border-gray-200 text-gray-400"
                    }`}
                  >
                    {isPaid ? <Check size={14} strokeWidth={3} /> : (m.isRevision ? "R" : idx + 1)}
                  </div>
                  <div>
                    <h4 className="font-bold text-darkgray text-xs sm:text-[13.5px]">
                      {m.name}
                    </h4>
                    <p className="text-[10px] text-text-subtle mt-0.5">
                      {m.isRevision 
                        ? `Design Revision Milestone · Base: ${formatAmount(base)} · GST (${m.gstAmt ? Math.round((m.gstAmt/m.base)*100) : 18}%): ${formatAmount(gstAmt)}` 
                        : `${m.pct}% of project value · Base: ${formatAmount(base)} · GST (18%): ${formatAmount(gstAmt)}`
                      }
                    </p>
                    {m.isRevision && (
                      <p className="text-[10px] text-amber-600 font-extrabold mt-0.5">
                        Revision #{revisionNum || "-"} - Status: {isPaid ? "Paid" : "Pending Payment"}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                  <span className="text-xs sm:text-sm font-extrabold text-darkgray font-sans">
                    {formatAmount(total)}
                  </span>
                  {isPaid ? (
                    <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                      Paid on {m.paidDate || "15.05.2026"}
                    </span>
                  ) : (
                    <button
                      disabled={!isPreviousPaid}
                      onClick={() => handleOpenPayment(m)}
                      className={`text-[11px] font-extrabold px-3 py-1 rounded-lg border transition-all cursor-pointer ${
                        !isPreviousPaid
                          ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-purple hover:bg-dark-blue text-white border-purple hover:border-dark-blue shadow-sm"
                      }`}
                    >
                      Pay Now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Project execution tracker timeline at bottom */}
      <div className="mt-8 pt-6 border-t border-gray-100 text-left">
        <h4 className="text-[13px] font-bold text-darkgray uppercase tracking-wider mb-5">Project Execution Phase</h4>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { title: "Design Signoff", desc: "Drawings approved", completed: true },
            { title: "Procurement", desc: "Material sourced", completed: true },
            { title: "First Fix", desc: "Carpentry & Electrical", completed: true },
            { title: "Finishing", desc: "Paint & Veneer", completed: false },
            { title: "Handover", desc: "Final delivery", completed: false }
          ].map((step, idx) => (
            <div key={idx} className="flex flex-col items-center text-center p-3 rounded-2xl bg-slate-50 border border-gray-100">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border text-[11px] font-bold ${
                step.completed ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-gray-300 text-text-subtle"
              }`}>
                {step.completed ? <Check size={12} strokeWidth={3} /> : idx + 1}
              </div>
              <p className={`text-xs font-bold mt-2 ${step.completed ? 'text-darkgray' : 'text-text-subtle'}`}>{step.title}</p>
              <p className="text-[9.5px] text-text-subtle mt-0.5 leading-tight">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment Confirmation Modal */}
      {paymentModalOpen && selectedMilestone && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 text-left relative overflow-hidden animate-fade-in">
            {isPaymentSuccess ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 animate-scale-up">
                  <Check size={32} strokeWidth={3} />
                </div>
                <h3 className="text-xl font-bold text-darkgray mb-2">Payment Logged Successfully!</h3>
                <p className="text-sm text-text-subtle">Your payment update is being processed by our accounts team.</p>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-extrabold text-darkgray mb-2">Log Milestone Payment</h3>
                <p className="text-xs text-text-subtle mb-4">
                  Log bank transfer details for <span className="font-bold text-darkgray">{selectedMilestone.name}</span>.
                </p>
                <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-subtle">Amount to Pay</span>
                    <span className="font-bold text-darkgray">{formatAmount(selectedMilestone.total)}</span>
                  </div>
                </div>
                <form onSubmit={handleSubmitPayment} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-grey uppercase tracking-wider">Transaction Reference ID</label>
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="E.g. TXN9876543210"
                      className="w-full text-xs border border-bordergray rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-purple"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-grey uppercase tracking-wider">Originating Bank Name</label>
                    <input
                      type="text"
                      required
                      value={paymentBank}
                      onChange={(e) => setPaymentBank(e.target.value)}
                      placeholder="E.g. HDFC Bank, ICICI Bank"
                      className="w-full text-xs border border-bordergray rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-purple"
                    />
                  </div>
                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setPaymentModalOpen(false)}
                      className="flex-1 py-2.5 border border-bordergray hover:bg-slate-50 rounded-full text-xs font-bold text-grey transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="flex-1 py-2.5 bg-purple hover:bg-dark-blue text-white rounded-full text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingPayment ? (
                        <>
                          <Loader2 className="animate-spin" size={14} />
                          Processing...
                        </>
                      ) : (
                        "Submit Reference"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentMilestones;
