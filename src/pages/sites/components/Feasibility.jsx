import { useEffect, useState } from "react";
import {
  FiShield,
  FiMap,
  FiCompass,
  FiCheckCircle,
  FiAlertTriangle,
  FiClock,
  FiArrowRight,
  FiLock,
  FiFileText,
  FiUpload,
  FiPaperclip,
  FiDownload,
  FiTrash2,
} from "react-icons/fi";
import {
  getFeasibility,
  setFeasibilityField,
  setSectionStatus,
  isFeasibilityComplete,
  setDecision,
  buildArchBasis,
  SECTION_STATUSES,
  seedFeasibilityFromVisit,
  addFeasibilityDocument,
  removeFeasibilityDocument,
} from "../../../data/feasibilityStorage";
import { startDesign, isDesignStarted } from "../../../data/designFlowStorage";
import { getSiteLead } from "../../../data/surveyMeasureStorage";
import { storeFile, getFile, deleteFile } from "../../../utils/fileStorage";

const genId = () =>
  `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const inputBase =
  "bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle";

const STATUS_META = {
  Pending: { cls: "bg-slate-100 text-slate-500 border-slate-200", Icon: FiClock },
  Cleared: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: FiCheckCircle },
  Issue: { cls: "bg-rose-50 text-rose-600 border-rose-200", Icon: FiAlertTriangle },
};

const Field = ({ label, value, onChange, placeholder, textarea }) => (
  <div>
    <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1">
      {label}
    </label>
    {textarea ? (
      <textarea
        rows={2}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputBase} resize-none`}
      />
    ) : (
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputBase}
      />
    )}
  </div>
);

const StatusControl = ({ value, onChange }) => (
  <div className="flex items-center gap-1">
    {SECTION_STATUSES.map((s) => {
      const active = value === s;
      const m = STATUS_META[s];
      return (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold transition-all ${
            active ? m.cls : "bg-white text-text-subtle border-bordergray hover:bg-bg-soft"
          }`}
        >
          <m.Icon size={11} /> {s}
        </button>
      );
    })}
  </div>
);

const Section = ({ iconEl, title, hint, status, onStatus, children }) => (
  <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          {iconEl}
        </div>
        <div>
          <h3 className="text-[14px] font-bold text-darkgray">{title}</h3>
          <p className="text-[10.5px] text-text-muted">{hint}</p>
        </div>
      </div>
      <StatusControl value={status} onChange={onStatus} />
    </div>
    <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">{children}</div>
  </div>
);

const Feasibility = ({ site }) => {
  const siteID = site.siteID;
  const [feas, setFeas] = useState(() => getFeasibility(siteID));
  const [fileUrls, setFileUrls] = useState({});
  const designStarted = isDesignStarted(siteID);

  useEffect(() => {
    const refresh = () => setFeas(getFeasibility(siteID));
    window.addEventListener("feasibilityChanged", refresh);
    return () => window.removeEventListener("feasibilityChanged", refresh);
  }, [siteID]);

  // One-time carry-over from the lead's preliminary site visit.
  useEffect(() => {
    const visit = getSiteLead(site)?.prelimVisit;
    if (visit?.done) setFeas(seedFeasibilityFromVisit(siteID, visit));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteID]);

  // Resolve document blobs → object URLs for preview/download.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const d of feas.documents || []) {
        if (!d.fileId || fileUrls[d.fileId]) continue;
        const file = await getFile(d.fileId);
        if (file && !cancelled) {
          const url = URL.createObjectURL(file);
          setFileUrls((prev) => (prev[d.fileId] ? prev : { ...prev, [d.fileId]: url }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feas]);

  const onPickDoc = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fileId = genId();
    await storeFile(fileId, file);
    setFileUrls((prev) => ({ ...prev, [fileId]: URL.createObjectURL(file) }));
    setFeas(
      addFeasibilityDocument(siteID, {
        id: genId(),
        name: file.name,
        fileId,
        mime: file.type,
      }),
    );
  };

  const removeDoc = (d) => {
    // Don't delete the blob for visit-carried docs — it's shared with the lead.
    if (d.fileId && !d.fromVisit) deleteFile(d.fileId).catch(() => {});
    setFeas(removeFeasibilityDocument(siteID, d.id));
  };

  const field = (section, key) => (v) =>
    setFeas(setFeasibilityField(siteID, section, key, v));
  const status = (section) => (s) => setFeas(setSectionStatus(siteID, section, s));

  const complete = isFeasibilityComplete(feas);
  const canStart = feas.decision === "Go" && complete && !designStarted;

  const startArchitectureDesign = () => {
    startDesign(site, { basis: buildArchBasis(siteID) });
    // SiteDetail listens for designFlowChanged and swaps to the pipeline.
  };

  return (
    <div className="space-y-5">
      {/* Header + decision gate */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-darkgray">
              Feasibility & Due Diligence
            </h2>
            <p className="mt-0.5 text-[12px] text-text-muted">
              Verify the land before any design or pricing. Clear all three, then
              decide Go / No-Go.
            </p>
          </div>
          {designStarted ? (
            <span className="flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-100 px-3 py-1 text-[11.5px] font-bold text-violet-700">
              <FiLock size={12} /> Design in progress
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFeas(setDecision(siteID, "No-Go"))}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-all ${
                  feas.decision === "No-Go"
                    ? "border-rose-300 bg-rose-50 text-rose-600"
                    : "border-bordergray bg-white text-grey hover:bg-bg-soft"
                }`}
              >
                No-Go
              </button>
              <button
                type="button"
                onClick={() => setFeas(setDecision(siteID, "Go"))}
                disabled={!complete}
                title={complete ? "" : "Clear all three streams first"}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  feas.decision === "Go"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-bordergray bg-white text-grey hover:bg-bg-soft"
                }`}
              >
                Go
              </button>
              <button
                type="button"
                onClick={startArchitectureDesign}
                disabled={!canStart}
                title={canStart ? "" : "Decide Go after clearing all streams"}
                className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-4 py-1.5 text-[12px] font-bold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
              >
                Start Design <FiArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
        {!designStarted && (
          <div className="mt-3 flex flex-wrap gap-2">
            {["legal", "planning", "survey"].map((s) => {
              const st = feas[s].status;
              const m = STATUS_META[st];
              return (
                <span
                  key={s}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${m.cls}`}
                >
                  <m.Icon size={11} />
                  {s === "legal" ? "Legal" : s === "planning" ? "Planning" : "Survey"}: {st}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Documents — carried from the site visit, plus any added here */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
              <FiFileText size={15} />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-darkgray">Documents</h3>
              <p className="text-[10.5px] text-text-muted">
                Title, plot, photos — carried from the site visit
              </p>
            </div>
          </div>
          {!designStarted && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-grey hover:bg-bordergray">
              <FiUpload size={13} /> Upload
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={onPickDoc}
              />
            </label>
          )}
        </div>
        <div className="space-y-1.5 p-5">
          {(feas.documents || []).length === 0 && (
            <p className="rounded-lg border border-dashed border-bordergray py-3 text-center text-[12px] text-text-subtle">
              No documents yet.
            </p>
          )}
          {(feas.documents || []).map((d) => {
            const url = fileUrls[d.fileId];
            const isImg = (d.mime || "").startsWith("image/");
            return (
              <div
                key={d.id}
                className="flex items-center gap-2.5 rounded-lg border border-bg-soft bg-palewhite/40 px-3 py-2"
              >
                {isImg && url ? (
                  <img
                    src={url}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded border border-bordergray object-cover"
                  />
                ) : (
                  <FiPaperclip size={14} className="shrink-0 text-select-blue" />
                )}
                <span className="truncate text-[12.5px] font-medium text-darkgray">
                  {d.name}
                </span>
                {d.fromVisit && (
                  <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                    from visit
                  </span>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="View / download"
                      className="rounded p-1 text-text-muted hover:bg-blue-50 hover:text-select-blue"
                    >
                      <FiDownload size={13} />
                    </a>
                  )}
                  {!designStarted && (
                    <button
                      type="button"
                      onClick={() => removeDoc(d)}
                      className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-500"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Section
        iconEl={<FiShield size={15} />}
        title="Land Legal / Title"
        hint="Ownership, encumbrance, disputes"
        status={feas.legal.status}
        onStatus={status("legal")}
      >
        <Field label="Ownership status" value={feas.legal.ownership} onChange={field("legal", "ownership")} placeholder="Clear title / chain verified" />
        <Field label="EC reference" value={feas.legal.ecRef} onChange={field("legal", "ecRef")} placeholder="Encumbrance Certificate no." />
        <div className="sm:col-span-2">
          <Field label="Notes" value={feas.legal.notes} onChange={field("legal", "notes")} placeholder="Litigation, conversion status…" textarea />
        </div>
      </Section>

      <Section
        iconEl={<FiMap size={15} />}
        title="Statutory / Planning"
        hint="Zoning, FSI, setbacks, authority"
        status={feas.planning.status}
        onStatus={status("planning")}
      >
        <Field label="Land use / zoning" value={feas.planning.landUse} onChange={field("planning", "landUse")} placeholder="Residential / Commercial…" />
        <Field label="FSI / FAR" value={feas.planning.fsi} onChange={field("planning", "fsi")} placeholder="e.g. 1.5" />
        <Field label="Max built-up area" value={feas.planning.maxBuiltUp} onChange={field("planning", "maxBuiltUp")} placeholder="e.g. 3600 sqft" />
        <Field label="Height limit" value={feas.planning.heightLimit} onChange={field("planning", "heightLimit")} placeholder="e.g. 15 m / G+3" />
        <Field label="Sanctioning authority" value={feas.planning.authority} onChange={field("planning", "authority")} placeholder="Corporation / DTCP / CMDA…" />
        <Field label="Notes" value={feas.planning.notes} onChange={field("planning", "notes")} placeholder="NOCs required (fire, airport…)" />
      </Section>

      <Section
        iconEl={<FiCompass size={15} />}
        title="Site / Land Survey"
        hint="Topo, soil, orientation"
        status={feas.survey.status}
        onStatus={status("survey")}
      >
        <Field label="Plot dimensions" value={feas.survey.plotDimensions} onChange={field("survey", "plotDimensions")} placeholder="e.g. 40 × 60 ft" />
        <Field label="Soil SBC" value={feas.survey.soilSBC} onChange={field("survey", "soilSBC")} placeholder="Safe bearing capacity" />
        <Field label="Orientation" value={feas.survey.orientation} onChange={field("survey", "orientation")} placeholder="e.g. East-facing" />
        <Field label="Notes" value={feas.survey.notes} onChange={field("survey", "notes")} placeholder="Access, levels, utilities…" />
      </Section>
    </div>
  );
};

export default Feasibility;
