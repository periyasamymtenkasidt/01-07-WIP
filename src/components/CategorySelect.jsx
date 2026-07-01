import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { getScheduleConfig } from "../data/scheduleConfig";

// Strict room/category picker backed by the canonical Master → Schedule list.
// Categories are managed only in Master → Schedule — this is read-only here.
// Any current off-list value is preserved as an option so existing data isn't lost.
// Enhanced with an inline searchable dropdown behavior.
const CategorySelect = ({ value, onChange, className, placeholder = "Select room…", disabled }) => {
  const [names] = useState(() => getScheduleConfig().rooms.map((r) => r.name));
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const dropdownRef = useRef(null);

  // Keep the current value selectable even if it's not in the master list.
  const options = useMemo(() => {
    return value && !names.includes(value) ? [value, ...names] : names;
  }, [value, names]);

  // Sync typedValue with value prop when not actively open
  useEffect(() => {
    if (!isOpen) {
      setTypedValue(value || "");
    }
  }, [value, isOpen]);

  // Filter options by typed text when typing
  const filteredOptions = useMemo(() => {
    if (!isTyping || !typedValue.trim()) return options;
    const q = typedValue.trim().toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, typedValue, isTyping]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsTyping(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFocus = () => {
    if (disabled) return;
    setIsOpen(true);
    setIsTyping(false);
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setTypedValue(newVal);
    onChange(newVal);
    setIsTyping(true);
  };

  const handleSelect = (val) => {
    setTypedValue(val);
    onChange(val);
    setIsOpen(false);
    setIsTyping(false);
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={typedValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          disabled={disabled}
          placeholder={placeholder}
          className={className}
        />
        <button
          type="button"
          onClick={() => {
            if (disabled) return;
            if (isOpen) {
              setIsOpen(false);
            } else {
              handleFocus();
            }
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-textcolor"
          tabIndex={-1}
        >
          <ChevronDown
            size={13}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-bordergray shadow-xl max-h-[200px] flex flex-col overflow-hidden animate-fade-in">
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {filteredOptions.length === 0 && (
              <p className="text-[11px] text-text-subtle text-center py-3 italic">
                No matching rooms
              </p>
            )}
            {filteredOptions.map((opt) => {
              const isSelected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full flex items-center px-2.5 py-2 rounded-lg text-left text-[11.5px] font-semibold transition-all ${
                    isSelected
                      ? "bg-active-bg border border-select-blue/30 text-select-blue"
                      : "hover:bg-bg-soft border border-transparent text-textcolor"
                  }`}
                >
                  <span className="truncate">{opt}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategorySelect;
