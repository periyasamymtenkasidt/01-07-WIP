import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown } from "lucide-react";

const SearchableSelect = ({ value, onChange, options, className, placeholder = "Select option…", disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  // Find label of the current value
  const currentOption = useMemo(() => {
    return options.find((opt) => {
      if (typeof opt === "object") {
        return opt.value === value || opt.code === value;
      }
      return opt === value;
    });
  }, [value, options]);

  const displayLabel = useMemo(() => {
    if (value === undefined || value === null || value === "") return "";
    if (!currentOption) return String(value);
    if (typeof currentOption === "object") { 
      return currentOption.label || currentOption.name || currentOption.code || String(currentOption.value);
    }
    return String(currentOption);
  }, [currentOption, value]);

  useEffect(() => {
    if (!isOpen) {
      setTypedValue(displayLabel);
    }
  }, [displayLabel, isOpen]);

  const filteredOptions = useMemo(() => {
    if (!isTyping || !typedValue.trim()) return options;
    const q = typedValue.trim().toLowerCase();
    return options.filter((opt) => {
      const label = typeof opt === "object" ? (opt.label || opt.name || opt.code || String(opt.value)) : String(opt);
      return label.toLowerCase().includes(q);
    });
  }, [options, typedValue, isTyping]);

  // Reset activeIndex when filteredOptions change
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, isOpen]);

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
    setIsTyping(true);
    setIsOpen(true);
  };

  const handleSelect = (opt) => {
    const val = typeof opt === "object" ? (opt.value !== undefined ? opt.value : opt.code) : opt;
    const label = typeof opt === "object" ? (opt.label || opt.name || opt.code || String(opt.value)) : String(opt);
    setTypedValue(label);
    onChange(val);
    setIsOpen(false);
    setIsTyping(false);
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        if (filteredOptions.length === 0) return -1;
        const nextIdx = prev + 1;
        return nextIdx >= filteredOptions.length ? 0 : nextIdx;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        if (filteredOptions.length === 0) return -1;
        const nextIdx = prev - 1;
        return nextIdx < 0 ? filteredOptions.length - 1 : nextIdx;
      });
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        e.preventDefault();
        handleSelect(filteredOptions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setIsTyping(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={typedValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
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
          <div ref={listRef} className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {filteredOptions.length === 0 && (
              <p className="text-[11px] text-text-subtle text-center py-3 italic">
                No matches
              </p>
            )}
            {filteredOptions.map((opt, index) => {
              const val = typeof opt === "object" ? (opt.value !== undefined ? opt.value : opt.code) : opt;
              const label = typeof opt === "object" ? (opt.label || opt.name || opt.code || String(opt.value)) : String(opt);
              const isSelected = val === value;
              const isActive = index === activeIndex;
              return (
                <button
                  key={String(val)}
                  data-index={index}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center px-2.5 py-2 rounded-lg text-left text-[11.5px] font-semibold transition-all ${
                    isSelected
                      ? "bg-active-bg border border-select-blue/30 text-select-blue"
                      : isActive
                      ? "bg-gray-100 border border-select-blue/20 text-textcolor"
                      : "hover:bg-bg-soft border border-transparent text-textcolor"
                  }`}
                >
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
