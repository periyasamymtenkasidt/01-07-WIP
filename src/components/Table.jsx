import { useState, useEffect, useRef, useMemo } from "react";
import Pagination from "./table/Pagination";
import SortDropdown from "./table/SortDropdown";
import FilterDropdown from "./table/FilterDropdown";
import DateRangeButton from "./table/DateRangeButton";
import ExportButton from "./table/ExportButton";

/**
 * Props:
 *   title, subtitle      — page-level heading
 *   actions              — ReactNode rendered right of title (e.g. Add button)
 *   columns              — [{ key, label, render? }]
 *   data                 — full unfiltered dataset
 *   rowsPerPage          — default 8
 *   onRowClick, activeRow, activeRowKey
 *   emptyMessage
 *   sortFields           — [{ key, label }]
 *   filterFields         — [{ key, label, options: string[] }]
 *   dateRangeField       — { key, parse: (value) => Date|null }
 *   exportConfig         — { filename, columns: [{ label, key?, render? }] }
 *   mainTabs             — string[] — skeuomorphic folder tabs (top row)
 *   subTabs              — string[] — underline tabs (second row)
 *   defaultMainTab       — number (default 0)
 *   defaultSubTab        — number (default 0)
 *   onMainTabChange      — (index) => void
 *   onSubTabChange       — (index) => void
 *   children             — fallback render prop: (toolbar) => JSX, used when no tabs
 */
const Table = ({
  title,
  subtitle,
  actions,
  children,
  columns = [],
  data = [],
  rowsPerPage = 8,
  onRowClick,
  activeRowKey = "id",
  emptyMessage = "No records found.",
  sortFields,
  filterFields,
  dateRangeField,
  exportConfig,
  mainTabs,
  subTabs,
  defaultMainTab = 0,
  defaultSubTab = 0,
  onMainTabChange,
  onSubTabChange,
  clickableColumns = [],
  onCellClick,
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: "", direction: "asc" });
  const [filterValues, setFilterValues] = useState(() =>
    (filterFields || []).reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}),
  );
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [currentPage, setCurrentPage] = useState(1);
  const [activeMainTab, setActiveMainTab] = useState(defaultMainTab);
  const [activeSubTab, setActiveSubTab] = useState(defaultSubTab);
  const [selectedRowId, setSelectedRowId] = useState(null);

  const handleMainTabClick = (idx) => {
    setActiveMainTab(idx);
    onMainTabChange?.(idx);
  };

  const handleSubTabClick = (idx) => {
    setActiveSubTab(idx);
    onSubTabChange?.(idx);
  };

  const toolbarRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setCurrentPage(1);
  }

  const processedData = useMemo(() => {
    let result = [...data];

    if (filterFields) {
      result = result.filter((item) =>
        filterFields.every((field) => {
          const active = filterValues[field.key];
          if (!active) return true;
          return (
            item[field.key]?.toString().toLowerCase() === active.toLowerCase()
          );
        }),
      );
    }

    if (dateRangeField && (dateRange.start || dateRange.end)) {
      result = result.filter((item) => {
        const date = dateRangeField.parse(item[dateRangeField.key]);
        if (!date) return true;
        if (dateRange.start && date < new Date(dateRange.start)) return false;
        if (dateRange.end && date > new Date(dateRange.end)) return false;
        return true;
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filterValues, dateRange, sortConfig, filterFields, dateRangeField]);

  const totalPages = Math.ceil(processedData.length / rowsPerPage) || 1;
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageData = processedData.slice(startIdx, startIdx + rowsPerPage);
  const fromEntry = processedData.length === 0 ? 0 : startIdx + 1;
  const toEntry = Math.min(startIdx + rowsPerPage, processedData.length);

  const toggle = (name) =>
    setActiveDropdown((prev) => (prev === name ? null : name));

  const hasTabs = mainTabs?.length > 0 || subTabs?.length > 0;
  const hasToolbar =
    sortFields || filterFields || dateRangeField || exportConfig;

  const toolbar = hasToolbar ? (
    <div className="flex items-center gap-2" ref={toolbarRef}>
      {dateRangeField && (
        <DateRangeButton
          value={dateRange}
          onChange={(val) => {
            setDateRange(val);
            setCurrentPage(1);
          }}
          isOpen={activeDropdown === "dateRange"}
          onToggle={() => toggle("dateRange")}
          onClose={() => setActiveDropdown(null)}
        />
      )}
      {sortFields && (
        <SortDropdown
          fields={sortFields}
          value={sortConfig}
          onChange={(val) => {
            setSortConfig(val);
            setCurrentPage(1);
          }}
          isOpen={activeDropdown === "sort"}
          onToggle={() => toggle("sort")}
        />
      )}
      {filterFields && (
        <FilterDropdown
          fields={filterFields}
          values={filterValues}
          onChange={(val) => {
            setFilterValues(val);
            setCurrentPage(1);
          }}
          isOpen={activeDropdown === "filter"}
          onToggle={() => toggle("filter")}
        />
      )}
      {exportConfig && (
        <ExportButton data={processedData} config={exportConfig} />
      )}
    </div>
  ) : null;

  return (
    <div className="h-full w-full min-w-0 flex flex-col p-1.5 overflow-hidden">
      {activeDropdown === "dateRange" && (
        <div className="fixed inset-0  z-40" />
      )}

      {/* Tabs + Toolbar section (title/subtitle/actions live here when mainTabs present) */}
      {hasTabs ? (
        <div className="flex flex-col pt-2 px-2">
          {mainTabs?.length > 0 && (
            <>
              {/* Title + actions sit above the folder tabs (flex justify-between) */}
              {(title || subtitle || actions) && (
                <div className="flex justify-between items-center mb-1 px-0.5">
                  <span>
                    {title && (
                      <h3 className="text-primary text-3xl font-semibold">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-text-muted text-xs mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </span>
                  {actions}
                </div>
              )}
              {/* Folder tabs — toolbar sits on the right (flex justify-between) */}
              <div className="flex justify-between items-end">
                <div className="overflow-x-auto min-w-0 scroll-hidden-bar">
                  <div className="flex gap-7 items-end pl-2 relative z-20">
                    {mainTabs.map((tab, idx) => {
                      const isActive = activeMainTab === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleMainTabClick(idx)}
                          className={`relative cursor-pointer flex items-center h-[42px] ${isActive ? "z-20" : "z-10"} ${idx > 0 ? "-ml-4" : ""}`}
                        >
                          <div
                            className={`relative flex items-center px-6 h-full rounded-t-[16px] transition-colors duration-200 z-20 ${
                              isActive
                                ? "bg-white text-dark-blue font-semibold text-[15px]"
                                : "bg-bordergray text-secondary"
                            }`}
                          >
                            <span className="relative z-30 tracking-wide">
                              {tab}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="shrink-0 pb-1">{toolbar}</div>
              </div>
            </>
          )}
          {/* When only subTabs (no mainTabs): standalone title row then subTabs + toolbar */}
          {!mainTabs?.length && (title || subtitle || actions) && (
            <div className="flex justify-between items-center mb-2">
              <span>
                {title && (
                  <h3 className="text-primary text-3xl font-semibold">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>
                )}
              </span>
              {actions}
            </div>
          )}
          {/* Sub-tabs row */}
          {subTabs?.length > 0 && (
            <div
              className={`flex ${!mainTabs?.length ? "justify-between items-start gap-2" : ""}`}
            >
              <div className="overflow-x-auto min-w-0 scroll-hidden-bar">
                <div className="relative z-10 flex bg-white w-max items-center pr-8 ml-2 rounded-bl-[16px] rounded-br-[16px] rounded-tr-[16px] -mt-px">
                  <div className="flex gap-8 px-6 pt-3 pb-0 relative z-30">
                    {subTabs.map((tab, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubTabClick(i)}
                        className={`pb-3 pt-1 text-[15px] transition-all relative whitespace-nowrap ${
                          activeSubTab === i
                            ? "text-dark-blue font-semibold"
                            : "text-secondary hover:text-dark-blue"
                        }`}
                      >
                        {tab}
                        {activeSubTab === i && (
                          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-dark-blue rounded-t-lg" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {!mainTabs?.length && (
                <div className="shrink-0 pt-2">{toolbar}</div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* No tabs: standalone title row + optional children/toFolbar */
        <>
          {(title || subtitle || actions) && (
            <div className="flex justify-between items-center mb-2 px-1.5">
              <span>
                {title && (
                  <h3 className="text-primary text-3xl font-semibold">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>
                )}
              </span>
              {actions}
            </div>
          )}
          {children &&
            (typeof children === "function" ? children(toolbar) : children)}
        </>
      )}

      {/* Row 3: Table */}
      <div className="flex-1 min-h-0 px-1.5">
        <div className="h-full overflow-x-auto overflow-y-auto">
          <table className="w-full text-sm border-separate border-spacing-y-0.5 text-center min-w-[700px]">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={col.key || i}
                    className={`py-4 px-3 font-medium whitespace-nowrap bg-white text-primary sticky top-0 z-10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]
                      ${i === 0 ? "rounded-l-2xl pl-5" : ""}
                      ${i === columns.length - 1 ? "rounded-r-2xl pr-5" : ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="py-16 text-text-muted text-sm text-center bg-white rounded-2xl shadow-sm"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                pageData.map((item, index) => {
                  const rowId = item[activeRowKey] ?? index;
                  const isSelected =
                    selectedRowId != null && selectedRowId === rowId;
                  const isClickableRow =
                    clickableColumns.length > 0 || onRowClick;
                  return (
                    <tr
                      key={index}
                      onClick={() => {
                        setSelectedRowId(rowId);
                        if (!clickableColumns.length && onRowClick) {
                          onRowClick(item);
                        }
                      }}
                      className={`text-sm transition-all duration-200 group hover:-translate-y-px ${isClickableRow ? "cursor-pointer" : ""}`}
                    >
                      {columns.map((col, colIdx) => {
                        const isFirst = colIdx === 0;
                        const isLast = colIdx === columns.length - 1;
                        const isClickableCell = clickableColumns.includes(
                          col.key,
                        );

                        const bgClass = isSelected
                          ? "bg-active-bg shadow-[0_4px_15px_rgba(0,0,0,0.08)]"
                          : "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.03)] group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.06)] group-hover:bg-gray-50/50";
                        const borderClass = isSelected
                          ? isFirst
                            ? "border-l-[3px] border-l-select-blue border-t-[1.5px] border-b-[1.5px] border-t-select-blue/30 border-b-select-blue/30"
                            : isLast
                              ? "border-r-[3px] border-r-select-blue border-t-[1.5px] border-b-[1.5px] border-t-select-blue/30 border-b-select-blue/30"
                              : "border-t-[1.5px] border-b-[1.5px] border-t-select-blue/30 border-b-select-blue/30"
                          : "";

                        return (
                          <td
                            key={col.key || colIdx}
                            onClick={(e) => {
                              if (isClickableCell && onCellClick) {
                                e.stopPropagation();
                                setSelectedRowId(rowId);
                                onCellClick(item);
                              }
                            }}
                            className={`py-3.5 px-3 transition-colors
                              ${isFirst ? "rounded-l-2xl pl-5" : ""}
                              ${isLast ? "rounded-r-2xl pr-5" : ""}
                              ${bgClass} ${borderClass}
                              ${isClickableCell ? "cursor-pointer hover:text-select-blue hover:underline underline-offset-2" : ""}`}
                          >
                            {col.render
                              ? col.render(item[col.key], item, index)
                              : item[col.key]}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer — pinned below the scroll area */}
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        fromEntry={fromEntry}
        toEntry={toEntry}
        totalCount={processedData.length}
      />
    </div>
  );
};

export default Table;
