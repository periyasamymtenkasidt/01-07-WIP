import React from "react";
import { ArrowUpDown } from "lucide-react";

export default function SortDropdown({ fields, value, onChange, isOpen, onToggle }) {
  const handleSort = (key) => {
    const direction =
      value.key === key && value.direction === "asc" ? "desc" : "asc";
    onChange({ key, direction });
    onToggle();
  };

  const handleClear = () => {
    onChange({ key: "", direction: "asc" });
    onToggle();
  };

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        title="Sort"
        className={`p-2 rounded-md shadow-sm border transition-colors ${
          isOpen || value.key
            ? "border-select-blue bg-blue-50 text-select-blue"
            : "border-grayborder bg-white text-gray-text hover:bg-gray-50"
        }`}
      >
        <ArrowUpDown size={17} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 p-3 bg-white border border-gray-200 shadow-lg rounded-lg w-48 z-50">
          <p className="text-sm font-semibold mb-2 text-text">Sort By</p>
          <div className="flex flex-col gap-0.5 text-sm">
            {fields.map((field) => (
              <button
                key={field.key}
                onClick={() => handleSort(field.key)}
                className={`text-left px-2 py-1.5 rounded flex justify-between items-center hover:bg-gray-50 ${
                  value.key === field.key
                    ? "bg-blue-50 text-select-blue font-medium"
                    : "text-gray-700"
                }`}
              >
                <span>{field.label}</span>
                {value.key === field.key && (
                  <span className="text-xs">
                    {value.direction === "asc" ? "↑" : "↓"}
                  </span>
                )}
              </button>
            ))}
          </div>
          {value.key && (
            <button
              onClick={handleClear}
              className="mt-2 text-xs text-red-500 hover:underline px-2"
            >
              Clear sort
            </button>
          )}
        </div>
      )}
    </div>
  );
}
