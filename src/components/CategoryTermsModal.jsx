import React, { useState, useEffect, useRef } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import Modal from "./Modal";
import { getGlobalTerms } from "../data/termsStorage";
import MasterNavLink from "./MasterNavLink";

// ── Dropdown Item ─────────────────────────────────────────────────────────────
const DropdownItem = ({ checked, label, onToggle, accent = "green" }) => {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-2.5 cursor-pointer h-[34px] px-2.5 rounded-lg hover:bg-bg-soft transition-all text-left w-full select-none"
    >
      <div className="relative inline-flex items-center shrink-0">
        <div
          className={`shrink-0 h-4 w-4 rounded flex items-center justify-center border transition-all duration-200 ${
            checked
              ? accent === "green"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                : "bg-red-500/80 border-red-500/50 text-white shadow-sm"
              : "bg-white border-slate-300 text-transparent hover:border-slate-400"
          }`}
        >
          <Check size={11} strokeWidth={3} className="shrink-0 text-white" />
        </div>
      </div>
      <span className="text-[12px] text-text-muted transition-colors leading-tight truncate">
        {label}
      </span>
    </div>
  );
};

// ── Selected Item Row ────────────────────────────────────────────────────────
const SelectedItemRow = ({ label, onToggle, accent = "green" }) => {
  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-2.5 cursor-pointer h-[34px] px-2.5 rounded-lg hover:bg-bg-soft transition-all text-left w-full select-none group"
    >
      <div className="relative inline-flex items-center shrink-0">
        <div
          className={`shrink-0 h-4 w-4 rounded flex items-center justify-center border transition-all duration-200 ${
            accent === "green"
              ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
              : "bg-red-500/80 border-red-500/50 text-white shadow-sm"
          }`}
        >
          <Check size={11} strokeWidth={3} className="shrink-0 text-white" />
        </div>
      </div>
      <span className="text-[12px] text-textcolor font-medium transition-colors leading-tight truncate flex-1">
        {label}
      </span>
      <X size={12} className="text-text-subtle opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 shrink-0" />
    </div>
  );
};

// ── Floating Multiselect Dropdown ──────────────────────────────────────────
const FloatingDropdown = ({
  label,
  items = [],
  selected = [],
  onToggle,
  onSelectAllToggle,
  accent = "green",
  placeholder = "Select items...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = items.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  const displayPlaceholder =
    selected.length > 0
      ? `${selected.length} item${selected.length > 1 ? "s" : ""} selected`
      : placeholder;

  const isGreen = accent === "green";
  const borderActiveColor = isGreen ? "border-emerald-500 ring-emerald-500/20" : "border-red-500 ring-red-500/20";

  const handleSelectAll = (e) => {
    e.stopPropagation();
    const allChecked = items.every((i) => selected.includes(i));
    onSelectAllToggle(items, !allChecked);
    setIsOpen(false);
    setSearch("");
  };

  const handleTriggerClick = () => {
    if (!isOpen) {
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleChevronClick = (e) => {
    e.stopPropagation();
    if (isOpen) {
      setIsOpen(false);
      setSearch("");
    } else {
      setIsOpen(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <span className="block text-[11px] font-bold text-textcolor/70 uppercase tracking-widest mb-2">
        {label}
      </span>
      <div
        onClick={handleTriggerClick}
        className={`w-full flex items-center justify-between bg-white border h-[38px] ${
          isOpen ? borderActiveColor + " ring-1" : "border-bordergray"
        } rounded-lg px-3.5 py-2 transition-all duration-205 hover:border-textcolor/30 cursor-pointer shadow-xs`}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent border-none p-0 text-[12px] font-semibold text-textcolor placeholder:text-text-muted focus:outline-none focus:ring-0 h-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={`text-[12px] ${selected.length > 0 ? "text-textcolor font-semibold" : "text-text-muted"} select-none truncate pr-4`}>
            {displayPlaceholder}
          </span>
        )}
        <div
          onClick={handleChevronClick}
          className="cursor-pointer flex items-center justify-center shrink-0 ml-2 h-full"
        >
          <ChevronDown
            size={14}
            className={`text-text-subtle transition-transform duration-200 ${
              isOpen ? "rotate-180 text-textcolor" : ""
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute top-full left-0 w-full mt-1 bg-white border border-bordergray rounded-lg shadow-lg z-20 flex flex-col overflow-hidden animate-[fadeIn_0.12s_ease-out]"
        >
          <div 
            style={{ maxHeight: '170px', scrollBehavior: 'smooth' }}
            className="overflow-y-auto p-2 space-y-0.5 scroll-hidden-bar scroll-smooth"
          >
            {filtered.length === 0 ? (
              <p className="text-[11.5px] text-text-subtle italic text-center py-4">
                No matching items.
              </p>
            ) : (
              <>
                <DropdownItem
                  checked={items.length > 0 && items.every((i) => selected.includes(i))}
                  label="All"
                  accent={accent}
                  onToggle={handleSelectAll}
                />
                {filtered.map((item, idx) => (
                  <DropdownItem
                    key={idx}
                    checked={selected.includes(item)}
                    label={item}
                    accent={accent}
                    onToggle={(e) => {
                      e.stopPropagation();
                      onToggle(item);
                      inputRef.current?.focus();
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Category Terms Modal ─────────────────────────────────────────────────────
const CategoryTermsModal = ({
  category,
  categoryLabel,
  initialInclusions = [],
  initialExclusions = [],
  onApply,
  onClose,
}) => {
  // Load global master terms for this category
  const masterTerms = getGlobalTerms(category);

  const masterInclusions = (masterTerms.inclusions || []).filter((t) => !t.isDefault).map((t) => t.text);
  const masterExclusions = (masterTerms.exclusions || []).filter((t) => !t.isDefault).map((t) => t.text);

  // Initialize selected collections from initial selections passed by parent, filtered to master list (non-defaults)
  const [selectedInclusions, setSelectedInclusions] = useState(
    initialInclusions.filter((t) => masterInclusions.includes(t))
  );
  const [selectedExclusions, setSelectedExclusions] = useState(
    initialExclusions.filter((t) => masterExclusions.includes(t))
  );

  const toggleInclusion = (text) => {
    setSelectedInclusions((prev) =>
      prev.includes(text) ? prev.filter((t) => t !== text) : [...prev, text]
    );
  };

  const toggleExclusion = (text) => {
    setSelectedExclusions((prev) =>
      prev.includes(text) ? prev.filter((t) => t !== text) : [...prev, text]
    );
  };

  const handleSelectAllInclusions = (itemsList, isSelectAll) => {
    setSelectedInclusions((prev) => {
      if (isSelectAll) {
        return Array.from(new Set([...prev, ...itemsList]));
      } else {
        return prev.filter((t) => !itemsList.includes(t));
      }
    });
  };

  const handleSelectAllExclusions = (itemsList, isSelectAll) => {
    setSelectedExclusions((prev) => {
      if (isSelectAll) {
        return Array.from(new Set([...prev, ...itemsList]));
      } else {
        return prev.filter((t) => !itemsList.includes(t));
      }
    });
  };

  const totalSelectedCount = selectedInclusions.length + selectedExclusions.length;

  const inclusionsEmpty = masterInclusions.length === 0;
  const exclusionsEmpty = masterExclusions.length === 0;

  const footer = (
    <div className="flex justify-end gap-3 modal-no-print">
      <button
        type="button"
        onClick={onClose}
        className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-bg-soft transition-all"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={inclusionsEmpty && exclusionsEmpty}
        onClick={() => {
          onApply(selectedInclusions, selectedExclusions);
        }}
        className={`px-5 py-2 rounded-lg text-white text-sm font-medium transition-all shadow-sm ${
          inclusionsEmpty && exclusionsEmpty
            ? "bg-slate-300 cursor-not-allowed opacity-60"
            : "bg-select-blue hover:bg-primary"
        }`}
      >
        Apply Selection {totalSelectedCount > 0 ? `(${totalSelectedCount})` : ""}
      </button>
    </div>
  );

  const renderContent = () => {
    if (inclusionsEmpty && exclusionsEmpty) {
      return (
        <div className="flex flex-col items-center justify-center text-center h-[240px] w-full space-y-2 select-none border border-dashed border-slate-200 rounded-xl bg-slate-50/40 p-6">
          <p className="text-[13px] font-semibold text-textcolor/70">
            No Included or Not Included Items available.
          </p>
          <p className="text-[12px] text-text-subtle">
            Please navigate to the <MasterNavLink text="Master Module" tab="terms" sub={category} /> to add items.
          </p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-6 py-2 select-none h-[240px]">
        {/* Included Column (always on the left) */}
        <div className="flex flex-col relative h-[240px]">
          {inclusionsEmpty ? (
            <div className="flex flex-col items-center justify-center text-center h-full space-y-2 select-none border border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/40">
              <p className="text-[12.5px] font-semibold text-textcolor/70">
                No Included Items available.
              </p>
              <p className="text-[11.5px] text-text-subtle leading-relaxed">
                Please navigate to the <MasterNavLink text="Master Module" tab="terms" sub={category} /> to add Included Items.
              </p>
            </div>
          ) : (
            <>
              <FloatingDropdown
                label="INCLUDED ITEMS"
                items={masterInclusions}
                selected={selectedInclusions}
                onToggle={toggleInclusion}
                onSelectAllToggle={handleSelectAllInclusions}
                accent="green"
                placeholder="Select items..."
              />
              <div 
                style={{ height: '170px', scrollBehavior: 'smooth' }}
                className="mt-3 overflow-y-auto scroll-hidden-bar scroll-smooth space-y-0.5"
              >
                {selectedInclusions.map((item, idx) => (
                  <SelectedItemRow
                    key={idx}
                    label={item}
                    accent="green"
                    onToggle={() => toggleInclusion(item)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Not Included Column (always on the right) */}
        <div className="flex flex-col relative h-[240px]">
          {exclusionsEmpty ? (
            <div className="flex flex-col items-center justify-center text-center h-full space-y-2 select-none border border-dashed border-slate-200 rounded-lg p-4 bg-slate-50/40">
              <p className="text-[12.5px] font-semibold text-textcolor/70">
                No Not Included Items available.
              </p>
              <p className="text-[11.5px] text-text-subtle leading-relaxed">
                Please navigate to the <MasterNavLink text="Master Module" tab="terms" sub={category} /> to add Not Included Items.
              </p>
            </div>
          ) : (
            <>
              <FloatingDropdown
                label="NOT INCLUDED ITEMS"
                items={masterExclusions}
                selected={selectedExclusions}
                onToggle={toggleExclusion}
                onSelectAllToggle={handleSelectAllExclusions}
                accent="red"
                placeholder="Select items..."
              />
              <div 
                style={{ height: '170px', scrollBehavior: 'smooth' }}
                className="mt-3 overflow-y-auto scroll-hidden-bar scroll-smooth space-y-0.5"
              >
                {selectedExclusions.map((item, idx) => (
                  <SelectedItemRow
                    key={idx}
                    label={item}
                    accent="red"
                    onToggle={() => toggleExclusion(item)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Modal
      title={`${categoryLabel} Terms & Conditions`}
      subtitle={`Configure additional ${categoryLabel.toLowerCase()} inclusions and exclusions (standard defaults are applied automatically).`}
      onClose={onClose}
      maxWidth="w-[760px] max-w-[760px]"
      maxHeight="h-[480px] max-h-[480px]"
      footer={footer}
    >
      {renderContent()}
    </Modal>
  );
};

export default CategoryTermsModal;
