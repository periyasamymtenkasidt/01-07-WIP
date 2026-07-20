import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiActivity,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiFileText,
  FiPhone,
  FiMail,
  FiMapPin,
  FiLayers,
  FiHome,
  FiX,
  FiDownload,
  FiSend,
} from "react-icons/fi";
import PrelimVisitModal from "../../components/PrelimVisitModal";
import FeeProposalModal from "../../components/FeeProposalModal";
import { downloadQuoteAsImage } from "../../utils/downloadQuoteImage";

import { ClientTableData } from "../../data/ClientTableData";
import { TableData } from "../../data/TableData";
import {
  updateClient,
  deleteClient,
} from "../../api/clients";
import { getOrSeedSchedule, saveSchedule } from "../../data/scheduleStorage";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import EditClientForm from "./EditClientForm";
import QuoteModal from "../../components/QuoteModal";
import QuotePreviewModal from "../../components/QuotePreviewModal";
import ClientAvatar from "../../assets/images/Client_avatar.png";
import { getLatestQuoteForParent, getQuotesForParent, getConfigForType, getDocumentsForLead, saveQuoteDocument } from "../../data/QuotePresets";
import { appendActivity, getActivity } from "../../data/LeadStatusConfig";
import { ARCHITECTURE_PIPELINE, getDesignFlow, computeArchFee } from "../../data/designFlowStorage";

const formatAmount = (amount) => {
  if (!amount || amount <= 0) return "—";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
};

const formatDocSize = (snapshot) => {
  const items = snapshot?.scopeItems?.length || 0;
  return `PDF • ${(120 + items * 18).toLocaleString()} KB`;
};

const formatDocDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const InfoCard = ({ icon, label, value }) => (
  <div className="bg-white rounded-[20px] p-5 border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.03)] flex items-center gap-4">
    <div className="w-10 h-10 bg-palewhite rounded-xl text-gray-500 flex items-center justify-center border border-gray-100">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-[14px] font-bold text-gray-800 truncate">
        {value || "—"}
      </p>
    </div>
  </div>
);

const SummaryRow = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 border-b border-bg-soft last:border-0">
    <span className="text-[12px] text-text-muted">{label}</span>
    <span className="text-[12px] font-semibold text-darkgray">{children}</span>
  </div>
);

const StepperRow = ({ steps, currentIdx }) => (
  <div className="relative">
    <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gray-200 -translate-y-1/2 rounded-full"></div>
    <div
      className="absolute top-1/2 left-0 h-[3px] bg-select-blue -translate-y-1/2 rounded-full transition-all duration-500"
      style={{
        width:
          currentIdx >= 0
            ? `${(currentIdx / (steps.length - 1)) * 100}%`
            : "0%",
      }}
    ></div>
    <div className="relative flex justify-between">
      {steps.map((step, idx) => {
        const isCompleted = currentIdx >= 0 && idx <= currentIdx;
        return (
          <div key={step} className="relative flex flex-col items-center">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center z-10 border-[3px] border-white ring-2 ring-white shadow-sm transition-colors ${
                isCompleted
                  ? "bg-select-blue text-white"
                  : "bg-gray-200 text-transparent"
              }`}
            >
              {isCompleted && <FiCheck size={12} strokeWidth={4} />}
            </div>
            <span
              className={`absolute top-8 text-[11px] font-bold whitespace-nowrap ${isCompleted ? "text-select-blue" : "text-gray-400"}`}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

const ClientProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(() => {
    const saved = localStorage.getItem("newClientsData");
    let newClients = [];
    if (saved) {
      try {
        newClients = JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse new clients data", e);
      }
    }

    const deleted = localStorage.getItem("deletedClients");
    const deletedClients = deleted ? JSON.parse(deleted) : [];
    if (deletedClients.includes(id)) {
      return null;
    }

    const foundNew = newClients.find((c) => c.clientID === id);
    if (foundNew) {
      return foundNew;
    }

    return ClientTableData.find((c) => c.clientID === id) || null;
  });

  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [previewQuote, setPreviewQuote] = useState(null);
  const [showPrelimVisit, setShowPrelimVisit] = useState(false);
  const [showFeeProposalModal, setShowFeeProposalModal] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [proposalConfirmed, setProposalConfirmed] = useState(() => !!client.proposalConfirmed);

  const [milestones, setMilestones] = useState(() => {
    try {
      const saved = localStorage.getItem(`clientMilestones_${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [associatedLead, setAssociatedLead] = useState(null);
  const parentId = client?.sourceLeadId || client?.clientID;
  const [quotes, setQuotes] = useState(() => getQuotesForParent(parentId));
  const [documents, setDocuments] = useState(() => getDocumentsForLead(parentId));
  const [downloadingId, setDownloadingId] = useState(null);

  const [activityLog, setActivityLog] = useState(() => getActivity(parentId));
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ type: "note", title: "", body: "" });

  useEffect(() => {
    const refresh = () => setActivityLog(getActivity(parentId));
    window.addEventListener("activityChanged", refresh);
    window.addEventListener("leadDataChanged", refresh);
    return () => {
      window.removeEventListener("activityChanged", refresh);
      window.removeEventListener("leadDataChanged", refresh);
    };
  }, [parentId]);

  const handleAddActivity = () => {
    if (!logForm.title.trim()) return;
    appendActivity(parentId, {
      type: logForm.type,
      title: logForm.title.trim(),
      body: logForm.body.trim(),
      subject: logForm.type === "email" ? logForm.title.trim() : undefined,
    });
    setActivityLog(getActivity(parentId));
    setLogForm({ type: "note", title: "", body: "" });
    setShowLogModal(false);
  };

  const [revisionSettings, setRevisionSettings] = useState(() => {
    const saved = localStorage.getItem(`client_portal_settings_${id}`);
    if (saved) return JSON.parse(saved);
    const globalSaved = localStorage.getItem("client_portal_settings");
    if (globalSaved) return JSON.parse(globalSaved);
    return {
      freeRevisionLimit: 3,
      additionalRevisionCost: 5000,
      gstPercentage: 18,
      turnaroundDuration: 5,
    };
  });

  const handleQuoteSent = ({ quote }) => {
    const saved = saveQuoteDocument(parentId, quote);
    setDocuments(saved);
    setQuotes(getQuotesForParent(parentId));
    appendActivity(parentId, {
      type: "email",
      subject: "Proposal Sent",
      title: `Proposal Sent — ${quote.quoteId}`,
      body: `Proposal sent to ${quote.recipientName || client.clientName}. Grand total: ${formatAmount(quote.grandTotal || quote.subtotal)}.`,
    });

    if (!client.sourceLeadId) {
      const milestonesKey = `clientMilestones_${client.clientID}`;
      if (!localStorage.getItem(milestonesKey)) {
        const subtotal = quote.subtotal || 0;

        // Seed milestones — identical formula to lead conversion
        const seeded = PAYMENT_MILESTONES.map((m) => {
          const base = Math.round((subtotal * m.pct) / 100);
          const gstAmt = Math.round((base * m.gst) / 100);
          return { ...m, base, gstAmt, total: base + gstAmt, status: "pending", dueDate: "", paidDate: "" };
        });
        localStorage.setItem(milestonesKey, JSON.stringify(seeded));
        setMilestones(seeded);

        // Seed project schedule keyed to clientID
        const syntheticLead = {
          proposalId: client.clientID,
          quotePreset: quote.presetKey || client.quotePreset || "2BHK",
          propertyType: quote.propertyType || client.propertyType || "",
          quoteSizeRange: quote.sizeRange || "",
          clientName: client.clientName,
        };
        saveSchedule(client.clientID, getOrSeedSchedule(syntheticLead));

        // Update projectValue on client record
        const raw = localStorage.getItem("newClientsData");
        let allClients = raw ? JSON.parse(raw) : [];
        const idx = allClients.findIndex((c) => c.clientID === client.clientID);
        if (idx >= 0) {
          allClients[idx] = { ...allClients[idx], projectValue: subtotal };
        } else {
          allClients.push({ ...client, projectValue: subtotal });
        }
        localStorage.setItem("newClientsData", JSON.stringify(allClients));
        setClient((prev) => ({ ...prev, projectValue: subtotal }));

        window.dispatchEvent(new Event("leadDataChanged"));
      }
    }
  };

  // Persist a partial patch to the client record in localStorage and local state.
  const persistClientPatch = (patch) => {
    const raw = localStorage.getItem("newClientsData");
    let all = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex((c) => c.clientID === client.clientID);
    const updated = idx >= 0
      ? { ...all[idx], ...patch }
      : { ...client, ...patch };
    if (idx >= 0) all[idx] = updated; else all.push(updated);
    localStorage.setItem("newClientsData", JSON.stringify(all));
    setClient(updated);
    window.dispatchEvent(new Event("leadDataChanged"));
  };

  const handleSavePrelimVisit = (visit) => {
    persistClientPatch({ prelimVisit: { ...visit, visitedAt: new Date().toISOString() } });
    appendActivity(parentId, { type: "note", title: "Site Visit Recorded", body: "Preliminary site visit recorded." });
    setShowPrelimVisit(false);
  };

  const handleFeeProposalSent = ({ fee }) => {
    persistClientPatch({ feeProposal: fee });
    appendActivity(parentId, { type: "email", subject: "Fee Proposal", title: "Design Fee Proposal Sent", body: "Design fee proposal sent to client." });
    setShowFeeProposalModal(false);
  };

  const handleConfirmProposal = () => {
    // 1. Mark client as proposal-confirmed
    const raw = localStorage.getItem("newClientsData");
    let allClients = raw ? JSON.parse(raw) : [];
    const idx = allClients.findIndex((c) => c.clientID === client.clientID);
    if (idx >= 0) {
      allClients[idx] = { ...allClients[idx], proposalConfirmed: true };
    } else {
      allClients.push({ ...client, proposalConfirmed: true });
    }
    localStorage.setItem("newClientsData", JSON.stringify(allClients));
    setProposalConfirmed(true);
    setClient((prev) => ({ ...prev, proposalConfirmed: true }));
    setShowConfirmModal(false);

    // 2. Create a synthetic "Won" lead so this client surfaces in the Projects
    //    module. getAllProjects() reads newLeadsData; direct clients (no sourceLeadId)
    //    have no lead record yet, so we inject one keyed on clientID.
    const rawLeads = localStorage.getItem("newLeadsData");
    let allLeads = rawLeads ? JSON.parse(rawLeads) : [];
    const existingLeadIdx = allLeads.findIndex((l) => l.proposalId === client.clientID);
    const syntheticLead = {
      proposalId: client.clientID,
      clientName: client.clientName,
      phone: client.clientPhone || "",
      email: client.clientEmail || "",
      status: "Won",
      convertedClientID: client.clientID,
      serviceTrack: client.serviceTrack || "Interiors",
      inquirySource: client.inquirySource || "",
      referralPersonName: client.referralPersonName || "",
      referralPersonEmail: client.referralPersonEmail || "",
      clientType: client.clientType || "",
      whatsappNumber: client.whatsappNumber || "",
      quotePreset: isArch ? "" : (client.quotePreset || "2BHK"),
      propertyType: isArch ? (client.buildingUse || "") : (client.propertyType || "Apartment"),
      location: client.locationSecondary || client.location || "",
      locationSecondary: client.locationSecondary || "",
      investment: isArch
        ? (client.budget || client.investmentRange || "—")
        : (client.projectValue ? formatAmount(client.projectValue) : (client.investmentRange || client.budget || "—")),
      possessionDate: isArch ? "" : (client.possessionDate || ""),
      projectIntent: client.projectIntent || "",
      scope: isArch
        ? [client.projectIntent, client.requirementType].filter(Boolean).join(" — ")
        : (client.projectIntent || ""),
      requirementType: client.requirementType || "",
      buildingUse: client.buildingUse || "",
      plotArea: client.plotArea || "",
      architecturalNotes: client.architecturalNotes || "",
      isDirect: true,
    };
    if (existingLeadIdx >= 0) {
      allLeads[existingLeadIdx] = { ...allLeads[existingLeadIdx], ...syntheticLead };
    } else {
      allLeads.push(syntheticLead);
    }
    localStorage.setItem("newLeadsData", JSON.stringify(allLeads));

    // 3. Log a proposal-confirmed activity so the project surfaces in the
    //    activity-based pass of getAllProjects (status Won is the fallback anyway).
    appendActivity(parentId, {
      type: "email",
      subject: "Proposal Confirmed",
      title: "Proposal Confirmed",
      to: client.clientEmail || "",
      body: `Proposal confirmed and project initiated for ${client.clientName}.`,
    });

    window.dispatchEvent(new Event("leadDataChanged"));
  };

  useEffect(() => {
    if (!client) return;
    const savedLeads = localStorage.getItem("newLeadsData");
    const leadsList = savedLeads ? JSON.parse(savedLeads) : [];
    const matchFn = (l) =>
      l.proposalId === client.sourceLeadId ||
      l.convertedClientID === client.clientID;
    const foundLead = leadsList.find(matchFn) || TableData.find(matchFn) || null;
    setAssociatedLead(foundLead);

    // Seed schedule in background for consistency
    const seedLead = foundLead || {
      proposalId: client.sourceLeadId || client.clientID,
      quotePreset: client.quotePreset || "2BHK",
      propertyType: client.propertyType || "Apartment",
      quoteSizeRange: "",
      clientName: client.clientName,
    };
    getOrSeedSchedule(seedLead);
  }, [client]);


  // The backend id (Mongo `id`) lives on the cached client record; the in-app
  // clientID (BL-YYYY-###) is only used in the URL. Mutations resolve the
  // backend id from `client.id` and SKIP the API call when it's absent
  // (mock/static seed or an offline-created record) — never throwing.
  const backendId = client?.id || null;

  const isArch = client?.serviceTrack === "Architecture";
  // Site IDs are derived from the client number: BL-2026-007 → ST-2026-007.
  const siteNum = client?.clientID?.split("-").pop() || "";
  const archSiteID = isArch ? `ST-2026-${siteNum}` : null;
  const archFlow = archSiteID ? getDesignFlow(archSiteID) : null;
  const archFee = archFlow ? computeArchFee(archFlow) : null;

  const getArchStageState = (key) =>
    archFlow?.stages?.find((s) => s.key === key)?.reviewState || "LOCKED";
  const archStagesDone = archFlow
    ? archFlow.stages.filter((s) => s.reviewState === "APPROVED").length
    : 0;
  const archStagesActive = archFlow
    ? archFlow.stages.filter((s) => !["APPROVED", "LOCKED"].includes(s.reviewState)).length
    : 0;

  const handleDelete = () => {
    // Best-effort backend delete; keep the local soft-delete regardless.
    if (backendId) {
      try {
        Promise.resolve(deleteClient(backendId)).catch((err) =>
          console.warn("deleteClient failed — removed locally only:", err?.message || err),
        );
      } catch (err) {
        console.warn("deleteClient failed — removed locally only:", err?.message || err);
      }
    }

    const deleted = localStorage.getItem("deletedClients");
    let deletedClients = deleted ? JSON.parse(deleted) : [];
    if (!deletedClients.includes(id)) {
      deletedClients.push(id);
      localStorage.setItem("deletedClients", JSON.stringify(deletedClients));
    }
    setShowDeleteConfirm(false);
    window.dispatchEvent(new Event("leadDataChanged"));
    navigate("/clients");
  };

  const handleEditSave = (updatedData) => {
    // Best-effort backend update; the local write below is the source the UI
    // reads, so it must happen even if the PATCH fails or is skipped.
    if (backendId) {
      try {
        Promise.resolve(updateClient(backendId, updatedData)).catch((err) =>
          console.warn("updateClient failed — saved locally only:", err?.message || err),
        );
      } catch (err) {
        console.warn("updateClient failed — saved locally only:", err?.message || err);
      }
    }

    const saved = localStorage.getItem("newClientsData");
    let newClients = saved ? JSON.parse(saved) : [];

    const existingIndex = newClients.findIndex((c) => c.clientID === id);
    if (existingIndex >= 0) {
      newClients[existingIndex] = {
        ...newClients[existingIndex],
        ...updatedData,
      };
      localStorage.setItem("newClientsData", JSON.stringify(newClients));
      setClient({ ...newClients[existingIndex] });
    } else {
      const updatedClient = { ...client, ...updatedData };
      newClients.push(updatedClient);
      localStorage.setItem("newClientsData", JSON.stringify(newClients));
      setClient(updatedClient);
    }
    window.dispatchEvent(new Event("leadDataChanged"));
  };


  if (!client) {
    return (
      <div className="flex justify-center items-center h-full bg-overallbg text-text-muted text-sm font-medium">
        Loading...
      </div>
    );
  }

  const getBadgeClass = (status) => {
    const s = status?.toLowerCase();
    if (s === "pending") return "bg-[#FFF4E5] text-pending border-[#FFEDD5]";
    if (s === "completed")
      return "bg-[#E6F4EA] text-[#16A34A] border-[#DCFCE7]";
    if (s === "failed" || s === "cancelled")
      return "bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  const isConverted = !!client.sourceLeadId;
  const paidCount = milestones?.filter((m) => m.status === "paid").length ?? 0;
  const grandTotal =
    milestones?.reduce((s, m) => s + (m.total ?? m.base ?? 0), 0) ?? 0;
  const collected =
    milestones
      ?.filter((m) => m.status === "paid")
      .reduce((s, m) => s + (m.total ?? m.base ?? 0), 0) ?? 0;
  const remaining = grandTotal - collected;
  const collectionPct =
    grandTotal > 0 ? Math.round((collected / grandTotal) * 100) : 0;

  // Canonical projects delivery steps (matching LeadStatusConfig.js)
  const steps = ["ADVANCE", "STAGEWISE A", "STAGEWISE B", "REMAINING"];
  const highestPaidId = milestones
    ? milestones
        .filter((m) => m.status === "paid")
        .reduce((max, m) => (m.id > max ? m.id : max), 0)
    : 0;
  const stepperIdx =
    client.paymentStatus === "completed"
      ? 3
      : highestPaidId > 0
        ? highestPaidId - 1
        : -1;

  // Derive live payment status from milestones (never read the stored field for display).
  const derivedPaymentStatus = (() => {
    if (!milestones || milestones.length === 0) return "unpaid";
    const paid = milestones.filter((m) => m.status === "paid").length;
    if (paid === milestones.length) return "completed";
    if (paid > 0) return "pending";
    return "unpaid";
  })();

  const paymentBadgeClass = {
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    pending:   "bg-yellow-100 text-yellow-700 border-yellow-200",
    unpaid:    "bg-orange-100 text-orange-600 border-orange-200",
  }[derivedPaymentStatus] || "bg-gray-100 text-gray-500 border-gray-200";

  // Map raw activity entries to display shape
  const typeConfig = {
    call:      { icon: <FiPhone size={12} />,    bg: "bg-green-50",   iconColor: "text-green-600",   label: "Call" },
    email:     { icon: <FiMail size={12} />,     bg: "bg-blue-50",    iconColor: "text-blue-600",    label: "Email" },
    note:      { icon: <FiEdit2 size={12} />,    bg: "bg-gray-100",   iconColor: "text-gray-600",    label: "Note" },
    milestone: { icon: <FiCheck size={12} />,    bg: "bg-emerald-50", iconColor: "text-emerald-600", label: "Milestone" },
    quote:     { icon: <FiFileText size={12} />, bg: "bg-blue-50",    iconColor: "text-blue-600",    label: "Quote" },
  };

  // Tab-aware types — anything not in this set is bucketed under "note"
  // so status/negotiation entries don't vanish when a user clicks a specific tab.
  const TAB_TYPES = new Set(["call", "email", "note", "milestone", "quote"]);

  const activityLogs = activityLog.map((entry) => {
    const tabType = TAB_TYPES.has(entry.type) ? entry.type : "note";
    const cfg = typeConfig[tabType] || typeConfig.note;
    const title =
      entry.title ||
      (tabType === "email" ? `Email — ${entry.subject || "No subject"}` :
       tabType === "call"  ? "Call logged" :
       tabType === "milestone" ? `Milestone: ${entry.name || "Payment"}` :
       tabType === "quote" ? "Proposal sent" : "Note");
    return { ...entry, ...cfg, type: tabType, title, body: entry.body || entry.message || "" };
  });

  const filteredLogs =
    activeTab === "all"
      ? activityLogs
      : activityLogs.filter((l) => l.type === activeTab);

  return (
    <div className="bg-overallbg p-6 font-sans h-full flex flex-col overflow-y-auto lg:overflow-hidden scroll-hidden-bar">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/clients")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-bordergray hover:bg-bg-soft hover:border-select-blue/30 text-gray-500 hover:text-select-blue transition-all shadow-sm cursor-pointer"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[26px] font-bold text-darkgray leading-tight">
                {client.clientName}
              </h1>
              <span
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${paymentBadgeClass}`}
              >
                {derivedPaymentStatus}
              </span>
            </div>
            <p className="text-[13px] text-gray-500 mt-1">
              Client ID: #{client.clientID}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEditFormOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-bordergray cursor-pointer rounded-xl text-sm font-semibold text-darkgray hover:bg-bg-soft shadow-sm transition-all"
          >
            <FiEdit2 size={15} /> Edit Client
          </button>
          {/* Architecture-specific pre-project CTA sequence */}
          {isArch && !isConverted && !proposalConfirmed && (
            <>
              <button
                onClick={() => setShowPrelimVisit(true)}
                className={`flex items-center gap-2 px-5 py-2.5 cursor-pointer rounded-xl text-sm font-semibold shadow-sm transition-all ${
                  client.prelimVisit?.done
                    ? "bg-white border border-bordergray text-darkgray hover:bg-bg-soft"
                    : "bg-dark-blue text-white hover:bg-blue-950"
                }`}
              >
                <FiMapPin size={15} />
                {client.prelimVisit?.done ? "Site Visit ✓" : "Site Visit"}
              </button>
              {client.prelimVisit?.done && (
                <button
                  onClick={() => setShowFeeProposalModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-dark-blue text-white cursor-pointer rounded-xl text-sm font-semibold hover:bg-blue-950 shadow-sm transition-all"
                >
                  <FiSend size={15} />
                  {client.feeProposal ? "Resend Fee Proposal" : "Send Fee Proposal"}
                </button>
              )}
              {client.feeProposal && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 cursor-pointer rounded-xl text-sm font-semibold text-white shadow-sm transition-all"
                >
                  <FiCheck size={15} /> Confirm Project
                </button>
              )}
            </>
          )}

          {!isArch && !isConverted && !proposalConfirmed && (
            <>
              <button
                onClick={() => setShowQuoteModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-select-blue hover:bg-primary cursor-pointer rounded-xl text-sm font-semibold text-white shadow-sm transition-all"
              >
                <FiFileText size={15} />
                {quotes.length > 0 ? "Resend Proposal" : "Send Proposal"}
              </button>
              {documents.length > 0 && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 cursor-pointer rounded-xl text-sm font-semibold text-white shadow-sm transition-all"
                >
                  <FiCheck size={15} /> Confirm Proposal
                </button>
              )}
            </>
          )}
          <Link
            to={`/client/dashboard/${client.clientID}`}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            View Client Portal
          </Link>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-200 cursor-pointer rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 shadow-sm transition-all"
          >
            <FiTrash2 size={15} /> Delete Client
          </button>
        </div>
      </div>

      {/* Two-Column Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full lg:items-stretch lg:overflow-hidden min-h-0">
        {/* Left Main Content Area (70%) */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6 min-w-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
          {/* Card 1: Identity */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${paymentBadgeClass}`}
                  >
                    {derivedPaymentStatus}
                  </span>
                  <span className="text-[13px] text-gray-500 font-medium tracking-wide">
                    Client ID: #{client.clientID}
                  </span>
                </div>
                <h2 className="text-[28px] font-bold text-select-blue mb-3 tracking-tight">
                  {client.clientName}
                </h2>
                <div className="text-[15px] text-gray-500 flex items-center gap-2">
                  <FiMapPin size={18} className="shrink-0 text-gray-500" />
                  <span className="text-gray-900 font-semibold leading-normal">
                    {client.locationSecondary || "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Property / Project Information */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 shrink-0 text-left">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray border-b border-gray-100 pb-3">
              <FiHome className="text-gray-500" />
              {isArch ? "Architecture Project" : "Property Information"}
            </h3>
            {isArch ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Project Intent</p>
                  <p className="text-sm font-bold text-gray-800">{client.projectIntent || "—"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Requirement Type</p>
                  <p className="text-sm font-bold text-gray-800">{client.requirementType || "—"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Building Use</p>
                  <p className="text-sm font-bold text-gray-800">{client.buildingUse || "—"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Plot Area</p>
                  <p className="text-sm font-bold text-gray-800">{client.plotArea || "—"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Construction Budget</p>
                  <p className="text-sm font-bold text-gray-800">{client.budget || client.investmentRange || "—"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Location</p>
                  <p className="text-sm font-bold text-gray-800">{client.locationSecondary || "—"}</p>
                </div>
                {client.architecturalNotes && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50 sm:col-span-2">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Project Notes</p>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{client.architecturalNotes}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Property Preset / Project Preset
                  </p>
                  <p className="text-sm font-bold text-gray-800 uppercase">
                    {(client.quotePreset || associatedLead?.quotePreset || "2BHK").replace(/^(\d+)(BHK)$/i, "$1 BHK")}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Property Type / Site Type
                  </p>
                  <p className="text-sm font-bold text-gray-800 uppercase">
                    {client.propertyType || associatedLead?.propertyType || client.location || "Apartment"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Investment Range / Budget
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    {client.investmentRange || client.budget || associatedLead?.investmentRange || "—"}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">
                    Possession Date
                  </p>
                  <p className="text-sm font-bold text-gray-800">
                    {client.possessionDate || associatedLead?.possessionDate || "—"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Activity Summary (Interiors) / Design Pipeline (Architecture) */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 shrink-0 text-left">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray border-b border-gray-100 pb-3">
              <FiActivity className="text-gray-500" />
              {isArch ? "Design Pipeline" : "Activity Summary"}
            </h3>

            {isArch ? (
              <>
                {/* Arch: top-line counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Stages</p>
                    <div className="text-[18px] font-extrabold text-slate-800">{ARCHITECTURE_PIPELINE.length}</div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Completed</p>
                    <div className="text-[18px] font-extrabold text-emerald-700">{archStagesDone}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">In Progress</p>
                    <div className="text-[18px] font-extrabold text-blue-700">{archStagesActive}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Locked</p>
                    <div className="text-[18px] font-extrabold text-slate-500">
                      {ARCHITECTURE_PIPELINE.length - archStagesDone - archStagesActive}
                    </div>
                  </div>
                </div>

                {/* Arch: per-stage pipeline list */}
                <div className="mt-5 space-y-2">
                  {ARCHITECTURE_PIPELINE.map((pd, idx) => {
                    const state = getArchStageState(pd.key);
                    const stageData = archFlow?.stages?.find((s) => s.key === pd.key);
                    const stateConfig = {
                      APPROVED: { pill: "bg-emerald-100 text-emerald-700", row: "bg-emerald-50 border-emerald-100", label: "Approved" },
                      AWAITING_CLIENT: { pill: "bg-orange-100 text-orange-700", row: "bg-orange-50 border-orange-100", label: "Awaiting Approval" },
                      REVISION_REQUESTED: { pill: "bg-amber-100 text-amber-700", row: "bg-amber-50 border-amber-100", label: "Revision Requested" },
                      INTERNAL_REVIEW: { pill: "bg-indigo-100 text-indigo-700", row: "bg-indigo-50 border-indigo-100", label: "Internal Review" },
                      DRAFTING: { pill: "bg-blue-100 text-blue-700", row: "bg-blue-50 border-blue-100", label: "In Progress" },
                      LOCKED: { pill: "bg-gray-100 text-gray-500", row: "bg-bg-soft border-border", label: "Not Started" },
                    };
                    const cfg = stateConfig[state] || stateConfig.LOCKED;
                    return (
                      <div key={pd.key} className={`flex items-center justify-between p-3 rounded-xl border ${cfg.row}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-darkgray truncate">{pd.label}</p>
                            {stageData?.approvedAt && (
                              <p className="text-[10px] text-gray-400">Approved {stageData.approvedAt}</p>
                            )}
                          </div>
                        </div>
                        <span className={`ml-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${cfg.pill}`}>
                          {cfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {!archFlow && (
                  <p className="text-[11px] text-text-subtle mt-3 text-center">
                    Design starts once a site is assigned and feasibility is cleared.
                  </p>
                )}
              </>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Stages</p>
                  <div className="text-[18px] font-extrabold text-slate-800">{steps.length}</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Stages Completed</p>
                  <div className="text-[18px] font-extrabold text-emerald-700">{paidCount}</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Stages Pending</p>
                  <div className="text-[18px] font-extrabold text-amber-700">{steps.length - paidCount}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100/50">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Project Value</p>
                  <div className="text-[18px] font-extrabold text-select-blue font-sans">
                    {formatAmount(grandTotal || (client.projectValue ? client.projectValue * 1.18 : 0))}
                  </div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Amount Paid</p>
                  <div className="text-[18px] font-extrabold text-emerald-700 font-sans">{formatAmount(collected)}</div>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Balance Amount</p>
                  <div className="text-[18px] font-extrabold text-rose-700 font-sans">
                    {formatAmount(remaining || (client.projectValue ? client.projectValue * 1.18 : 0))}
                  </div>
                </div>
              </div>
            )}
          </div>


          {/* Card 3: Activity Timeline Feed */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] overflow-hidden shrink-0">
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray">
                    <FiFileText size={18} className="text-gray-500" />{" "}
                    Communication Log
                  </h3>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    Showing{" "}
                    {activeTab === "all"
                      ? "full activity feed"
                      : `${activeTab} history`}
                    .
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-text-subtle">
                    {filteredLogs.length} total{" "}
                    {filteredLogs.length === 1 ? "entry" : "entries"}
                  </span>
                  <button
                    onClick={() => setShowLogModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-select-blue hover:bg-primary text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <FiEdit2 size={11} />
                    Log Activity
                  </button>
                </div>
              </div>

              {/* Tab Pills */}
              <div className="flex flex-wrap gap-2 -mx-1 px-1 pb-1">
                {["all", "call", "email", "note", "milestone"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all cursor-pointer ${
                      activeTab === type
                        ? "bg-select-blue text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type === "all" ? "All Activity" : typeConfig[type]?.label + "s"}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Entries List */}
            <div className="border-t border-bg-soft mt-2 p-8">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs italic">
                  No activity found for the selected tab.
                </div>
              ) : (
                <div className="relative pl-6 space-y-10 before:absolute before:inset-y-2 before:left-[11px] before:w-[2px] before:bg-bordergray">
                  {filteredLogs.map((log, idx) => (
                    <div key={idx} className="relative">
                      {/* Left icon wrapper */}
                      <div
                        className={`absolute -left-[35px] top-0 w-8 h-8 rounded-full ${log.bg} border-[4px] border-white flex items-center justify-center ${log.iconColor} z-10 shadow-sm`}
                      >
                        {log.icon}
                      </div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-darkgray text-[14px]">
                          {log.title}
                        </h4>
                        <span className="text-[11px] font-medium text-gray-400">
                          {new Date(log.at).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-500 leading-relaxed pr-8 whitespace-pre-wrap font-sans">
                        {log.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar Column (30%) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 min-w-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
          {/* Sidebar 1: Profile Summary Card (merged with Communications) */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] flex flex-col items-center text-center">
            <div className="relative mb-5">
              <div className="w-[100px] h-[100px] rounded-full overflow-hidden border-[5px] border-white shadow-[0_4px_15px_-3px_rgba(0,0,0,0.15)]">
                <img
                  src={ClientAvatar}
                  alt={client.clientName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-2 right-2 w-4 h-4 bg-emarold border-[3px] border-white rounded-full"></div>
            </div>
            <h3 className="text-[22px] font-bold text-select-blue mb-1">
              {client.clientName}
            </h3>
            <p className="text-[13px] font-medium text-gray-500 mb-2 truncate w-full">
              {client.clientEmail || "—"}
            </p>
            <p className="text-[12px] text-gray-500 flex items-center gap-1.5 mb-8">
              <FiPhone size={12} /> +91 {client.clientPhone || "—"}
            </p>

            <button className="w-full py-3 bg-white border-[1.5px] border-bordergray hover:border-select-blue hover:text-select-blue text-gray-500 rounded-[14px] text-[14px] font-bold mb-3 flex items-center justify-center gap-2.5 transition-all shadow-sm cursor-pointer">
              <FiPhone size={18} /> Schedule Call
            </button>
            <a
              href={`mailto:${client.clientEmail}`}
              className="w-full py-3 bg-palewhite hover:bg-bg-soft text-gray-600 rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-gray-200"
            >
              <FiMail size={16} /> Email
            </a>
          </div>

          {/* Sidebar 2: Documents */}
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
                <div className="w-10 h-10 mx-auto bg-active-bg text-select-blue rounded-[10px] flex items-center justify-center mb-2">
                  <FiFileText size={18} />
                </div>
                <p className="text-[12px] font-semibold text-text">No documents yet</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Sent proposals appear here automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {documents.map((doc) => (
                  <div
                    key={doc.docId}
                    className="flex items-center justify-between p-3.5 border border-bg-soft rounded-[14px] hover:border-select-blue/40 hover:bg-palewhite transition-all group"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewQuote(doc.snapshot)}
                      className="flex items-center gap-3.5 min-w-0 text-left flex-1 cursor-pointer"
                      title="Preview quote"
                    >
                      <div className="w-10 h-10 bg-active-bg text-select-blue rounded-[10px] flex items-center justify-center shrink-0">
                        <FiFileText size={18} />
                      </div>
                      <div className="truncate pr-2">
                        <p className="text-[13px] font-bold text-darkgray truncate leading-tight mb-1">
                          {doc.fileName}
                        </p>
                        <p className="text-[11px] font-medium text-gray-400">
                          {formatDocSize(doc.snapshot)} · Sent {formatDocDate(doc.sentAt)}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDownloadingId(doc.docId);
                        try {
                          await downloadQuoteAsImage(doc.snapshot, doc.fileName);
                        } finally {
                          setDownloadingId(null);
                        }
                      }}
                      disabled={downloadingId === doc.docId}
                      className="text-gray-400 hover:text-select-blue disabled:opacity-50 transition-colors shrink-0 ml-2 p-1 cursor-pointer"
                      title="Download as image"
                    >
                      <FiDownload size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar 3: Delivery & Payment Progress (Interiors only) */}
          {!isArch && milestones && (
            <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-left">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="text-[15px] font-bold text-darkgray">
                  Collection Progress
                </h3>
                <span className="text-[13px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {collectionPct}% Collected
                </span>
              </div>
              <div className="space-y-2">
                {milestones.map((m) => {
                  const paid = m.status === "paid";
                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border ${
                        paid
                          ? "bg-emerald-50 border-emerald-100"
                          : "bg-bg-soft border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[12px] font-bold text-darkgray uppercase tracking-wide">
                          {m.name}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            paid
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {paid ? "Paid" : "Pending"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px] text-text-muted">
                        <span>
                          {m.pct}% ({formatAmount(m.total || m.base)})
                        </span>
                        {paid && m.paidDate ? (
                          <span>Paid on {m.paidDate}</span>
                        ) : (
                          <span className="font-semibold text-gray-500">
                            {formatAmount(m.total || m.base)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sidebar 3 (Architecture): Design Fee Breakdown */}
          {isArch && (
            <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] text-left">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
                <h3 className="text-[15px] font-bold text-darkgray">Design Fee</h3>
                {archFee && (
                  <span className="text-[13px] font-extrabold text-select-blue bg-active-bg px-2 py-0.5 rounded-md border border-select-blue/20">
                    {formatAmount(archFee.total)}
                  </span>
                )}
              </div>

              {archFee ? (
                <>
                  <div className="flex items-center justify-between text-[11px] text-text-muted mb-3 px-1">
                    <span>{archFee.builtUpArea.toLocaleString("en-IN")} sqft</span>
                    <span>@ ₹{archFee.feeRatePerSqft}/sqft</span>
                  </div>
                  <div className="space-y-2">
                    {archFee.stages.map((s) => (
                      <div
                        key={s.key}
                        className={`p-3 rounded-xl border ${
                          s.invoiced
                            ? "bg-emerald-50 border-emerald-100"
                            : "bg-bg-soft border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <p className="text-[12px] font-bold text-darkgray">{s.label}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              s.invoiced
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {s.invoiced ? "Invoiced" : "Pending"}
                          </span>
                        </div>
                        <p className="text-[11px] text-text-muted">
                          {s.weight}% — {formatAmount(s.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-[12px] text-text-muted">Invoiced so far</span>
                    <span className="text-[13px] font-extrabold text-emerald-700">
                      {formatAmount(archFee.invoicedTotal)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="rounded-[14px] border border-dashed border-border bg-bg-soft px-4 py-8 text-center">
                  <div className="w-10 h-10 mx-auto bg-active-bg text-select-blue rounded-[10px] flex items-center justify-center mb-2">
                    <FiLayers size={18} />
                  </div>
                  <p className="text-[12px] font-semibold text-text">Design not started</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Fee breakdown appears once a site is assigned and design begins.
                  </p>
                  {(client.budget || client.investmentRange) && (
                    <div className="mt-4 p-3 bg-white rounded-xl border border-border">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Construction Budget</p>
                      <p className="text-[14px] font-extrabold text-gray-800">{client.budget || client.investmentRange}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Preliminary Site Visit Modal (Architecture, direct clients only) */}
      {showPrelimVisit && (
        <PrelimVisitModal
          initial={client.prelimVisit}
          onClose={() => setShowPrelimVisit(false)}
          onSave={handleSavePrelimVisit}
        />
      )}

      {/* Design Fee Proposal Modal (Architecture, direct clients only) */}
      {showFeeProposalModal && (
        <FeeProposalModal
          recipient={{
            name: client.clientName,
            email: client.clientEmail,
            phone: client.clientPhone,
          }}
          lead={{
            projectIntent: client.projectIntent,
            scope: client.projectIntent,
            plotArea: client.plotArea,
            prelimVisit: client.prelimVisit,
          }}
          initial={client.feeProposal}
          onClose={() => setShowFeeProposalModal(false)}
          onSent={handleFeeProposalSent}
        />
      )}

      {/* Edit Form Modal */}
      {isEditFormOpen && (
        <EditClientForm
          initialData={client}
          onClose={() => setIsEditFormOpen(false)}
          onSave={handleEditSave}
        />
      )}

      {/* Quote Preview / Save as PDF */}
      {previewQuote && (
        <QuotePreviewModal
          quote={previewQuote}
          fileName={`${previewQuote.quoteId}_${client.clientName?.replace(/\s+/g, "_")}.pdf`}
          onClose={() => setPreviewQuote(null)}
        />
      )}

      {/* Send / Resend Proposal Modal */}
      {showQuoteModal && (
        <QuoteModal
          parentId={parentId}
          parentType={client.sourceLeadId ? "lead" : "client"}
          mode="proposal"
          recipient={{
            name: client.clientName,
            email: client.clientEmail,
            phone: client.clientPhone,
          }}
          initialQuote={getLatestQuoteForParent(parentId)}
          defaultPropertyType={
            client.propertyType || associatedLead?.propertyType || ""
          }
          presetData={(() => {
            const presetKey = client.quotePreset || associatedLead?.quotePreset || "";
            const propertyType = client.propertyType || associatedLead?.propertyType || "";
            const masterSizeRange = presetKey && propertyType
              ? (getConfigForType(presetKey, propertyType)?.sizeRange || "")
              : "";
            return {
              presetKey,
              propertyType,
              sizeRange:
                client.sizeRange || client.quoteSizeRange ||
                associatedLead?.quoteSizeRange || masterSizeRange,
            };
          })()}
          onSent={handleQuoteSent}
          onClose={() => {
            setShowQuoteModal(false);
            setQuotes(getQuotesForParent(parentId));
            setDocuments(getDocumentsForLead(parentId));
          }}
        />
      )}

      {/* Confirm Proposal Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white rounded-[16px] font-sans shadow-2xl w-full max-w-[420px] mx-auto p-6 text-center relative">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
              <FiCheck size={24} />
            </div>
            <h2 className="text-[19px] font-bold text-darkgray mb-2">
              {isArch ? "Confirm Project" : "Confirm Proposal"}
            </h2>
            <p className="text-text-muted text-[14px] mb-6">
              {isArch
                ? "Once confirmed, the fee proposal is locked and the client moves to active Projects. You won't be able to resend."
                : "Once confirmed, this proposal is locked. The client will be added to Projects and Site Visit. You won't be able to resend."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-5 py-2.5 rounded-[8px] bg-white border border-border text-text-muted text-[13px] font-bold hover:bg-bg-soft transition-all flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmProposal}
                className="px-5 py-2.5 rounded-[8px] bg-emerald-600 text-white text-[13px] font-bold hover:bg-emerald-700 shadow-sm transition-all flex-1 cursor-pointer"
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Activity Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white rounded-[16px] font-sans shadow-2xl w-full max-w-[440px] mx-auto p-6 relative">
            <button
              type="button"
              onClick={() => setShowLogModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 hover:bg-gray-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <FiX size={16} />
            </button>
            <h2 className="text-[17px] font-bold text-darkgray mb-1">Log Activity</h2>
            <p className="text-[12px] text-text-muted mb-5">Record a call, note, or email for this client.</p>

            <div className="flex gap-2 mb-4">
              {["call", "email", "note"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLogForm((f) => ({ ...f, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-[12px] font-bold capitalize transition-all cursor-pointer ${
                    logForm.type === t
                      ? "bg-select-blue text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {t === "call" ? <><FiPhone className="inline mr-1" size={12} />Call</> :
                   t === "email" ? <><FiMail className="inline mr-1" size={12} />Email</> :
                   <><FiEdit2 className="inline mr-1" size={12} />Note</>}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                {logForm.type === "call" ? "Call Summary" : logForm.type === "email" ? "Subject" : "Title"}
              </label>
              <input
                type="text"
                value={logForm.title}
                onChange={(e) => setLogForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={
                  logForm.type === "call" ? "e.g. Follow-up call on project timeline" :
                  logForm.type === "email" ? "e.g. Design approval confirmation" :
                  "e.g. Client requested changes to living room"
                }
                className="w-full px-3 py-2 border border-bordergray rounded-lg text-[13px] text-darkgray focus:outline-none focus:border-select-blue"
              />
            </div>
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
                Details (optional)
              </label>
              <textarea
                rows={3}
                value={logForm.body}
                onChange={(e) => setLogForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Add any extra context or follow-up notes…"
                className="w-full px-3 py-2 border border-bordergray rounded-lg text-[13px] text-darkgray focus:outline-none focus:border-select-blue resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="flex-1 px-4 py-2.5 rounded-[8px] bg-white border border-border text-text-muted text-[13px] font-bold hover:bg-bg-soft transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddActivity}
                disabled={!logForm.title.trim()}
                className="flex-1 px-4 py-2.5 rounded-[8px] bg-select-blue text-white text-[13px] font-bold hover:bg-primary shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4 animate-fade-in">
          <div className="bg-white rounded-[16px] font-sans shadow-2xl w-full max-w-[400px] mx-auto p-6 text-center relative">
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
              Delete Client
            </h2>
            <p className="text-text-muted text-[14px] mb-6">
              Are you sure you want to delete this client? This action cannot be
              undone.
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

export default ClientProfile;

