import React from "react";
import { CalendarRange } from "lucide-react";
import DateRangePicker from "./DateRangePicker";

export default function DateRangeButton({
  value,
  onChange,
  isOpen,
  onToggle,
  onClose,
}) {
  const hasRange = value.start || value.end;

  return (
    <div className="relative ">
      <button
        onClick={onToggle}
        title="Date Range"
        className={`p-2 rounded-md shadow-sm border transition-colors ${
          isOpen || hasRange
            ? "border-select-blue bg-blue-50 text-select-blue"
            : "border-grayborder bg-white text-gray-text hover:bg-gray-50"
        }`}
      >
        <CalendarRange size={17} />
      </button>

      {isOpen && (
        <DateRangePicker
          initialStart={value.start}
          initialEnd={value.end}
          onApply={(range) => {
            onChange(range);
            onClose();
          }}
          onReset={() => {
            onChange({ start: "", end: "" });
          }}
          onClose={onClose}
        />
      )}
    </div>
  );
}
