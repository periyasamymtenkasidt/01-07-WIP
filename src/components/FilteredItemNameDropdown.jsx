import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Package } from "lucide-react";
import { listLibrary, computeLibraryItemAmount } from "../data/itemLibrary";

/**
 * Item name dropdown. Items are category-free now, so the whole Item Master is
 * shown (filtered only by typed text) — the room is chosen via the scope's
 * heading, not by the item's category. Selecting an item triggers
 * `onItemSelect(libraryItem)` so the parent auto-populates rate, unit, days,
 * materials, etc.
 */
const FilteredItemNameDropdown = ({
  value = "",
  onChange,
  onItemSelect,
  error = "",
  placeholder = "Select or type an item name…",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typedValue, setTypedValue] = useState("");
  const dropdownRef = useRef(null);

  // Get all library items
  const allItems = useMemo(() => listLibrary(), []);

  // Show the whole library, filtered only by the typed text.
  const filteredItems = useMemo(() => {
    if (!isTyping || !typedValue.trim()) return allItems;
    const q = typedValue.trim().toLowerCase();
    return allItems.filter(
      (item) =>
        (item.description || "").toLowerCase().includes(q) ||
        (item.tags || []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [allItems, typedValue, isTyping]);

  // Sync typedValue with value prop when not actively editing
  useEffect(() => {
    if (!isOpen) {
      setTypedValue(value);
    }
  }, [value, isOpen]);

  // Close dropdown on outside click
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
    setIsOpen(true);
    setIsTyping(false);
  };

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setTypedValue(newVal);
    onChange(newVal);
    setIsTyping(true);
  };

  const handleSelect = (item) => {
    const desc = item.description || "";
    setTypedValue(desc);
    onChange(desc);
    if (onItemSelect) onItemSelect(item);
    setIsOpen(false);
    setIsTyping(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger */}
      <div className="relative flex items-center">
        <input
          type="text"
          value={typedValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`flex-1 bg-white border ${
            error
              ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
              : isOpen
                ? "border-select-blue"
                : "border-bordergray"
          } text-[12px] text-textcolor rounded-lg px-3 py-2 pr-8 transition-all placeholder:text-text-subtle focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15`}
        />
        <button
          type="button"
          onClick={() => {
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

      {error && (
        <p className="text-red-500 text-[10px] mt-1 font-semibold">{error}</p>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white rounded-xl border border-bordergray shadow-xl max-h-[300px] flex flex-col overflow-hidden animate-fade-in">
          {/* Items list */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 scrollbar-thin">
            {filteredItems.length === 0 && (
              <p className="text-[11px] text-text-subtle text-center py-4 italic">
                No items found
              </p>
            )}
            {filteredItems.map((item) => {
              const amount = computeLibraryItemAmount(item);
              const isSelected =
                (item.description || "").toLowerCase().trim() ===
                (value || "").toLowerCase().trim();
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all ${
                    isSelected
                      ? "bg-active-bg border border-select-blue/30"
                      : "hover:bg-bg-soft border border-transparent"
                  }`}
                >
                  <Package
                    size={12}
                    className={
                      isSelected ? "text-select-blue" : "text-text-subtle"
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[11.5px] font-semibold truncate ${
                        isSelected ? "text-select-blue" : "text-textcolor"
                      }`}
                    >
                      {item.description}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      {item.unit && <span>{item.unit}</span>}
                      {amount > 0 && (
                        <span className="font-semibold tabular-nums">
                          ₹{amount.toLocaleString("en-IN")}
                        </span>
                      )}
                      {(item.materials || []).length > 0 && (
                        <span>
                          {item.materials.length} material
                          {item.materials.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilteredItemNameDropdown;
