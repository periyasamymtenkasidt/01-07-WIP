import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiMapPin,
  FiCalendar,
  FiPhone,
  FiMessageCircle,
  FiFileText,
  FiLayers,
  FiHome,
  FiCheck,
  FiUserCheck,
  FiSend,
  FiPause,
  FiXCircle,
  FiTrendingUp,
  FiAward,
  FiEdit3,
  FiExternalLink,
  FiPaperclip,
  FiDownload,
} from "react-icons/fi";
import { TableData } from "../../data/TableData";
import { ClientTableData } from "../../data/ClientTableData";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import {
  SALES_STEPS,
  DELIVERY_STEPS,
  getBadgeClass,
  getActivity,
  findLeadById,
  getMilestonesForLead,
} from "../../data/LeadStatusConfig";
import ProjectSchedule from "./ProjectSchedule";
import avatar from "../../assets/images/avatar.png";

// Read-only Project view. All edits (status changes, calls, notes, milestone
// payments) happen on the Leads / Clients pages — this page is the canonical
// "what was sent and what happened" record.

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatActivityTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today, ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}, ${time}`;
};

// Visual treatment for non-email entries (emails get their own expanded card).
const activityIcon = (entry) => {
  if (entry.type === "call") {
    return {
      title: `${entry.direction === "inbound" ? "Inbound" : "Outbound"} call${entry.duration ? ` • ${entry.duration} min` : ""}`,
      body: entry.notes,
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
  if (entry.type === "schedule") {
    if (entry.event === "room-done") {
      return {
        title: `Room marked done: ${entry.room || "—"}`,
        body: "",
        icon: <FiCheck size={12} />,
        bg: "bg-emerald-50",
        iconColor: "text-emerald-600",
      };
    }
    if (entry.event === "start-amended") {
      return {
        title: "Start unlocked for amendment",
        body: entry.note ? `Reason: ${entry.note}` : "",
        icon: <FiEdit3 size={12} />,
        bg: "bg-amber-50",
        iconColor: "text-amber-600",
      };
    }
    if (entry.event === "client-notified") {
      return {
        title:
          entry.reason === "execution"
            ? "Client notified — execution delay"
            : "Client notified — client-requested change",
        body: [
          entry.breachDays > 0
            ? `${entry.breachDays} day${entry.breachDays === 1 ? "" : "s"} past possession`
            : "",
          entry.message || "",
        ]
          .filter(Boolean)
          .join(" • "),
        icon: <FiMessageCircle size={12} />,
        bg: "bg-red-50",
        iconColor: "text-red-600",
      };
    }
    // start-confirmed
    const startLabel = entry.startDate
      ? new Date(`${entry.startDate}T00:00:00`).toLocaleDateString([], {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "";
    return {
      title: "Work start confirmed",
      body: [
        startLabel ? `Start: ${startLabel}` : "",
        entry.delayDays > 0
          ? `${entry.delayDays} day${entry.delayDays === 1 ? "" : "s"} after payment`
          : "",
        entry.clientApproved ? "Client approved" : "Client not approved",
        entry.breachDays > 0 ? `${entry.breachDays}d past possession` : "",
        entry.breachDays > 0 && entry.reason
          ? entry.reason === "client"
            ? "Client-requested"
            : "Our delay"
          : "",
        entry.note ? `Reason: ${entry.note}` : "",
      ]
        .filter(Boolean)
        .join(" • "),
      icon: <FiCalendar size={12} />,
      bg: entry.breachDays > 0 ? "bg-red-50" : "bg-blue-50",
      iconColor: entry.breachDays > 0 ? "text-red-600" : "text-blue-600",
    };
  }
  if (entry.type === "quote") {
    return {
      title: `Quote ${entry.quoteId || ""} sent`.trim(),
      body: [entry.subject, entry.to ? `to ${entry.to}` : ""]
        .filter(Boolean)
        .join(" • "),
      icon: <FiFileText size={12} />,
      bg: "bg-blue-50",
      iconColor: "text-blue-600",
    };
  }
  // status
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
  return { title: `Marked as ${entry.to}`, body, ...styling };
};

// ── Phase grouping ──────────────────────────────────────────────────────────
// Each activity entry is assigned to the project phase that was active when
// it was logged. Status-change entries belong to their destination phase
// (the start of that phase).

const PHASES = [
  {
    key: "proposal",
    label: "Proposal",
    description: "Initial proposal sent and follow-ups",
    badge: "bg-blue-100 text-blue-700",
    accent: "bg-blue-500",
    softBg: "bg-blue-50",
    icon: <FiSend size={14} />,
  },
  {
    key: "negotiation",
    label: "Negotiation",
    description: "Blocker discussions, revisions, terms",
    badge: "bg-amber-100 text-amber-700",
    accent: "bg-amber-500",
    softBg: "bg-amber-50",
    icon: <FiTrendingUp size={14} />,
  },
  {
    key: "onhold",
    label: "On Hold",
    description: "Paused — waiting on client",
    badge: "bg-gray-200 text-gray-700",
    accent: "bg-gray-400",
    softBg: "bg-gray-50",
    icon: <FiPause size={14} />,
  },
  {
    key: "won",
    label: "Won",
    description: "Closed-won, awaiting conversion",
    badge: "bg-emerald-100 text-emerald-700",
    accent: "bg-emerald-500",
    softBg: "bg-emerald-50",
    icon: <FiAward size={14} />,
  },
  {
    key: "delivery",
    label: "Delivery",
    description: "Project execution and milestones",
    badge: "bg-teal-100 text-teal-700",
    accent: "bg-teal-500",
    softBg: "bg-teal-50",
    icon: <FiUserCheck size={14} />,
  },
  {
    key: "lost",
    label: "Lost",
    description: "Closed-lost",
    badge: "bg-red-100 text-red-700",
    accent: "bg-red-500",
    softBg: "bg-red-50",
    icon: <FiXCircle size={14} />,
  },
];

const phaseFromStatus = (status) => {
  const s = status?.toLowerCase();
  if (s === "negotiation") return "negotiation";
  if (s === "won") return "won";
  if (s === "converted") return "delivery";
  if (s === "lost") return "lost";
  if (s === "on hold") return "onhold";
  return "proposal";
};

const groupActivityByPhase = (activity) => {
  const oldestFirst = [...activity].reverse();
  let phase = "proposal";
  const out = {
    proposal: [],
    negotiation: [],
    onhold: [],
    won: [],
    delivery: [],
    lost: [],
  };
  oldestFirst.forEach((entry) => {
    if (entry.type === "status") {
      // A "Won" transition that also created a client (clientID set) moves
      // straight into delivery — same semantics as the old "Converted" event.
      phase =
        entry.to === "Won" && entry.clientID
          ? "delivery"
          : phaseFromStatus(entry.to);
    } else if (entry.type === "negotiation") {
      phase = "negotiation";
    } else if (entry.type === "milestone") {
      phase = "delivery";
    }
    out[phase].push(entry);
  });
  Object.keys(out).forEach((k) => out[k].reverse()); // newest first within phase
  return out;
};

// Re-usable entry renderer used inside each phase card.
const TimelineEntry = ({ entry }) => {
  if (entry.type === "email") {
    const count = entry.attachments?.length || 0;
    return (
      <div className="relative">
        <div className="absolute -left-[35px] top-0 w-8 h-8 rounded-full bg-active-bg border-4 border-white flex items-center justify-center text-blue-500 z-10 shadow-sm">
          <FiSend size={12} />
        </div>
        <div className="flex justify-between items-start mb-1.5">
          <h4 className="font-bold text-darkgray text-[14px]">
            Proposal emailed to {entry.to}
          </h4>
          <span className="text-[11px] font-medium text-gray-400 tracking-wide">
            {formatActivityTime(entry.at)}
          </span>
        </div>
        {count > 0 && (
          <p className="text-[11px] text-text-subtle mb-1">
            {count} attachment{count > 1 ? "s" : ""} attached
          </p>
        )}
        <EmailEntry entry={entry} />
      </div>
    );
  }
  const meta = activityIcon(entry);
  return (
    <div className="relative">
      <div
        className={`absolute -left-[35px] top-0 w-8 h-8 rounded-full ${meta.bg} border-4 border-white flex items-center justify-center ${meta.iconColor} z-10 shadow-sm`}
      >
        {meta.icon}
      </div>
      <div className="flex justify-between items-start mb-1.5">
        <h4 className="font-bold text-darkgray text-[14px]">{meta.title}</h4>
        <span className="text-[11px] font-medium text-gray-400 tracking-wide">
          {formatActivityTime(entry.at)}
        </span>
      </div>
      {meta.body && (
        <p className="text-[13px] text-gray-500 leading-relaxed pr-8 whitespace-pre-wrap">
          {meta.body}
        </p>
      )}
    </div>
  );
};

const StepperRow = ({ steps, currentIdx, dimmed }) => (
  <div className={`relative ${dimmed ? "opacity-40" : ""}`}>
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
        const isCompleted = !dimmed && currentIdx >= 0 && idx <= currentIdx;
        return (
          <div key={step} className="flex flex-col items-center">
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
              className={`absolute top-8 text-[11px] font-bold ${isCompleted ? "text-select-blue" : "text-gray-400"}`}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  </div>
);

// Expanded email entry — full subject, To, body, attachments inline.
const EmailEntry = ({ entry }) => {
  const totalBytes =
    entry.attachments?.reduce((s, a) => s + (a.size || 0), 0) || 0;
  return (
    <div className="bg-bg-soft border border-border rounded-2xl p-4 mt-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
        <Field label="To">{entry.to || "—"}</Field>
        <Field label="Sent">{formatActivityTime(entry.at)}</Field>
        <div className="col-span-2">
          <Field label="Subject">
            <span className="font-bold text-darkgray">
              {entry.subject || "—"}
            </span>
          </Field>
        </div>
      </div>

      <div className="bg-white border border-border rounded-xl p-4 mb-3">
        <pre className="text-[13px] text-text whitespace-pre-wrap font-sans leading-relaxed">
          {entry.body}
        </pre>
      </div>

      {entry.attachments && entry.attachments.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wider text-text-subtle font-bold mb-2 flex items-center gap-1.5">
            <FiPaperclip size={12} />
            Attachments ({entry.attachments.length} • {formatBytes(totalBytes)})
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {entry.attachments.map((att, i) => (
              <div
                key={`${att.name}-${i}`}
                className="flex items-center justify-between p-3 border border-border rounded-xl bg-white hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FiFileText size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-darkgray truncate">
                      {att.name}
                    </p>
                    <p className="text-[10px] text-text-subtle">
                      {formatBytes(att.size)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-gray-400 group-hover:text-blue-600 transition-colors shrink-0 ml-2"
                  title="Download (mock)"
                >
                  <FiDownload size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="flex items-baseline gap-2 text-[12px]">
    <span className="text-text-subtle min-w-[60px]">{label}:</span>
    <span className="text-text font-medium truncate">{children}</span>
  </div>
);

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead] = useState(() => findLeadById(id, TableData));
  const [activity, setActivity] = useState(() => getActivity(id));
  const [milestones] = useState(() => getMilestonesForLead(lead));
  // Refresh the timeline live when schedule actions append activity (confirm
  // start, notify client, room done, amend) — they fire "activityChanged".
  useEffect(() => {
    const refresh = () => setActivity(getActivity(id));
    window.addEventListener("activityChanged", refresh);
    return () => window.removeEventListener("activityChanged", refresh);
  }, [id]);

  const grouped = useMemo(() => groupActivityByPhase(activity), [activity]);

  // Default the timeline tab to the lead's current phase so the latest
  // relevant activity is visible without scrolling. Falls back to "all" if
  // that phase has no entries (e.g. brand-new lead with only an email).
  const defaultTab = useMemo(() => {
    if (!lead) return "all";
    const currentPhase = phaseFromStatus(lead.status);
    if (grouped[currentPhase]?.length > 0) return currentPhase;
    // Otherwise pick the latest non-empty phase (in pipeline order).
    const lastNonEmpty = [...PHASES]
      .reverse()
      .find((p) => grouped[p.key]?.length > 0);
    return lastNonEmpty?.key || "all";
  }, [lead, grouped]);

  const [activeTab, setActiveTab] = useState(defaultTab);

  if (!lead) {
    return (
      <div className="p-8">
        <button
          onClick={() => navigate("/projects")}
          className="flex items-center gap-2 text-[13px] text-text-muted hover:text-text mb-4"
        >
          <FiArrowLeft size={14} /> Back to Projects
        </button>
        <div className="bg-white rounded-[20px] p-12 text-center shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
          <p className="text-[14px] font-semibold text-darkgray">
            No project found for {id}
          </p>
        </div>
      </div>
    );
  }

  const status = lead.status?.toLowerCase();
  const salesIdx = SALES_STEPS.findIndex((s) => s.toLowerCase() === status);
  const adjustedSalesIdx = status === "won" ? SALES_STEPS.length - 1 : salesIdx;
  const deliveryActive = status === "won";
  const highestPaidId = milestones
    .filter((m) => m.status === "paid")
    .reduce((max, m) => (m.id > max ? m.id : max), 0);
  const deliveryIdx = highestPaidId > 0 ? highestPaidId - 1 : -1;

  const isLost = status === "lost";
  const isOnHold = status === "on hold";
  const isConverted = status === "won" && !!lead.convertedClientID;

  const client = lead.convertedClientID
    ? [
        ...JSON.parse(localStorage.getItem("newClientsData") || "[]"),
        ...ClientTableData,
      ].find((c) => c.clientID === lead.convertedClientID)
    : null;

  const completedIds = new Set();
  let progress = 0;
  milestones.forEach((m) => {
    if (m.status === "paid" && !completedIds.has(m.id)) {
      completedIds.add(m.id);
      const config = PAYMENT_MILESTONES.find((pm) => pm.id === m.id) || m;
      progress += (config.pct || 0);
    }
  });
  const collectedPct = Math.min(progress, 100);

  return (
    <div className="bg-overallbg p-6 font-sans h-full flex flex-col overflow-y-auto lg:overflow-hidden scroll-hidden-bar">
      {/* Header */}
      <div className="flex justify-between items-center mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/projects")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-border hover:bg-gray-50 hover:border-select-blue/30 text-gray-500 hover:text-select-blue transition-all shadow-sm cursor-pointer"
          >
            <FiArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-[26px] font-bold text-darkgray leading-tight">
              Project
            </h1>
            <p className="text-[13px] text-gray-500 mt-1">
              Read-only view • Proposal ID #{lead.proposalId}
            </p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap justify-end">
          <Link
            to={`/leads/${lead.proposalId}`}
            className="flex items-center gap-2 px-5 py-2.5 bg-select-blue text-white rounded-xl text-sm font-semibold hover:bg-blue-950 shadow-sm"
          >
            <FiExternalLink size={16} /> Open Lead to Edit
          </Link>
          {isConverted && client && (
            <Link
              to={`/clients/${client.clientID}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-semibold text-emerald-700 hover:bg-emerald-100 shadow-sm"
            >
              <FiUserCheck size={16} /> View Client
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 w-full lg:items-stretch lg:overflow-hidden min-h-0">
        <div className="w-full lg:w-2/3 flex flex-col gap-6 min-w-0 lg:min-h-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
          {/* Card 1: identity + 2-tier stepper */}
          <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${getBadgeClass(lead.status)}`}
                  >
                    {lead.status}
                  </span>
                  <span className="text-[13px] text-gray-500 font-medium tracking-wide">
                    Project ID: #{lead.proposalId}
                  </span>
                </div>
                <h2 className="text-[28px] font-bold text-select-blue mb-3 tracking-tight">
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
            </div>

            <div className="mt-12">
              <p className="text-[10px] text-text-subtle font-bold uppercase tracking-wider mb-4">
                Sales
              </p>
              <StepperRow
                steps={SALES_STEPS}
                currentIdx={adjustedSalesIdx}
                dimmed={isLost}
              />
            </div>

            <div className="mt-14">
              <p className="text-[10px] text-text-subtle font-bold uppercase tracking-wider mb-4">
                Delivery
              </p>
              <StepperRow
                steps={DELIVERY_STEPS}
                currentIdx={deliveryIdx}
                dimmed={!deliveryActive || isLost}
              />
            </div>

            {status === "negotiation" && lead.negotiationNote && (
              <div className="mt-12 flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <FiTrendingUp size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-amber-800">
                    Active Blocker
                  </p>
                  <p className="text-[12px] text-amber-700 mt-0.5">
                    {lead.negotiationNote}
                  </p>
                  {lead.expectedClose && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      Expected close: {lead.expectedClose}
                    </p>
                  )}
                </div>
              </div>
            )}
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
                    Project on Hold
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Investment + Info Grid */}
          <div className="flex flex-col md:flex-row gap-6 shrink-0">
            <div className="bg-white rounded-[20px] p-7 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] w-full md:w-[35%] flex flex-col justify-between">
              <div>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-3">
                  Investment Range
                </p>
                <h3 className="text-3xl font-bold text-select-blue leading-tight">
                  {lead.investment?.includes("-") ? (
                    <>
                      {lead.investment.split("-")[0].trim()} - <br />
                      {lead.investment.split("-")[1].trim()}
                    </>
                  ) : (
                    lead.investment || "—"
                  )}
                </h3>
              </div>
              <div className="mt-10 border-t border-gray-100 text-left pt-5 space-y-3.5">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-500 font-medium">
                    Property Type
                  </span>
                  <span className="font-bold text-gray-900">
                    {lead.propertyType || "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-[65%] grid grid-cols-2 gap-4">
              <InfoCard
                icon={<FiHome size={18} />}
                label="Property Type"
                value={lead.propertyType}
              />
              <InfoCard
                icon={<FiCalendar size={18} />}
                label="Possession Date"
                value={lead.possessionDate}
              />
              <InfoCard
                icon={<FiLayers size={18} />}
                label="Project Scope"
                value={(() => {
                  const presetKey = lead.quotePreset || "";
                  const propType = lead.propertyType || "";
                  if (!presetKey) return lead.scope || "—";
                  const formattedPresetKey = presetKey.replace(/^(\d+)(BHK)$/i, "$1 BHK");
                  return `${formattedPresetKey} / ${propType}`;
                })()}
              />
              <InfoCard
                icon={<FiMessageCircle size={18} />}
                label="Inquiry Source"
                value={lead.inquirySource}
              />
              <div className="col-span-2">
                <InfoCard
                  icon={<FiPhone size={18} />}
                  label="Phone Number"
                  value={lead.phone}
                />
              </div>
            </div>
          </div>

          {/* Schedule — room-by-room plan with escalation */}
          <ProjectSchedule lead={lead} />

          {/* Communication Log — tab filtered, latest visible without scrolling */}
          <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] overflow-hidden shrink-0">
            <div className="px-6 pt-5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 className="flex items-center gap-2 text-[16px] font-bold text-darkgray">
                    <FiFileText size={18} className="text-gray-500" />{" "}
                    Communication Log
                  </h3>
                  <p className="text-[12px] text-text-muted mt-0.5">
                    Showing the{" "}
                    {activeTab === "all"
                      ? "full activity feed"
                      : `${PHASES.find((p) => p.key === activeTab)?.label ?? ""} stage`}
                    .{activeTab !== "all" && " Switch tabs for other stages."}
                  </p>
                </div>
                <span className="text-[11px] text-text-subtle">
                  {activity.length} total{" "}
                  {activity.length === 1 ? "entry" : "entries"}
                </span>
              </div>

              {/* Tabs */}
              {activity.length > 0 && (
                <div className="flex flex-wrap gap-2 -mx-1 px-1 pb-1">
                  <TabPill
                    label="All Activity"
                    icon={<FiFileText size={13} />}
                    count={activity.length}
                    active={activeTab === "all"}
                    onClick={() => setActiveTab("all")}
                    className="bg-gray-100 text-gray-700"
                  />
                  {PHASES.map((p) => {
                    const entries = grouped[p.key];
                    if (!entries || entries.length === 0) return null;
                    return (
                      <TabPill
                        key={p.key}
                        label={p.label}
                        icon={p.icon}
                        count={entries.length}
                        active={activeTab === p.key}
                        onClick={() => setActiveTab(p.key)}
                        className={p.badge}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Selected content */}
            <div className="border-t border-bg-soft mt-2">
              {activity.length === 0 ? (
                <div className="text-center py-12 px-8">
                  <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                    <FiFileText size={20} />
                  </div>
                  <p className="text-[13px] text-gray-500">
                    No activity yet. Calls, emails, notes, and stage changes
                    logged from the lead will appear here.
                  </p>
                </div>
              ) : activeTab === "all" ? (
                <AllActivityFeed activity={activity} />
              ) : (
                <PhaseSection
                  phase={PHASES.find((p) => p.key === activeTab)}
                  entries={grouped[activeTab] || []}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar — read-only */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6 min-w-0 lg:min-h-0 lg:h-full lg:overflow-y-auto scroll-hidden-bar pr-1">
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
            <h3 className="text-[22px] font-bold text-select-blue mb-1">
              {lead.clientName}
            </h3>
            <p className="text-[13px] font-medium text-gray-500 mb-2">
              {lead.email || "—"}
            </p>
            <p className="text-[12px] text-gray-500 flex items-center gap-1.5">
              <FiPhone size={12} /> {lead.phone || "—"}
            </p>
          </div>

          {isConverted && (
            <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-darkgray">
                  Delivery Progress
                </h3>
                <span className="text-[11px] font-bold text-emerald-600">
                  {collectedPct}%
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
                <div
                  className="h-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${collectedPct}%` }}
                ></div>
              </div>
              <div className="space-y-2">
                {(milestones.length > 0 ? milestones : PAYMENT_MILESTONES).map(
                  (m) => {
                    const paid = m.status === "paid";
                    return (
                      <div
                        key={m.id}
                        className={`p-3 rounded-xl border ${paid ? "bg-emerald-50 border-emerald-100" : "bg-bg-soft border-border"}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[12px] font-bold text-darkgray">
                            {m.id}. {m.name}
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
                        <p className="text-[11px] text-text-muted">
                          {m.pct}%
                          {m.total
                            ? ` • ₹${m.total.toLocaleString("en-IN")}`
                            : ""}
                          {paid && m.paidDate ? ` • ${m.paidDate}` : ""}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
              {client && (
                <Link
                  to={`/clients/${client.clientID}`}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-blue text-white text-[12px] font-semibold hover:bg-blue-950 transition-all"
                >
                  Manage in Client page <FiExternalLink size={12} />
                </Link>
              )}
            </div>
          )}

          <div className="bg-white rounded-[20px] p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)]">
            <p className="text-[11px] uppercase tracking-wider text-text-subtle font-bold mb-4">
              Activity Summary
            </p>
            <SummaryRow label="Total entries">{activity.length}</SummaryRow>
            <SummaryRow label="Emails sent">
              {activity.filter((a) => a.type === "email").length}
            </SummaryRow>
            <SummaryRow label="Calls logged">
              {activity.filter((a) => a.type === "call").length}
            </SummaryRow>
            <SummaryRow label="Notes">
              {activity.filter((a) => a.type === "note").length}
            </SummaryRow>
            <SummaryRow label="Stage changes">
              {
                activity.filter(
                  (a) => a.type === "status" || a.type === "negotiation",
                ).length
              }
            </SummaryRow>
            <SummaryRow label="Milestone events">
              {activity.filter((a) => a.type === "milestone").length}
            </SummaryRow>
          </div>

          <div className="bg-blue-50/40 border border-blue-100 rounded-[16px] p-4">
            <p className="text-[12px] text-blue-700 leading-relaxed">
              <strong>This page is read-only.</strong> To send a proposal, log a
              call, or change the project status, open the lead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Communication-log subcomponents ─────────────────────────────────────────

const TabPill = ({ label, icon, count, active, onClick, className }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all ${
      active
        ? `${className} ring-2 ring-offset-1 ring-dark-blue/30 shadow-sm`
        : `${className} opacity-60 hover:opacity-100`
    }`}
  >
    <span>{icon}</span>
    {label}
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white" : "bg-white/70"}`}
    >
      {count}
    </span>
  </button>
);

// One phase's worth of entries with the colored header band.
const PhaseSection = ({ phase, entries }) => {
  if (!phase) return null;
  const emails = entries.filter((e) => e.type === "email").length;
  const calls = entries.filter((e) => e.type === "call").length;
  const notes = entries.filter((e) => e.type === "note").length;
  return (
    <div>
      <div className={`${phase.softBg} px-8 py-5 border-b border-bg-soft`}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl ${phase.badge} flex items-center justify-center`}
            >
              {phase.icon}
            </div>
            <div>
              <h4 className="text-[15px] font-bold text-darkgray">
                {phase.label}{" "}
                <span className="text-text-muted font-medium">
                  · {entries.length} entr{entries.length === 1 ? "y" : "ies"}
                </span>
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5">
                {phase.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-subtle">
            {emails > 0 && (
              <span className="px-2 py-1 rounded-md bg-white/70">
                {emails} mail{emails > 1 ? "s" : ""}
              </span>
            )}
            {calls > 0 && (
              <span className="px-2 py-1 rounded-md bg-white/70">
                {calls} call{calls > 1 ? "s" : ""}
              </span>
            )}
            {notes > 0 && (
              <span className="px-2 py-1 rounded-md bg-white/70">
                {notes} note{notes > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="p-8">
        <div className="relative pl-6 space-y-10 before:absolute before:inset-y-2 before:left-[11px] before:w-[2px] before:bg-border">
          {entries.map((entry, idx) => (
            <div key={idx} className="relative">
              {idx === 0 && (
                <span className="absolute -left-[35px] -top-3 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider z-20">
                  Latest
                </span>
              )}
              <TimelineEntry entry={entry} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Flat reverse-chronological feed across all phases.
const AllActivityFeed = ({ activity }) => (
  <div className="p-8">
    <div className="relative pl-6 space-y-10 before:absolute before:inset-y-2 before:left-[11px] before:w-[2px] before:bg-border">
      {activity.map((entry, idx) => (
        <div key={idx} className="relative">
          {idx === 0 && (
            <span className="absolute -left-[35px] -top-3 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold uppercase tracking-wider z-20">
              Latest
            </span>
          )}
          <TimelineEntry entry={entry} />
        </div>
      ))}
    </div>
  </div>
);

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

export default ProjectDetail;
