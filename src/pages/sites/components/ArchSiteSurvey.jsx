import { useMemo, useState } from "react";
import {
  FiPlus,
  FiSave,
  FiCopy,
  FiTrash2,
  FiAlertTriangle,
  FiCheckCircle,
  FiCrosshair,
} from "react-icons/fi";
import NumericInput from "../../../components/NumericInput";
import {
  getArchSurvey,
  saveArchSurvey,
  blankRow,
  computeNetQty,
  rowMissing,
  summarize,
  formatUnitTotals,
  fmtQty,
  UNIT_OPTIONS,
} from "../../../data/archSurveyStorage";

const inputCls =
  "w-full rounded-lg border border-bordergray bg-white px-3 py-2 text-[12.5px] text-textcolor focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 placeholder:text-text-subtle";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1";

const TextField = ({ label, value, onChange, placeholder }) => (
  <label className="block">
    <span className={labelCls}>{label}</span>
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls}
    />
  </label>
);

const NumField = ({ label, value, onChange }) => (
  <label className="block">
    <span className={labelCls}>{label}</span>
    <NumericInput
      value={value}
      onChange={onChange}
      placeholder="0"
      className={inputCls}
    />
  </label>
);

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-bg-soft/50 px-4 py-3">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
      {label}
    </p>
    <p className="mt-0.5 text-[15px] font-bold text-darkgray">{value}</p>
  </div>
);

const fmtSavedAt = (iso) => {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d
    .toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase();
  return `${date}, ${time}`;
};

// One measurement row card — the full survey-sheet columns for an item.
const MeasurementRow = ({ index, row, onChange, onDuplicate, onRemove }) => {
  const missing = rowMissing(row);
  const ready = missing.length === 0;
  const netQty = computeNetQty(row);
  const set = (key) => (val) => onChange(row.id, { [key]: val });

  return (
    <div
      className={`rounded-2xl border p-5 ${
        ready ? "border-gray-100 bg-white" : "border-amber-200 bg-amber-50/40"
      }`}
    >
      {/* Row header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h4 className="text-[13.5px] font-bold text-darkgray">
            Measurement Row {index + 1}
          </h4>
          {ready ? (
            <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
              <FiCheckCircle size={11} /> Ready
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100/70 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
              <FiAlertTriangle size={11} /> Needs correction
            </span>
          )}
          {!ready && (
            <span className="text-[11.5px] font-medium text-amber-700">
              Missing: {missing.join(", ")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold ${
              ready
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-500"
            }`}
          >
            Net Qty: {netQty.toFixed(3)} {row.unit}
          </span>
          <button
            type="button"
            onClick={() => onDuplicate(row.id)}
            title="Duplicate row"
            className="rounded-lg border border-bordergray p-1.5 text-text-muted hover:bg-bg-soft"
          >
            <FiCopy size={14} />
          </button>
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            title="Delete row"
            className="rounded-lg border border-rose-200 p-1.5 text-rose-400 hover:bg-rose-50 hover:text-rose-500"
          >
            <FiTrash2 size={14} />
          </button>
        </div>
      </div>

      {/* Location / classification */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <TextField label="Block / Tower" value={row.blockTower} onChange={set("blockTower")} placeholder="Block A" />
        <TextField label="Floor" value={row.floor} onChange={set("floor")} placeholder="G/F" />
        <TextField label="Room / Area" value={row.roomArea} onChange={set("roomArea")} placeholder="Lobby" />
        <TextField label="Work Category" value={row.workCategory} onChange={set("workCategory")} placeholder="Civil" />
        <TextField label="Sub-Category" value={row.subCategory} onChange={set("subCategory")} placeholder="Masonry" />
      </div>

      {/* Item description */}
      <div className="mb-3">
        <TextField
          label="Item Description"
          value={row.itemDescription}
          onChange={set("itemDescription")}
          placeholder="Brick wall construction"
        />
      </div>

      {/* Measurement inputs */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <NumField label="Nos" value={row.nos} onChange={set("nos")} />
        <NumField label="Length" value={row.length} onChange={set("length")} />
        <NumField label="Breadth" value={row.breadth} onChange={set("breadth")} />
        <NumField label="Height" value={row.height} onChange={set("height")} />
        <NumField label="Deduction" value={row.deduction} onChange={set("deduction")} />
        <label className="block">
          <span className={labelCls}>Unit</span>
          <select
            value={row.unit}
            onChange={(e) => set("unit")(e.target.value)}
            className={`${inputCls} cursor-pointer`}
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u.code} value={u.code}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Net Quantity</span>
          <input
            value={netQty.toFixed(3)}
            readOnly
            className={`${inputCls} cursor-default bg-bg-soft/60 font-bold`}
          />
        </label>
      </div>

      {/* Provenance */}
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TextField label="Drawing / Photo Ref" value={row.drawingRef} onChange={set("drawingRef")} placeholder="DWG-A-101 / Photo 03" />
        <TextField label="Measured By" value={row.measuredBy} onChange={set("measuredBy")} placeholder="Surveyor name" />
        <TextField label="Checked By" value={row.checkedBy} onChange={set("checkedBy")} placeholder="Checker name" />
        <label className="block">
          <span className={labelCls}>Measurement Date</span>
          <input
            type="date"
            value={row.measurementDate || ""}
            onChange={(e) => set("measurementDate")(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {/* Remarks */}
      <label className="block">
        <span className={labelCls}>Remarks</span>
        <textarea
          rows={2}
          value={row.remarks || ""}
          onChange={(e) => set("remarks")(e.target.value)}
          placeholder="Site notes, assumptions, hold points"
          className={`${inputCls} resize-none`}
        />
      </label>
    </div>
  );
};

// Architecture site survey measurements — the AS-IS existing-site take-off.
// Final BOQ quantities are prepared later from approved design / GFC drawings;
// these rows are the survey reference the design take-off is checked against.
const ArchSiteSurvey = ({ site }) => {
  const siteID = site.siteID;
  const [rows, setRows] = useState(() => getArchSurvey(siteID).rows);
  const [savedAt, setSavedAt] = useState(() => getArchSurvey(siteID).savedAt);
  const [dirty, setDirty] = useState(false);

  // Reload from storage when navigating to a different site — SiteDetail isn't
  // remounted on a route-param change. Render-time reset (React's recommended
  // pattern) instead of an effect that sets state.
  const [loadedSiteID, setLoadedSiteID] = useState(siteID);
  if (siteID !== loadedSiteID) {
    const data = getArchSurvey(siteID);
    setLoadedSiteID(siteID);
    setRows(data.rows);
    setSavedAt(data.savedAt);
    setDirty(false);
  }

  const stats = useMemo(() => summarize(rows), [rows]);

  const addRow = () => {
    setRows((prev) => [...prev, blankRow()]);
    setDirty(true);
  };

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const duplicateRow = (id) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx < 0) return prev;
      const clone = { ...prev[idx], id: blankRow().id };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setDirty(true);
  };

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const save = () => {
    const saved = saveArchSurvey(siteID, rows);
    setSavedAt(saved.savedAt);
    setDirty(false);
  };

  const reviewReady = stats.total > 0 && stats.needsCorrection === 0;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-[16px] font-bold text-darkgray">
            Architecture Site Survey Measurements
          </h2>
          <p className="mt-0.5 text-[12px] text-text-muted">
            Capture existing-site measurements from the survey. Final BOQ
            quantities are prepared later from approved design/GFC drawings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg border border-bordergray bg-white px-3.5 py-2 text-[12.5px] font-semibold text-grey hover:bg-bg-soft"
          >
            <FiPlus size={14} /> Add Row
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="flex items-center gap-1.5 rounded-lg bg-select-blue px-4 py-2 text-[12.5px] font-bold text-white shadow-sm hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiSave size={14} /> Save Measurements
          </button>
        </div>
      </div>

      {/* ── Header stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 border-b border-gray-100 px-6 py-4 lg:grid-cols-4">
        <Stat label="Rows" value={stats.total} />
        <Stat label="Survey Ready" value={`${stats.ready} / ${stats.total}`} />
        <Stat label="Unit Totals" value={formatUnitTotals(stats.unitTotals)} />
        <Stat label="Last Saved" value={fmtSavedAt(savedAt)} />
      </div>

      {/* ── Measurement review ─────────────────────────────────────────── */}
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-bold text-darkgray">
              Measurement Review
            </h3>
            <p className="text-[11.5px] text-text-muted">
              Review submitted survey rows before they are used as design
              take-off reference.
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold ${
              reviewReady
                ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                : "border-amber-200 bg-amber-50 text-amber-600"
            }`}
          >
            {reviewReady ? "Survey Ready" : "Complete Survey Rows"}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-emerald-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Ready Rows
            </p>
            <p className="mt-0.5 text-[15px] font-bold text-darkgray">
              {stats.ready}
            </p>
          </div>
          <div className="rounded-xl border border-amber-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">
              Needs Correction
            </p>
            <p className="mt-0.5 text-[15px] font-bold text-darkgray">
              {stats.needsCorrection}
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
              Overall Quantity
            </p>
            <p className="mt-0.5 text-[15px] font-bold text-darkgray">
              {formatUnitTotals(stats.unitTotals)}
            </p>
          </div>
        </div>

        {/* Work category totals */}
        <div className="mt-3 rounded-xl bg-bg-soft/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
              Work Category Totals
            </p>
            <span className="text-[11px] text-text-subtle">
              {stats.categoryTotals.length} categor
              {stats.categoryTotals.length === 1 ? "y" : "ies"}
            </span>
          </div>
          {stats.categoryTotals.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-text-muted">
              Add measurement rows to see category totals.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {stats.categoryTotals.map(({ category, units }) => (
                <span
                  key={category}
                  className="flex items-center gap-1.5 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[11.5px]"
                >
                  <FiCrosshair size={11} className="text-select-blue" />
                  <span className="font-semibold text-darkgray">{category}</span>
                  <span className="text-text-muted">
                    {Object.entries(units)
                      .map(([u, q]) => `${fmtQty(q)} ${u}`)
                      .join(" · ")}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Rows / empty state ─────────────────────────────────────────── */}
      <div className="space-y-4 px-6 py-5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bordergray bg-bg-soft/30 px-6 py-10 text-center">
            <p className="text-[14px] font-bold text-darkgray">
              No measurement rows yet.
            </p>
            <p className="mt-1 text-[12px] text-text-muted">
              Add a row to start capturing floor, area, work item and quantity.
            </p>
          </div>
        ) : (
          rows.map((row, i) => (
            <MeasurementRow
              key={row.id}
              index={i}
              row={row}
              onChange={updateRow}
              onDuplicate={duplicateRow}
              onRemove={removeRow}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ArchSiteSurvey;
