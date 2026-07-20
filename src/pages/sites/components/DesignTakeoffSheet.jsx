import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiPlus,
  FiSave,
  FiDownload,
  FiCopy,
  FiTrash2,
  FiCheckCircle,
  FiAlertTriangle,
  FiArrowRight,
  FiFileText,
  FiRefreshCw,
} from "react-icons/fi";
import NumericInput from "../../../components/NumericInput";
import {
  getTakeoff,
  saveTakeoff,
  blankTakeoffRow,
  computeNetQty,
  summarizeTakeoff,
  formatUnitTotals,
  fmtQty,
  importSurveyAsTakeoff,
  generateTenderBoqFromTakeoff,
  getArchSurvey,
  UNIT_OPTIONS,
  TAKEOFF_STATUSES,
} from "../../../data/archSurveyStorage";

const inputCls =
  "w-full rounded-lg border border-bordergray bg-white px-3 py-2 text-[12.5px] text-textcolor focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 placeholder:text-text-subtle";
const labelCls =
  "block text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1";

const fmtSavedAt = (iso) => {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `${date}, ${time}`;
};

const fmtApprovalTrace = () => {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = now
    .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    .toLowerCase();
  return `Approved ${date}, ${time}`;
};

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-bg-soft/50 px-4 py-3">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-subtle">
      {label}
    </p>
    <p className="mt-0.5 text-[15px] font-bold text-darkgray">{value}</p>
  </div>
);

const TextField = ({ label, value, onChange, placeholder, readOnly }) => (
  <label className="block">
    <span className={labelCls}>{label}</span>
    <input
      value={value || ""}
      onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`${inputCls} ${readOnly ? "cursor-default bg-bg-soft/60" : ""}`}
    />
  </label>
);

const NumField = ({ label, value, onChange }) => (
  <label className="block">
    <span className={labelCls}>{label}</span>
    <NumericInput value={value} onChange={onChange} placeholder="0" className={inputCls} />
  </label>
);

const STATUS_BADGE = {
  draft: "border-slate-200 bg-slate-50 text-slate-600",
  checked: "border-blue-200 bg-blue-50 text-blue-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const TakeoffRow = ({ index, row, onChange, onDuplicate, onRemove, editable }) => {
  const netQty = computeNetQty(row);
  const set = (key) => (val) => onChange(row.id, { [key]: val });

  const handleStatusChange = (newStatus) => {
    const patch = { status: newStatus };
    if (newStatus === "approved" && !row.approvalTrace) {
      patch.approvalTrace = fmtApprovalTrace();
    } else if (newStatus !== "approved") {
      patch.approvalTrace = "";
    }
    onChange(row.id, patch);
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      {/* Row header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-[13.5px] font-bold text-darkgray">
            Take-off Row {index + 1}
          </h4>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
              STATUS_BADGE[row.status] || STATUS_BADGE.draft
            }`}
          >
            {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          </span>
          {row.source === "site-survey" && (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-600">
              Imported from Site Survey
            </span>
          )}
          <span className="rounded-full bg-bg-soft px-2.5 py-0.5 text-[11px] font-bold text-select-blue tabular-nums">
            Net: {fmtQty(netQty)} {row.unit}
          </span>
        </div>
        {editable && (
          <div className="flex items-center gap-1.5">
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
        )}
      </div>

      {/* ── 1. Location (matches ArchSiteSurvey grouping) ─────────────────── */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <TextField label="Block / Tower" value={row.blockTower} onChange={set("blockTower")} placeholder="Block A" readOnly={!editable} />
        <TextField label="Floor" value={row.floor} onChange={set("floor")} placeholder="G/F" readOnly={!editable} />
        <TextField label="Room / Area" value={row.roomArea} onChange={set("roomArea")} placeholder="Lobby" readOnly={!editable} />
        <TextField label="Work Category" value={row.workCategory} onChange={set("workCategory")} placeholder="Civil" readOnly={!editable} />
        <TextField label="Sub-Category" value={row.subCategory} onChange={set("subCategory")} placeholder="Masonry" readOnly={!editable} />
      </div>

      {/* ── 2. Item Description (matches ArchSiteSurvey grouping) ─────────── */}
      <div className="mb-3">
        <TextField
          label="Item Description"
          value={row.itemDescription}
          onChange={set("itemDescription")}
          placeholder="Brick wall construction, RCC column, etc."
          readOnly={!editable}
        />
      </div>

      {/* ── 3. Drawing reference (tender-specific: ref + revision + spec code) */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <TextField label="Drawing Ref" value={row.drawingRef} onChange={set("drawingRef")} placeholder="DWG-A-101" readOnly={!editable} />
        <TextField label="Drawing Revision" value={row.drawingRevision} onChange={set("drawingRevision")} placeholder="R2" readOnly={!editable} />
        <TextField label="Specification Code" value={row.specificationCode} onChange={set("specificationCode")} placeholder="SP-CIV-04" readOnly={!editable} />
      </div>

      {/* ── 4. Measurements (matches ArchSiteSurvey grouping) ─────────────── */}
      <div className="mb-3 grid grid-cols-3 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <NumField label="Nos" value={row.nos} onChange={editable ? set("nos") : undefined} />
        <NumField label="Length" value={row.length} onChange={editable ? set("length") : undefined} />
        <NumField label="Breadth" value={row.breadth} onChange={editable ? set("breadth") : undefined} />
        <NumField label="Height" value={row.height} onChange={editable ? set("height") : undefined} />
        <NumField label="Deduction" value={row.deduction} onChange={editable ? set("deduction") : undefined} />
        <label className="block">
          <span className={labelCls}>Unit</span>
          <select
            value={row.unit}
            onChange={editable ? (e) => set("unit")(e.target.value) : undefined}
            disabled={!editable}
            className={`${inputCls} cursor-pointer disabled:cursor-default disabled:bg-bg-soft/60`}
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
            className={`${inputCls} cursor-default bg-bg-soft/60 font-bold text-select-blue`}
          />
        </label>
      </div>

      {/* ── 5. Provenance + approval ───────────────────────────────────────── */}
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <TextField
          label="Measured By"
          value={row.measuredBy}
          onChange={set("measuredBy")}
          placeholder="Surveyor name"
          readOnly={!editable}
        />
        <label className="block">
          <span className={labelCls}>Measurement Date</span>
          <input
            type="date"
            value={row.measurementDate || ""}
            onChange={editable ? (e) => set("measurementDate")(e.target.value) : undefined}
            readOnly={!editable}
            className={`${inputCls} ${!editable ? "cursor-default bg-bg-soft/60" : ""}`}
          />
        </label>
        <TextField label="Checked By" value={row.checkedBy} onChange={set("checkedBy")} placeholder="Checker name" readOnly={!editable} />
        <TextField label="Approved By" value={row.approvedBy} onChange={set("approvedBy")} placeholder="Approver name" readOnly={!editable} />
        <label className="block">
          <span className={labelCls}>Status</span>
          <select
            value={row.status}
            onChange={editable ? (e) => handleStatusChange(e.target.value) : undefined}
            disabled={!editable}
            className={`${inputCls} cursor-pointer disabled:cursor-default disabled:bg-bg-soft/60`}
          >
            {TAKEOFF_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label="Approval Trace"
          value={row.approvalTrace}
          readOnly
          placeholder="Auto-set on approval"
        />
      </div>

      {/* ── 6. Remarks ────────────────────────────────────────────────────── */}
      <label className="block">
        <span className={labelCls}>Remarks</span>
        <textarea
          rows={2}
          value={row.remarks || ""}
          onChange={editable ? (e) => set("remarks")(e.target.value) : undefined}
          readOnly={!editable}
          placeholder="Site notes, assumptions, hold points"
          className={`${inputCls} resize-none ${!editable ? "cursor-default bg-bg-soft/60" : ""}`}
        />
      </label>
    </div>
  );
};

const DesignTakeoffSheet = ({ site, existingBoqId, firmOwns, onBoqGenerated }) => {
  const navigate = useNavigate();
  const siteID = site?.siteID;

  const [rows, setRows] = useState(() => getTakeoff(siteID).rows);
  const [savedAt, setSavedAt] = useState(() => getTakeoff(siteID).savedAt);
  const [dirty, setDirty] = useState(false);

  // Reset when navigating to a different site without a component remount.
  const [loadedSiteID, setLoadedSiteID] = useState(siteID);
  if (siteID !== loadedSiteID) {
    const data = getTakeoff(siteID);
    setLoadedSiteID(siteID);
    setRows(data.rows);
    setSavedAt(data.savedAt);
    setDirty(false);
  }

  const stats = useMemo(() => summarizeTakeoff(rows), [rows]);

  const addRow = () => {
    setRows((prev) => [...prev, blankTakeoffRow()]);
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
      const clone = { ...prev[idx], id: blankTakeoffRow().id };
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
    const saved = saveTakeoff(siteID, rows);
    setSavedAt(saved.savedAt);
    setDirty(false);
  };

  const importSurvey = () => {
    const surveyRows = getArchSurvey(siteID).rows;
    if (surveyRows.length === 0) return;
    setRows((prev) => [...prev, ...importSurveyAsTakeoff(surveyRows)]);
    setDirty(true);
  };

  const generateBoq = () => {
    const boqId = generateTenderBoqFromTakeoff(site, rows);
    if (!boqId) return;
    onBoqGenerated?.(boqId);
    navigate(`/boq/${boqId}`);
  };

  const canGenerate = stats.approved > 0;
  const hasBOQ = !!existingBoqId;

  return (
    <div className="mb-5 rounded-2xl border border-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div>
          <h3 className="text-[16px] font-bold text-darkgray">
            Design Take-off Measurements
          </h3>
          <p className="mt-0.5 text-[12px] text-text-muted">
            Refine survey quantities against approved construction drawings before
            creating the Tender BOQ.
          </p>
        </div>
        {firmOwns && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={importSurvey}
              className="flex items-center gap-1.5 rounded-lg border border-bordergray bg-white px-3.5 py-2 text-[12.5px] font-semibold text-grey hover:bg-bg-soft"
              title="Append rows from the site survey"
            >
              <FiDownload size={13} /> Import Site Survey
            </button>
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 rounded-lg border border-bordergray bg-white px-3.5 py-2 text-[12.5px] font-semibold text-grey hover:bg-bg-soft"
            >
              <FiPlus size={13} /> Add Row
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="flex items-center gap-1.5 rounded-lg bg-select-blue px-4 py-2 text-[12.5px] font-bold text-white shadow-sm hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiSave size={13} /> Save Take-off
            </button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 border-b border-gray-100 px-6 py-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Rows" value={stats.total} />
        <Stat label="Draft / Checked" value={`${stats.draft} / ${stats.checked}`} />
        <Stat label="Approved" value={`${stats.approved} / ${stats.total}`} />
        <Stat label="Unit Totals" value={formatUnitTotals(stats.unitTotals) || "—"} />
        <Stat label="Last Saved" value={fmtSavedAt(savedAt)} />
      </div>

      {/* Tender BOQ Readiness */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
        <div>
          <p className="text-[14px] font-bold text-darkgray">Tender BOQ Readiness</p>
          <p className="text-[11.5px] text-text-muted">
            BOQ generation should use only valid rows that are approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold ${
              canGenerate
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {canGenerate ? (
              <FiCheckCircle size={12} />
            ) : (
              <FiAlertTriangle size={12} />
            )}
            {canGenerate ? "Ready for Tender BOQ" : "No approved rows yet"}
          </span>
          {firmOwns && (
            <button
              type="button"
              onClick={generateBoq}
              disabled={!canGenerate}
              title={canGenerate ? "" : "Approve take-off rows to enable BOQ generation"}
              className="flex items-center gap-1.5 rounded-lg bg-select-blue px-4 py-2 text-[12.5px] font-bold text-white shadow-sm hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiFileText size={13} />
              {hasBOQ ? "Regenerate Tender BOQ" : "Generate Tender BOQ"}
            </button>
          )}
        </div>
      </div>

      {/* Take-off rows */}
      <div className="space-y-4 px-6 py-5">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-bordergray bg-bg-soft/30 px-6 py-10 text-center">
            <p className="text-[14px] font-bold text-darkgray">No take-off rows yet.</p>
            <p className="mt-1 text-[12px] text-text-muted">
              {firmOwns
                ? "Import from the site survey or add a row manually."
                : "No take-off rows have been added for this stage."}
            </p>
          </div>
        ) : (
          rows.map((row, i) => (
            <TakeoffRow
              key={row.id}
              index={i}
              row={row}
              onChange={updateRow}
              onDuplicate={duplicateRow}
              onRemove={removeRow}
              editable={firmOwns}
            />
          ))
        )}
      </div>

      {/* Open Tender BOQ button */}
      {hasBOQ && (
        <div className="border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={() => navigate(`/boq/${existingBoqId}`)}
            className="flex items-center gap-2 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:shadow-md"
          >
            <FiArrowRight size={14} /> Open Tender BOQ
          </button>
        </div>
      )}
    </div>
  );
};

export default DesignTakeoffSheet;
