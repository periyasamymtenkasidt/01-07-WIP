import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ClientTableData } from "../../data/ClientTableData";
import avatar from "../../assets/images/avatar.png";
import EditInquiryform from "./EditInquiryform";
import ConvertToClientForm from "./ConvertToClientForm";
import NegotiationModal from "../projects/NegotiationModal";
import LogActivityModal from "../projects/LogActivityModal";
import QuoteModal from "../../components/QuoteModal";
import FeeProposalModal from "../../components/FeeProposalModal";
import PrelimVisitModal from "../../components/PrelimVisitModal";
import QuotePreviewModal from "../../components/QuotePreviewModal";
import {
  getDocumentsForLead,
  getLatestQuoteForParent,
  saveQuoteDocument,
} from "../../data/QuotePresets";
import { downloadQuoteAsImage } from "../../utils/downloadQuoteImage";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import {
  PIPELINE_STEPS,
  LOST_REASONS,
  getBadgeClass,
  getStepIndex,
  isPipelineStep,
  getActivity,
  appendActivity,
  fetchServerActivity,
} from "../../data/LeadStatusConfig";
import {
  FiEdit2,
  FiTrash2,
  FiMapPin,
  FiCalendar,
  FiPhone,
  FiMail,
  FiMessageCircle,
  FiDownload,
  FiFileText,
  FiLayers,
  FiHome,
  FiCheck,
  FiArrowRight,
  FiArrowLeft,
  FiUserCheck,
  FiSend,
  FiPause,
  FiPlay,
  FiXCircle,
  FiTrendingUp,
  FiAward,
  FiEdit3,
  FiX,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";
import { getOrSeedSchedule, saveSchedule } from "../../data/scheduleStorage";
import { createContractFromConversion } from "../../data/contractStorage";
import { resolveServiceTrack } from "../../data/serviceTrack";
import { updateLead, deleteLead, convertLead, listLeads } from "../../api/leads";
import { toApiDate, toDisplayDate } from "../../utils/leadDates";

// Resolve the Mongo backend id from a lead record. Records that only exist in
// the local write-through cache (offline create) have no `id` (only the display
// proposalId) — return "" so callers skip the API and stay local-only until the
// next reconcile picks up the server copy. Never throws.
const backendIdOf = (leadRecord) =>
  (leadRecord && (leadRecord.id || leadRecord._id)) || "";

// Read a single lead out of the local write-through cache by its display
// proposalId. Used to paint the detail page instantly before the backend
// reconcile lands; returns null when the lead isn't cached locally.
const readLocalLead = (proposalId) => {
  try {
    const arr = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
    if (Array.isArray(arr))
      return arr.find((l) => l.proposalId === proposalId) || null;
  } catch {
    /* ignore malformed cache */
  }
  return null;
};

// Detail-only fields the UI persists locally that the backend lead schema may
// not carry (quote-builder state, fee proposal, prelim visit, negotiation
// notes, the converted client id). These are merged OVER the authoritative
// server record on reconcile so a fetch never blanks them out.
const UI_ONLY_FIELDS = [
  "quotePreset",
  "quoteSizeRange",
  "quoteGrade",
  "quoteScopeItems",
  "quoteInclusions",
  "quoteExclusions",
  "quoteCategoryInclusions",
  "quoteCategoryExclusions",
  "quoteAddedInclusions",
  "quoteAddedExclusions",
  "quoteValidityDays",
  "quoteNotes",
  "feeProposal",
  "prelimVisit",
  "negotiationNote",
  "expectedClose",
  "convertedClientID",
];
const localUiFields = (local) => {
  if (!local) return {};
  const out = {};
  for (const k of UI_ONLY_FIELDS)
    if (local[k] !== undefined) out[k] = local[k];
  return out;
};

const LostReasonModal = ({ onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const canSubmit = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-[16px] font-manrope shadow-2xl w-full max-w-[460px] mx-auto p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
          title="Close dialog"
        >
          <FiX size={16} />
        </button>
        <div className="flex items-start gap-3 mb-5">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <FiXCircle size={22} />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-darkgray">
              Mark Inquiry as Lost
            </h2>
            <p className="text-[12px] text-text-muted mt-0.5">
              Capture the reason — this feeds win/loss reporting.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[12px] font-semibold text-text mb-2">
            Reason <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {LOST_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`py-2 px-3 rounded-lg text-xs font-medium border transition-all text-left ${
                  reason === r
                    ? "bg-active-bg border-select-blue text-select-blue"
                    : "bg-white border-border text-text-muted hover:bg-bg-soft"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-[12px] font-semibold text-text mb-2">
            Notes (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Anything useful for future re-engagement…"
            className="w-full rounded-lg border border-border px-3 py-2 text-[13px] text-text placeholder:text-text-subtle focus:outline-none focus:border-select-blue resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-text-muted hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason, note)}
            disabled={!canSubmit}
            className="px-5 py-2.5 rounded-lg bg-red-500 text-white text-[13px] font-semibold hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark Lost
          </button>
        </div>
      </div>
    </div>
  );
};

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDocSize = (snapshot) => {
  // Synthetic size based on quote complexity — purely cosmetic until we
  // generate a real PDF.
  const items = snapshot?.scopeItems?.length || 0;
  return `PDF • ${(120 + items * 18).toLocaleString()} KB`;
};

const formatDocDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const DocumentsCard = ({ documents, onOpen }) => {
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownload = async (e, doc) => {
    e.stopPropagation();
    setDownloadingId(doc.docId);
    try {
      await downloadQuoteAsImage(doc.snapshot, doc.fileName);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[17px] font-bold text-darkgray">Documents</h3>
        {documents.length > 0 && (
          <span className="px-2.5 py-1 bg-active-bg text-select-blue text-[10px] font-bold tracking-wider rounded-md">
            {documents.length}
          </span>
        )}
      </div>

      {documents.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-bg-soft px-4 py-8 text-center">
          <div className="w-10 h-10 mx-auto bg-active-bg text-sky-blue rounded-[10px] flex items-center justify-center mb-2">
            <FiFileText size={18} />
          </div>
          <p className="text-[12px] font-semibold text-text">
            No documents yet
          </p>
          <p className="text-[11px] text-text-muted mt-0.5">
            Sent proposals appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {documents.map((doc) => (
            <div
              key={doc.docId}
              className="flex items-center justify-between p-3.5 border border-bg-soft rounded-[14px] hover:border-sky-blue/40 hover:bg-palewhite transition-all group"
            >
              <button
                type="button"
                onClick={() => onOpen?.(doc)}
                className="flex items-center gap-3.5 min-w-0 text-left flex-1 cursor-pointer"
                title="Preview quote"
              >
                <div className="w-10 h-10 bg-active-bg text-sky-blue rounded-[10px] flex items-center justify-center shrink-0">
                  <FiFileText size={18} />
                </div>
                <div className="truncate pr-2">
                  <p className="text-[13px] font-bold text-darkgray truncate leading-tight mb-1">
                    {doc.fileName}
                  </p>
                  <p className="text-[11px] font-medium text-gray-400">
                    {formatDocSize(doc.snapshot)} · Sent{" "}
                    {formatDocDate(doc.sentAt)}
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={(e) => handleDownload(e, doc)}
                disabled={downloadingId === doc.docId}
                className="text-gray-400 hover:text-sky-blue disabled:opacity-50 transition-colors shrink-0 ml-2 p-1"
                title="Download as PNG"
              >
                <FiDownload size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Maps an activity log entry to its visual treatment in the timeline card.
const activityMeta = (entry) => {
  if (entry.type === "email") {
    const count = entry.attachments?.length || 0;
    const totalBytes =
      entry.attachments?.reduce((s, a) => s + (a.size || 0), 0) || 0;
    const attachLine =
      count > 0
        ? ` • ${count} attachment${count > 1 ? "s" : ""} (${formatBytes(totalBytes)})`
        : "";
    return {
      title: `Proposal emailed to ${entry.to}`,
      body: `${entry.subject ? `Subject: ${entry.subject}` : ""}${attachLine}`,
      icon: <FiSend size={12} />,
      bg: "bg-active-bg",
      iconColor: "text-blue-500",
    };
  }
  if (entry.type === "call") {
    return {
      title: `${entry.direction === "inbound" ? "Inbound" : "Outbound"} call${entry.duration ? ` • ${entry.duration} min` : ""}`,
      body: entry.notes || "",
      icon: <FiPhone size={12} />,
      bg: "bg-green-50",
      iconColor: "text-green-600",
    };
  }
  if (entry.type === "note") {
    return {
      title: "Note added",
      body: entry.text,
      icon: <FiEdit3 size={12} />,
      bg: "bg-gray-100",
      iconColor: "text-gray-600",
    };
  }
  if (entry.type === "negotiation") {
    return {
      title: "Moved to Negotiation",
      body: [
        entry.note ? `Blocker: ${entry.note}` : "",
        entry.expectedClose ? `Expected close: ${entry.expectedClose}` : "",
      ]
        .filter(Boolean)
        .join(" • "),
      icon: <FiTrendingUp size={12} />,
      bg: "bg-amber-50",
      iconColor: "text-amber-600",
    };
  }
  if (entry.type === "milestone") {
    return {
      title: `Milestone ${entry.action}: ${entry.milestoneName}`,
      body: "",
      icon: <FiAward size={12} />,
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    };
  }
  // status transition
  const to = entry.to?.toLowerCase();
  const map = {
    qualified: {
      icon: <FiCheck size={12} />,
      bg: "bg-green-50",
      iconColor: "text-green-600",
    },
    proposal: {
      icon: <FiFileText size={12} />,
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    negotiation: {
      icon: <FiTrendingUp size={12} />,
      bg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    won: {
      icon: <FiAward size={12} />,
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    converted: {
      icon: <FiUserCheck size={12} />,
      bg: "bg-teal-50",
      iconColor: "text-teal-600",
    },
    "on hold": {
      icon: <FiPause size={12} />,
      bg: "bg-gray-100",
      iconColor: "text-gray-500",
    },
    lost: {
      icon: <FiXCircle size={12} />,
      bg: "bg-red-50",
      iconColor: "text-red-600",
    },
  };
  const styling = map[to] || {
    icon: <FiCheck size={12} />,
    bg: "bg-gray-100",
    iconColor: "text-gray-500",
  };
  const body =
    entry.to === "Lost" && entry.lostReason
      ? `Reason: ${entry.lostReason}${entry.lostNote ? ` — ${entry.lostNote}` : ""}`
      : `Status moved from ${entry.from || "—"} to ${entry.to}`;
  return {
    title: `Marked as ${entry.to}`,
    body,
    ...styling,
  };
};

const formatActivityTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
};

const LeadEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // Seed synchronously from the local write-through cache so the page paints
  // instantly for a lead the user just touched. The reconcile effect below then
  // replaces it with the authoritative server record (and pulls in leads that
  // only exist on the backend).
  const [lead, setLead] = useState(() => readLocalLead(id));
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [showNegotiationModal, setShowNegotiationModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logTab, setLogTab] = useState("call");
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showPrelimVisit, setShowPrelimVisit] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [activity, setActivity] = useState(() => (id ? getActivity(id) : []));
  const [documents, setDocuments] = useState(() =>
    id ? getDocumentsForLead(id) : [],
  );

  // Reconcile against the backend. Leads are served by GET /leads, so pull the
  // authoritative record for this proposalId and merge any local UI-only fields
  // (quote-builder state, fee proposal, prelim visit, negotiation notes) on top
  // so nothing the modals saved locally is lost. Leaves the local seed in place
  // if the fetch fails or the lead isn't on the server yet (offline create).
  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      let server = null;
      try {
        const res = await listLeads({ limit: 200 });
        const all = Array.isArray(res) ? res : (res?.data ?? []);
        server = all.find((l) => l.proposalId === id) || null;
      } catch (err) {
        console.warn(
          "LeadEdit: listLeads failed, keeping local copy —",
          err?.message || err,
        );
        return;
      }
      if (cancelled || !server) return;
      // Server dates come back ISO. possessionDate renders as DD.MM.YYYY;
      // targetCompletion stays YYYY-MM-DD (its existing convention — the edit
      // form binds it straight to a native date input).
      const normalized = {
        ...server,
        possessionDate: toDisplayDate(server.possessionDate),
        targetCompletion: toApiDate(server.targetCompletion) || "",
      };
      setLead((local) => ({ ...normalized, ...localUiFields(local) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Hydrate the activity timeline from the backend once we know the lead's
  // server id (set by the reconcile above). The server is the source of truth;
  // we only keep the local log when it returns nothing — an offline lead, an
  // empty server timeline, or a failed fetch.
  React.useEffect(() => {
    const backendId = lead?.id || lead?._id;
    if (!backendId) return;
    let cancelled = false;
    (async () => {
      const server = await fetchServerActivity(backendId);
      if (!cancelled && server.length > 0) setActivity(server);
    })();
    return () => {
      cancelled = true;
    };
  }, [lead?.id, lead?._id]);

  // Refresh documents when sends complete. The `activity` state changes on
  // every email/quote send, so it's a reliable trigger.
  React.useEffect(() => {
    if (!id) return;
    setDocuments(getDocumentsForLead(id));
  }, [id, activity]);

  // Persist a status transition: write to localStorage, append activity entry,
  // re-render, and notify the leads list so its counts/tabs stay in sync.
  const transitionStatus = (nextStatus, extra = {}) => {
    if (!lead) return;
    const saved = localStorage.getItem("newLeadsData");
    const newLeads = saved ? JSON.parse(saved) : [];
    const updated = { ...lead, status: nextStatus, ...extra };
    const filtered = newLeads.filter((l) => l.proposalId !== lead.proposalId);
    localStorage.setItem(
      "newLeadsData",
      JSON.stringify([updated, ...filtered]),
    );
    setLead(updated);
    setActivity(
      appendActivity(lead.proposalId, {
        type: "status",
        from: lead.status,
        to: nextStatus,
        ...extra,
      }),
    );
    window.dispatchEvent(new Event("leadDataChanged"));

    // Backend write-through. On success re-notify so the backend-sourced leads
    // list re-reads the updated record. Skip local-only records (no server id).
    const backendId = backendIdOf(lead);
    if (backendId) {
      updateLead(backendId, { status: nextStatus, ...extra })
        .then(() => window.dispatchEvent(new Event("leadDataChanged")))
        .catch((err) =>
          console.warn("transitionStatus: updateLead failed —", err?.message || err),
        );
    }
  };

  // Merge a patch onto the lead and persist (no status change / activity log).
  const patchLead = (patch) => {
    if (!lead) return;
    const saved = localStorage.getItem("newLeadsData");
    const newLeads = saved ? JSON.parse(saved) : [];
    const updated = { ...lead, ...patch };
    localStorage.setItem(
      "newLeadsData",
      JSON.stringify([
        updated,
        ...newLeads.filter((l) => l.proposalId !== lead.proposalId),
      ]),
    );
    setLead(updated);
    window.dispatchEvent(new Event("leadDataChanged"));

    // Backend write-through; re-notify on success so the leads list re-reads.
    // Skip local-only records (no server id).
    const backendId = backendIdOf(lead);
    if (backendId) {
      updateLead(backendId, patch)
        .then(() => window.dispatchEvent(new Event("leadDataChanged")))
        .catch((err) =>
          console.warn("patchLead: updateLead failed —", err?.message || err),
        );
    }
  };

  const handleDelete = async () => {
    const deleted = localStorage.getItem("deletedLeads");
    let deletedLeads = deleted ? JSON.parse(deleted) : [];
    if (!deletedLeads.includes(id)) {
      deletedLeads.push(id);
      localStorage.setItem("deletedLeads", JSON.stringify(deletedLeads));
    }
    setShowDeleteConfirm(false);

    // Delete on the backend and WAIT before navigating, so the backend-sourced
    // leads list doesn't re-fetch the row before it's actually gone. Skip
    // local-only records (no server id).
    const backendId = backendIdOf(lead);
    if (backendId) {
      try {
        await deleteLead(backendId);
      } catch (err) {
        console.warn("handleDelete: deleteLead failed —", err?.message || err);
      }
    }

    window.dispatchEvent(new Event("leadDataChanged"));
    navigate("/leads");
  };

  const handleEditSave = (updatedData) => {
    const saved = localStorage.getItem("newLeadsData");
    let newLeads = saved ? JSON.parse(saved) : [];

    // Architecture has no package preset — blank the interiors fields so the
    // form's defaults don't leak onto the lead or its detail view.
    const isArch =
      (updatedData.serviceTrack || lead.serviceTrack || "Interiors") ===
      "Architecture";

    // Map formData back to lead format
    const newLeadFormat = {
      ...lead,
      clientName: updatedData.fullName,
      phone: updatedData.phoneNumber,
      email: updatedData.email,
      scope: updatedData.projectScope,
      location: updatedData.location?.trim() || lead.location || "",
      locationSecondary:
        updatedData.locationSecondary?.trim() || lead.locationSecondary || "",
      serviceTrack: updatedData.serviceTrack || lead.serviceTrack || "Interiors",
      projectIntent: updatedData.projectIntent ?? lead.projectIntent ?? "",
      plotArea: updatedData.plotArea ?? lead.plotArea ?? "",
      plotNumber: updatedData.plotNumber ?? lead.plotNumber ?? "",
      landOwnership: updatedData.landOwnership ?? lead.landOwnership ?? "",
      targetCompletion: updatedData.targetCompletion ?? lead.targetCompletion ?? "",
      indicativeBudget: updatedData.indicativeBudget ?? lead.indicativeBudget ?? "",
      propertyType: isArch ? "" : updatedData.propertyType || lead.propertyType || "",
      status: updatedData.inquiryStatus || lead.status,
      investment: updatedData.investmentRange || lead.investment,
      inquirySource: updatedData.inquirySource || lead.inquirySource,
      referralPersonName: updatedData.referralPersonName || "",
      referralPersonEmail: updatedData.referralPersonEmail || "",
      possessionDate: isArch
        ? ""
        : updatedData.processionDate
          ? updatedData.processionDate.split("-").reverse().join(".")
          : lead.possessionDate,
      quotePreset: isArch ? "" : (updatedData.quotePreset ?? lead.quotePreset),
      quoteSizeRange: isArch ? "" : (updatedData.quoteSizeRange ?? lead.quoteSizeRange),
    };

    const filteredLeads = newLeads.filter((l) => l.proposalId !== id);
    const updatedLeads = [newLeadFormat, ...filteredLeads];
    localStorage.setItem("newLeadsData", JSON.stringify(updatedLeads));
    setLead(newLeadFormat);
    window.dispatchEvent(new Event("leadDataChanged"));

    // Best-effort backend write-through. Send only the editable fields (the API
    // assigns proposalId/id and computes derived fields). Skip local-only leads.
    const backendId = backendIdOf(lead);
    if (backendId) {
      const patch = {
        clientName: newLeadFormat.clientName,
        phone: newLeadFormat.phone,
        email: newLeadFormat.email,
        scope: newLeadFormat.scope,
        location: newLeadFormat.location,
        locationSecondary: newLeadFormat.locationSecondary,
        serviceTrack: newLeadFormat.serviceTrack,
        projectIntent: newLeadFormat.projectIntent,
        plotArea: newLeadFormat.plotArea,
        plotNumber: newLeadFormat.plotNumber,
        landOwnership: newLeadFormat.landOwnership,
        targetCompletion: toApiDate(newLeadFormat.targetCompletion),
        indicativeBudget: newLeadFormat.indicativeBudget,
        propertyType: newLeadFormat.propertyType,
        status: newLeadFormat.status,
        investment: newLeadFormat.investment,
        inquirySource: newLeadFormat.inquirySource,
        referralPersonName: newLeadFormat.referralPersonName,
        referralPersonEmail: newLeadFormat.referralPersonEmail,
        possessionDate: toApiDate(newLeadFormat.possessionDate),
        quotePreset: newLeadFormat.quotePreset,
        quoteSizeRange: newLeadFormat.quoteSizeRange,
      };
      updateLead(backendId, patch)
        .then(() => window.dispatchEvent(new Event("leadDataChanged")))
        .catch((err) =>
          console.warn("handleEditSave: updateLead failed —", err?.message || err),
        );
    }
  };
  const handleConvert = async (formData, numericValue) => {
    await new Promise((r) => setTimeout(r, 700));

    const savedClients = localStorage.getItem("newClientsData");
    const newClients = savedClients ? JSON.parse(savedClients) : [];

    const maxStaticId = ClientTableData.reduce((max, c) => {
      const n = parseInt(c.clientID.split("-").pop(), 10);
      return n > max ? n : max;
    }, 0);
    const nextNum = maxStaticId + newClients.length + 1;
    const clientID = `BL-2026-${String(nextNum).padStart(3, "0")}`;

    const today = new Date();
    const joinDate = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

    const budget =
      numericValue >= 10000000
        ? `₹${(numericValue / 10000000).toFixed(2)} Cr`
        : numericValue >= 100000
          ? `₹${(numericValue / 100000).toFixed(1)}L`
          : `₹${numericValue.toLocaleString("en-IN")}`;

    const siteAddress = [
      formData.addressLine1,
      formData.addressLine2,
      [formData.city, formData.state, formData.pincode]
        .filter(Boolean)
        .join(" "),
    ]
      .filter((s) => s && s.trim())
      .join(", ");

    const newClient = {
      sno: nextNum,
      clientID,
      clientName: formData.clientName,
      clientPhone: formData.clientPhone,
      clientEmail: formData.clientEmail,
      location: formData.location,
      locationSecondary: formData.city,
      addressLine1: formData.addressLine1,
      addressLine2: formData.addressLine2,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      siteAddress,
      budget,
      paymentStatus: "pending",
      joinDate,
      sourceLeadId: lead.proposalId,
      projectValue: numericValue,
    };
    localStorage.setItem(
      "newClientsData",
      JSON.stringify([newClient, ...newClients]),
    );

    // Seed and save the project schedule immediately
    const schedule = getOrSeedSchedule(lead);
    saveSchedule(lead.proposalId, schedule);

    const milestones = PAYMENT_MILESTONES.map((m) => {
      const base = Math.round((numericValue * m.pct) / 100);
      const gstAmt = Math.round((base * m.gst) / 100);
      return {
        ...m,
        base,
        gstAmt,
        total: base + gstAmt,
        status: "pending",
        dueDate: "",
        paidDate: "",
      };
    });
    localStorage.setItem(
      `clientMilestones_${clientID}`,
      JSON.stringify(milestones),
    );

    // Lock the agreed scope + value + payment schedule as a Contract — the
    // delivery anchor that procurement, work packages, change orders, invoices
    // and project P&L all reference via contractId. Persists the previously
    // "computed-only" project as a real record at the moment of Won.
    createContractFromConversion({
      lead,
      clientID,
      clientName: formData.clientName,
      numericValue,
      schedule,
      milestones,
    });

    const savedLeads = localStorage.getItem("newLeadsData");
    let newLeads = savedLeads ? JSON.parse(savedLeads) : [];
    const convertedLead = {
      ...lead,
      status: "Won",
      convertedClientID: clientID,
    };
    const filtered = newLeads.filter((l) => l.proposalId !== lead.proposalId);
    localStorage.setItem(
      "newLeadsData",
      JSON.stringify([convertedLead, ...filtered]),
    );
    setLead(convertedLead);
    setActivity(
      appendActivity(lead.proposalId, {
        type: "status",
        from: lead.status,
        to: "Won",
        clientID,
      }),
    );
    window.dispatchEvent(new Event("leadDataChanged"));

    // Best-effort backend write-through: the server creates its own client
    // record (idempotent). All local client/milestone/schedule/contract writes
    // above are kept regardless. Skip local-only leads.
    const backendId = backendIdOf(lead);
    if (backendId) {
      convertLead(backendId)
        .then(() => window.dispatchEvent(new Event("leadDataChanged")))
        .catch((err) =>
          console.warn("handleConvert: convertLead failed —", err?.message || err),
        );
    }

    return clientID;
  };

  if (!lead) {
    return (
      <div className="p-8 text-gray-500 font-medium">
        Loading lead details...
      </div>
    );
  }

  // Stepper: linear path only. "Lost" and "On Hold" are off-ramps rendered
  // as a callout below, not as steps.
  const steps = PIPELINE_STEPS;
  const onLinearPath = isPipelineStep(lead.status);
  // While off-path (Lost / On Hold) we keep the prior step highlighted up to
  // wherever the lead got — by default treat as Inquiry.
  const currentStepIdx = onLinearPath
    ? Math.max(getStepIndex(lead.status), 0)
    : 0;
  const isLost = lead.status?.toLowerCase() === "lost";
  const isOnHold = lead.status?.toLowerCase() === "on hold";
  const isArchLead = resolveServiceTrack(lead) === "Architecture";

  return (
    <div className="bg-overallbg p-6 font-sans h-full flex flex-col overflow-y-auto lg:overflow-hidden scroll-hidden-bar">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border hover:bg-gray-50 hover:border-select-blue/30 text-gray-500 hover:text-select-blue transition-all shadow-sm cursor-pointer"
            title="Go back"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[26px] font-bold text-darkgray leading-tight">
              New Inquiry
            </h1>
            <p className="text-[13px] text-gray-500 mt-1">
              Inquiries - New Inquiries
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          {/* Primary progression button — depends on current status */}
          {lead.status?.toLowerCase() === "inquiry" && (
            <button
              onClick={() => transitionStatus("Qualified")}
              className="flex items-center gap-2 px-5 py-2.5 bg-dark-blue text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-blue-950 shadow-sm transition-all"
            >
              <FiCheck size={16} /> Mark Qualified
            </button>
          )}
          {lead.status?.toLowerCase() === "qualified" &&
            (isArchLead ? (
              <>
                {/* Light preliminary visit before the fee proposal */}
                <button
                  onClick={() => setShowPrelimVisit(true)}
                  className={`flex items-center gap-2 px-5 py-2.5 cursor-pointer rounded-xl text-sm font-semibold shadow-sm transition-all ${
                    lead.prelimVisit?.done
                      ? "bg-white border border-border text-darkgray hover:bg-gray-50"
                      : "bg-dark-blue text-white hover:bg-blue-950"
                  }`}
                >
                  <FiMapPin size={16} />{" "}
                  {lead.prelimVisit?.done ? "Site Visit ✓" : "Site Visit"}
                </button>
                {lead.prelimVisit?.done && (
                  <button
                    onClick={() => setShowProposalModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-dark-blue text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-blue-950 shadow-sm transition-all"
                  >
                    <FiSend size={16} /> Send Fee Proposal
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={() => setShowProposalModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-dark-blue text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-blue-950 shadow-sm transition-all"
              >
                <FiSend size={16} /> Send Proposal
              </button>
            ))}
          {lead.status?.toLowerCase() === "proposal" && (
            <>
              <button
                onClick={() => setShowProposalModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
              >
                <FiMail size={16} /> Resend Proposal
              </button>
              <button
                onClick={() => setShowNegotiationModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-amber-600 shadow-sm transition-all"
              >
                <FiTrendingUp size={16} /> Move to Negotiation
              </button>
            </>
          )}
          {lead.status?.toLowerCase() === "negotiation" && (
            <button
              onClick={() => setShowProposalModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
            >
              <FiMail size={16} /> Resend Proposal
            </button>
          )}
          {(lead.status?.toLowerCase() === "proposal" ||
            lead.status?.toLowerCase() === "negotiation") && (
            <button
              onClick={() => setShowConvertForm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-sm transition-all"
            >
              <FiAward size={16} /> Mark Won
            </button>
          )}
          {lead.status?.toLowerCase() === "won" && (
            <button
              onClick={() => {
                const clientsStr = localStorage.getItem("newClientsData");
                let clientID = lead.convertedClientID;
                if (!clientID && clientsStr) {
                  try {
                    const clients = JSON.parse(clientsStr);
                    const found = clients.find((c) => c.sourceLeadId === lead.proposalId);
                    if (found) clientID = found.clientID;
                  } catch (e) {
                    console.error(e);
                  }
                }
                navigate(clientID ? `/clients/${clientID}` : "/clients");
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-200 cursor-pointer rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-100 shadow-sm transition-all"
            >
              <FiUserCheck size={16} /> View Client
            </button>
          )}

          {/* Hold toggle — available while the deal is still open */}
          {!isLost &&
            lead.status?.toLowerCase() !== "won" &&
            (isOnHold ? (
              <button
                onClick={() => transitionStatus("Qualified")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
              >
                <FiPlay size={16} /> Resume
              </button>
            ) : (
              <button
                onClick={() => transitionStatus("On Hold")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
              >
                <FiPause size={16} /> Put on Hold
              </button>
            ))}

          {/* Mark Lost — available until the deal is closed (won/converted) */}
          {!isLost && lead.status?.toLowerCase() !== "won" && (
            <button
              onClick={() => setShowLostModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 cursor-pointer rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 shadow-sm transition-all"
            >
              <FiXCircle size={16} /> Mark Lost
            </button>
          )}

          {lead.status?.toLowerCase() !== "won" && (
            <button
              onClick={() => {
                setLogTab("call");
                setShowLogModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
            >
              <FiPhone size={16} /> Log Call
            </button>
          )}
          {lead.status?.toLowerCase() !== "won" && (
            <button
              onClick={() => {
                setLogTab("note");
                setShowLogModal(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
            >
              <FiEdit3 size={16} /> Add Note
            </button>
          )}
          {lead.status?.toLowerCase() !== "won" && (
            <button
              onClick={() => setIsEditFormOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-border cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-gray-50 shadow-sm transition-all"
            >
              <FiEdit2 size={16} /> Edit Inquiry
            </button>
          )}
          {lead.status?.toLowerCase() !== "won" && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 cursor-pointer rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 shadow-sm transition-all"
            >
              <FiTrash2 size={16} /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full lg:items-stretch lg:overflow-hidden min-h-0">
        {/* Left Column (Main Content) */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6 min-w-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
          {/* Card 1: Main Info & Stepper */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getBadgeClass(lead.status)}`}
                  >
                    {lead.status || "Inquiry"}
                  </span>
                  <span className="text-[13px] text-gray-500 font-medium tracking-wide">
                    Proposal ID: #{lead.proposalId}
                  </span>
                </div>
                {/* Replaced generic lead.clientName with the exact project name from the mockup, while still keeping dynamic if you want, but user asked for "exact ui in the above image". So we will make it look exactly like the image, though using lead data where appropriate. */}
                <h2 className="text-[28px] font-bold text-dark-blue mb-3 tracking-tight">
                  {lead.clientName}
                </h2>
                <div className="text-[15px] text-gray-500 flex items-start gap-2">
                  <FiMapPin size={18} className="mt-1 shrink-0 text-gray-500" />
                  <div className="flex flex-col text-left">
                    {(() => {
                      const parts = lead.location?.includes(",")
                        ? lead.location.split(",")
                        : [lead.location || "", lead.locationSecondary || ""];
                      const primary = parts[0]?.trim() || "—";
                      const secondary = parts.slice(1).join(",").trim() || "";
                      return (
                        <>
                          <span className="text-gray-900 font-semibold leading-normal">{primary}</span>
                          {secondary && (
                            <span className="text-select-blue text-sm leading-tight mt-0.5">{secondary}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (documents[0]) setPreviewDoc(documents[0]);
                  }}
                  disabled={documents.length === 0}
                  className="px-6 py-2.5 bg-white border border-dark-blue text-dark-blue rounded-xl text-[13px] font-semibold hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  title={
                    documents.length === 0
                      ? "Send a proposal first to generate a quote"
                      : "View latest quote"
                  }
                >
                  Quote
                </button>
              </div>
            </div>

            {/* Stepper — dimmed when the lead is off-path (Lost / On Hold) */}
            <div
              className={`mt-14 mb-2 relative ${onLinearPath ? "" : "opacity-50"}`}
            >
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gray-200 -translate-y-1/2 rounded-full"></div>
              {/* Dynamic progress line */}
              <div
                className="absolute top-1/2 left-0 h-[3px] bg-dark-blue -translate-y-1/2 rounded-full transition-all duration-500"
                style={{
                  width: `${(currentStepIdx / (steps.length - 1)) * 100}%`,
                }}
              ></div>

              <div className="relative flex justify-between">
                {steps.map((step, idx) => {
                  const isCompleted = onLinearPath && idx <= currentStepIdx;
                  return (
                    <div key={idx} className="flex flex-col items-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center z-10 border-[3px] border-white ring-2 ring-white shadow-sm transition-colors ${
                          isCompleted
                            ? "bg-dark-blue text-white"
                            : "bg-gray-200 text-transparent"
                        }`}
                      >
                        {isCompleted && <FiCheck size={12} strokeWidth={4} />}
                      </div>
                      <span
                        className={`absolute top-8 text-[11px] font-bold ${
                          isCompleted ? "text-dark-blue" : "text-gray-400"
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Off-ramp callout */}
            {isLost && (
              <div className="mt-12 flex items-start gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <FiXCircle size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-red-700">
                    Marked as Lost
                  </p>
                  <p className="text-[12px] text-red-600 mt-0.5">
                    Reason: {lead.lostReason || "Not specified"}
                    {lead.lostNote ? ` — ${lead.lostNote}` : ""}
                  </p>
                </div>
              </div>
            )}
            {isOnHold && (
              <div className="mt-12 flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center shrink-0">
                  <FiPause size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-gray-700">
                    Lead is On Hold
                  </p>
                  <p className="text-[12px] text-gray-500 mt-0.5">
                    Resume when the client is ready to move forward.
                  </p>
                </div>
              </div>
            )}
            {lead.status?.toLowerCase() === "negotiation" && lead.negotiationNote && (
              <div className="mt-12 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FiTrendingUp size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-amber-800">
                    Active Blocker / Negotiation Details
                  </p>
                  <p className="text-[12px] text-amber-700 mt-0.5">
                    Reason / Remarks: {lead.negotiationNote}
                  </p>
                  {lead.expectedClose && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Expected Close Date: {lead.expectedClose}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Investment & Grid */}
          <div className="flex flex-col md:flex-row gap-6">
            {/* Investment Card */}
            <div className="bg-white rounded-[20px] p-7 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] w-full md:w-[35%] flex flex-col justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-3">
                  Investment Range
                </p>
                <h3 className="text-3xl font-bold text-dark-blue leading-tight">
                  {lead.investment?.includes("-") ? (
                    <>
                      {lead.investment.split("-")[0].trim()} - <br />{" "}
                      {lead.investment.split("-")[1].trim()}
                    </>
                  ) : (
                    lead.investment
                  )}
                </h3>
              </div>
              <div className="mt-10 border-t border-gray-100 text-left pt-5 space-y-3.5">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500 font-medium">
                    {isArchLead ? "Plot Area" : "Property Type"}
                  </span>
                  <div className="flex text-left items-center gap-2">
                    <span className="font-bold  text-gray-900">
                      {isArchLead
                        ? lead.plotArea || "—"
                        : lead.propertyType}
                    </span>
                    <div className="w-5 h-5 bg-gray-200 rounded flex items-center justify-center text-gray-500">
                      <FiHome size={12} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="w-full md:w-[65%] grid grid-cols-2 gap-4">
              <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4">
                <div className="w-10 h-10 bg-palewhite rounded-xl text-gray-500 flex items-center justify-center border border-gray-100">
                  <FiHome size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                    {isArchLead ? "Project Intent" : "Property Type"}
                  </p>
                  <p className="text-[14px] font-bold text-gray-800">
                    {isArchLead
                      ? lead.projectIntent || lead.scope || "—"
                      : lead.propertyType}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4">
                <div className="w-10 h-10 bg-palewhite rounded-xl text-gray-500 flex items-center justify-center border border-gray-100">
                  <FiCalendar size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                    {isArchLead ? "Target Completion" : "Possession Date"}
                  </p>
                  <p className="text-[14px] font-bold text-gray-800">
                    {isArchLead
                      ? lead.targetCompletion || "—"
                      : lead.possessionDate}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4">
                <div className="w-10 h-10 bg-palewhite rounded-xl text-gray-500 flex items-center justify-center border border-gray-100">
                  <FiLayers size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                    Project Scope
                  </p>
                  <p className="text-[14px] font-bold text-gray-800">
                    {(() => {
                      const presetKey = lead.quotePreset || "";
                      const propType = lead.propertyType || "";
                      if (!presetKey) return lead.scope || "—";
                      const formattedPresetKey = presetKey.replace(
                        /^(\d+)(BHK)$/i,
                        "$1 BHK",
                      );
                      return `${formattedPresetKey} / ${propType}`;
                    })()}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4">
                <div className="w-10 h-10 bg-palewhite rounded-xl text-gray-500 flex items-center justify-center border border-gray-100">
                  <FiMessageCircle size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                    Inquiry Source
                  </p>
                  <p className="text-[14px] font-bold text-gray-800">
                    {lead.inquirySource}
                  </p>
                </div>
              </div>
              {(() => {
                const track = resolveServiceTrack(lead);
                const isArch = track === "Architecture";
                return (
                  <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4 col-span-2">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                        isArch
                          ? "bg-violet-50 text-violet-600 border-violet-100"
                          : "bg-blue-50 text-select-blue border-blue-100"
                      }`}
                    >
                      <FiLayers size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                        Service Track
                      </p>
                      <p className="text-[14px] font-bold text-gray-800">
                        {track}
                        <span className="ml-2 text-[11px] font-semibold text-gray-400">
                          {isArch ? "Build from land" : "Fit-out"}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4 col-span-2">
                <div className="w-10 h-10 bg-palewhite rounded-xl text-gray-500 flex items-center justify-center border border-gray-100">
                  <FiPhone size={18} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                    Phone Number
                  </p>
                  <p className="text-[14px] font-bold text-gray-800">
                    {lead.phone}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Activity Timeline (driven by status changes) */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
            <h3 className="flex items-center gap-2 text-[17px] font-bold text-darkgray mb-8">
              <FiFileText size={20} className="text-gray-500" /> Activity
              Timeline
            </h3>

            {activity.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                  <FiFileText size={20} />
                </div>
                <p className="text-[13px] text-gray-500">
                  No activity yet. Status changes and emails will appear here.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-10 before:absolute before:inset-y-2 before:left-[11px] before:w-[2px] before:bg-border">
                {activity.map((entry, idx) => {
                  const meta = activityMeta(entry);
                  return (
                    <div key={idx} className="relative">
                      <div
                        className={`absolute -left-[35px] top-0 w-8 h-8 rounded-full ${meta.bg} border-4 border-white flex items-center justify-center ${meta.iconColor} z-10 shadow-sm`}
                      >
                        {meta.icon}
                      </div>
                      <div className="flex justify-between items-start mb-1.5">
                        <h4 className="font-bold text-darkgray text-[14px]">
                          {meta.title}
                        </h4>
                        <span className="text-[11px] font-medium text-gray-400 tracking-wide">
                          {formatActivityTime(entry.at)}
                        </span>
                      </div>
                      {meta.body && (
                        <p className="text-[13px] text-gray-500 leading-relaxed pr-8">
                          {meta.body}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 min-w-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
          {/* Profile Card */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div className="w-[100px] h-[100px] rounded-full overflow-hidden border-[5px] border-white shadow-[0_4px_15px_-3px_rgba(0,0,0,0.15)]">
                <img
                  src={avatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-emarold border-[3px] border-white rounded-full"></div>
            </div>
            <h3 className="text-[22px] font-bold text-dark-blue mb-1">
              {lead.clientName}
            </h3>
            <p className="text-[13px] font-medium text-gray-500 mb-8">
              Lead Interior Designer
            </p>

            <button className="w-full py-3 bg-white border-[1.5px] border-border hover:border-dark-blue hover:text-dark-blue text-midgray rounded-[14px] text-[14px] font-bold mb-3 flex items-center justify-center gap-2.5 transition-all shadow-sm">
              <FiPhone size={18} /> Schedule Call
            </button>
            <div className="w-full flex gap-3">
              <button className="flex-1 py-3 bg-palewhite hover:bg-bg-soft text-grey rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-gray-200">
                <FaWhatsapp size={16} /> WhatsApp
              </button>
              <button className="flex-1 py-3 bg-palewhite hover:bg-bg-soft text-grey rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-gray-200">
                <FiMail size={16} /> Email
              </button>
            </div>
          </div>

          {/* Documents Card — auto-populated when a proposal is sent */}
          <DocumentsCard
            documents={documents}
            onOpen={(doc) => setPreviewDoc(doc)}
          />
        </div>
      </div>

      {/* Convert to Client Modal */}
      {showConvertForm && (
        <ConvertToClientForm
          lead={lead}
          onClose={() => setShowConvertForm(false)}
          onConvert={handleConvert}
        />
      )}

      {/* Preliminary site visit — light pre-proposal capture (Architecture) */}
      {showPrelimVisit && (
        <PrelimVisitModal
          initial={lead.prelimVisit}
          onClose={() => setShowPrelimVisit(false)}
          onSave={(visit) => {
            patchLead({ prelimVisit: { ...visit, visitedAt: new Date().toISOString() } });
            setActivity(
              appendActivity(lead.proposalId, {
                type: "note",
                body: "Preliminary site visit recorded.",
              }),
            );
            setShowPrelimVisit(false);
          }}
        />
      )}

      {/* Send / Resend Proposal — Architecture sends a fee proposal; Interiors
          sends the package quote builder. */}
      {showProposalModal && isArchLead && (
        <FeeProposalModal
          recipient={{
            name: lead.clientName,
            email: lead.email,
            phone: lead.phone,
          }}
          lead={lead}
          initial={lead.feeProposal}
          onClose={() => setShowProposalModal(false)}
          onSent={({ total, fee }) => {
            const next =
              isPipelineStep(lead.status) &&
              getStepIndex(lead.status) < getStepIndex("Proposal")
                ? "Proposal"
                : lead.status;
            if (next !== lead.status) {
              transitionStatus(next, { feeProposal: fee });
            } else {
              // Already Proposal/Negotiation — persist the fee without a status hop.
              const saved = localStorage.getItem("newLeadsData");
              const newLeads = saved ? JSON.parse(saved) : [];
              const updated = { ...lead, feeProposal: fee };
              localStorage.setItem(
                "newLeadsData",
                JSON.stringify([
                  updated,
                  ...newLeads.filter((l) => l.proposalId !== lead.proposalId),
                ]),
              );
              setLead(updated);
            }
            setActivity(
              appendActivity(lead.proposalId, {
                type: "email",
                to: lead.email,
                subject: "Design Fee Proposal",
                body: `Design fee proposal sent — total ₹${Math.round(
                  total,
                ).toLocaleString("en-IN")}.`,
                total,
              }),
            );
            window.dispatchEvent(new Event("leadDataChanged"));
            setShowProposalModal(false);
          }}
        />
      )}
      {showProposalModal && !isArchLead && (
        <QuoteModal
          parentId={lead.proposalId}
          parentType="lead"
          mode="proposal"
          recipient={{
            name: lead.clientName,
            email: lead.email,
            phone: lead.phone,
          }}
          defaultPropertyType={lead.propertyType || lead.location}
          initialQuote={
            isPipelineStep(lead.status) &&
            getStepIndex(lead.status) >= getStepIndex("Proposal")
              ? getLatestQuoteForParent(lead.proposalId)
              : null
          }
          presetData={{
            presetKey: lead.quotePreset,
            grade: lead.quoteGrade,
            propertyType: lead.propertyType || lead.location,
            sizeRange: lead.quoteSizeRange,
            scopeItems: lead.quoteScopeItems,
            inclusions: lead.quoteInclusions,
            exclusions: lead.quoteExclusions,
            categoryInclusions: lead.quoteCategoryInclusions,
            categoryExclusions: lead.quoteCategoryExclusions,
            addedInclusions: lead.quoteAddedInclusions,
            addedExclusions: lead.quoteAddedExclusions,
            validityDays: lead.quoteValidityDays,
            notes: lead.quoteNotes,
          }}
          onClose={() => setShowProposalModal(false)}
          onSent={({ to, subject, body, total, quote }) => {
            // First send moves Qualified → Proposal. Subsequent sends keep
            // the current status (Proposal, Negotiation).
            const next =
              isPipelineStep(lead.status) &&
              getStepIndex(lead.status) < getStepIndex("Proposal")
                ? "Proposal"
                : lead.status;
            if (next !== lead.status) {
              transitionStatus(next);
            }
            // Keep the inquiry snapshot aligned with the grade/rates actually
            // sent so subsequent proposal opens use it.
            const quotePatch = {
              quoteGrade: quote?.grade || "premium",
              quoteScopeItems: quote?.scopeItems || lead.quoteScopeItems,
            };
            const savedLeads = JSON.parse(
              localStorage.getItem("newLeadsData") || "[]",
            );
            const current = savedLeads.find(
              (item) => item.proposalId === lead.proposalId,
            );
            const syncedLead = {
              ...lead,
              ...current,
              status: next,
              ...quotePatch,
            };
            localStorage.setItem(
              "newLeadsData",
              JSON.stringify([
                syncedLead,
                ...savedLeads.filter(
                  (item) => item.proposalId !== lead.proposalId,
                ),
              ]),
            );
            setLead(syncedLead);
            // Single email-style activity entry — keeps the existing
            // "lead has emailed proposal" check working for the Projects
            // list, while linking to the saved quote.
            setActivity(
              appendActivity(lead.proposalId, {
                type: "email",
                to,
                subject,
                body,
                quoteId: quote?.quoteId,
                total,
              }),
            );
            saveQuoteDocument(lead.proposalId, quote);
            window.dispatchEvent(new Event("leadDataChanged"));
          }}
        />
      )}

      {/* View-only preview — opened from the Quote header button or any
          row in the Documents card. Read-only with a Download action only. */}
      {previewDoc && (
        <QuotePreviewModal
          quote={previewDoc.snapshot}
          fileName={previewDoc.fileName}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Edit Form Modal */}
      {isEditFormOpen && (
        <EditInquiryform
          initialData={lead}
          onClose={() => setIsEditFormOpen(false)}
          onAddLead={handleEditSave}
        />
      )}

      {/* Log Call / Add Note Modal */}
      {showLogModal && (
        <LogActivityModal
          defaultTab={logTab}
          onClose={() => setShowLogModal(false)}
          onSubmit={(entry) => {
            setActivity(appendActivity(lead.proposalId, entry));
            window.dispatchEvent(new Event("leadDataChanged"));
            setShowLogModal(false);
          }}
        />
      )}

      {/* Negotiation Modal */}
      {showNegotiationModal && (
        <NegotiationModal
          onClose={() => setShowNegotiationModal(false)}
          initialNote={lead.negotiationNote}
          initialExpectedClose={lead.expectedClose}
          onConfirm={({ note, expectedClose }) => {
            const stored = JSON.parse(
              localStorage.getItem("newLeadsData") || "[]",
            );
            const updated = {
              ...lead,
              status: "Negotiation",
              negotiationNote: note,
              expectedClose,
            };
            const filtered = stored.filter(
              (l) => l.proposalId !== lead.proposalId,
            );
            localStorage.setItem(
              "newLeadsData",
              JSON.stringify([updated, ...filtered]),
            );
            setLead(updated);
            setActivity(
              appendActivity(lead.proposalId, {
                type: "negotiation",
                from: lead.status,
                note,
                expectedClose,
              }),
            );
            window.dispatchEvent(new Event("leadDataChanged"));
            setShowNegotiationModal(false);
          }}
        />
      )}

      {/* Mark as Lost Modal */}
      {showLostModal && (
        <LostReasonModal
          onClose={() => setShowLostModal(false)}
          onConfirm={(reason, note) => {
            transitionStatus("Lost", { lostReason: reason, lostNote: note });
            setShowLostModal(false);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-[16px] font-manrope shadow-2xl w-full max-w-[400px] mx-auto p-6 text-center relative">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close dialog"
            >
              <FiX size={16} />
            </button>
            <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
              <FiTrash2 size={24} />
            </div>
            <h2 className="text-[19px] font-bold text-darkgray mb-2">
              Delete Inquiry
            </h2>
            <p className="text-text-muted text-[14px] mb-6">
              Are you sure you want to delete this inquiry? This action cannot
              be undone.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2.5 rounded-[8px] bg-white border border-border text-text-muted text-[13px] font-bold hover:bg-gray-50 transition-all flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-5 py-2.5 rounded-[8px] bg-red-500 text-white text-[13px] font-bold hover:bg-red-600 shadow-sm transition-all flex-1 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadEdit;
