import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  RotateCcw,
  FileText,
  ThumbsUp,
  Download,
} from "lucide-react";
import { getFile } from "../../utils/fileStorage";
import {
  getPipeline,
  getDesignFlow,
  currentStage,
  approveStage,
  requestRevision,
  isStageBillable,
  tenderEstimate,
} from "../../data/designFlowStorage";
import { approvePortalStage, requestPortalRevision } from "../../api/portal";
import { tokens } from "../../api/client";

// Best-effort portal write-through. The portal uses the client token; if absent
// the call would 401 — the try/catch swallows it so the local action stands.
const pushPortal = (fn) => {
  if (!tokens.access()) return;
  try {
    Promise.resolve(fn()).catch((e) =>
      console.warn("portal stage API write-through failed:", e),
    );
  } catch (e) {
    console.warn("portal stage API write-through failed:", e);
  }
};

// Resolve a stage's backend id from the cached flow (attached by
// hydrateDesignFlow). Absent → skip the API call, stay local-only.
const stageBackendId = (stage) => stage?.backendId ?? stage?.id ?? null;

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Client-facing per-stage sign-off for the design pipeline. Self-guards: renders
// nothing unless the site has gone through the survey → design freeze.
const PortalStageApproval = ({ site, clientName }) => {
  const siteID = site?.siteID;
  const [flow, setFlow] = useState(() => (siteID ? getDesignFlow(siteID) : null));
  const [showChanges, setShowChanges] = useState(false);
  const [comment, setComment] = useState("");
  const [fileUrls, setFileUrls] = useState({}); // fileId → object URL

  useEffect(() => {
    if (!siteID) return;
    const refresh = () => setFlow(getDesignFlow(siteID));
    window.addEventListener("designFlowChanged", refresh);
    return () => window.removeEventListener("designFlowChanged", refresh);
  }, [siteID]);

  // Resolve the current stage's uploaded files for review/download.
  useEffect(() => {
    const st = flow ? currentStage(flow) : null;
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
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow]);

  if (!flow) return null;

  const pipeline = getPipeline(flow.track);
  const stage = currentStage(flow); // first stage not yet approved
  const awaiting = stage?.reviewState === "AWAITING_CLIENT";
  const billable = isStageBillable(stage);
  const stageLabel = (key) =>
    pipeline.find((s) => s.key === key)?.label || key;

  const approve = () => {
    const backendId = stageBackendId(stage);
    setFlow(approveStage(siteID, stage.key, { by: clientName || "Client" }));
    if (backendId != null) pushPortal(() => approvePortalStage(backendId));
  };

  const sendChanges = () => {
    const backendId = stageBackendId(stage);
    const note = comment.trim();
    setFlow(
      requestRevision(siteID, stage.key, {
        by: clientName || "Client",
        comment: note,
      }),
    );
    if (backendId != null)
      pushPortal(() => requestPortalRevision(backendId, note));
    setComment("");
    setShowChanges(false);
  };

  return (
    <div className="bg-white rounded-[20px] border border-slate-100 p-5 shadow-sm shrink-0">
      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
        Design Approvals
      </h4>

      {/* Stage progress strip */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {flow.stages.map((s, i) => {
          const done = s.reviewState === "APPROVED";
          const active = stage && s.key === stage.key;
          return (
            <div
              key={s.key}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : active
                    ? "border-purple/30 bg-purple/10 text-purple"
                    : "border-slate-200 bg-slate-50 text-slate-400"
              }`}
            >
              {done ? (
                <CheckCircle2 size={13} />
              ) : active ? (
                <Clock size={13} />
              ) : (
                <Lock size={12} />
              )}
              {pipeline[i].label}
            </div>
          );
        })}
      </div>

      {/* All approved */}
      {!stage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> All design stages approved. Thank you!
        </div>
      )}

      {/* Awaiting this client's sign-off */}
      {stage && awaiting && (
        <div className="rounded-xl border border-purple/20 bg-purple/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <p className="text-[14px] font-bold text-darkgray">
              {stageLabel(stage.key)}
              <span className="ml-2 align-middle text-[10px] font-bold text-slate-400">
                ROUND {stage.round}
              </span>
            </p>
            <span className="rounded-full bg-purple/10 px-2.5 py-0.5 text-[10.5px] font-bold text-purple">
              Awaiting your approval
            </span>
          </div>
          <p className="mb-3 text-[12px] text-slate-500">
            You&apos;re approving:{" "}
            <span className="font-semibold text-darkgray">
              {pipeline.find((s) => s.key === stage.key)?.question}
            </span>
          </p>

          {/* Deliverables to review */}
          <div className="space-y-1.5 mb-4">
            {(stage.deliverables || []).length === 0 && (
              <p className="text-[12px] text-slate-400 italic">
                No files attached.
              </p>
            )}
            {(stage.deliverables || []).map((d) => {
              const url = d.src || (d.fileId ? fileUrls[d.fileId] : null);
              const isImg = (d.mime || "").startsWith("image/");
              return (
                <div
                  key={d.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  {isImg && url ? (
                    <img
                      src={url}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded border border-slate-200 object-cover"
                    />
                  ) : (
                    <FileText size={14} className="shrink-0 text-purple" />
                  )}
                  <span className="truncate text-[12.5px] font-medium text-darkgray">
                    {d.name}
                  </span>
                  <span className="ml-auto shrink-0 rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold text-slate-500 border border-slate-200">
                    {d.type}
                  </span>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      title="View / download"
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-white hover:text-purple"
                    >
                      <Download size={13} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {/* BOQ cost summary — when the stage under review is the bill */}
          {stage.boq && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {stage.boq.hasQuote && (
                <div className="flex items-center justify-between text-[12px] text-slate-500">
                  <span>Original estimate</span>
                  <span className="tabular-nums">{inr(stage.boq.quotedTotal)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[12px] text-slate-600">
                <span>GST ({stage.boq.gstPercent}%)</span>
                <span className="tabular-nums">{inr(stage.boq.gst)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5 text-[13.5px] font-bold text-darkgray">
                <span>Final total</span>
                <span className="tabular-nums text-purple">{inr(stage.boq.total)}</span>
              </div>
              {stage.boq.hasQuote && (
                <p
                  className={`mt-1.5 text-[11px] font-semibold ${
                    stage.boq.withinTolerance ? "text-emerald-600" : "text-orange-600"
                  }`}
                >
                  {stage.boq.withinTolerance
                    ? `✓ ${stage.boq.variance > 0 ? "+" : stage.boq.variance < 0 ? "−" : ""}₹${Math.abs(Math.round(stage.boq.variance)).toLocaleString("en-IN")} vs estimate — increase is within ₹${stage.boq.toleranceAmount.toLocaleString("en-IN")}`
                    : `+₹${Math.round(stage.boq.variance).toLocaleString("en-IN")} vs estimate — beyond proposal + ₹${stage.boq.toleranceAmount.toLocaleString("en-IN")}, needs your approval`}
                </p>
              )}
            </div>
          )}

          {/* Tender cost summary — when the stage under review is the tender */}
          {stage.key === "TENDER" && stage.tender && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between text-[12px] text-slate-600">
                <span>Construction estimate</span>
                <span className="tabular-nums">
                  {inr(tenderEstimate(stage.tender))}
                </span>
              </div>
              {stage.tender.awarded && (
                <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5 text-[13px] font-bold text-darkgray">
                  <span>Awarded contractor</span>
                  <span className="text-purple">{stage.tender.awarded}</span>
                </div>
              )}
            </div>
          )}

          {/* Request-changes comment box */}
          {showChanges && (
            <div className="mb-3">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="What would you like changed?"
                className="w-full rounded-xl border border-slate-200 p-3 text-[12.5px] text-darkgray placeholder:text-slate-400 focus:outline-none focus:border-purple/40"
              />
              {billable && (
                <p className="mt-1 text-[11px] font-semibold text-orange-600">
                  Note: this stage is past its included revisions — a further
                  change may be chargeable.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {showChanges ? (
              <>
                <button
                  onClick={() => {
                    setShowChanges(false);
                    setComment("");
                  }}
                  className="rounded-xl px-4 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={sendChanges}
                  disabled={!comment.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-[11px] font-bold text-white hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={13} /> Send change request
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowChanges(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw size={13} /> Request Changes
                </button>
                <button
                  onClick={approve}
                  className="flex items-center gap-1.5 rounded-xl bg-purple px-5 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-dark-blue"
                >
                  <ThumbsUp size={13} /> Approve {stageLabel(stage.key)}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Active stage still with the design team */}
      {stage && !awaiting && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12.5px] text-slate-500">
          <Clock size={15} /> The design team is working on{" "}
          <span className="font-semibold text-darkgray">
            {stageLabel(stage.key)}
          </span>
          . You&apos;ll be notified when it&apos;s ready for your review.
        </div>
      )}
    </div>
  );
};

export default PortalStageApproval;
