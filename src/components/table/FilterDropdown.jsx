import React from "react";
import { SlidersHorizontal } from "lucide-react";

export default function FilterDropdown({
  fields,
  values,
  onChange,
  isOpen,
  onToggle,
}) {
  const hasActive = fields.some((f) => values[f.key]);

  const handleChange = (key, val) => onChange({ ...values, [key]: val });

  const handleClear = () => {
    onChange(fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}));
    onToggle();
  };

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        title="Filter"
        className={`p-2 rounded-md shadow-sm border transition-colors ${
          isOpen || hasActive
            ? "border-select-blue bg-blue-50 text-select-blue"
            : "border-grayborder bg-white text-gray-text hover:bg-gray-50"
        }`}
      >
        <SlidersHorizontal size={17} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-4 bg-white border border-gray-200 shadow-lg rounded-lg w-56 z-50">
          <p className="text-sm font-semibold mb-3 text-text">Filter Options</p>
          <div className="flex flex-col gap-3 text-sm">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-gray-500 mb-1 text-xs">
                  {field.label}
                </label>
                <select
                  value={values[field.key] || ""}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="w-full border border-gray-300 rounded p-1.5 text-sm focus:outline-none focus:border-select-blue"
                >
                  <option value="">All {field.label}</option>
                  {field.options.map((opt) => {
                    const val = typeof opt === "string" ? opt : opt.value;
                    const label = typeof opt === "string" ? opt : opt.label;
                    return (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}
            {hasActive && (
              <button
                onClick={handleClear}
                className="text-xs text-red-500 hover:underline text-left"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
