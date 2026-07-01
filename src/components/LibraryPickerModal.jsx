import { useMemo, useState } from "react";
import { Search, X, Library, Clock } from "lucide-react";
import { listLibrary } from "../data/itemLibrary";
import { UNITS } from "../data/boqUnits";

/**
 * Standalone Library Picker modal — pick a work item from the (category-free)
 * Item Master to add to a scope of work.
 *
 * Props:
 *   onClose  — close the modal
 *   onPick   — callback with the selected library item
 *   excludeId — optional item id to exclude from the list
 */
const LibraryPickerModal = ({ excludeId, onClose, onPick }) => {
  const [items] = useState(() => listLibrary());
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => it.id !== excludeId)
      .filter((it) => {
        if (!q) return true;
        return (
          (it.description || "").toLowerCase().includes(q) ||
          (it.hsn || "").toLowerCase().includes(q) ||
          (it.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
  }, [items, query, excludeId]);

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between bg-linear-to-r from-select-blue/5 to-white">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-select-blue/10 text-select-blue flex items-center justify-center">
              <Library size={14} />
            </span>
            <div>
              <h3 className="text-[13px] font-bold text-textcolor">
                Pick from Library
              </h3>
              <p className="text-[10.5px] text-text-muted">
                Choose a work item to add to the scope of work
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-bordergray flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] text-text-muted font-medium">
            {filtered.length} work item{filtered.length === 1 ? "" : "s"}
          </span>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, HSN, tag"
              className="bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30 w-[260px]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-center text-[11.5px] text-text-subtle py-8">
              No items match
            </p>
          ) : (
            filtered.map((it) => {
              const unitLabel =
                UNITS.find((u) => u.code === it.unit)?.label || it.unit;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onPick(it)}
                  className="w-full text-left rounded-lg border border-bordergray bg-white hover:border-select-blue hover:bg-active-bg/30 px-3 py-2 transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-semibold text-textcolor truncate">
                      {it.description}
                    </p>
                    <p className="text-[10px] text-text-muted flex items-center gap-2 flex-wrap mt-0.5">
                      <span className="font-semibold">{unitLabel}</span>
                      {(it.days ?? "") !== "" && (
                        <span className="flex items-center gap-0.5">
                          <Clock size={9} /> {it.days}d
                        </span>
                      )}
                      <span>GST {it.gstPercent}%</span>
                      {it.recipes && (
                        <span className="text-[8.5px] font-bold uppercase tracking-wider text-select-blue bg-active-bg px-1.5 py-0.5 rounded">
                          {it.defaultGrade || "premium"} · built-up
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[12px] font-bold text-textcolor tabular-nums shrink-0">
                    ₹{Number(it.rate || 0).toLocaleString("en-IN")}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default LibraryPickerModal;
