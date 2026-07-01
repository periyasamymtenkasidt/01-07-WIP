/**
 * Universal tab bar — two visual variants.
 *
 * Props:
 *   tabs      — string[]
 *   active    — number (controlled)
 *   onChange  — (index) => void
 *   variant   — "folder" (skeuomorphic main tabs) | "underline" (sub-tabs)
 */
const TabBar = ({ tabs = [], active = 0, onChange, variant = "folder" }) => {
  if (variant === "folder") {
    return (
      <div className="flex gap-7 items-end pl-3.5 relative z-20">
        {tabs.map((tab, idx) => {
          const isActive = active === idx;
          return (
            <div
              key={idx}
              onClick={() => onChange?.(idx)}
              className={`relative cursor-pointer flex items-center h-[42px] ${isActive ? "z-20" : "z-10"} ${idx > 0 ? "-ml-4" : ""}`}
            >
              <div
                className={`relative flex items-center px-6 h-full rounded-tl-[16px] transition-colors duration-200 z-20 ${
                  isActive
                    ? "bg-white text-dark-blue font-semibold text-[15px]"
                    : "bg-bordergray text-secondary"
                }`}
              >
                <span className="relative z-30 tracking-wide">{tab}</span>
              </div>
              <div
                className="bg-gray-200 text-gray-600 px-6 py-3 rounded-full 
               [clip-path:polygon(0%_0%,85%_0%,100%_50%,85%_100%,0%_100%)]"
              />
            </div>
          );
        })}
      </div>
    );
  }

  if (variant === "underline") {
    return (
      <div className="flex gap-6 border-b border-bordergray mb-6">
        {tabs.map((tab, idx) => {
          const isActive = active === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChange?.(idx)}
              className={`pb-3 text-xs font-bold px-4 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                isActive
                  ? "border-select-blue text-select-blue"
                  : "border-transparent text-text-muted hover:text-darkgray"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};

export default TabBar;
