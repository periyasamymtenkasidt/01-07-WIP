import React, { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FileText, Printer } from "lucide-react";
import QuotePreviewModal from "../../components/QuotePreviewModal";
import { getQuotesForParent } from "../../data/QuotePresets";

const ProjectQuotes = () => {
  const { client, formatAmount } = useOutletContext();
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState(null);

  const parentId = client.sourceLeadId || client.clientID;
  const list = getQuotesForParent(parentId);

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
              const grandTotal = q.grandTotal || (q.scopeItems || []).reduce((s, it) => s + (Number(it.amount) || 0), 0) * 1.18;
              return (
                <div
                  key={q.quoteId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white border border-bordergray rounded-[20px] shadow-sm hover:border-blue-100 hover:bg-palewhite transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center text-purple shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-extrabold text-darkgray text-sm leading-snug">
                        {q.quoteId}
                      </h4>
                      <p className="text-[11px] text-text-subtle mt-0.5">
                        Created on {new Date(q.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })} · {q.propertyType}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 mt-4 sm:mt-0 justify-between sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-extrabold text-darkgray">
                        {formatAmount(grandTotal)}
                      </p>
                      <p className="text-[10px] text-text-subtle">
                        Incl. 18% GST
                      </p>
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
    </div>
  );
};

export default ProjectQuotes;
