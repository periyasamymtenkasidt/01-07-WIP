import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClientTableData } from "../../data/ClientTableData";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import Modal from "../../components/Modal";
import {
  FiHash,
  FiCheckCircle,
  FiKey,
  FiPackage,
  FiTool,
  FiEdit3,
  FiUser,
  FiCalendar,
} from "react-icons/fi";
import { FaRegHandshake } from "react-icons/fa6";

// ─── Stage definitions (mirror PAYMENT_MILESTONES order) ─────────────────────
const STAGES = [
  {
    idx: 0,
    name: "ADVANCE",
    pct: 40,
    icon: FaRegHandshake,
    color: "var(--color-select-blue)",
    bg: "#eef2ff",
    border: "#c7d2fe",
    badge: { bg: "#dbeafe", color: "var(--color-select-blue)" },
  },
  {
    idx: 1,
    name: "STAGEWISE A",
    pct: 30,
    icon: FiEdit3,
    color: "#7c3aed",
    bg: "#f5f3ff",
    border: "#ddd6fe",
    badge: { bg: "#ede9fe", color: "#6d28d9" },
  },
  {
    idx: 2,
    name: "STAGEWISE B",
    pct: 25,
    icon: FiPackage,
    color: "#0891b2",
    bg: "#ecfeff",
    border: "#a5f3fc",
    badge: { bg: "#cffafe", color: "#0e7490" },
  },
  {
    idx: 3,
    name: "REMAINING",
    pct: 5,
    icon: FiKey,
    color: "#059669",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    badge: { bg: "#d1fae5", color: "#047857" },
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatINR = (n) => {
  if (!n || n <= 0) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

const parseBudget = (budget) => {
  if (!budget) return 0;
  const clean = budget.replace(/[₹\s]/g, "");
  const parts = clean.split("-");
  const parseOne = (s) => {
    const num = parseFloat(s.replace(/[^\d.]/g, ""));
    if (/cr/i.test(s)) return num * 10000000;
    if (/l/i.test(s)) return num * 100000;
    return num;
  };
  if (parts.length === 2) return (parseOne(parts[0]) + parseOne(parts[1])) / 2;
  return parseOne(parts[0]);
};

const parseDDMMYYYY = (str) => {
  if (!str) return new Date();
  const [d, m, y] = str.split(".");
  return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
};

const formatDDMMYYYY = (date) =>
  `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;

const milestoneKey = (clientID) => `clientMilestones_${clientID}`;

// Build milestone list — read from storage, else seed deterministically based on paymentStatus
const buildMilestones = (client) => {
  const stored = localStorage.getItem(milestoneKey(client.clientID));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
  }
  const projectValue = client.projectValue || parseBudget(client.budget);
  let paidCount = 0;
  if (client.paymentStatus === "completed") {
    paidCount = PAYMENT_MILESTONES.length;
  } else if (client.paymentStatus === "pending") {
    const tail = parseInt(client.clientID.split("-").pop() || "0", 10);
    paidCount = tail % 4; // 0..3 → cards land in cols 1..4
  }
  const join = parseDDMMYYYY(client.joinDate);
  return PAYMENT_MILESTONES.map((m, i) => {
    const base = Math.round((projectValue * m.pct) / 100);
    const gstAmt = Math.round((base * m.gst) / 100);
    let paidDate = "";
    if (i < paidCount) {
      const d = new Date(join);
      d.setDate(d.getDate() + (i + 1) * 12);
      paidDate = formatDDMMYYYY(d);
    }
    return {
      ...m,
      base,
      gstAmt,
      total: base + gstAmt,
      status: i < paidCount ? "paid" : "pending",
      paidDate,
      dueDate: "",
    };
  });
};

const getStaticOverride = (clientID) => {
  try {
    const o = JSON.parse(
      localStorage.getItem("staticClientStatusOverrides") || "{}",
    );
    return o[clientID];
  } catch {
    return undefined;
  }
};

const updatePaymentStatus = (clientID, status) => {
  const saved = localStorage.getItem("newClientsData");
  const newClients = saved ? JSON.parse(saved) : [];
  const idx = newClients.findIndex((c) => c.clientID === clientID);
  if (idx >= 0) {
    newClients[idx] = { ...newClients[idx], paymentStatus: status };
    localStorage.setItem("newClientsData", JSON.stringify(newClients));
    return;
  }
  const o = JSON.parse(
    localStorage.getItem("staticClientStatusOverrides") || "{}",
  );
  o[clientID] = status;
  localStorage.setItem("staticClientStatusOverrides", JSON.stringify(o));
};

const buildAllProjects = () => {
  const saved = localStorage.getItem("newClientsData");
  const newClients = saved ? JSON.parse(saved) : [];
  // Merge new + static (newClientsData wins on clientID collision)
  const seen = new Set(newClients.map((c) => c.clientID));
  const merged = [
    ...newClients,
    ...ClientTableData.filter((c) => !seen.has(c.clientID)),
  ];

  const today = new Date();
  let needsStorageUpdate = false;
  const updatedNewClients = [...newClients];
  const staticOverrides = JSON.parse(localStorage.getItem("staticClientStatusOverrides") || "{}");
  let needsOverridesUpdate = false;

  const result = merged
    .map((rawClient) => {
      const override = staticOverrides[rawClient.clientID];
      let client = override
        ? { ...rawClient, paymentStatus: override }
        : rawClient;
      // Skip "failed" projects from the kanban
      if (client.paymentStatus === "failed") return null;

      const milestones = buildMilestones(client);
      const isAllPaid = milestones.length === 4 && milestones.every((m) => m.status === "paid");

      // Verify payment status matches milestones
      let expectedStatus = client.paymentStatus;
      if (isAllPaid) {
        expectedStatus = "completed";
      } else {
        if (client.paymentStatus === "completed") {
          expectedStatus = "pending";
        }
      }

      if (client.paymentStatus !== expectedStatus) {
        client = { ...client, paymentStatus: expectedStatus };
        // Sync back to storage
        const idx = updatedNewClients.findIndex((c) => c.clientID === client.clientID);
        if (idx >= 0) {
          updatedNewClients[idx] = client;
          needsStorageUpdate = true;
        } else {
          const isStatic = ClientTableData.some((c) => c.clientID === client.clientID);
          if (isStatic) {
            staticOverrides[client.clientID] = expectedStatus;
            needsOverridesUpdate = true;
          } else {
            updatedNewClients.push(client);
            needsStorageUpdate = true;
          }
        }
      }

      const currentStageIdx = isAllPaid ? -1 : milestones.findIndex((m) => m.status !== "paid");
      const projectValue = client.projectValue || parseBudget(client.budget);

      // Days in current stage
      let stageStart;
      if (currentStageIdx <= 0) {
        stageStart = parseDDMMYYYY(client.joinDate);
      } else {
        const prev = milestones[currentStageIdx - 1];
        stageStart = prev?.paidDate
          ? parseDDMMYYYY(prev.paidDate)
          : parseDDMMYYYY(client.joinDate);
      }
      const daysInStage = Math.max(
        0,
        Math.floor((today - stageStart) / 86400000),
      );

      return { client, milestones, currentStageIdx, projectValue, daysInStage };
    })
    .filter(Boolean);

  if (needsStorageUpdate) {
    localStorage.setItem("newClientsData", JSON.stringify(updatedNewClients));
  }
  if (needsOverridesUpdate) {
    localStorage.setItem("staticClientStatusOverrides", JSON.stringify(staticOverrides));
  }

  return result;
};

const urgencyOf = (days) => {
  if (days <= 7)
    return {
      dot: "var(--color-emarold)",
      chipBg: "#ecfdf5",
      chipText: "#047857",
      label: "On track",
    };
  if (days <= 14)
    return {
      dot: "#f59e0b",
      chipBg: "#fffbeb",
      chipText: "#b45309",
      label: "Watch",
    };
  return {
    dot: "#ef4444",
    chipBg: "#fef2f2",
    chipText: "#b91c1c",
    label: "Overdue",
  };
};

// ─── Card ────────────────────────────────────────────────────────────────────
const ProjectCard = ({
  project,
  stage,
  isDragging,
  onDragStart,
  onDragEnd,
  onMarkPaid,
  onView,
}) => {
  const { client, milestones, currentStageIdx, projectValue, daysInStage } =
    project;
  const milestone = milestones[currentStageIdx];
  const urgency = urgencyOf(daysInStage);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.15 : 1,
        transform: isDragging ? "scale(0.97) rotate(-1.5deg)" : "scale(1)",
        transition: "all 0.15s ease",
        borderLeft: `3px solid ${stage.color}`,
      }}
      className="group bg-white rounded-xl p-3.5 mb-3 cursor-grab active:cursor-grabbing
                 shadow-sm hover:shadow-md border border-gray-100/80 hover:border-gray-200"
    >
      {/* Top row: client ID + urgency chip */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <FiHash size={10} className="text-gray-400" />
          <span className="text-[10px] font-bold tracking-wider font-mono text-gray-400">
            {client.clientID}
          </span>
        </div>
        <span
          style={{ background: urgency.chipBg, color: urgency.chipText }}
          className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: urgency.dot }}
          />
          {daysInStage}d
        </span>
      </div>

      {/* Client name + property */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          style={{ background: stage.badge.bg, color: stage.badge.color }}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 border border-white shadow-sm"
        >
          {client.clientName?.charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-text leading-snug truncate">
            {client.clientName}
          </p>
          <p className="text-[10px] text-text-muted truncate">
            {client.location} · {client.locationSecondary}
          </p>
        </div>
      </div>

      {/* Value grid */}
      <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b border-bg-soft">
        <div>
          <p className="text-[9px] uppercase tracking-wider font-bold text-text-subtle mb-0.5">
            Project
          </p>
          <p className="text-[12px] font-bold text-text">
            {formatINR(projectValue)}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider font-bold text-text-subtle mb-0.5">
            Stage Due
          </p>
          <p className="text-[12px] font-bold" style={{ color: stage.color }}>
            {formatINR(milestone?.total)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onView}
          className="flex-1 text-[11px] font-semibold text-text-muted hover:text-primary border border-bordergray hover:bg-bg-soft rounded-lg py-1.5 transition-colors"
        >
          View Profile
        </button>
        <button
          onClick={onMarkPaid}
          style={{ background: stage.color }}
          className="flex-1 text-[11px] font-semibold bg-primary text-white hover:opacity-90 rounded-lg py-1.5 transition-opacity"
        >
          Mark as Paid
        </button>
      </div>
    </div>
  );
};

// ─── Column ──────────────────────────────────────────────────────────────────
const KanbanColumn = ({
  stage,
  projects,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
  onMarkPaid,
  onView,
}) => {
  const [isOver, setIsOver] = useState(false);
  const Icon = stage.icon;
  const pendingTotal = projects.reduce((sum, p) => {
    const m = p.milestones[p.currentStageIdx];
    return sum + (m?.total || 0);
  }, 0);

  return (
    <div
      style={{
        background: isOver ? stage.bg : "#f9fafb",
        borderTop: `3px solid ${stage.color}`,
        transition: "background 0.2s ease",
        height: "calc(100vh - 220px)",
      }}
      className="flex-1 flex flex-col rounded-2xl border border-gray-100 shadow-sm min-w-[260px]"
    >
      {/* Header */}
      <div
        className="px-4 py-3 shrink-0"
        style={{
          borderBottom: `1px solid ${isOver ? stage.border : "var(--color-bg-soft)"}`,
        }}
      >
        <div className="flex items-center gap-2.5 mb-1.5">
          <div
            style={{ background: stage.badge.bg }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          >
            <Icon size={14} style={{ color: stage.color }} />
          </div>
          <span className="text-[13px] font-bold text-text flex-1">
            {stage.name}
          </span>
          <span
            style={{ background: stage.badge.bg, color: stage.badge.color }}
            className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
          >
            {projects.length}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] font-medium text-text-muted pl-9">
          <span>
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </span>
          <span style={{ color: stage.color }} className="font-bold">
            {formatINR(pendingTotal)} pending
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={() => {
          setIsOver(false);
          onDrop(stage.idx);
        }}
        className="col-scroll flex-1 p-3 overflow-y-auto"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {projects.length === 0 && !isOver && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div
              style={{ background: stage.badge.bg }}
              className="w-11 h-11 rounded-full flex items-center justify-center mb-2.5"
            >
              <Icon size={17} style={{ color: stage.color, opacity: 0.4 }} />
            </div>
            <p className="text-[11px] font-medium text-gray-300">
              No projects here
            </p>
            <p className="text-[10px] mt-0.5 text-gray-200">
              Drag a card to advance
            </p>
          </div>
        )}

        {projects.map((p) => (
          <ProjectCard
            key={p.client.clientID}
            project={p}
            stage={stage}
            isDragging={draggingId === p.client.clientID}
            onDragStart={() => onDragStart(p.client.clientID)}
            onDragEnd={onDragEnd}
            onMarkPaid={() => onMarkPaid(p.client.clientID)}
            onView={() => onView(p.client.clientID)}
          />
        ))}

        {isOver && (
          <div
            style={{ borderColor: stage.color, background: stage.bg }}
            className="h-16 rounded-xl border-2 border-dashed flex items-center justify-center mt-1"
          >
            <span
              className="text-[11px] font-semibold"
              style={{ color: stage.color }}
            >
              Drop here
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Completed Swimlane ──────────────────────────────────────────────────────
const CompletedSwimlane = ({ projects, onView }) => {
  if (projects.length === 0) return null;
  const totalCollected = projects.reduce((s, p) => s + p.projectValue, 0);

  return (
    <div className="mt-5 bg-white rounded-2xl border border-emerald-100 shadow-sm">
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-bg-soft">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
            <FiCheckCircle size={14} className="text-emerald-600" />
          </div>
          <span className="text-[13px] font-bold text-text">
            Completed Projects
          </span>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
            {projects.length}
          </span>
        </div>
        <span className="text-[11px] font-bold text-emerald-700">
          {formatINR(totalCollected)} collected
        </span>
      </div>
      <div className="flex gap-3 p-4 overflow-x-auto col-scroll">
        {projects.map((p) => (
          <button
            key={p.client.clientID}
            onClick={() => onView(p.client.clientID)}
            className="shrink-0 w-[240px] text-left bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-100 rounded-xl p-3 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold tracking-wider text-emerald-700">
                {p.client.clientID}
              </span>
              <FiCheckCircle size={12} className="text-emerald-600" />
            </div>
            <p className="text-[13px] font-bold text-text mb-0.5 truncate">
              {p.client.clientName}
            </p>
            <p className="text-[10px] text-text-muted truncate mb-2">
              {p.client.location} · {p.client.locationSecondary}
            </p>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-emerald-700">
                {formatINR(p.projectValue)}
              </span>
              <span className="flex items-center gap-1 text-text-muted">
                <FiCalendar size={10} />
                {p.milestones[p.milestones.length - 1]?.paidDate ||
                  p.client.joinDate}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Confirm Modal ───────────────────────────────────────────────────────────
const ConfirmPaidModal = ({ project, stage, onClose, onConfirm }) => {
  const milestone = project.milestones[project.currentStageIdx];
  const Icon = stage.icon;

  const footer = (
    <div className="flex justify-end gap-3">
      <button
        onClick={onClose}
        className="px-5 py-2.5 rounded-lg border border-bordergray text-sm font-medium text-text-muted hover:bg-bg-soft transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        style={{ background: stage.color }}
        className="px-7 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        Confirm Payment
      </button>
    </div>
  );

  return (
    <Modal
      title={`Mark ${stage.name} as Paid`}
      subtitle={`${project.client.clientName} · ${project.client.clientID}`}
      onClose={onClose}
      footer={footer}
      maxWidth="max-w-[480px]"
    >
      <div
        style={{ background: stage.bg, borderColor: stage.border }}
        className="rounded-xl border p-4 mb-4 flex items-center gap-3"
      >
        <div
          style={{ background: stage.badge.bg }}
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        >
          <Icon size={18} style={{ color: stage.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-subtle">
            Stage {stage.idx + 1} of 4
          </p>
          <p className="text-[14px] font-bold text-text">{stage.name}</p>
        </div>
        <span style={{ color: stage.color }} className="text-[18px] font-bold">
          {milestone.pct}%
        </span>
      </div>

      <div className="rounded-xl border border-bordergray overflow-hidden">
        <div className="grid grid-cols-3 px-4 py-2.5 bg-bg-soft text-[10px] font-bold uppercase tracking-widest text-text-muted">
          <span>Base</span>
          <span className="text-center">GST 18%</span>
          <span className="text-right">Total Due</span>
        </div>
        <div className="grid grid-cols-3 px-4 py-3 text-[13px] font-bold">
          <span className="text-text-muted">{formatINR(milestone.base)}</span>
          <span className="text-center text-orange-500">
            +{formatINR(milestone.gstAmt)}
          </span>
          <span className="text-right text-text">
            {formatINR(milestone.total)}
          </span>
        </div>
      </div>

      <p className="text-[12px] text-text-muted mt-4">
        Confirming will stamp today's date as the paid date and move the project
        {stage.idx === STAGES.length - 1
          ? " to the Completed section."
          : ` to ${STAGES[stage.idx + 1].name}.`}
      </p>
    </Modal>
  );
};

// ─── Main ────────────────────────────────────────────────────────────────────
export default function Deals() {
  const navigate = useNavigate();
  const [tick, setTick] = useState(0);
  const [draggingId, setDraggingId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    const onStorage = () => setTick((t) => t + 1);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const projects = useMemo(() => buildAllProjects(), [tick]);
  const activeProjects = projects.filter((p) => p.currentStageIdx >= 0);
  const completedProjects = projects.filter((p) => p.currentStageIdx === -1);
  const projectsAt = (idx) =>
    activeProjects.filter((p) => p.currentStageIdx === idx);

  const confirmProject = confirmId
    ? projects.find((p) => p.client.clientID === confirmId)
    : null;
  const confirmStage = confirmProject
    ? STAGES[confirmProject.currentStageIdx]
    : null;

  const markCurrentMilestonePaid = (clientID) => {
    const project = projects.find((p) => p.client.clientID === clientID);
    if (!project || project.currentStageIdx < 0) return;
    const today = formatDDMMYYYY(new Date());
    const updated = project.milestones.map((m, i) =>
      i === project.currentStageIdx
        ? { ...m, status: "paid", paidDate: today }
        : m,
    );
    localStorage.setItem(milestoneKey(clientID), JSON.stringify(updated));
    if (updated.every((m) => m.status === "paid")) {
      updatePaymentStatus(clientID, "completed");
    } else {
      updatePaymentStatus(clientID, "pending");
    }
    setTick((t) => t + 1);
    window.dispatchEvent(new Event("leadDataChanged"));
  };

  const handleDrop = (targetStageIdx) => {
    if (!draggingId) return;
    const project = projects.find((p) => p.client.clientID === draggingId);
    setDraggingId(null);
    if (!project || project.currentStageIdx < 0) return;
    // Only allow advancing exactly one stage
    if (targetStageIdx === project.currentStageIdx + 1) {
      setConfirmId(draggingId);
    }
  };

  return (
    <>
      <style>{`
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: var(--color-bordergray); border-radius: 99px; }
        .col-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="bg-overallbg h-full overflow-y-auto p-4 font-manrope">
        {/* Page header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="text-primary text-3xl font-semibold">Deals</h3>
            <p className="text-[12px] text-text-muted mt-1">
              Project execution board · {activeProjects.length} active ·{" "}
              {completedProjects.length} completed
            </p>
          </div>

          <div className="flex gap-2 items-center flex-wrap justify-end">
            {STAGES.map((stage) => {
              const cards = projectsAt(stage.idx);
              return (
                <div
                  key={stage.idx}
                  style={{
                    background: stage.badge.bg,
                    color: stage.badge.color,
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
                >
                  <stage.icon size={11} />
                  {cards.length}&nbsp;{stage.name}
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty state */}
        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-bordergray py-20 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-bg-soft flex items-center justify-center mb-3">
              <FiUser size={22} className="text-text-subtle" />
            </div>
            <p className="text-[14px] font-bold text-text mb-1">
              No active projects yet
            </p>
            <p className="text-[12px] text-text-muted">
              Convert a Won lead from the Leads page to add a project here.
            </p>
          </div>
        ) : (
          <>
            {/* 5-column board */}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.idx}
                  stage={stage}
                  projects={projectsAt(stage.idx)}
                  draggingId={draggingId}
                  onDragStart={setDraggingId}
                  onDragEnd={() => setDraggingId(null)}
                  onDrop={handleDrop}
                  onMarkPaid={(id) => setConfirmId(id)}
                  onView={(id) => navigate(`/clients/${id}`)}
                />
              ))}
            </div>

            {/* Completed swimlane */}
            <CompletedSwimlane
              projects={completedProjects}
              onView={(id) => navigate(`/clients/${id}`)}
            />
          </>
        )}

        {/* Confirm Mark-as-Paid modal */}
        {confirmProject && confirmStage && (
          <ConfirmPaidModal
            project={confirmProject}
            stage={confirmStage}
            onClose={() => setConfirmId(null)}
            onConfirm={() => {
              markCurrentMilestonePaid(confirmProject.client.clientID);
              setConfirmId(null);
            }}
          />
        )}
      </div>
    </>
  );
}
