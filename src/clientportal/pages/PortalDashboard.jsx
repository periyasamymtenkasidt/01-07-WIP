import React, { useMemo, useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  LayoutGrid,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Info,
  Upload,
  Bell,
  Lock,
} from "lucide-react";
import {
  getDesignFlow,
  currentStage,
  getPipeline,
  getRevisionPolicy,
  stageRevisionsUsed,
} from "../../data/designFlowStorage";

const fmtDate = (iso) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

const reviewStateLabel = (state) => {
  if (state === "AWAITING_CLIENT") return "Awaiting Your Approval";
  if (state === "REVISION_REQUESTED") return "Revision In Progress";
  if (state === "APPROVED") return "Approved";
  if (state === "DRAFTING") return "In Progress";
  if (state === "LOCKED") return "Locked";
  return state || "In Progress";
};

const reviewStateBadge = (state) => {
  if (state === "AWAITING_CLIENT") return "bg-amber-50 text-amber-700";
  if (state === "REVISION_REQUESTED") return "bg-rose-50 text-rose-600";
  if (state === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (state === "DRAFTING") return "bg-[#E0F2FE] text-[#0284C7]";
  return "bg-slate-100 text-slate-500";
};

const notifDot = (type) => {
  if (type === "upload") return "bg-blue-500";
  if (type === "approval") return "bg-amber-500";
  if (type === "milestone") return "bg-emerald-500";
  return "bg-slate-400";
};

const PortalDashboard = () => {
  const { client, site, progressPct, milestones, notifications } =
    useOutletContext();
  const navigate = useNavigate();

  // ── Real design flow data ─────────────────────────────────────────────────
  const [flow, setFlow] = useState(() =>
    site?.siteID ? getDesignFlow(site.siteID) : null,
  );

  useEffect(() => {
    const siteID = site?.siteID;
    setFlow(siteID ? getDesignFlow(siteID) : null);
    if (!siteID) return;
    const refresh = () => setFlow(getDesignFlow(siteID));
    const onStorage = (e) => {
      if (e.key === `designFlow_${siteID}`) refresh();
    };
    window.addEventListener("designFlowChanged", refresh);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("designFlowChanged", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [site?.siteID]);

  const pipeline = useMemo(
    () => (flow ? getPipeline(flow.track) : []),
    [flow],
  );

  const stages = flow?.stages || [];
  const active = currentStage(flow);
  const { freeRevisions } = getRevisionPolicy(flow);

  const approvedCount = stages.filter((s) => s.reviewState === "APPROVED").length;
  const totalStages = stages.length || pipeline.length;
  const designProgress = totalStages
    ? Math.round((approvedCount / totalStages) * 100)
    : 0;

  const totalDeliverables = stages.reduce(
    (sum, s) => sum + (s.deliverables?.length || 0),
    0,
  );

  const totalRevisions = stages.reduce(
    (sum, s) => sum + stageRevisionsUsed(s),
    0,
  );

  const currentStageLabel = active
    ? pipeline.find((p) => p.key === active.key)?.label || active.key
    : approvedCount === totalStages && totalStages > 0
      ? "All Stages Complete"
      : "Not Started";

  const currentReviewState = active?.reviewState || (approvedCount === totalStages && totalStages > 0 ? "APPROVED" : "LOCKED");

  const pendingAction =
    active?.reviewState === "AWAITING_CLIENT"
      ? `Review & Approve: ${currentStageLabel}`
      : null;

  // Real payment data
  const paidMilestones = (milestones || []).filter((m) => m.status === "paid");
  const nextDue = (milestones || []).find((m) => m.status === "pending");

  // Recent updates: prefer design flow history, fall back to client notifications
  const flowHistory = (flow?.history || []).slice(0, 5).map((h) => ({
    id: `h-${h.at}`,
    title: h.action,
    timestamp: fmtDate(h.at),
    type: "info",
  }));

  const recentNotifs =
    flowHistory.length > 0
      ? flowHistory
      : (notifications || site?.clientNotifications || []).slice(0, 5);

  return (
    <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col text-left">
      <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider">
        Project Feed & Status
      </h4>

      <div className="space-y-5">
        {/* Current Phase */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-400 font-semibold">Current Phase</p>
            <p className="text-sm font-bold text-darkgray mt-0.5">
              {flow ? currentStageLabel : "Project Onboarding"}
            </p>
            {active && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Stage {approvedCount + 1} of {totalStages}
              </p>
            )}
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${reviewStateBadge(currentReviewState)}`}
          >
            {reviewStateLabel(currentReviewState)}
          </span>
        </div>

        {/* Design Pipeline Summary */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-purple-50/20 border border-indigo-100/40 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-purple" />
              <span className="text-xs font-bold text-slate-700">
                Design Pipeline Summary
              </span>
            </div>
            <span className="text-[10px] font-bold text-purple bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
              Live
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                Active Stage
              </span>
              <p className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {flow ? currentStageLabel : "—"}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                Stages Approved
              </span>
              <p className="text-xs font-bold text-purple mt-0.5">
                {approvedCount} / {totalStages}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                Files Uploaded
              </span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {totalDeliverables} File{totalDeliverables !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                Revision Logs
              </span>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {totalRevisions} Revision{totalRevisions !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Stage progress bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 mb-1">
              <span>Overall Design Completion</span>
              <span>{designProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple h-full transition-all duration-500 rounded-full"
                style={{ width: `${designProgress}%` }}
              />
            </div>
          </div>

          {/* Per-stage mini tracker */}
          {stages.length > 0 && (
            <div className="flex gap-1 mb-4 flex-wrap">
              {stages.map((s) => {
                const stageLabel =
                  pipeline.find((p) => p.key === s.key)?.label || s.key;
                const isApproved = s.reviewState === "APPROVED";
                const isActive = s.key === active?.key;
                return (
                  <div
                    key={s.key}
                    title={stageLabel}
                    className={`flex-1 min-w-[28px] h-1.5 rounded-full ${
                      isApproved
                        ? "bg-purple"
                        : isActive
                          ? "bg-purple/40"
                          : "bg-slate-200"
                    }`}
                  />
                );
              })}
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="font-semibold text-slate-500">
                Action Required:
              </span>
              <span
                className={`font-bold ${pendingAction ? "text-amber-600" : "text-emerald-600"}`}
              >
                {pendingAction || "None"}
              </span>
            </div>
            <button
              onClick={() =>
                navigate(
                  `/client-portal/${client.clientID}/designs-renders`,
                )
              }
              className="flex items-center gap-1 text-[11px] font-bold text-purple hover:text-dark-blue transition-colors cursor-pointer"
            >
              Open Designs & Renders <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Payment Milestone Progress */}
        <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100/50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">
              Payment Milestone Progress
            </span>
            <span className="text-xs font-bold text-emerald-700">
              {progressPct}% Paid
            </span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-semibold pt-0.5">
            <span>
              {paidMilestones.length} of {(milestones || []).length} milestones
              paid
            </span>
            {nextDue && (
              <span className="text-amber-600">Next: {nextDue.name}</span>
            )}
          </div>
        </div>

        {/* Revision Usage — from real flow policy */}
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-4 text-left">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileEdit size={16} className="text-purple" />
              <span className="text-xs font-bold text-slate-700">
                Revision Usage & Policy
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                totalRevisions >= freeRevisions
                  ? "bg-amber-50 text-amber-700 border-amber-100"
                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}
            >
              {totalRevisions >= freeRevisions
                ? "Paid Track Active"
                : "Complimentary Track"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                Complimentary Limit
              </span>
              <span className="text-xs font-extrabold text-slate-800 mt-1 block">
                {freeRevisions} Free Revision{freeRevisions !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                Revisions Used
              </span>
              <span className="text-xs font-extrabold text-purple mt-1 block">
                {Math.min(totalRevisions, freeRevisions)} / {freeRevisions}{" "}
                Used
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">
                Policy Applied
              </span>
              <span className="text-xs font-extrabold text-slate-800 mt-1 block">
                {totalRevisions >= freeRevisions
                  ? "Paid Revisions Active"
                  : "Complimentary Active"}
              </span>
            </div>
          </div>
          <p className="text-[10.5px] text-text-subtle leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
            <strong>Revision Rule:</strong> Up to {freeRevisions} complimentary
            revision{freeRevisions !== 1 ? "s" : ""} included. Subsequent
            change requests are billed as paid revisions.
          </p>
        </div>

        {/* Recent Updates — design flow history */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
            <Bell size={11} /> Recent Updates
          </p>
          {recentNotifs.length > 0 ? (
            <div className="border-l-2 border-slate-200 pl-4 space-y-4">
              {recentNotifs.map((n, i) => (
                <div key={n.id || i} className="relative">
                  <div
                    className={`absolute -left-[22px] top-0.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${notifDot(n.type)}`}
                  />
                  <p className="text-xs font-bold text-darkgray">{n.title}</p>
                  {n.text && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{n.text}</p>
                  )}
                  {n.timestamp && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {n.timestamp}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-subtle pl-4 border-l-2 border-slate-200">
              No recent updates yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortalDashboard;
