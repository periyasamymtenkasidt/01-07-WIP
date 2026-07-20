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

// Predefined records the visitor ticks off as collected on site. These are the
// paperwork/records gathered, distinct from the uploaded Attachments (files).
const DOCUMENT_OPTIONS = [
  "Patta / Chitta / EC",
  "Sale Deed",
  "Survey Sketch",
  "Site Plan",
  "Previous Approval Drawing",
  "Soil Test Report",
  "Photos / Videos",
];

// The visit's feasibility verdict — the outcome that drives the next step.
const FEASIBILITY_OPTIONS = ["Feasible", "Needs Verification", "Not Feasible"];

// Section heading inside the modal body.
const SectionTitle = ({ children }) => (
  <h4 className="text-[11px] font-bold uppercase tracking-wider text-darkgray">
    {children}
  </h4>
);

// Module-level so the input isn't remounted (and focus lost) on every keystroke.
const VisitField = ({ label, value, onChange, placeholder, type = "text", min }) => (
  <label className="block">
    <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
      {label}
    </span>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      className={inputBase}
    />
  </label>
);

// Small pill-style toggle group (single-select). Used for Client Present and
// the Feasibility Read verdict. Clicking the active pill clears it.
const PillToggle = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => {
      const selected = value === opt.value;
      return (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(selected ? null : opt.value)}
          className={`rounded-lg border px-4 py-1.5 text-[12px] font-semibold transition-colors ${
            selected
              ? "border-select-blue bg-active-bg text-select-blue"
              : "border-bordergray bg-white text-text-muted hover:bg-bg-soft"
          }`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// Light preliminary site visit — captured BEFORE the fee proposal so the design
// fee is quoted with site knowledge, not blind. This is NOT the detailed
// feasibility (legal/soil/topo) — that comes after appointment.
const PrelimVisitModal = ({ initial, onClose, onSave }) => {
  const [form, setForm] = useState({
    // Visit details
    visitDate: initial?.visitDate || "",
    visitedBy: initial?.visitedBy || "",
    clientPresent: initial?.clientPresent ?? null,
    // Site read — plotRead / access / condition keys are kept (relabeled) so the
    // feasibility auto-fill (feasibilityStorage) keeps working.
    plotRead: initial?.plotRead || "", // "Plot Dimensions"
    orientation: initial?.orientation || "",
    access: initial?.access || "", // "Site Access"
    roadWidth: initial?.roadWidth || "",
    condition: initial?.condition || "", // "Existing Condition"
    utilities: initial?.utilities || "",
    // Visit outcome
    feasibilityRead: initial?.feasibilityRead || "",
    nextAction: initial?.nextAction || "",
    followUpDate: initial?.followUpDate || "",
    notes: initial?.notes || "",
  });
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Records ticked off as collected on site (chip multi-select).
  const [documentsCollected, setDocumentsCollected] = useState(
    initial?.documentsCollected || [],
  );
  const toggleDoc = (doc) =>
    setDocumentsCollected((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc],
    );

  // Uploaded files (photos, scanned records) — carried into feasibility.
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
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
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
                Quick read to decide feasibility and scope the fee — not the full
                due diligence.
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

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* ── Visit details ─────────────────────────────────────────── */}
          <div className="space-y-3.5">
            <SectionTitle>Visit Details</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <VisitField
                label="Visit Date"
                type="date"
                value={form.visitDate}
                onChange={set("visitDate")}
                min={new Date().toISOString().split("T")[0]}
              />
              <VisitField
                label="Visited By"
                value={form.visitedBy}
                onChange={set("visitedBy")}
                placeholder="e.g. Site engineer name"
              />
            </div>
            <div>
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                Client Present
              </span>
              <PillToggle
                value={form.clientPresent}
                onChange={(v) => setField("clientPresent", v)}
                options={[
                  { label: "Yes", value: true },
                  { label: "No", value: false },
                ]}
              />
            </div>
          </div>

          {/* ── Site read ─────────────────────────────────────────────── */}
          <div className="space-y-3.5">
            <SectionTitle>Site Read</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <VisitField
                label="Plot Dimensions"
                value={form.plotRead}
                onChange={set("plotRead")}
                placeholder="e.g. 40×60 ft"
              />
              <VisitField
                label="Orientation"
                value={form.orientation}
                onChange={set("orientation")}
                placeholder="e.g. East-facing"
              />
              <VisitField
                label="Site Access"
                value={form.access}
                onChange={set("access")}
                placeholder="e.g. corner plot, easy access"
              />
              <VisitField
                label="Road Width"
                value={form.roadWidth}
                onChange={set("roadWidth")}
                placeholder="e.g. 30 ft"
              />
              <VisitField
                label="Existing Condition"
                value={form.condition}
                onChange={set("condition")}
                placeholder="e.g. vacant, levelled"
              />
              <VisitField
                label="Utilities Available"
                value={form.utilities}
                onChange={set("utilities")}
                placeholder="e.g. water, electricity"
              />
            </div>
          </div>

          {/* ── Documents collected (checklist) ───────────────────────── */}
          <div className="space-y-2.5">
            <SectionTitle>Documents Collected</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {DOCUMENT_OPTIONS.map((doc) => {
                const selected = documentsCollected.includes(doc);
                return (
                  <button
                    key={doc}
                    type="button"
                    onClick={() => toggleDoc(doc)}
                    className={`rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                      selected
                        ? "border-select-blue bg-active-bg text-select-blue"
                        : "border-bordergray bg-white text-text-muted hover:bg-bg-soft"
                    }`}
                  >
                    {doc}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Attachments (uploaded files) ──────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <SectionTitle>Attachments</SectionTitle>
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
                  No files attached yet.
                </p>
              )}
              {documents.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-bg-soft bg-palewhite/40 px-3 py-1.5"
                >
                  <FiPaperclip size={12} className="shrink-0 text-select-blue" />
                  <span className="truncate text-[12px] text-darkgray">
                    {d.name}
                  </span>
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

          {/* ── Visit outcome ─────────────────────────────────────────── */}
          <div className="space-y-3.5">
            <SectionTitle>Visit Outcome</SectionTitle>
            <div>
              <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted">
                Feasibility Read
              </span>
              <PillToggle
                value={form.feasibilityRead}
                onChange={(v) => setField("feasibilityRead", v)}
                options={FEASIBILITY_OPTIONS.map((o) => ({ label: o, value: o }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <VisitField
                label="Next Action"
                value={form.nextAction}
                onChange={set("nextAction")}
                placeholder="e.g. Send fee proposal"
              />
              <VisitField
                label="Follow-up Date"
                type="date"
                value={form.followUpDate}
                onChange={set("followUpDate")}
              />
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
            onClick={() =>
              onSave({ ...form, documentsCollected, documents, done: true })
            }
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
