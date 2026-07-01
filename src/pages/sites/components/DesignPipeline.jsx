import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiLock,
  FiClock,
  FiCheckCircle,
  FiRotateCcw,
  FiSend,
  FiTrash2,
  FiPaperclip,
  FiUpload,
  FiDownload,
  FiGrid,
  FiArrowRight,
  FiRefreshCw,
  FiImage,
  FiPlus,
  FiUserCheck,
} from "react-icons/fi";
import { storeFile, getFile, deleteFile } from "../../../utils/fileStorage";
import { DIMENSIONAL_UNITS } from "../../../data/boqStorage";
import { elKey, qtyFor } from "../../../data/surveyMeasureStorage";
import {
  getPipeline,
  stageHasSamples,
  getDesignFlow,
  hydrateDesignFlow,
  getStage,
  currentStage,
  isStageBillable,
  setStageDeliverables,
  submitForInternalReview,
  generateStageBoq,
  unfreezeSurvey,
  addSampleDeliverables,
  setArchFee,
  computeArchFee,
  getTender,
  setTender,
  tenderEstimate,
} from "../../../data/designFlowStorage";
import DesignReviewPanel from "./DesignReviewPanel";

const genId = () =>
  `dlv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Compact, read-only measurement string for the frozen Site Basis rail.
const basisFormula = (unit, d) => {
  if (!DIMENSIONAL_UNITS[unit]) return `${Number(d?.nos) || 0} ${unit}`;
  const parts = [d?.length, d?.breadth, d?.height]
    .map((v) => Number(v) || 0)
    .filter((v) => v > 0);
  const q = qtyFor(unit, d);
  return `${parts.join(" × ") || 0} = ${q.toLocaleString("en-IN")} ${unit}`;
};

const STATE_META = {
  LOCKED: { label: "Locked", cls: "bg-slate-100 text-slate-500 border-slate-200", Icon: FiLock },
  DRAFTING: { label: "In progress", cls: "bg-blue-50 text-select-blue border-blue-200", Icon: FiClock },
  REVISION_REQUESTED: { label: "Revision requested", cls: "bg-rose-50 text-rose-600 border-rose-200", Icon: FiRotateCcw },
  INTERNAL_REVIEW: { label: "Internal review", cls: "bg-violet-50 text-violet-700 border-violet-200", Icon: FiUserCheck },
  AWAITING_CLIENT: { label: "With client", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: FiClock },
  APPROVED: { label: "Approved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: FiCheckCircle },
};

const StatusPill = ({ state, size = "sm" }) => {
  const m = STATE_META[state] || STATE_META.LOCKED;
  const pad = size === "lg" ? "px-3 py-1 text-[12px]" : "px-2 py-0.5 text-[10.5px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-bold ${pad} ${m.cls}`}>
      <m.Icon size={size === "lg" ? 13 : 11} /> {m.label}
    </span>
  );
};

const SectionTitle = ({ children }) => (
  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-text-subtle">
    {children}
  </p>
);

const DesignPipeline = ({ site }) => {
  const siteID = site.siteID;
  const navigate = useNavigate();
  const [flow, setFlow] = useState(() => getDesignFlow(siteID));
  const [selectedKey, setSelectedKey] = useState(() => {
    const f = getDesignFlow(siteID);
    return currentStage(f)?.key || getPipeline(f?.track)[0].key;
  });
  const [newType, setNewType] = useState("");
  const [fileUrls, setFileUrls] = useState({}); // fileId → object URL
  const [showSurvey, setShowSurvey] = useState(true);
  const [newBid, setNewBid] = useState({ name: "", amount: "" });

  // Each stage offers only its own deliverable types — reset on stage switch.
  useEffect(() => {
    const types =
      getPipeline(flow?.track).find((d) => d.key === selectedKey)
        ?.deliverableTypes || [];
    setNewType(types[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  // Keep in sync with portal approvals / other tabs.
  useEffect(() => {
    const refresh = () => setFlow(getDesignFlow(siteID));
    window.addEventListener("designFlowChanged", refresh);
    // Refresh the local cache from the server once on mount (best-effort; no-op
    // when logged out, and it never overwrites a working local flow on error).
    // hydrateDesignFlow dispatches designFlowChanged itself, so `refresh` picks
    // up the result — no extra setFlow needed here.
    hydrateDesignFlow(siteID);
    return () => window.removeEventListener("designFlowChanged", refresh);
  }, [siteID]);

  // Resolve the selected stage's uploaded files (IndexedDB blobs → object URLs).
  useEffect(() => {
    const st = flow?.stages?.find((s) => s.key === selectedKey);
    const dlvs = st?.deliverables || [];
    let cancelled = false;
    (async () => {
      for (const d of dlvs) {
        if (!d.fileId || fileUrls[d.fileId]) continue;
        const file = await getFile(d.fileId);
        if (file && !cancelled) {
          const url = URL.createObjectURL(file);
          setFileUrls((prev) => (prev[d.fileId] ? prev : { ...prev, [d.fileId]: url }));
        }
      }
      for (const area of flow?.siteBasis?.areas || []) {
        for (const el of area.elements || []) {
          const measurement =
            flow.siteBasis?.measurements?.[
              elKey(area.area, el.name, el.scopeItemId)
            ] ||
            flow.siteBasis?.measurements?.[elKey(area.area, el.name)] ||
            {};
          for (const image of measurement.images || []) {
            if (!image?.fileId || fileUrls[image.fileId]) continue;
            const file = await getFile(image.fileId);
            if (file && !cancelled) {
              const url = URL.createObjectURL(file);
              setFileUrls((prev) =>
                prev[image.fileId] ? prev : { ...prev, [image.fileId]: url },
              );
            }
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow, selectedKey]);

  if (!flow) return null;

  const pipeline = getPipeline(flow.track);
  const stage = getStage(flow, selectedKey);
  const basis = flow.siteBasis || {};
  const isArchBasis = basis.kind === "architecture";
  const firmOwns =
    stage?.reviewState === "DRAFTING" || stage?.reviewState === "REVISION_REQUESTED";
  const billable = isStageBillable(stage);
  const lastRevision = stage?.approvals?.find((a) => a.decision === "REVISION");
  const isBoqStage = selectedKey === "BOQ";
  const isTenderStage = selectedKey === "TENDER";
  const stageDef = pipeline.find((d) => d.key === selectedKey);
  const deliverableTypes = stageDef?.deliverableTypes || [];
  const approvedCount = flow.stages.filter((s) => s.reviewState === "APPROVED").length;
  const deliverables = stage?.deliverables || [];

  const generateBoq = () => setFlow(generateStageBoq(siteID));

  const onPickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fileId = genId();
    await storeFile(fileId, file);
    setFileUrls((prev) => ({ ...prev, [fileId]: URL.createObjectURL(file) }));
    const next = [
      ...deliverables,
      { id: genId(), type: newType, name: file.name, fileId, mime: file.type },
    ];
    setFlow(setStageDeliverables(siteID, selectedKey, next));
  };

  const removeDeliverable = (d) => {
    if (d.fileId) deleteFile(d.fileId).catch(() => {});
    setFlow(setStageDeliverables(siteID, selectedKey, deliverables.filter((x) => x.id !== d.id)));
  };

  const addSamples = () => setFlow(addSampleDeliverables(siteID, selectedKey));
  const submit = () => setFlow(submitForInternalReview(siteID, selectedKey));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Fixed: header + stepper */}
      <div className="shrink-0 space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-tight text-darkgray">
            Design Pipeline
          </h2>
          <p className="mt-0.5 text-[12.5px] text-text-muted">
            {isArchBasis
              ? `Feasibility approved ${basis.frozenAt}${basis.fsi ? ` · FSI ${basis.fsi}` : ""}${basis.maxBuiltUp ? ` · max ${basis.maxBuiltUp}` : ""}`
              : `Survey frozen ${basis.frozenAt} · ${basis.measured}/${basis.total} works measured · ${(basis.totalSqft || 0).toLocaleString("en-IN")} sqft`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-semibold text-grey">
            {approvedCount}/{flow.stages.length} stages approved
          </span>
          <div className="h-2 w-32 overflow-hidden rounded-full bg-bg-soft">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(approvedCount / flow.stages.length) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowSurvey((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[12px] font-semibold text-grey hover:bg-bg-soft"
          >
            <FiGrid size={13} /> {showSurvey ? "Hide" : "Show"} survey
          </button>
          {flow.track !== "Architecture" && (
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Unlock this survey? The design pipeline will be archived and its generated BOQ marked stale.",
                  )
                ) {
                  unfreezeSurvey(siteID);
                }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-red-600 hover:bg-red-100"
            >
              <FiRotateCcw size={13} /> Unlock survey
            </button>
          )}
        </div>
      </div>

      {/* ── Stepper (compact, single row) ──────────────────────────────────── */}
      <div className="rounded-xl border border-gray-100 bg-white px-2 py-1.5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {flow.stages.map((s, i) => {
            const def = pipeline[i];
            const active = s.key === selectedKey;
            const approved = s.reviewState === "APPROVED";
            const locked = s.reviewState === "LOCKED";
            return (
              <Fragment key={s.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(s.key)}
                  title={def.question}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all ${
                    active ? "bg-violet-50 ring-1 ring-violet-200" : "hover:bg-bg-soft"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      approved
                        ? "bg-emerald-500 text-white"
                        : active
                          ? "bg-violet-600 text-white"
                          : locked
                            ? "bg-slate-100 text-slate-400"
                            : "bg-violet-100 text-violet-600"
                    }`}
                  >
                    {approved ? <FiCheckCircle size={13} /> : locked ? <FiLock size={11} /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap text-[12px] font-bold text-darkgray">
                    {def.label}
                  </span>
                  <StatusPill state={s.reviewState} />
                </button>
                {i < flow.stages.length - 1 && (
                  <FiArrowRight
                    size={13}
                    className={`shrink-0 ${approved ? "text-emerald-400" : "text-bordergray"}`}
                  />
                )}
              </Fragment>
            );
          })}
        </div>
      </div>
      </div>

      {/* ── Body (scrolls): stage workspace + survey reference ─────────────── */}
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 scroll-hidden-bar">
        <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          {/* Stage panel */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
            {/* Stage header */}
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="text-[17px] font-bold text-darkgray">
                  {stageDef?.label}
                </h3>
                <StatusPill state={stage.reviewState} size="lg" />
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-grey">
                  Round {stage.round}
                </span>
                {billable && (
                  <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                    Billable revision
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[13px] text-grey">
                <span className="font-semibold text-darkgray">Client signs off:</span>{" "}
                {stageDef?.question}
              </p>
            </div>

            <div className="px-6 py-5">
              {/* State banners */}
              {stage.reviewState === "LOCKED" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-[13px] text-slate-500">
                  <FiLock size={15} /> Unlocks when the previous stage is approved.
                </div>
              )}
              {stage.reviewState === "INTERNAL_REVIEW" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50 p-3.5 text-[13px] text-violet-800">
                  <FiUserCheck size={15} /> Under internal review — clears the
                  Intern → Principal Architect chain before it goes to the client.
                </div>
              )}
              {firmOwns && stage.internalKickback && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-700">
                  <p className="flex items-center gap-1.5 font-bold">
                    <FiRotateCcw size={14} /> Returned by{" "}
                    {stage.internalKickback.role} (internal review)
                  </p>
                  {stage.internalKickback.comment && (
                    <p className="mt-1 italic">
                      “{stage.internalKickback.comment}”
                    </p>
                  )}
                </div>
              )}
              {stage.reviewState === "AWAITING_CLIENT" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-800">
                  <FiClock size={15} /> Sent to the client — awaiting approval in
                  their portal.
                </div>
              )}
              {stage.reviewState === "APPROVED" && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-[13px] text-emerald-800">
                  <FiCheckCircle size={15} /> Approved by client
                  {stage.approvedAt ? ` · ${stage.approvedAt}` : ""}.
                </div>
              )}
              {stage.reviewState === "REVISION_REQUESTED" && lastRevision && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[13px] text-rose-700">
                  <p className="flex items-center gap-1.5 font-bold">
                    <FiRotateCcw size={14} /> Client requested changes
                  </p>
                  {lastRevision.comment && (
                    <p className="mt-1 italic">“{lastRevision.comment}”</p>
                  )}
                </div>
              )}

              {/* BOQ stage — auto-built bill */}
              {stage.reviewState !== "LOCKED" && isBoqStage && (
                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle>
                      Bill of Quantities{" "}
                      {stage.reviewState === "APPROVED" ? "(approved)" : ""}
                    </SectionTitle>
                    <div className="flex items-center gap-2">
                      {stage.boq?.editorBoqId && !stage.boq.syncError && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/boq/${stage.boq.editorBoqId || flow.boqId || `BOQ-${siteID}`}`)
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-select-blue px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-950 transition-all shadow-sm cursor-pointer"
                        >
                          Open in BOQ Editor
                        </button>
                      )}
                      {firmOwns && (
                        <button
                          type="button"
                          onClick={generateBoq}
                          className="flex items-center gap-1.5 rounded-lg bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-grey hover:bg-bordergray"
                        >
                          <FiRefreshCw size={13} />{" "}
                          {stage.boq ? "Regenerate" : "Generate"} from survey
                        </button>
                      )}
                    </div>
                  </div>

                  {!stage.boq ? (
                    <p className="rounded-xl border border-dashed border-bordergray py-6 text-center text-[12.5px] text-text-subtle">
                      Generate the bill from the frozen survey — Quoted (assumed
                      qty) vs Measured (actual qty), at the same fixed rates.
                    </p>
                  ) : (
                    <>
                      {stage.boq.syncError && (
                        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11.5px] font-semibold text-red-700">
                          {stage.boq.syncError} Regenerate after freeing browser
                          storage or resolving the storage error.
                        </div>
                      )}
                      {/* Quoted vs Measured vs Variance summary */}
                      <div className="mb-3 grid grid-cols-3 gap-2.5">
                        <div className="rounded-xl border border-bg-soft bg-palewhite p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
                            Quoted
                          </p>
                          <p className="mt-0.5 text-[16px] font-black text-grey tabular-nums">
                            {inr(stage.boq.quotedTotal)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-select-blue/70">
                            Measured (final)
                          </p>
                          <p className="mt-0.5 text-[16px] font-black text-select-blue tabular-nums">
                            {inr(stage.boq.total)}
                          </p>
                        </div>
                        <ToleranceTile boq={stage.boq} />
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-bg-soft">
                        <table className="w-full text-[12.5px]">
                          <thead>
                            <tr className="bg-palewhite text-left text-[10.5px] uppercase tracking-wider text-text-subtle">
                              <th className="px-4 py-2.5 font-bold">Work</th>
                              <th className="px-4 py-2.5 text-right font-bold">Quoted</th>
                              <th className="px-4 py-2.5 text-right font-bold">Measured</th>
                              <th className="px-4 py-2.5 text-right font-bold">Δ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stage.boq.areas.map((a) => (
                              <Fragment key={a.area}>
                                <tr className="bg-blue-50/40">
                                  <td colSpan={2} className="px-4 py-2 font-bold text-select-blue">
                                    {a.area}
                                  </td>
                                  <td className="px-4 py-2 text-right font-bold text-select-blue tabular-nums">
                                    {inr(a.measuredSubtotal)}
                                  </td>
                                  <td className="px-4 py-2 text-right font-bold tabular-nums text-select-blue">
                                    {inr(a.measuredSubtotal - a.quotedSubtotal)}
                                  </td>
                                </tr>
                                {a.rows.map((r) => (
                                  <tr key={r.name} className="border-t border-bg-soft">
                                    <td className="px-4 py-2 text-darkgray">
                                      {r.name}
                                      <span className="ml-1 text-[10.5px] text-text-subtle">
                                        @ {inr(r.rate)}/{r.unit}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums text-grey">
                                      {(Number(r.quotedQty) || 0).toLocaleString("en-IN")} {r.unit} ·{" "}
                                      {inr(r.quotedAmount)}
                                    </td>
                                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-darkgray">
                                      {(Number(r.measuredQty) || 0).toLocaleString("en-IN")} {r.unit} ·{" "}
                                      {inr(r.measuredAmount)}
                                    </td>
                                    <td
                                      className={`px-4 py-2 text-right font-semibold tabular-nums ${
                                        r.variance > 0
                                          ? "text-orange-600"
                                          : r.variance < 0
                                            ? "text-emerald-600"
                                            : "text-text-subtle"
                                      }`}
                                    >
                                      {r.variance > 0 ? "+" : ""}
                                      {inr(r.variance)}
                                    </td>
                                  </tr>
                                ))}
                              </Fragment>
                            ))}
                          </tbody>
                          <tfoot className="bg-palewhite">
                            <tr>
                              <td colSpan={2} className="px-4 py-2 text-right text-grey">
                                Subtotal
                              </td>
                              <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                {inr(stage.boq.measuredSubtotal)}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums text-text-subtle">
                                {inr(stage.boq.variance)}
                              </td>
                            </tr>
                            <tr>
                              <td colSpan={2} className="px-4 py-2 text-right text-grey">
                                GST ({stage.boq.gstPercent}%)
                              </td>
                              <td className="px-4 py-2 text-right font-semibold tabular-nums">
                                {inr(stage.boq.gst)}
                              </td>
                              <td />
                            </tr>
                            <tr className="border-t border-bordergray">
                              <td colSpan={2} className="px-4 py-2.5 text-right text-[14px] font-bold text-darkgray">
                                Total
                              </td>
                              <td className="px-4 py-2.5 text-right text-[15px] font-black text-select-blue tabular-nums">
                                {inr(stage.boq.total)}
                              </td>
                              <td />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}

                  {firmOwns && stage.boq && (
                    <div className="mt-5 flex justify-end">
                      <SubmitButton onClick={submit} />
                    </div>
                  )}
                </div>
              )}

              {/* Tender stage — contractor construction cost + bids */}
              {stage.reviewState !== "LOCKED" && isTenderStage && (
                <TenderPanel
                  flow={flow}
                  firmOwns={firmOwns}
                  newBid={newBid}
                  setNewBid={setNewBid}
                  onChangeField={(patch) => setFlow(setTender(siteID, patch))}
                  onSubmit={submit}
                />
              )}

              {/* Creative stages — uploaded design files as a gallery */}
              {stage.reviewState !== "LOCKED" && !isBoqStage && !isTenderStage && (
                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <SectionTitle>
                      Deliverables{" "}
                      {stage.reviewState === "APPROVED" ? "(submitted)" : ""}
                    </SectionTitle>
                    {firmOwns && (
                      <div className="flex items-center gap-2">
                        <select
                          value={newType}
                          onChange={(e) => setNewType(e.target.value)}
                          className="rounded-lg border border-bordergray bg-white px-2.5 py-1.5 text-[12px] font-medium text-textcolor focus:outline-none"
                        >
                          {deliverableTypes.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                        {stageHasSamples(selectedKey) && (
                          <button
                            type="button"
                            onClick={addSamples}
                            title="Populate this stage with sample mockups (demo)"
                            className="flex items-center gap-1.5 rounded-lg border border-dashed border-bordergray px-3 py-1.5 text-[12px] font-semibold text-text-muted hover:bg-bg-soft"
                          >
                            <FiImage size={13} /> Add samples
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {deliverables.length === 0 && !firmOwns ? (
                    <p className="rounded-xl border border-dashed border-bordergray py-6 text-center text-[12.5px] text-text-subtle">
                      No deliverables yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {deliverables.map((d) => {
                        const url = d.src || (d.fileId ? fileUrls[d.fileId] : null);
                        const isImg = (d.mime || "").startsWith("image/");
                        return (
                          <div
                            key={d.id}
                            className="group overflow-hidden rounded-xl border border-bg-soft bg-white"
                          >
                            <div className="relative flex aspect-[4/3] items-center justify-center bg-palewhite">
                              {isImg && url ? (
                                <img src={url} alt={d.name} className="h-full w-full object-cover" />
                              ) : (
                                <FiPaperclip size={22} className="text-text-subtle" />
                              )}
                              {/* hover actions */}
                              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                {url && (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="View / download"
                                    className="rounded-md bg-white/90 p-1.5 text-grey shadow-sm hover:text-select-blue"
                                  >
                                    <FiDownload size={13} />
                                  </a>
                                )}
                                {firmOwns && (
                                  <button
                                    type="button"
                                    onClick={() => removeDeliverable(d)}
                                    className="rounded-md bg-white/90 p-1.5 text-grey shadow-sm hover:text-rose-500"
                                  >
                                    <FiTrash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="p-2.5">
                              <span className="mb-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-bold text-select-blue">
                                {d.type}
                              </span>
                              <p className="truncate text-[12px] font-medium text-darkgray">
                                {d.name}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {/* Upload tile */}
                      {firmOwns && (
                        <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-bordergray text-text-muted transition-colors hover:border-violet-300 hover:bg-violet-50/40 hover:text-violet-600">
                          <FiUpload size={20} />
                          <span className="text-[11.5px] font-semibold">Upload file</span>
                          <span className="text-[9.5px] text-text-subtle">
                            {newType}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,application/pdf"
                            onChange={onPickFile}
                          />
                        </label>
                      )}
                    </div>
                  )}

                  {firmOwns && (
                    <div className="mt-5 flex justify-end">
                      <SubmitButton onClick={submit} disabled={deliverables.length === 0} />
                    </div>
                  )}
                </div>
              )}

              {/* Internal design review — checklist, comment register, sign-off chain */}
              {stage.reviewState !== "LOCKED" && (
                <DesignReviewPanel
                  siteID={siteID}
                  stage={stage}
                  stageKey={selectedKey}
                  onChange={setFlow}
                />
              )}

              {/* Approval history */}
              {(stage.approvals || []).length > 0 && (
                <div className="mt-6 border-t border-bg-soft pt-4">
                  <SectionTitle>Approval history</SectionTitle>
                  <div className="mt-2.5 space-y-2">
                    {stage.approvals.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-[12.5px]">
                        {a.decision === "APPROVED" ? (
                          <FiCheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                        ) : (
                          <FiRotateCcw size={14} className="mt-0.5 shrink-0 text-rose-500" />
                        )}
                        <span className="text-grey">
                          <span className="font-semibold text-darkgray">
                            {a.decision === "APPROVED" ? "Approved" : "Changes requested"}
                          </span>{" "}
                          by {a.by} · R{a.round} · {a.at}
                          {a.comment ? ` — “${a.comment}”` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Activity timeline */}
          {(flow.history || []).length > 0 && (
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
              <SectionTitle>Activity</SectionTitle>
              <div className="mt-3 space-y-2.5">
                {flow.history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-[12.5px]">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                    <span className="text-grey">{h.action}</span>
                    <span className="ml-auto shrink-0 text-text-subtle">{h.at}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Frozen Site Basis reference (collapsible) ────────────────────── */}
        {showSurvey && (
        <aside className="lg:w-72 lg:shrink-0">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] lg:sticky lg:top-0">
          {isArchBasis ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <FiLock size={14} className="text-violet-600" />
                <h4 className="text-[14px] font-bold text-darkgray">
                  Feasibility Basis
                </h4>
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                  FROZEN
                </span>
              </div>
              <p className="mb-2 text-[10px] text-text-subtle">
                Buildable envelope the design is built against.
              </p>
              <div className="space-y-1.5">
                {[
                  ["Land use", basis.landUse],
                  ["FSI / FAR", basis.fsi],
                  ["Max built-up", basis.maxBuiltUp],
                  ["Height limit", basis.heightLimit],
                  ["Authority", basis.authority],
                  ["Plot", basis.plotDimensions],
                  ["Soil SBC", basis.soilSBC],
                  ["Legal", basis.legalStatus],
                ]
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="flex items-center justify-between gap-2 rounded-lg border border-bg-soft bg-palewhite/40 px-3 py-1.5 text-[11px]"
                    >
                      <span className="text-grey">{k}</span>
                      <span className="shrink-0 text-right font-semibold text-select-blue">
                        {v}
                      </span>
                    </div>
                  ))}
              </div>
              <FeePanel flow={flow} siteID={siteID} onChange={setFlow} />
            </>
          ) : (
            <>
            <div className="mb-3 flex items-center gap-2">
              <FiLock size={14} className="text-violet-600" />
              <h4 className="text-[14px] font-bold text-darkgray">Site Survey</h4>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">
                FROZEN
              </span>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-palewhite p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Measured
                </p>
                <p className="text-[17px] font-black text-darkgray">
                  {basis.measured}/{basis.total}
                </p>
              </div>
              <div className="rounded-xl bg-blue-50/60 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-wider text-select-blue/70">
                  Total Area
                </p>
                <p className="text-[17px] font-black text-select-blue">
                  {(basis.totalSqft || 0).toLocaleString("en-IN")}
                  <span className="text-[10px]"> sqft</span>
                </p>
              </div>
            </div>
            <p className="mb-2 text-[10px] text-text-subtle">
              Read-only basis the design is built against.
            </p>
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {(basis.areas || []).map((a) => (
                <div key={a.area} className="rounded-xl border border-bg-soft">
                  <div className="flex items-center gap-1.5 border-b border-bg-soft px-3 py-2">
                    <FiGrid size={12} className="text-select-blue" />
                    <span className="truncate text-[12px] font-bold text-darkgray">
                      {a.area}
                    </span>
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    {a.elements.map((el) => {
                      const d =
                        basis.measurements?.[
                          elKey(a.area, el.name, el.scopeItemId)
                        ] ||
                        basis.measurements?.[elKey(a.area, el.name)] ||
                        {};
                      const imgs = d.images || [];
                      return (
                        <div key={el.name} className="text-[11px]">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-grey">{el.name}</span>
                            <span className="shrink-0 font-semibold text-select-blue tabular-nums">
                              {basisFormula(el.unit, d)}
                            </span>
                          </div>
                          {imgs.length > 0 && (
                            <div className="mt-1 flex gap-1">
                              {imgs.slice(0, 4).map((image, i) => {
                                const src =
                                  typeof image === "string"
                                    ? image
                                    : fileUrls[image?.fileId];
                                return src ? (
                                  <img
                                    key={image?.fileId || i}
                                    src={src}
                                    alt=""
                                    className="h-8 w-8 rounded border border-bordergray object-cover"
                                  />
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
          </div>
        </aside>
        )}
        </div>
      </div>
    </div>
  );
};

const ToleranceTile = ({ boq }) => {
  if (!boq.hasQuote) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Variance
        </p>
        <p className="mt-0.5 text-[13px] font-bold text-slate-400">
          No quote baseline
        </p>
      </div>
    );
  }
  const ok = boq.withinTolerance;
  const sign = boq.variance > 0 ? "+" : boq.variance < 0 ? "−" : "";
  return (
    <div
      className={`rounded-xl border p-3 ${
        ok ? "border-emerald-200 bg-emerald-50/60" : "border-orange-200 bg-orange-50/60"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wider ${
          ok ? "text-emerald-600/80" : "text-orange-600/80"
        }`}
      >
        Variance
      </p>
      <p
        className={`mt-0.5 text-[16px] font-black tabular-nums ${
          ok ? "text-emerald-700" : "text-orange-700"
        }`}
      >
        {sign}₹{Math.abs(Math.round(boq.variance)).toLocaleString("en-IN")}
      </p>
      <p className={`text-[10px] font-semibold ${ok ? "text-emerald-600" : "text-orange-600"}`}>
        {ok
          ? `Increase is within ₹${boq.toleranceAmount.toLocaleString("en-IN")}`
          : `Over proposal + ₹${boq.toleranceAmount.toLocaleString("en-IN")}`}
      </p>
    </div>
  );
};

const numInput =
  "w-full rounded-lg border border-bordergray bg-white px-2 py-1 text-[12px] text-textcolor focus:outline-none focus:border-select-blue";

// Design fee (firm revenue) — staged %, invoiced as stages get approved.
const FeePanel = ({ flow, siteID, onChange }) => {
  const fee = computeArchFee(flow);
  return (
    <div className="mt-4 border-t border-bg-soft pt-3">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-[13px] font-bold text-darkgray">Design Fee</h4>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[8.5px] font-bold text-violet-700">
          FIRM REVENUE
        </span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
            Built-up (sqft)
          </span>
          <input
            type="number"
            value={fee.builtUpArea}
            onChange={(e) =>
              onChange(setArchFee(siteID, { builtUpArea: Number(e.target.value) || 0 }))
            }
            className={numInput}
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
            Rate ₹/sqft
          </span>
          <input
            type="number"
            value={fee.feeRatePerSqft}
            onChange={(e) =>
              onChange(setArchFee(siteID, { feeRatePerSqft: Number(e.target.value) || 0 }))
            }
            className={numInput}
          />
        </label>
      </div>
      <div className="mb-2 flex items-center justify-between rounded-lg bg-violet-50 px-3 py-1.5 text-[12px] font-bold text-violet-700">
        <span>Total fee</span>
        <span className="tabular-nums">{inr(fee.total)}</span>
      </div>
      <div className="space-y-1">
        {fee.stages.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-[10.5px]">
            <span className={s.invoiced ? "font-semibold text-emerald-600" : "text-grey"}>
              {s.invoiced ? "✓ " : ""}
              {s.label} · {s.weight}%
            </span>
            <span className="tabular-nums text-grey">{inr(s.amount)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-bg-soft pt-1.5 text-[11px] font-bold">
        <span className="text-grey">Invoiced</span>
        <span className="tabular-nums text-emerald-700">{inr(fee.invoicedTotal)}</span>
      </div>
    </div>
  );
};

// Tender — the contractor's construction cost + bids (separate from the fee).
const TenderPanel = ({ flow, firmOwns, newBid, setNewBid, onChangeField, onSubmit }) => {
  const tender = getTender(flow);
  const estimate = tenderEstimate(tender);
  const bids = tender.bids || [];
  const addBid = () => {
    const name = newBid.name.trim();
    const amount = Number(newBid.amount) || 0;
    if (!name || !amount) return;
    onChangeField({ bids: [...bids, { name, amount }] });
    setNewBid({ name: "", amount: "" });
  };
  return (
    <div className="mt-5">
      <SectionTitle>Tender — Construction Cost</SectionTitle>
      <p className="mt-1 mb-3 text-[11px] text-text-subtle">
        The contractor&apos;s build cost — separate from the firm&apos;s design fee.
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        <label className="rounded-xl border border-bg-soft bg-palewhite p-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
            Built-up (sqft)
          </span>
          <input
            type="number"
            disabled={!firmOwns}
            value={tender.builtUpArea}
            onChange={(e) => onChangeField({ builtUpArea: Number(e.target.value) || 0 })}
            className={`${numInput} mt-1 disabled:bg-transparent`}
          />
        </label>
        <label className="rounded-xl border border-bg-soft bg-palewhite p-3">
          <span className="text-[9px] font-bold uppercase tracking-wider text-text-subtle">
            Rate ₹/sqft
          </span>
          <input
            type="number"
            disabled={!firmOwns}
            value={tender.constructionRate}
            onChange={(e) => onChangeField({ constructionRate: Number(e.target.value) || 0 })}
            className={`${numInput} mt-1 disabled:bg-transparent`}
          />
        </label>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-select-blue/70">
            Estimate
          </p>
          <p className="mt-0.5 text-[16px] font-black text-select-blue tabular-nums">
            {inr(estimate)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <SectionTitle>Contractor bids</SectionTitle>
        <div className="mt-2 space-y-1.5">
          {bids.length === 0 && (
            <p className="rounded-lg border border-dashed border-bordergray py-3 text-center text-[11px] text-text-subtle">
              No bids yet.
            </p>
          )}
          {bids.map((b, i) => {
            const awarded = tender.awarded === b.name;
            return (
              <div
                key={i}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                  awarded ? "border-emerald-200 bg-emerald-50" : "border-bg-soft bg-palewhite/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    firmOwns && onChangeField({ awarded: awarded ? null : b.name })
                  }
                  className={`text-[12px] font-semibold ${
                    awarded ? "text-emerald-700" : "text-darkgray"
                  } ${firmOwns ? "cursor-pointer" : "cursor-default"}`}
                  title={firmOwns ? "Award / un-award" : ""}
                >
                  {awarded ? "★ " : ""}
                  {b.name}
                </button>
                <span className="ml-auto text-[12px] font-bold tabular-nums text-darkgray">
                  {inr(b.amount)}
                </span>
                {firmOwns && (
                  <button
                    type="button"
                    onClick={() => onChangeField({ bids: bids.filter((_, j) => j !== i) })}
                    className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-500"
                  >
                    <FiTrash2 size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {firmOwns && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={newBid.name}
                onChange={(e) => setNewBid({ ...newBid, name: e.target.value })}
                placeholder="Contractor name"
                className="min-w-0 flex-1 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[12px] focus:outline-none"
              />
              <input
                type="number"
                value={newBid.amount}
                onChange={(e) => setNewBid({ ...newBid, amount: e.target.value })}
                placeholder="Bid amount"
                className="w-32 rounded-lg border border-bordergray bg-white px-3 py-1.5 text-[12px] focus:outline-none"
              />
              <button
                type="button"
                onClick={addBid}
                className="flex items-center gap-1 rounded-lg bg-bg-soft px-3 py-1.5 text-[12px] font-semibold text-grey hover:bg-bordergray"
              >
                <FiPlus size={13} /> Add bid
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <SubmitButton onClick={onSubmit} disabled={estimate <= 0} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const SubmitButton = ({ onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-1.5 rounded-lg bg-linear-to-br from-violet-600 to-violet-800 px-5 py-2.5 text-[13px] font-bold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
  >
    <FiSend size={14} /> Submit for Review
  </button>
);

export default DesignPipeline;
