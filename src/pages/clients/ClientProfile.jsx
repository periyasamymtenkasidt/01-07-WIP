import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiActivity,
  FiEdit2,
  FiTrash2,
  FiCheck,
  FiMoreVertical,
  FiFileText,
  FiCalendar,
  FiPhone,
  FiMail,
  FiMapPin,
  FiLayers,
  FiHome,
  FiUserCheck,
  FiClock,
  FiMessageCircle,
  FiX,
  FiAward,
  FiChevronDown,
  FiChevronRight,
  FiPlus,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa6";

import { ClientTableData } from "../../data/ClientTableData";
import {
  updateClient,
  deleteClient,
  updateMilestone,
} from "../../api/clients";
import { getOrSeedSchedule, saveSchedule } from "../../data/scheduleStorage";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import EditClientForm from "./EditClientForm";
import QuoteModal from "../../components/QuoteModal";
import ClientAvatar from "../../assets/images/Client_avatar.png";
import { getLatestQuoteForParent } from "../../data/QuotePresets";

const formatAmount = (amount) => {
  if (!amount || amount <= 0) return "—";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
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
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [milestones, setMilestones] = useState(() => {
    try {
      const saved = localStorage.getItem(`clientMilestones_${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [associatedLead, setAssociatedLead] = useState(null);

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

  useEffect(() => {
    if (!client) return;
    const savedLeads = localStorage.getItem("newLeadsData");
    const leadsList = savedLeads ? JSON.parse(savedLeads) : [];
    const foundLead = leadsList.find(
      (l) =>
        l.proposalId === client.sourceLeadId ||
        l.convertedClientID === client.clientID
    ) || null;
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

  const handleMarkPaid = (milestoneId) => {
    if (!milestones) return;

    const targetIdx = milestones.findIndex((m) => m.id === milestoneId);
    if (targetIdx === -1) return;

    if (targetIdx > 0 && milestones[targetIdx - 1].status !== "paid") {
      return;
    }

    const today = new Date();
    const paidDate = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

    // Resolve the backend milestone id. Seed/local milestones use plain numeric
    // ids (the array index) and have no backend record — SKIP the API call for
    // those. Only milestones carrying a non-numeric (Mongo) id were hydrated
    // from the backend and can be PATCHed.
    const target = milestones[targetIdx];
    const backendMilestoneId =
      typeof target?.id === "string" && !/^\d+$/.test(target.id)
        ? target.id
        : null;
    if (backendMilestoneId) {
      try {
        Promise.resolve(
          updateMilestone(backendMilestoneId, { status: "paid", paidDate }),
        ).catch((err) =>
          console.warn("updateMilestone failed — marked paid locally only:", err?.message || err),
        );
      } catch (err) {
        console.warn("updateMilestone failed — marked paid locally only:", err?.message || err);
      }
    }

    const updated = milestones.map((m) =>
      m.id === milestoneId ? { ...m, status: "paid", paidDate } : m,
    );
    setMilestones(updated);
    localStorage.setItem(`clientMilestones_${id}`, JSON.stringify(updated));

    if (updated.every((m) => m.status === "paid")) {
      const savedClients = localStorage.getItem("newClientsData");
      let newClients = savedClients ? JSON.parse(savedClients) : [];
      const idx = newClients.findIndex((c) => c.clientID === id);
      if (idx >= 0) {
        newClients[idx] = { ...newClients[idx], paymentStatus: "completed" };
      } else {
        newClients.push({ ...client, paymentStatus: "completed" });
      }
      localStorage.setItem("newClientsData", JSON.stringify(newClients));
      setClient((prev) => ({ ...prev, paymentStatus: "completed" }));
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

  // Communication logs feed matching ProjectDetail.jsx 1:1
  const activityLogs = [
    {
      type: "call",
      title: "Outbound call • 12 mins",
      body: "Discussed layout drawings and material collection times. Next inspection scheduled.",
      at: "2026-06-09T14:30:00Z",
      icon: <FiPhone size={12} />,
      bg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      type: "milestone",
      title: "Milestone Paid: Booking Token",
      body: `Collected milestone payment of ${formatAmount(collected || 200000)} inclusive of 18% GST.`,
      at: "2026-06-07T11:00:00Z",
      icon: <FiCheck size={12} />,
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      type: "note",
      title: "Agreement Finalization Notes",
      body: "Signed construction agreement paperwork. Copied key specifications.",
      at: "2026-06-04T10:00:00Z",
      icon: <FiEdit2 size={12} />,
      bg: "bg-gray-100",
      iconColor: "text-gray-600",
    },
    {
      type: "quote",
      title: "Proposal Linked",
      body: "Updated bedroom fittings quote breakdown based on site visit details.",
      at: "2026-06-02T09:00:00Z",
      icon: <FiFileText size={12} />,
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
  ];

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
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getBadgeClass(client.paymentStatus)}`}
              >
                {client.paymentStatus}
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
          {isConverted && (
            <Link
              to={`/leads/${client.sourceLeadId}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-bordergray rounded-xl text-sm font-semibold text-darkgray hover:bg-bg-soft shadow-sm transition-all"
            >
              View Leads
            </Link>
          )}
          <Link
            to={`/client/dashboard/${client.clientID}`}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            View Client Portal
          </Link>
          <Link
            to="/projects"
            className="flex items-center gap-2 px-5 py-2.5 bg-active-bg text-select-blue rounded-xl text-sm font-semibold hover:bg-blue-100 shadow-sm transition-all"
          >
            View Projects
          </Link>

          {/* Overflow Action menu */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-bordergray hover:bg-bg-soft text-gray-500 hover:text-select-blue transition-all shadow-sm cursor-pointer"
            >
              <FiMoreVertical size={18} />
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-bordergray rounded-xl shadow-lg py-1 z-50 animate-fade-in">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-semibold"
                >
                  <FiTrash2 size={14} /> Delete Client
                </button>
              </div>
            )}
          </div>
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
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getBadgeClass(client.paymentStatus)}`}
                  >
                    {client.paymentStatus}
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

          {/* Card 2: Property Information */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 shrink-0 text-left">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray border-b border-gray-100 pb-3">
              <FiHome className="text-gray-500" /> Property Information
            </h3>
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
            </div>
          </div>

          {/* Design Revision Configuration */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 shrink-0 text-left">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray border-b border-gray-100 pb-3 mb-4">
              <FiLayers className="text-gray-500" /> Design Revision Configuration
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Free Revision Limit</label>
                <input
                  type="number"
                  min="0"
                  value={revisionSettings.freeRevisionLimit}
                  onChange={(e) => {
                    const updated = { ...revisionSettings, freeRevisionLimit: parseInt(e.target.value) || 0 };
                    setRevisionSettings(updated);
                    localStorage.setItem(`client_portal_settings_${id}`, JSON.stringify(updated));
                  }}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple"
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Additional Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={revisionSettings.additionalRevisionCost}
                  onChange={(e) => {
                    const updated = { ...revisionSettings, additionalRevisionCost: parseInt(e.target.value) || 0 };
                    setRevisionSettings(updated);
                    localStorage.setItem(`client_portal_settings_${id}`, JSON.stringify(updated));
                  }}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple"
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">GST Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={revisionSettings.gstPercentage}
                  onChange={(e) => {
                    const updated = { ...revisionSettings, gstPercentage: parseInt(e.target.value) || 0 };
                    setRevisionSettings(updated);
                    localStorage.setItem(`client_portal_settings_${id}`, JSON.stringify(updated));
                  }}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple"
                />
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-1">Turnaround (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={revisionSettings.turnaroundDuration}
                  onChange={(e) => {
                    const updated = { ...revisionSettings, turnaroundDuration: parseInt(e.target.value) || 0 };
                    setRevisionSettings(updated);
                    localStorage.setItem(`client_portal_settings_${id}`, JSON.stringify(updated));
                  }}
                  className="w-full text-xs font-bold text-slate-800 bg-white border border-bordergray rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Activity Summary - Plain Textual Metrics */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 shrink-0 text-left">
            <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray border-b border-gray-100 pb-3">
              <FiActivity className="text-gray-500" /> Activity Summary
            </h3>
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
                <span className="text-[11px] text-text-subtle">
                  {filteredLogs.length} total{" "}
                  {filteredLogs.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {/* Tab Pills */}
              <div className="flex flex-wrap gap-2 -mx-1 px-1 pb-1">
                {["all", "call", "note", "milestone"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setActiveTab(type)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all cursor-pointer ${
                      activeTab === type
                        ? "bg-select-blue text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type === "all" ? "All Activity" : type + "s"}
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
            <div className="w-full flex gap-3">
              <a
                href={`https://wa.me/${client.clientPhone?.replace(/\s+/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3 bg-palewhite hover:bg-bg-soft text-gray-600 rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-gray-200"
              >
                <FaWhatsapp size={16} /> WhatsApp
              </a>
              <a
                href={`mailto:${client.clientEmail}`}
                className="flex-1 py-3 bg-palewhite hover:bg-bg-soft text-gray-600 rounded-[14px] text-[13px] font-bold flex items-center justify-center gap-2 transition-colors border border-transparent hover:border-gray-200"
              >
                <FiMail size={16} /> Email
              </a>
            </div>
          </div>

          {/* Sidebar 2: Delivery & Payment Progress */}
          {milestones && (
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
                        <p className="text-[12px] font-bold text-darkgray">
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
                          !paid && (
                            <button
                              onClick={() => handleMarkPaid(m.id)}
                              className="text-select-blue font-bold hover:underline cursor-pointer"
                            >
                              Mark Paid
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form Modal */}
      {isEditFormOpen && (
        <EditClientForm
          initialData={client}
          onClose={() => setIsEditFormOpen(false)}
          onSave={handleEditSave}
          hasMilestones={!!milestones}
        />
      )}

      {/* Quick Quote Modal */}
      {showQuoteModal && (
        <QuoteModal
          parentId={client.sourceLeadId || client.clientID}
          parentType={client.sourceLeadId ? "lead" : "client"}
          recipient={{
            name: client.clientName,
            email: client.clientEmail,
            phone: client.clientPhone,
          }}
          initialQuote={getLatestQuoteForParent(
            client.sourceLeadId || client.clientID,
          )}
          defaultPropertyType={
            client.propertyType || associatedLead?.propertyType || ""
          }
          presetData={{
            presetKey: client.quotePreset || associatedLead?.quotePreset || "",
            propertyType:
              client.propertyType || associatedLead?.propertyType || "",
            sizeRange:
              client.quoteSizeRange || associatedLead?.quoteSizeRange || "",
          }}
          onClose={() => setShowQuoteModal(false)}
        />
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

