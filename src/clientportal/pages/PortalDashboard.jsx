import React from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { ChevronRight, LayoutGrid, FileEdit, Clock } from "lucide-react";

const PortalDashboard = () => {
  const { client, site, progressPct } = useOutletContext();
  const navigate = useNavigate();

  // Helper to determine active design stage label
  const getDesignStageLabel = (s) => {
    if (!s) return "Not Started";
    if (s.approvalStatus === "Approved") return "Approved & Completed";
    if (s.designStatus === "Completed") {
      const hasPendingRevisions = s.revisions?.length > 0 && !s.revisions.every((r) => r.status === "Completed");
      if (hasPendingRevisions) return "Redesign";
      
      const MANDATORY_DRAWINGS = ["Floor Plan", "Furniture Layout", "Electrical Layout", "Ceiling Layout"];
      const missingMandatoryDrawings = MANDATORY_DRAWINGS.filter(
        (name) => !s.drawings?.some((d) => d.name.toLowerCase().includes(name.toLowerCase()))
      );
      const allMandatoryDrawingsApproved = s.drawings && MANDATORY_DRAWINGS.every((name) =>
        s.drawings.some((d) => d.name.toLowerCase().includes(name.toLowerCase()) && d.status === "Approved")
      );
      const isDrawingsStageCompleted = (s.drawings?.length || 0) >= 4 && missingMandatoryDrawings.length === 0 && allMandatoryDrawingsApproved;
      
      if (!isDrawingsStageCompleted) return "2D / 3D Drawings";
      return "Client Approval";
    }
    return "Default Design";
  };

  const currentDesignStage = getDesignStageLabel(site);
  const designProgress = site?.progress || 0;
  const totalDrawings = site?.drawings?.filter((d) => d.visibleToClient !== false).length || 0;
  const totalRevisions = site?.revisions?.length || 0;

  // Determine client pending action
  const getPendingAction = (s) => {
    if (!s) return "None";
    if (s.approvalStatus === "Sent" || s.approvalStatus === "Viewed") {
      return "Review Approval Package";
    }
    const hasDrawingsToReview = s.drawings?.some(
      (d) => d.visibleToClient !== false && (d.status === "Draft" || d.status === "Under Review")
    );
    if (hasDrawingsToReview) {
      return "Review drawings & provide feedback";
    }
    return "None";
  };
  const pendingAction = getPendingAction(site);

  return (
    <div className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between text-left">
      <div>
        <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider mb-4">Project Feed & Status</h4>
        <div className="space-y-6">
          
          {/* Dynamic Project Status Tracker */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-semibold">Current Phase</p>
              <p className="text-sm font-bold text-darkgray mt-0.5">
                {site ? `Stage ${currentDesignStage}` : "Project Onboarding"}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E0F2FE] text-[#0284C7] uppercase">
              {site?.designStatus || "In Progress"}
            </span>
          </div>

          {/* Design Summary Widget */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-purple-50/20 border border-indigo-100/40 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <LayoutGrid size={16} className="text-purple" />
                <span className="text-xs font-bold text-slate-700">Design Workspace Summary</span>
              </div>
              <span className="text-[10px] font-bold text-purple bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                Active Integration
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Design Stage</span>
                <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{currentDesignStage}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Design Progress</span>
                <p className="text-xs font-bold text-purple mt-0.5">{designProgress}%</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Files Uploaded</span>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{totalDrawings} Drawings</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-50 shadow-xs">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Revisions Logs</span>
                <p className="text-xs font-bold text-slate-800 mt-0.5">{totalRevisions} Revisions</p>
              </div>
            </div>

            {/* Design Stage Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between items-center text-[10px] font-semibold text-gray-500 mb-1">
                <span>Overall Design Completion</span>
                <span>{designProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-purple h-full transition-all duration-500 rounded-full" 
                  style={{ width: `${designProgress}%` }}
                ></div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-500">Action Required:</span>
                <span className={`font-bold ${pendingAction !== "None" ? "text-amber-600" : "text-emerald-600"}`}>
                  {pendingAction}
                </span>
              </div>
              <button
                onClick={() => navigate(`/client-portal/${client.clientID}/designs-renders`)}
                className="flex items-center gap-1 text-[11px] font-bold text-purple hover:text-dark-blue transition-colors cursor-pointer"
              >
                Open Designs & Renders
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
          
          {/* Milestone Summary */}
          <div className="p-4 rounded-xl bg-emerald-50/30 border border-emerald-100/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-slate-700">Payment Milestone Progress</span>
              <span className="text-xs font-bold text-emerald-700">{progressPct}% Paid</span>
            </div>
            <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>

          {/* Revision Limit & Policy Widget */}
          <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-xs space-y-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileEdit size={16} className="text-purple" />
                <span className="text-xs font-bold text-slate-700">Revision Usage & Policy</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                (site?.revisions?.length || 0) >= 3 
                  ? "bg-amber-50 text-amber-700 border-amber-100" 
                  : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}>
                {(site?.revisions?.length || 0) >= 3 ? "Paid Track Active" : "Complimentary Track"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Complimentary Limit</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block">3 Free Revisions</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Revisions Used</span>
                <span className="text-xs font-extrabold text-purple mt-1 block">
                  {Math.min(site?.revisions?.filter(r => r.status !== "Awaiting Payment").length || 0, 3)} / 3 Used
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Policy Applied</span>
                <span className="text-xs font-extrabold text-slate-800 mt-1 block">
                  {(site?.revisions?.length || 0) >= 3 ? "Paid Revisions Active" : "Complimentary Active"}
                </span>
              </div>
            </div>

            <p className="text-[10.5px] text-text-subtle leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
              <strong>Revision Rule:</strong> Complimentary revisions include initial design submission and up to 3 revisions. Subsequent change requests are billed as paid revisions.
            </p>
          </div>

          {/* Recent Activities */}
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recent Updates</p>
            <div className="border-l-2 border-slate-200 pl-4 space-y-4 text-xs text-left">
              <div className="relative">
                <div className="absolute -left-[22px] top-0.5 w-2.5 h-2.5 rounded-full bg-select-blue ring-4 ring-white" />
                <p className="font-bold text-darkgray">Design Workspace Updated</p>
                <p className="text-gray-500 mt-0.5">New drawings uploaded for Client review. Visible in Designs & Renders.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[22px] top-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white" />
                <p className="font-bold text-darkgray">Milestone Paid: Token Advance</p>
                <p className="text-gray-500 mt-0.5">Booking token payment confirmed and processed.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalDashboard;
