import React, { useState } from "react";
import { FiPhone, FiEdit3 } from "react-icons/fi";
import { X } from "lucide-react";

const TABS = [
  { key: "call", label: "Log Call", icon: FiPhone },
  { key: "note", label: "Add Note", icon: FiEdit3 },
];

const LogActivityModal = ({ defaultTab = "call", onClose, onSubmit }) => {
  const [tab, setTab] = useState(defaultTab);

  // Call fields
  const [direction, setDirection] = useState("outbound");
  const [duration, setDuration] = useState("");
  const [callNotes, setCallNotes] = useState("");

  // Note fields
  const [noteText, setNoteText] = useState("");

  const canSubmit =
    tab === "call"
      ? callNotes.trim().length > 0
      : noteText.trim().length > 0;

  const handleSubmit = () => {
    if (tab === "call") {
      onSubmit({
        type: "call",
        direction,
        duration: duration ? Number(duration) : null,
        notes: callNotes,
      });
    } else {
      onSubmit({ type: "note", text: noteText });
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-[16px] font-manrope shadow-2xl w-full max-w-[480px] mx-auto p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            {tab === "call" ? <FiPhone size={22} /> : <FiEdit3 size={22} />}
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-darkgray">
              {tab === "call" ? "Log a Call" : "Add a Note"}
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              Logged to the project's activity timeline.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5 border-b border-border">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-all ${
                  active
                    ? "border-select-blue text-select-blue"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {tab === "call" ? (
          <>
            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-text mb-2">
                Direction
              </label>
              <div className="grid grid-cols-2 gap-2">
                {["outbound", "inbound"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={`py-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                      direction === d
                        ? "bg-active-bg border-select-blue text-select-blue"
                        : "bg-white border-border text-text-muted hover:bg-bg-soft"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-text mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                min="0"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 12"
                className="w-full rounded-lg border border-border px-3 py-2 text-[13px] text-text focus:outline-none focus:border-select-blue"
              />
            </div>

            <div className="mb-6">
              <label className="block text-[12px] font-semibold text-text mb-2">
                Notes <span className="text-red-500">*</span>
              </label>
              <textarea
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                rows={4}
                placeholder="What was discussed, next steps, objections…"
                className="w-full rounded-lg border border-border px-3 py-2 text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:border-select-blue resize-none"
              />
            </div>
          </>
        ) : (
          <div className="mb-6">
            <label className="block text-[12px] font-semibold text-text mb-2">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={5}
              placeholder="Internal note for the team…"
              className="w-full rounded-lg border border-border px-3 py-2 text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:border-select-blue resize-none"
            />
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2.5 rounded-lg bg-select-blue text-white text-[13px] font-semibold hover:bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogActivityModal;
