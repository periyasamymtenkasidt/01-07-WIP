import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import Table from "../../components/Table";
import { TableData } from "../../data/TableData";
import { getAllProjects, getBadgeClass } from "../../data/LeadStatusConfig";
import { getProjectSlack } from "../../data/scheduleStorage";
import { ClientTableData } from "../../data/ClientTableData";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";

const SUB_TABS = ["In Sales", "In Delivery", "Handover Complete"];

const formatRelative = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
};

const summarizeActivity = (entry) => {
  if (!entry) return "—";
  switch (entry.type) {
    case "email":
      return `Email: ${entry.subject || "Proposal sent"}`;
    case "call":
      return `Call ${entry.direction || "outbound"}${entry.duration ? ` • ${entry.duration}m` : ""}`;
    case "note":
      return `Note: ${entry.text?.slice(0, 40) || "—"}`;
    case "negotiation":
      return `Moved to Negotiation`;
    case "milestone":
      return `Milestone: ${entry.milestoneName} ${entry.action}`;
    case "status":
      return `Status → ${entry.to}`;
    case "quote":
      return `Quote ${entry.quoteId || ""}: ${entry.subject || "sent"}`.trim();
    default:
      return entry.type;
  }
};

const isClientProjectCompleted = (clientID) => {
  if (!clientID) return false;

  let rawClient = null;
  try {
    const saved = localStorage.getItem("newClientsData");
    const newClients = saved ? JSON.parse(saved) : [];
    rawClient = newClients.find((c) => c.clientID === clientID);
  } catch {}

  if (!rawClient) {
    rawClient = ClientTableData.find((c) => c.clientID === clientID);
  }

  if (!rawClient) return false;

  let paymentStatus = rawClient.paymentStatus;
  try {
    const o = JSON.parse(localStorage.getItem("staticClientStatusOverrides") || "{}");
    if (o[clientID]) {
      paymentStatus = o[clientID];
    }
  } catch {}

  if (paymentStatus === "failed") return false;

  let milestones = [];
  try {
    const stored = localStorage.getItem(`clientMilestones_${clientID}`);
    if (stored) {
      milestones = JSON.parse(stored);
    } else {
      let paidCount = 0;
      if (paymentStatus === "completed") {
        paidCount = PAYMENT_MILESTONES.length;
      } else if (paymentStatus === "pending") {
        const tail = parseInt(clientID.split("-").pop() || "0", 10);
        paidCount = tail % 4;
      }
      milestones = PAYMENT_MILESTONES.map((m, i) => ({
        ...m,
        status: i < paidCount ? "paid" : "pending",
      }));
    }
  } catch {
    return false;
  }

  return milestones.length > 0 && milestones.every((m) => m.status === "paid");
};

const buildRows = () => {
  // Combine static mock leads with localStorage overrides (mirroring how
  // Leads.jsx merges them) so a Project surfaces regardless of source.
  let stored = [];
  try {
    stored = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
  } catch {
    stored = [];
  }
  const overriddenIds = new Set(stored.map((l) => l.proposalId));
  const merged = [
    ...stored,
    ...TableData.filter((l) => !overriddenIds.has(l.proposalId)),
  ];
  return getAllProjects(merged).map((p, idx) => {
    const slack = getProjectSlack(p.lead);
    const handoverComplete = p.lead.convertedClientID ? isClientProjectCompleted(p.lead.convertedClientID) : false;
    return {
      sno: String(idx + 1).padStart(2, "0"),
      proposalId: p.lead.proposalId,
      clientName: p.lead.clientName,
      status: handoverComplete ? "Completed" : p.lead.status,
      stageLabel: handoverComplete ? "Completed" : p.stage.label,
      progress: p.progress,
      lastActivity: p.lastActivity,
      investment: p.lead.investment,
      possessionDate: p.lead.possessionDate,
      slackDays: slack.slackDays,
      slackLevel: slack.level,
      phase: p.stage.phase,
      isHandoverComplete: handoverComplete,
      isLost: p.lead.status?.toLowerCase() === "lost",
    };
  });
};

const Projects = () => {
  const navigate = useNavigate();
  const [allRows, setAllRows] = useState(() => buildRows());
  const [activeSubTab, setActiveSubTab] = useState(0);

  useEffect(() => {
    const handler = () => setAllRows(buildRows());
    window.addEventListener("focus", handler);
    window.addEventListener("storage", handler);
    window.addEventListener("leadDataChanged", handler);
    return () => {
      window.removeEventListener("focus", handler);
      window.removeEventListener("storage", handler);
      window.removeEventListener("leadDataChanged", handler);
    };
  }, []);

  const data = useMemo(() => {
    const filtered = allRows.filter((row) => {
      switch (activeSubTab) {
        case 0:
          return false;
        case 1:
          return (row.phase === "delivery" || (row.phase === "closed" && row.stageLabel === "REMAINING")) && !row.isHandoverComplete && !row.isLost;
        case 2:
          return row.isHandoverComplete && !row.isLost;
        case 3:
          return row.isLost;
        default:
          return true;
      }
    });
    // Priority: most at-risk first (over-committed → tight → ok → no data).
    // Within a level, fewer slack days = more urgent.
    const RANK = { over: 0, tight: 1, ok: 2, none: 3 };
    filtered.sort((a, b) => {
      const ra = RANK[a.slackLevel] ?? 3;
      const rb = RANK[b.slackLevel] ?? 3;
      if (ra !== rb) return ra - rb;
      return (a.slackDays ?? Infinity) - (b.slackDays ?? Infinity);
    });
    // Re-number after filter + sort
    return filtered.map((r, i) => ({
      ...r,
      sno: String(i + 1).padStart(2, "0"),
    }));
  }, [allRows, activeSubTab]);

  const columns = [
    { key: "sno", label: "Sno" },
    {
      key: "proposalId",
      label: "Project ID",
      render: (_, item) => (
        <span
          className="cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${item.proposalId}`);
          }}
        >
          {item.proposalId}
        </span>
      ),
    },
    {
      key: "clientName",
      label: "Client Name",
      render: (_, item) => (
        <span
          className="cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/projects/${item.proposalId}`);
          }}
        >
          {item.clientName}
        </span>
      ),
    },
    {
      key: "stageLabel",
      label: "Stage",
      render: (_, item) => (
        <span className="text-[13px] font-semibold text-darkgray">
          {item.stageLabel}
        </span>
      ),
    },
    {
      key: "progress",
      label: "Progress",
      render: (_, item) => (
        <span className="text-[12px] text-text-muted">{item.progress}</span>
      ),
    },
    {
      key: "lastActivity",
      label: "Last Activity",
      render: (_, item) => (
        <div className="flex flex-col">
          <span className="text-[12px] text-gray-700 max-w-[220px] truncate">
            {summarizeActivity(item.lastActivity)}
          </span>
          <span className="text-[10px] text-text-subtle mt-0.5">
            {formatRelative(item.lastActivity?.at)}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (_, item) => (
        <span
          className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase ${getBadgeClass(item.status)}`}
        >
          {item.status}
        </span>
      ),
    },
    { key: "investment", label: "Investment" },
    { key: "possessionDate", label: "Possession" },
    {
      key: "slackDays",
      label: "Timeline",
      render: (_, item) => {
        if (item.slackLevel === "none")
          return <span className="text-text-subtle">—</span>;
        const chip = {
          over: "bg-red-100 text-red-600",
          tight: "bg-amber-100 text-amber-700",
          ok: "bg-emerald-100 text-emerald-700",
        }[item.slackLevel];
        const label =
          item.slackLevel === "over"
            ? `${Math.abs(item.slackDays)}d over`
            : `${item.slackDays}d slack`;
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${chip}`}
            title="Slack = possession date − planned completion"
          >
            {item.slackLevel === "over" && <FiAlertTriangle size={11} />}
            {label}
          </span>
        );
      },
    },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Table
        title="Projects"
        subtitle={`Projects - ${SUB_TABS[activeSubTab]}`}
        columns={columns}
        data={data}
        emptyMessage="No projects in this stage."
        rowsPerPage={8}
        activeRowKey="proposalId"
        onRowClick={(row) => navigate(`/projects/${row.proposalId}`)}
        subTabs={SUB_TABS}
        onSubTabChange={setActiveSubTab}
        sortFields={[
          { key: "slackDays", label: "Timeline slack" },
          { key: "clientName", label: "Client Name" },
          { key: "proposalId", label: "Project ID" },
          { key: "investment", label: "Investment" },
        ]}
        filterFields={[
          {
            key: "status",
            label: "Status",
            options: ["Proposal", "Negotiation", "Won", "Lost", "On Hold"],
          },
        ]}
        dateRangeField={{
          key: "possessionDate",
          parse: (value) => {
            const parts = value?.split(".");
            if (parts?.length === 3)
              return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return null;
          },
        }}
        exportConfig={{
          filename: "projects_export",
          columns: [
            { label: "Sno", key: "sno" },
            { label: "Project ID", key: "proposalId" },
            { label: "Client", key: "clientName" },
            { label: "Stage", key: "stageLabel" },
            { label: "Progress", key: "progress" },
            { label: "Status", key: "status" },
            { label: "Investment", key: "investment" },
            { label: "Possession", key: "possessionDate" },
            {
              label: "Slack (days)",
              render: (item) =>
                item.slackDays == null ? "—" : String(item.slackDays),
            },
          ],
        }}
      />
    </div>
  );
};

export default Projects;
