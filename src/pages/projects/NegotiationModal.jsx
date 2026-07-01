import React, { useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import { X } from "lucide-react";

const NegotiationModal = ({ onClose, onConfirm, initialNote = "", initialExpectedClose = "" }) => {
  const [note, setNote] = useState(initialNote);
  const [expectedClose, setExpectedClose] = useState(initialExpectedClose);
  const [errors, setErrors] = useState({});

  const handleConfirm = () => {
    const newErrors = {};
    if (!note.trim()) {
      newErrors.note = "Negotiation Reason / Remarks is required";
    }
    if (!expectedClose) {
      newErrors.expectedClose = "Negotiation Date is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onConfirm({ note, expectedClose });
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-[16px] font-manrope shadow-2xl w-full max-w-[460px] mx-auto p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
          title="Close"
        >
          <X size={16} />
        </button>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiTrendingUp size={22} />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-darkgray">
              Move to Negotiation
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              Capture negotiation details and expected close date. Both fields are required.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-text mb-2">
            Negotiation Reason / Remarks <span className="text-red-500">*</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              if (errors.note) {
                setErrors((prev) => ({ ...prev, note: "" }));
              }
            }}
            rows={3}
            placeholder="e.g. Client wants 10% off, asking for revised timeline…"
            className={`w-full rounded-lg border px-3 py-2 text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:border-select-blue resize-none ${
              errors.note ? "border-red-500" : "border-border"
            }`}
          />
          {errors.note && (
            <p className="text-red-500 text-[11px] mt-1">{errors.note}</p>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-[12px] font-semibold text-text mb-2">
            Negotiation Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={expectedClose}
            onChange={(e) => {
              setExpectedClose(e.target.value);
              if (errors.expectedClose) {
                setErrors((prev) => ({ ...prev, expectedClose: "" }));
              }
            }}
            className={`w-full rounded-lg border px-3 py-2 text-[13px] text-text focus:outline-none focus:border-select-blue ${
              errors.expectedClose ? "border-red-500" : "border-border"
            }`}
          />
          {errors.expectedClose && (
            <p className="text-red-500 text-[11px] mt-1">{errors.expectedClose}</p>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-lg bg-amber-500 text-white text-[13px] font-semibold hover:bg-amber-600 flex items-center gap-2"
          >
            <FiTrendingUp size={14} /> Move to Negotiation
          </button>
        </div>
      </div>
    </div>
  );
};

export default NegotiationModal;
