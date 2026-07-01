import React, { useState, useRef, useEffect, useMemo } from "react";
import { X, Plus, Folder, AlertCircle, Lock, Search } from "lucide-react";
import {
  getCategoryFromHeading,
  addScheduleHeading,
  getRoomCategoryPresets,
} from "../data/scheduleConfig";

/**
 * Reusable modal for selecting a destination heading or creating a new one.
 * The preset list defaults to the Schedule Master scope presets, but callers
 * can override it via `roomPresets` (the Proposal Master passes its room list
 * so this prompt offers rooms, not scopes).
 *
 * Shows ALL available headings from ALL categories so users can assign scopes
 * from one category to another category heading. The "Create New" form still
 * locks the prefix to the *resolved* category of the item being assigned.
 *
 * Previously selected scopes remain visible — duplicate detection is handled
 * by the caller's duplicate-warning workflow, not by hiding headings.
 */
const DestinationPromptModal = ({
  isOpen,
  onClose,
  itemName,
  itemCategory,
  existingHeadings = [],
  headingsWithItem = [],
  onSelect,
  onCreateNew,
  // Optional list of preset heading names. When provided, replaces the
  // Schedule Master scope presets fetched internally.
  roomPresets = null,
}) => {
  const [newHeadingSuffix, setNewHeadingSuffix] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef(null);
  const searchRef = useRef(null);

  // Resolve the category — from the prop or inferred from the item category
  const resolvedCategory = useMemo(() => {
    if (!itemCategory) return "";
    // Get the root category name from Schedule Master
    const cat = getCategoryFromHeading(itemCategory);
    return cat || itemCategory;
  }, [itemCategory]);

  // Get ALL headings from ALL room/category presets (not just the matched one).
  // This allows cross-category assignment (e.g. placing Living Room scope
  // under Dining Area heading).
  const scheduleHeadings = useMemo(() => {
    if (roomPresets) return roomPresets;
    return getRoomCategoryPresets().map((r) => r.name);
  }, [roomPresets]);

  // Merge schedule headings with existing scope headings (deduplicated)
  const allHeadings = useMemo(() => {
    const set = new Set();
    const result = [];
    scheduleHeadings.forEach((h) => {
      const upper = h.trim().toUpperCase();
      if (!set.has(upper)) {
        set.add(upper);
        result.push(h.trim());
      }
    });
    existingHeadings.forEach((h) => {
      const upper = h.trim().toUpperCase();
      if (!set.has(upper)) {
        set.add(upper);
        result.push(h.trim());
      }
    });
    return result;
  }, [scheduleHeadings, existingHeadings]);

  useEffect(() => {
    if (isOpen) {
      // Focus the search field when modal opens
      const timer = setTimeout(() => {
        searchRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      // Reset input value only when popup closes
      setNewHeadingSuffix("");
      setError("");
      setSearch("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Do NOT filter out headings that already contain this item —
  // they remain visible and selectable. Duplicate detection is handled
  // by the caller's duplicate-warning workflow.
  const availableHeadings = allHeadings;

  // Apply search filter
  const searchedHeadings = search.trim()
    ? availableHeadings.filter((h) =>
        h.toUpperCase().includes(search.trim().toUpperCase()),
      )
    : availableHeadings;

  const handleCreateNewSubmit = (e) => {
    e.preventDefault();
    const suffix = newHeadingSuffix.trim();

    if (!suffix) {
      setError("Please enter a heading name suffix.");
      return;
    }

    const newHeading = resolvedCategory
      ? `${resolvedCategory} - ${suffix}`.toUpperCase()
      : suffix.toUpperCase();

    // Check if heading exists — just select it
    const existingMatch = allHeadings.find(
      (h) => h.trim().toUpperCase() === newHeading,
    );
    if (existingMatch) {
      // Persist to Schedule Master and select
      addScheduleHeading(existingMatch, resolvedCategory);
      onSelect(existingMatch.toUpperCase());
      return;
    }

    // Create new heading in Schedule Master and assign
    addScheduleHeading(newHeading, resolvedCategory);
    onCreateNew(newHeading);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[10000] animate-fade-in p-4"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-bordergray transform scale-100 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-bg-soft border-b border-bordergray">
          <div>
            <h3 className="text-[14px] font-bold text-textcolor">
              Select Destination Heading
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              Assigning:{" "}
              <span className="font-semibold text-textcolor">{itemName}</span>
              {resolvedCategory && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-semibold text-select-blue">
                    {resolvedCategory}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Search */}
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search headings…"
              className="w-full bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30"
            />
          </div>

          {/* List of all available headings */}
          <div>
            <h4 className="text-[10px] font-bold text-text-subtle tracking-wider uppercase mb-2">
              Available Headings
            </h4>
            {searchedHeadings.length === 0 ? (
              <p className="text-[11px] text-text-muted italic bg-bg-soft/40 p-3 rounded-lg border border-bordergray/50">
                {search.trim()
                  ? "No headings match your search."
                  : "No headings available."}
              </p>
            ) : (
              <div className="space-y-1.5">
                {searchedHeadings.map((heading) => {
                  const alreadyHasItem = headingsWithItem.some(
                    (ex) => ex.trim().toUpperCase() === heading.trim().toUpperCase(),
                  );
                  return (
                    <button
                      key={heading}
                      type="button"
                      onClick={() => onSelect(heading.toUpperCase())}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border bg-white hover:border-select-blue/30 hover:bg-active-bg/20 transition-all shadow-xs cursor-pointer text-left group ${
                        alreadyHasItem
                          ? "border-amber-200 bg-amber-50/30"
                          : "border-bordergray"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Folder
                          size={14}
                          className="text-select-blue shrink-0"
                        />
                        <span className="text-[12px] font-semibold text-textcolor group-hover:text-select-blue truncate uppercase">
                          {heading}
                        </span>
                      </div>
                      {alreadyHasItem && (
                        <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md shrink-0">
                          has item
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-bordergray my-4" />

          {/* Create New Heading Form. With a resolved category the prefix is
              locked (e.g. "KITCHEN - …"); without one the user can type a fully
              custom heading. */}
          <div>
            <h4 className="text-[10px] font-bold text-text-subtle tracking-wider uppercase mb-2">
              Or Create New Heading
            </h4>
            <form onSubmit={handleCreateNewSubmit} className="space-y-3">
              <div>
                {resolvedCategory ? (
                  /* Locked prefix + editable suffix */
                  <div className="flex items-center gap-0 border border-bordergray rounded-xl overflow-hidden bg-white focus-within:border-select-blue focus-within:ring-1 focus-within:ring-select-blue/15">
                    <div className="flex items-center gap-1 bg-bg-soft border-r border-bordergray px-3 py-2.5 shrink-0 select-none">
                      <Lock size={10} className="text-text-subtle" />
                      <span className="text-[12px] font-bold text-textcolor uppercase whitespace-nowrap">
                        {resolvedCategory}
                      </span>
                      <span className="text-[12px] text-text-muted font-medium">
                        {" "}
                        -{" "}
                      </span>
                    </div>
                    <input
                      ref={inputRef}
                      type="text"
                      value={newHeadingSuffix}
                      onChange={(e) => {
                        setNewHeadingSuffix(e.target.value);
                        setError("");
                      }}
                      placeholder="e.g. Island Area"
                      className="flex-1 px-3.5 py-2.5 text-[12px] text-darkgray uppercase font-semibold focus:outline-none placeholder-gray-400 bg-transparent"
                    />
                  </div>
                ) : (
                  <input
                    ref={inputRef}
                    type="text"
                    value={newHeadingSuffix}
                    onChange={(e) => {
                      setNewHeadingSuffix(e.target.value);
                      setError("");
                    }}
                    placeholder="e.g. COMMON BATHROOM"
                    className="bg-light-gray border border-bordergray text-[12px] text-darkgray rounded-xl px-3.5 py-2.5 w-full focus:outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-300 placeholder-gray-400 uppercase font-semibold"
                  />
                )}
                {error && (
                  <p className="text-red-500 text-[10px] mt-1.5 flex items-center gap-1">
                    <AlertCircle size={10} /> {error}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-select-blue hover:bg-select-blue/90 text-white text-[12px] font-bold shadow-md hover:scale-[1.01] transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>Create & Assign</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 bg-bg-soft border-t border-bordergray">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DestinationPromptModal;
