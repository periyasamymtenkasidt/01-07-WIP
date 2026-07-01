import { AlertTriangle, CheckCircle2, XCircle, X } from "lucide-react";

/**
 * Warning modal shown when a duplicate scope item is detected during
 * multi-scope selection. Allows the user to add it anyway (under a
 * different heading) or skip it and continue processing remaining scopes.
 */
const DuplicateScopeWarningModal = ({
  isOpen,
  itemName,
  existingHeading,
  onAddAnyway,
  onSkip,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10001] animate-fade-in p-4"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-bordergray transform scale-100 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-200 relative">
          <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-textcolor">
              Duplicate Scope Detected
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              This item already exists in your scope
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            title="Close warning"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="bg-bg-soft rounded-xl border border-bordergray p-4 space-y-2">
            <p className="text-[12px] text-text-muted">
              The scope{" "}
              <span className="font-bold text-textcolor">"{itemName}"</span>{" "}
              already exists under:
            </p>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-bordergray px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-[12px] font-bold text-textcolor uppercase">
                {existingHeading}
              </span>
            </div>
            <p className="text-[11.5px] text-text-muted pt-1">
              Do you want to add it again anyway?
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor hover:border-text-subtle transition-all cursor-pointer"
          >
            <XCircle size={13} />
            No, Skip Scope
          </button>
          <button
            type="button"
            onClick={onAddAnyway}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-select-blue hover:bg-select-blue/90 text-white text-[12px] font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer"
          >
            <CheckCircle2 size={13} />
            Yes, Add Scope
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateScopeWarningModal;
