import React, { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  FileText,
  Printer,
  Check,
  CheckCircle2,
  MessageSquarePlus,
  Clock,
  Loader2,
} from "lucide-react";
import QuotePreviewModal from "../../components/QuotePreviewModal";
import Modal from "../../components/Modal";
import { getQuotesForParent } from "../../data/QuotePresets";
import {
  respondToFinalQuote,
  isQuoteActionable,
} from "../../data/finalQuoteStorage";

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// Status pill for a quote as the client sees it.
const StatusBadge = ({ quote }) => {
  const map = {
    accepted: {
      label: "Accepted",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: <CheckCircle2 size={12} />,
    },
    changes_requested: {
      label: "Changes requested",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
      icon: <MessageSquarePlus size={12} />,
    },
  };
  const meta =
    map[quote.status] ||
    (isQuoteActionable(quote)
      ? {
          label: "Awaiting your approval",
          cls: "bg-blue-50 text-blue-700 border-blue-200",
          icon: <Clock size={12} />,
        }
      : {
          label: "Draft",
          cls: "bg-slate-50 text-slate-500 border-slate-200",
          icon: <FileText size={12} />,
        });
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10.5px] font-bold ${meta.cls}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
};

const ProjectQuotes = () => {
  const { client, formatAmount } = useOutletContext();
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState(null);

  const parentId = client.sourceLeadId || client.clientID;
  const [list, setList] = useState(() => getQuotesForParent(parentId));
  const refresh = () => setList(getQuotesForParent(parentId));

  // Accept / request-changes flow state.
  const [action, setAction] = useState(null); // { quote, type: "accept" | "request" }
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openAction = (quote, type) => {
    setName(client.clientName || quote.recipientName || "");
    setAgree(false);
    setComment("");
    setAction({ quote, type });
  };
  const closeAction = () => {
    if (submitting) return;
    setAction(null);
  };

  const submitAction = () => {
    if (!action) return;
    setSubmitting(true);
    const res = respondToFinalQuote(
      parentId,
      action.quote.quoteId,
      action.type === "accept" ? "accept" : "request",
      { name, comment },
    );
    setSubmitting(false);
    if (!res.ok) {
      setToast({ msg: res.error || "Something went wrong.", ok: false });
      return;
    }
    refresh();
    setAction(null);
    setToast({
      msg:
        action.type === "accept"
          ? "Quote accepted — your architect has been notified."
          : "Change request sent to your architect.",
      ok: true,
    });
  };

  const isAccept = action?.type === "accept";
  const canSubmit = isAccept ? !!name.trim() && agree : !!name.trim();

  return (
    <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-6">
          <h4 className="text-[14px] font-bold text-darkgray uppercase tracking-wider">
            Project Estimates & Quotes
          </h4>
          <span className="px-2.5 py-0.5 rounded-full bg-[#E9E9FF] text-select-blue text-[10px] font-bold">
            {list.length} Quotes
          </span>
        </div>

        {/* Quotes list */}
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-gray-100 shadow-inner">
              <FileText className="text-gray-400" size={24} />
            </div>
            <p className="text-[14px] font-bold text-text mb-1">No Estimates Yet</p>
            <p className="text-[13px] text-text-muted">
              Your finalized project quotation will appear here for download once released by the architect.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-left">
            {list.map((q) => {
              const grandTotal =
                q.grandTotal ||
                (q.scopeItems || []).reduce(
                  (s, it) => s + (Number(it.amount) || 0),
                  0,
                ) * 1.18;
              const actionable = isQuoteActionable(q);
              return (
                <div
                  key={q.quoteId}
                  className="p-5 bg-white border border-bordergray rounded-[20px] shadow-sm hover:border-blue-100 hover:bg-palewhite transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center text-purple shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-extrabold text-darkgray text-sm leading-snug">
                            {q.quoteId}
                          </h4>
                          <StatusBadge quote={q} />
                        </div>
                        <p className="text-[11px] text-text-subtle mt-0.5">
                          Created on {fmtDate(q.createdAt)} · {q.propertyType}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 justify-between sm:justify-end">
                      <div className="text-left sm:text-right">
                        <p className="text-sm font-extrabold text-darkgray">
                          {formatAmount(grandTotal)}
                        </p>
                        <p className="text-[10px] text-text-subtle">Incl. 18% GST</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedQuoteForPreview(q)}
                          className="py-2 px-3.5 bg-palewhite hover:bg-bg-soft text-grey hover:text-darkgray border border-bordergray hover:border-border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          Preview
                        </button>
                        <button
                          onClick={() => setSelectedQuoteForPreview(q)}
                          className="py-2 px-3.5 bg-purple hover:bg-dark-blue text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Printer size={13} />
                          Save PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Approval action bar */}
                  {actionable ? (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-[11.5px] text-text-muted">
                        {q.status === "changes_requested"
                          ? "You requested changes — your architect will revise and re-issue."
                          : "Please review and approve this quote to proceed, or request changes."}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => openAction(q, "request")}
                          className="py-2 px-3.5 bg-white hover:bg-bg-soft text-grey hover:text-darkgray border border-bordergray rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <MessageSquarePlus size={13} /> Request changes
                        </button>
                        <button
                          onClick={() => openAction(q, "accept")}
                          className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          <Check size={13} /> Accept quote
                        </button>
                      </div>
                    </div>
                  ) : q.status === "accepted" ? (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-[11.5px] text-emerald-700">
                      <CheckCircle2 size={14} className="shrink-0" />
                      <span>
                        Accepted by{" "}
                        <span className="font-bold">{q.acceptedBy || "you"}</span>{" "}
                        on {fmtDate(q.acceptedAt)}.
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedQuoteForPreview && (
        <QuotePreviewModal
          isOpen={!!selectedQuoteForPreview}
          onClose={() => setSelectedQuoteForPreview(null)}
          quote={selectedQuoteForPreview}
          lead={client}
        />
      )}

      {/* Accept / Request-changes modal */}
      {action && (
        <Modal
          title={isAccept ? "Approve quote" : "Request changes"}
          subtitle={
            isAccept
              ? `Confirm your acceptance of ${action.quote.quoteId}.`
              : `Tell your architect what to revise on ${action.quote.quoteId}.`
          }
          onClose={closeAction}
          maxWidth="max-w-[460px]"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeAction}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg border border-bordergray text-sm font-medium text-text-muted hover:bg-bg-soft transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={submitting || !canSubmit}
                className={`min-w-[150px] flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  isAccept
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-select-blue hover:bg-primary"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Submitting…
                  </>
                ) : isAccept ? (
                  <>
                    <Check size={14} /> Confirm acceptance
                  </>
                ) : (
                  <>
                    <MessageSquarePlus size={14} /> Send request
                  </>
                )}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                Your name {isAccept && <span className="text-red-500">*</span>}
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-bordergray px-3 py-2.5 text-sm text-textcolor focus:outline-none focus:border-select-blue"
              />
            </div>

            {!isAccept && (
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  What should change?
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="e.g. Please revise the wardrobe finish and remove the false ceiling in Bedroom 2."
                  className="w-full rounded-lg border border-bordergray px-3 py-2.5 text-sm text-textcolor focus:outline-none focus:border-select-blue resize-none"
                />
              </div>
            )}

            {isAccept && (
              <label className="flex items-start gap-2.5 rounded-lg border border-bordergray bg-bg-soft/50 px-3 py-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <span className="text-[12px] text-textcolor leading-snug">
                  I have reviewed and agree to the scope, pricing and terms in this
                  quote. I understand this records my digital acceptance with my
                  name and the date.
                </span>
              </label>
            )}
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-xl shadow-lg text-[12.5px] font-semibold text-white ${
            toast.ok ? "bg-emerald-600" : "bg-red-500"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {toast.ok ? <CheckCircle2 size={15} /> : null}
            {toast.msg}
            <button
              onClick={() => setToast(null)}
              className="ml-2 opacity-80 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectQuotes;
