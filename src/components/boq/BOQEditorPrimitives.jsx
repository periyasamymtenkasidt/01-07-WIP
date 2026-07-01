import { useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { formatAmount } from "../../utils/formatAmount";

const compactInput =
  "bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-2 py-1.5 w-full focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/10 placeholder:text-text-subtle";

const formatSignoffDate = (iso) => {
  if (!iso) return "Pending";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const Field = ({ icon, label, hint, children }) => (
  <div>
    <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
      <span className="flex items-center gap-1 min-h-[16px]">
        <span className="text-select-blue">{icon}</span>
        {label}
      </span>
      {hint && (
        <span className="block text-[9.5px] font-normal text-text-subtle normal-case tracking-normal leading-tight mt-0.5">
          {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

export const SignoffField = ({ label, value, date, disabled, onChange }) => (
  <label className="block">
    <span className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
      {label}
      <span className="text-[9.5px] font-semibold normal-case tracking-normal text-text-subtle">
        {formatSignoffDate(date)}
      </span>
    </span>
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Name / role"
      className={`${compactInput} disabled:bg-bg-soft disabled:text-text-subtle disabled:cursor-not-allowed`}
    />
  </label>
);

export const SignoffCheck = ({ label, checked, disabled, onChange }) => (
  <label className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-[11px] font-semibold text-text-muted">
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="h-3.5 w-3.5 accent-select-blue disabled:cursor-not-allowed"
    />
    <span>{label}</span>
  </label>
);

export const CollapsiblePanel = ({
  title,
  icon,
  meta,
  actions,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-bordergray flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          {open ? (
            <ChevronDown size={13} className="text-text-subtle shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-text-subtle shrink-0" />
          )}
          {icon}
          <h3 className="text-[12px] font-bold text-textcolor truncate">
            {title}
          </h3>
          {meta && (
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-text-muted bg-bg-soft px-1.5 py-0.5 rounded shrink-0">
              {meta}
            </span>
          )}
        </button>
        {actions && open && (
          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      {open && children}
    </section>
  );
};

export const BulletListEditor = ({
  title,
  icon,
  items,
  placeholder,
  accent,
  onChange,
  disabled = false,
  defaultOpen = false,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const bullet =
    accent === "emerald"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-600";
  const headerTint =
    accent === "emerald"
      ? "from-emerald-50/60 to-white"
      : "from-red-50/60 to-white";
  const add = () => {
    setOpen(true);
    onChange([...(items || []), ""]);
  };
  const updateItem = (idx, v) =>
    onChange(items.map((it, i) => (i === idx ? v : it)));
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));

  return (
    <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
      <div
        className={`px-4 py-3 border-b border-bordergray bg-linear-to-r ${headerTint} flex items-center justify-between`}
      >
        <button
          type="button"
          onClick={() => setOpen((p) => !p)}
          className="flex items-center gap-2 min-w-0 text-left"
        >
          {open ? (
            <ChevronDown size={13} className="text-text-subtle shrink-0" />
          ) : (
            <ChevronRight size={13} className="text-text-subtle shrink-0" />
          )}
          {icon}
          <h3 className="text-[12px] font-bold text-textcolor">{title}</h3>
          <span className="text-[10px] font-semibold text-text-muted bg-white/70 px-1.5 py-0.5 rounded-md border border-bordergray">
            {(items || []).length}
          </span>
        </button>
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="flex items-center gap-1 text-[11px] font-semibold text-select-blue hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {open && (
        <div className="p-3 space-y-2">
          {(items || []).map((item, idx) => (
            <div key={idx} className="flex items-start gap-2 group">
              <span
                className={`mt-2 h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${bullet}`}
              >
                {accent === "emerald" ? (
                  <Check size={9} strokeWidth={3} />
                ) : (
                  <X size={9} strokeWidth={3} />
                )}
              </span>
              <input
                type="text"
                value={item}
                onChange={(e) => updateItem(idx, e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="bg-bg-soft border border-transparent text-[11.5px] text-textcolor rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:bg-white focus:border-select-blue/40 placeholder:text-text-subtle disabled:text-text-subtle disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                disabled={disabled}
                className="h-7 w-6 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          {(!items || items.length === 0) && (
            <button
              type="button"
              onClick={add}
              disabled={disabled}
              className="w-full text-[11px] text-text-subtle border border-dashed border-bordergray rounded-lg py-3 hover:border-select-blue hover:text-select-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add your first entry
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export const Row = ({ label, value, accent = "text-textcolor" }) => (
  <div className="flex items-center justify-between">
    <span className="text-text-muted">{label}</span>
    <span className={`tabular-nums ${accent}`}>{value}</span>
  </div>
);

export const CommercialValue = ({
  label,
  value,
  signed = false,
  tone = "text-textcolor",
}) => {
  const amount = Number(value) || 0;
  const prefix = signed && amount > 0 ? "+" : "";
  return (
    <div className="rounded-lg border border-bordergray bg-white px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`mt-0.5 text-[13px] font-bold tabular-nums ${tone}`}>
        {prefix}
        {formatAmount(amount)}
      </p>
    </div>
  );
};

export const Toast = ({ toast, onClose }) => {
  const variants = {
    success: { bg: "bg-emerald-500", icon: <CheckCircle2 size={14} /> },
    error: { bg: "bg-red-500", icon: <AlertTriangle size={14} /> },
    info: { bg: "bg-select-blue", icon: <Info size={14} /> },
  };
  const v = variants[toast.type] || variants.info;
  return (
    <div className="fixed top-6 right-6 z-50">
      <div
        className={`${v.bg} text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md`}
      >
        <span className="shrink-0">{v.icon}</span>
        <p className="text-[12px] font-medium flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}) => (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
      <button
        type="button"
        onClick={onCancel}
        className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
        title="Close dialog"
      >
        <X size={16} />
      </button>
      <div className="p-5 flex items-start gap-3">
        <span
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-50 text-red-500"
              : "bg-select-blue/10 text-select-blue"
          }`}
        >
          {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-textcolor">{title}</h3>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm ${
            danger
              ? "bg-red-500 hover:bg-red-600"
              : "bg-select-blue hover:bg-primary"
          }`}
        >
          {confirmLabel || "Confirm"}
        </button>
      </div>
    </div>
  </div>
);

export const SendValidationDialog = ({
  blocks,
  warnings,
  onCancel,
  onSendAnyway,
}) => {
  const hasBlocks = blocks.length > 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden relative">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
          title="Close dialog"
        >
          <X size={16} />
        </button>
        <div className="p-5 flex items-start gap-3">
          <span
            className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
              hasBlocks ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-600"
            }`}
          >
            <AlertTriangle size={18} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold text-textcolor">
              {hasBlocks ? "Can't mark this BOQ as sent" : "Send with warnings?"}
            </h3>
            <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
              {hasBlocks
                ? "Fix these before sending:"
                : "These won't block sending, but worth checking first:"}
            </p>
          </div>
        </div>
        <div className="px-5 pb-2 space-y-1.5 max-h-[260px] overflow-y-auto">
          {blocks.map((b, i) => (
            <div
              key={`b${i}`}
              className="flex items-start gap-2 text-[11.5px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>{b}</span>
            </div>
          ))}
          {warnings.map((w, i) => (
            <div
              key={`w${i}`}
              className="flex items-start gap-2 text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2"
            >
              <Info size={12} className="mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
          >
            {hasBlocks ? "Close" : "Cancel"}
          </button>
          {!hasBlocks && (
            <button
              type="button"
              onClick={onSendAnyway}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm bg-select-blue hover:bg-primary"
            >
              Send anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
