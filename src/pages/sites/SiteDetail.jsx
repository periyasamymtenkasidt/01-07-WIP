import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiMapPin,
  FiPhone,
  FiMessageCircle,
  FiX,
  FiUser,
  FiCheckCircle,
  FiAlertTriangle,
  FiMail,
  FiFileText,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";

import { Loader2 } from "lucide-react";
import { getSite } from "../../data/siteStorage";
import { resolveSiteFileUrls } from "../../data/fileStorage";
import ClientAvatar from "../../assets/images/Client_avatar.png";
import DesignPipeline from "./components/DesignPipeline";
import SurveyMeasurements from "./components/SurveyMeasurements";
import Feasibility from "./components/Feasibility";
import { getDesignFlow } from "../../data/designFlowStorage";
import { getSiteServiceTrack } from "../../data/surveyMeasureStorage";

const SiteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);

  // Read-only details (from the site record)
  const [editStatus, setEditStatus] = useState("");
  const [editSupervisor, setEditSupervisor] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const [lightboxImg, setLightboxImg] = useState(null);

  useEffect(() => {
    const loadSiteData = async () => {
      const data = getSite(id);
      if (data) {
        const resolved = await resolveSiteFileUrls(data);
        setSite(resolved);
        setEditStatus(resolved.status || "");
        setEditSupervisor(resolved.supervisor || "");
        setEditTargetDate(resolved.targetDate || "");
        setEditNotes(resolved.notes || "");
        setEditAddress(resolved.fullAddress || "");
      }
      setLoading(false);
    };
    loadSiteData();
    // Re-fetch when a gate flips the site (Move to Design / Feasibility → Design)
    // so the page swaps into the right view without a manual reload.
    window.addEventListener("siteDataChanged", loadSiteData);
    window.addEventListener("designFlowChanged", loadSiteData);
    return () => {
      window.removeEventListener("siteDataChanged", loadSiteData);
      window.removeEventListener("designFlowChanged", loadSiteData);
    };
  }, [id]);

  const handleExpandSurveyPhoto = (images, initialIdx, title) => {
    setLightboxImg({ images, currentIndex: initialIdx, title });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full bg-overallbg">
        <Loader2 className="animate-spin text-select-blue" size={36} />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-overallbg p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-4">
          <FiX size={32} />
        </div>
        <h2 className="text-xl font-bold text-darkgray mb-2">Site Not Found</h2>
        <p className="text-text-muted text-sm mb-6 max-w-sm">
          The site with ID "{id}" could not be found or has been deleted.
        </p>
        <button
          onClick={() => navigate("/sitevisit")}
          className="flex items-center gap-2 px-5 py-2.5 bg-dark-blue text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-blue-950 transition-all"
        >
          <FiArrowLeft size={16} /> Back to Sites List
        </button>
      </div>
    );
  }

  const statusColors = {
    survey: "bg-blue-100 text-blue-800 border-blue-200",
    design: "bg-purple-100 text-purple-800 border-purple-200",
    "in progress": "bg-amber-100 text-amber-800 border-amber-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  const activeStatusColor =
    statusColors[site.status?.toLowerCase()] || "bg-gray-100 text-gray-800 border-gray-200";

  // During the design phase: sites taken through the survey → design freeze get
  // the staged pipeline; legacy "Design" sites fall back to the original workspace.
  const isDesignPhase = site.status?.toLowerCase() === "design";
  const designFlow = isDesignPhase ? getDesignFlow(site.siteID) : null;
  if (isDesignPhase && designFlow) {
    return (
      <div className="bg-overallbg flex h-full flex-col overflow-hidden p-6 font-sans">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-grey hover:text-darkgray"
        >
          <FiArrowLeft size={14} /> Back
        </button>
        <DesignPipeline site={site} />
      </div>
    );
  }

  // Status says Design but there's no frozen survey behind it (stale/legacy
  // data) — guide back to Survey rather than showing a broken design view.
  const designMissingBasis = isDesignPhase && !designFlow;

  return (
    <div className="bg-overallbg p-6 font-sans h-full flex flex-col overflow-y-auto lg:overflow-hidden scroll-hidden-bar">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sitevisit")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border hover:bg-gray-50 hover:border-select-blue/30 text-gray-500 hover:text-select-blue transition-all shadow-sm cursor-pointer animate-all"
            title="Go back to Sites"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-bold text-darkgray leading-tight">
                Site Workspace
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${activeStatusColor}`}>
                {site.status || "Unassigned"}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-1">
              <span
                className="cursor-pointer hover:text-select-blue"
                onClick={() => navigate("/sitevisit")}
              >
                Sites List
              </span>{" "}
              — {site.siteID} ({site.clientName})
            </p>
          </div>
        </div>

      </div>

      {/* Main Grid */}
      <div className="flex-1 flex flex-col gap-6 w-full lg:min-h-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pb-6">

        {/* Merged: client info + site details — one full-width card */}
        <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

            {/* Left: client info */}
            <div className="lg:col-span-1 min-w-0 lg:border-r lg:border-gray-100 lg:pr-6">
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100">
              <div className="relative shrink-0">
                <img
                  src={ClientAvatar}
                  alt="Client Profile Avatar"
                  className="w-14 h-14 rounded-full border border-gray-100 shadow-sm object-cover"
                />
                <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-darkgray truncate">{site.clientName}</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Client Profile</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Site ID</span>
                <span className="font-bold text-darkgray text-[12px]">{site.siteID}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Scope</span>
                <span className="font-bold text-darkgray text-[12px] text-right">
                  {(() => {
                    const preset = site.propertyPreset;
                    const siteType = site.siteType || "";
                    const formattedPreset = preset ? preset.replace(/^(\d+)(BHK)$/i, "$1 BHK") : "";
                    return formattedPreset ? `${formattedPreset} / ${siteType}` : siteType;
                  })()}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Start Date</span>
                {site.startDate === "Awaiting Advance Payment" ? (
                  <span className="font-bold text-amber-600 text-[10px] bg-amber-50 border border-amber-100 px-2.5 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                    <FiAlertTriangle size={11} />
                    Awaiting Advance
                  </span>
                ) : (
                  <span className="font-bold text-darkgray text-[12px]">{site.startDate}</span>
                )}
              </div>
              <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Budget / Value</span>
                <span className="font-bold text-select-blue text-[12px]">{site.budget || "—"}</span>
              </div>
              {site.clientPhone && (
                <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Contact Phone</span>
                  <a href={`tel:${site.clientPhone}`} className="font-bold text-darkgray hover:text-select-blue text-[12px] flex items-center gap-1 transition-colors">
                    <FiPhone size={11} className="text-gray-400" />
                    +91 {site.clientPhone}
                  </a>
                </div>
              )}
              {site.clientEmail && (
                <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px] min-w-0">
                  <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Contact Email</span>
                  <span className="font-bold text-darkgray text-[11px] truncate max-w-[55%]" title={site.clientEmail}>
                    {site.clientEmail}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                <span className="text-gray-400 font-bold uppercase text-[9px] tracking-wider">Advance Payment</span>
                {site.isAdvancePaid ? (
                  <span className="font-bold text-emerald-700 text-[9px] bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">
                    Paid ({site.advancePaidDate})
                  </span>
                ) : (
                  <span className="font-bold text-red-600 text-[10px] bg-red-50 border border-red-100 px-2 py-0.5 rounded uppercase tracking-wider">
                    Pending
                  </span>
                )}
              </div>
            </div>
            </div>

            {/* Right: site details */}
            <div className="lg:col-span-2 min-w-0">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <h3 className="text-[15px] font-bold text-darkgray flex items-center gap-2">
                <span className="w-2.5 h-4 bg-select-blue rounded-xs inline-block"></span>
                Site details &amp; Logs
              </h3>
            </div>

              <div className="flex flex-col gap-3">
                {/* Site incharge with call actions */}
                <div className="flex items-center justify-between gap-3 p-2.5 border border-bg-soft bg-palewhite rounded-[12px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 text-select-blue flex items-center justify-center shrink-0">
                      <FiUser size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                        Site Incharge
                      </p>
                      <p className="text-[13px] font-bold text-darkgray truncate">
                        {editSupervisor || "Not Assigned"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={site.clientPhone ? `tel:${site.clientPhone}` : undefined}
                      title="Call"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-dark-blue text-white text-[11px] font-bold hover:bg-blue-950 transition-colors"
                    >
                      <FiPhone size={12} /> Call
                    </a>
                    <a
                      href={
                        site.clientPhone
                          ? `https://wa.me/91${site.clientPhone}`
                          : undefined
                      }
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-palewhite border border-gray-100 text-darkgray text-[11px] font-bold hover:bg-bg-soft transition-colors"
                    >
                      <FaWhatsapp size={12} /> WhatsApp
                    </a>
                  </div>
                </div>

                {/* Status / Target */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                      Status
                    </p>
                    <p className="text-[13px] font-semibold text-darkgray mt-0.5 truncate">
                      {editStatus || "Unassigned"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                      Target Completion
                    </p>
                    <p className="text-[13px] font-semibold text-darkgray mt-0.5 truncate">
                      {editTargetDate || "Not Set"}
                    </p>
                  </div>
                </div>

                {/* Address — full width, wraps */}
                <div>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                    Address
                  </p>
                  <p className="text-[13px] font-semibold text-darkgray mt-0.5 whitespace-pre-wrap break-words">
                    {editAddress || "—"}
                  </p>
                </div>

                {/* Operations Log */}
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                    Operations Log
                  </p>
                  <p className="text-[12px] text-text-muted mt-1 whitespace-pre-wrap line-clamp-2">
                    {editNotes || "No logs entered yet."}
                  </p>
                </div>
              </div>
          </div>

        </div>
        </div>

        {designMissingBasis && (
          <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4 text-[12.5px] text-amber-800">
            This site is marked <strong>Design</strong> but hasn&apos;t been through the
            survey freeze yet, so there&apos;s no design pipeline to show. Complete the
            survey below and click "Move to Design" to start it properly.
          </div>
        )}

        {/* Front-end — Architecture does Feasibility; Interiors does Survey */}
        {getSiteServiceTrack(site) === "Architecture" ? (
          <Feasibility site={site} />
        ) : (
          <SurveyMeasurements site={site} onExpandPhoto={handleExpandSurveyPhoto} />
        )}

      </div>

      {/* Lightbox / Zoom View */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-4 transition-all select-none"
          onClick={() => setLightboxImg(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-6 right-6 text-white/75 hover:text-white text-xs bg-white/10 px-4 py-2 rounded-full cursor-pointer hover:bg-white/20 transition-all font-semibold uppercase tracking-wider z-[210]"
          >
            ✕ Close View
          </button>

          {/* Left Arrow */}
          {lightboxImg.images?.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImg((prev) => ({
                  ...prev,
                  currentIndex:
                    prev.currentIndex === 0
                      ? prev.images.length - 1
                      : prev.currentIndex - 1,
                }));
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all cursor-pointer z-[210]"
            >
              <FiChevronLeft size={24} />
            </button>
          )}

          {/* Active File Preview */}
          <div onClick={(e) => e.stopPropagation()} className="max-w-[95vw] max-h-[80vh] w-full flex items-center justify-center">
            {(() => {
              const url = lightboxImg.images[lightboxImg.currentIndex];
              const ext = (url || "").split("?")[0].split(".").pop().toLowerCase();
              const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) || url.startsWith("blob:") || url.startsWith("data:image/");
              const isPdf = ext === "pdf" || url.includes("pdf");
              
              if (isImage) {
                return (
                  <img
                    src={url}
                    alt={`${lightboxImg.title} view`}
                    className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl transition-transform duration-300"
                  />
                );
              } else if (isPdf) {
                return (
                  <iframe
                    src={url}
                    title={lightboxImg.title}
                    className="w-full h-[70vh] max-w-4xl rounded-lg shadow-2xl bg-white border border-slate-200"
                  />
                );
              } else {
                return (
                  <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center flex flex-col items-center border border-gray-200 shadow-2xl">
                    <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-select-blue mb-4">
                      <FiFileText size={32} />
                    </div>
                    <h4 className="text-sm font-bold text-darkgray mb-2">{lightboxImg.title || "Document File"}</h4>
                    <p className="text-xs text-gray-400 mb-6">Preview not available for this document type.</p>
                    <a
                      href={url}
                      download={lightboxImg.title || "document"}
                      className="px-6 py-2.5 bg-select-blue text-white font-semibold rounded-xl text-xs hover:bg-blue-950 transition-all cursor-pointer shadow-sm"
                    >
                      Download File
                    </a>
                  </div>
                );
              }
            })()}
          </div>

          {/* Right Arrow */}
          {lightboxImg.images?.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxImg((prev) => ({
                  ...prev,
                  currentIndex:
                    prev.currentIndex === prev.images.length - 1
                      ? 0
                      : prev.currentIndex + 1,
                }));
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-all cursor-pointer z-[210]"
            >
              <FiChevronRight size={24} />
            </button>
          )}

          {/* Title & Caption */}
          <h3 className="text-white font-bold text-base mt-6 tracking-wide">
            {lightboxImg.title} (View {lightboxImg.currentIndex + 1} of{" "}
            {lightboxImg.images.length})
          </h3>
          <p className="text-white/60 text-[10px] uppercase tracking-wider mt-1.5">
            Mobile App Survey Upload
          </p>
        </div>
      )}
    </div>
  );
};

export default SiteDetail;
