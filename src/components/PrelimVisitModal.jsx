import { useState } from "react";
import {
  FiX,
  FiCheck,
  FiMapPin,
  FiUpload,
  FiPaperclip,
  FiTrash2,
} from "react-icons/fi";
import { storeFile, deleteFile } from "../utils/fileStorage";

const genId = () =>
  `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const inputBase =
  "w-full rounded-lg border border-bordergray bg-white px-3 py-2 text-[13px] text-textcolor focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15";

// Module-level so the input isn't remounted (and focus lost) on every keystroke.
const VisitField = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
      {label}
    </span>
    <input value={value} onChange={onChange} placeholder={placeholder} className={inputBase} />
  </label>
);

// Light preliminary site visit — captured BEFORE the fee proposal so the design
// fee is quoted with site knowledge, not blind. This is NOT the detailed
// feasibility (legal/soil/topo) — that comes after appointment.
const PrelimVisitModal = ({ initial, onClose, onSave }) => {
  const [form, setForm] = useState({
    plotRead: initial?.plotRead || "",
    approxFSI: initial?.approxFSI || "",
    access: initial?.access || "",
    condition: initial?.condition || "",
    notes: initial?.notes || "",
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const [documents, setDocuments] = useState(initial?.documents || []);

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fileId = genId();
    await storeFile(fileId, file);
    setDocuments((prev) => [
      ...prev,
      { id: genId(), name: file.name, fileId, mime: file.type },
    ]);
  };

  const removeDoc = (d) => {
    if (d.fileId) deleteFile(d.fileId).catch(() => {});
    setDocuments((prev) => prev.filter((x) => x.id !== d.id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-bordergray px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <FiMapPin size={16} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-darkgray">
                Preliminary Site Visit
              </h3>
              <p className="mt-0.5 text-[12px] text-text-muted">
                Quick read to scope the fee — not the full feasibility.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-soft"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-3.5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <VisitField label="Plot read" value={form.plotRead} onChange={set("plotRead")} placeholder="e.g. 40×60 corner plot" />
            <VisitField label="Approx FSI / buildable" value={form.approxFSI} onChange={set("approxFSI")} placeholder="e.g. ~1.5, G+3" />
            <VisitField label="Access / road" value={form.access} onChange={set("access")} placeholder="e.g. 30 ft road, easy access" />
            <VisitField label="Site condition" value={form.condition} onChange={set("condition")} placeholder="e.g. vacant, levelled" />
          </div>
          <label className="block">
            <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
              Notes
            </span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Observations that affect the design fee / approach…"
              className={`${inputBase} resize-none`}
            />
          </label>

          {/* Documents — photos, plot/title copies, sketches. Carried forward
              into the site's feasibility. */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                Documents
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-bg-soft px-3 py-1 text-[11.5px] font-semibold text-grey hover:bg-bordergray">
                <FiUpload size={12} /> Upload
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf"
                  onChange={onPickFile}
                />
              </label>
            </div>
            <div className="space-y-1.5">
              {documents.length === 0 && (
                <p className="rounded-lg border border-dashed border-bordergray py-2.5 text-center text-[11px] text-text-subtle">
                  No documents yet.
                </p>
              )}
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-bg-soft bg-palewhite/40 px-3 py-1.5"
                >
                  <FiPaperclip size={12} className="shrink-0 text-select-blue" />
                  <span className="truncate text-[12px] text-darkgray">{d.name}</span>
                  <button
                    type="button"
                    onClick={() => removeDoc(d)}
                    className="ml-auto shrink-0 rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-500"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-bordergray px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-grey hover:bg-bg-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...form, documents, done: true })}
            className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-5 py-2 text-[13px] font-bold text-white shadow-sm hover:shadow-md"
          >
            <FiCheck size={14} /> Save visit
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrelimVisitModal;
