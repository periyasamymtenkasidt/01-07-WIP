import { useMemo, useState } from "react";
import {
  FiUserPlus,
  FiPhone,
  FiMapPin,
  FiFileText,
  FiCheckCircle,
  FiArrowUpRight,
  FiArrowDownRight,
  FiPackage,
  FiCalendar,
  FiAlertTriangle,
} from "react-icons/fi";
import { HiOutlineDotsHorizontal } from "react-icons/hi";
import { TableData } from "../../data/TableData";
import { ClientTableData } from "../../data/ClientTableData";
import { listLibrary } from "../../data/itemLibrary";

// ─── Data merge helpers (mock + localStorage) ────────────────────────────────
function getMergedLeads() {
  let newLeads = [];
  let deleted = [];
  try {
    newLeads = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
  } catch { /* ignore — fall back to empty list */ }
  try {
    deleted = JSON.parse(localStorage.getItem("deletedLeads") || "[]");
  } catch { /* ignore — fall back to empty list */ }
  const overridden = new Set(newLeads.map((l) => l.proposalId));
  return [...newLeads, ...TableData.filter((i) => !overridden.has(i.proposalId))]
    .filter((i) => !deleted.includes(i.proposalId));
}

function getMergedClients() {
  let newClients = [];
  let deleted = [];
  try {
    newClients = JSON.parse(localStorage.getItem("newClientsData") || "[]");
  } catch { /* ignore — fall back to empty list */ }
  try {
    deleted = JSON.parse(localStorage.getItem("deletedClients") || "[]");
  } catch { /* ignore — fall back to empty list */ }
  const overridden = new Set(newClients.map((c) => c.clientID));
  return [...newClients, ...ClientTableData.filter((c) => !overridden.has(c.clientID))]
    .filter((c) => !deleted.includes(c.clientID));
}

// Parse budgets like "₹60-70L" or "₹1-1.2Cr" into lakhs (lower bound).
const parseBudgetLakhs = (str = "") => {
  const m = str.match(/([\d.]+)/);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  return /cr/i.test(str) ? n * 100 : n;
};

const formatLakhs = (lakhs) => {
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)}Cr`;
  return `₹${lakhs.toFixed(1)}L`;
};

// ─── Tone palettes (kept from original design) ───────────────────────────────
const TONE_BG = {
  emerald: "bg-emerald-400 text-white",
  sky: "bg-sky-400 text-white",
  violet: "bg-violet-400 text-white",
  amber: "bg-amber-300 text-white",
  rose: "bg-rose-400 text-white",
};

const TONE_DOT = {
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  amber: "bg-amber-400",
};

// Activity feed stays static — there is no rich source in the data files yet.
const ACTIVITY = [
  { time: "09:30 AM", title: "Site Visit · Azure Penthouse", sub: "Walkthrough completed with Mr. Anand", tone: "emerald" },
  { time: "11:15 AM", title: "Supplier Meeting · Amaca", sub: "Reviewed marble shipment timelines", tone: "sky" },
  { time: "01:45 PM", title: "Project Review · The Gilded Loft", sub: "Design sign-off pending from client", tone: "violet" },
  { time: "04:30 PM", title: "Contract Signed · Peak Villa", sub: "Initial booking token released", tone: "amber" },
];

const INVOICE_TABS = ["Pending", "Completed", "Overdue"];

// ─── Donut chart (SVG) ───────────────────────────────────────────────────────
const Donut = ({ data, size = 200, stroke = 24 }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.pct, 0) || 1;
  const segments = data.reduce(
    (acc, seg) => {
      const len = (seg.pct / total) * c;
      acc.items.push({ ...seg, len, offset: acc.cursor });
      acc.cursor += len;
      return acc;
    },
    { items: [], cursor: 0 },
  ).items;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-bg-soft)" strokeWidth={stroke} />
      {segments.map((seg) => (
        <circle
          key={seg.label}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={`${seg.len} ${c - seg.len}`}
          strokeDashoffset={-seg.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
};

// ─── Sections ────────────────────────────────────────────────────────────────
const StatCard = ({ stat }) => (
  <div className="relative bg-white rounded-2xl shadow-sm pt-5 pb-4 px-4 min-h-[110px] flex flex-col justify-between overflow-hidden">
    <div className={`absolute top-0 left-0 right-0 h-1.5 ${stat.accent}`} />
    {stat.badge && (
      <span
        className={`absolute -top-1 left-15 text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-sm ${TONE_BG[stat.badge.tone]}`}
      >
        {stat.badge.text}
      </span>
    )}
    <div className="mt-3">
      <p className="text-[12px] font-semibold text-text-subtle">{stat.label}</p>
    </div>
    <div className="text-right">
      <p className="text-2xl font-bold text-text">{stat.value}</p>
      <p className="text-[10px] text-text-subtle mt-0.5">{stat.sub}</p>
    </div>
  </div>
);

const LeadDistribution = ({ distribution, total }) => {
  const [view, setView] = useState("Monthly");
  const sum = distribution.reduce((s, d) => s + d.pct, 0) || 1;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 h-full">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-[16px] font-semibold text-text">Lead Distribution</h3>
          <p className="text-[11px] text-text-subtle">
            Performance by project type
          </p>
        </div>
        <div className="flex bg-bg-soft rounded-xl p-1 gap-1">
          {["Daily", "Monthly"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-[11px] rounded-lg transition-colors ${
                view === v ? "bg-primary text-white" : "text-text-muted hover:text-text"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 mt-4">
        <div className="relative shrink-0">
          <Donut data={distribution} size={200} stroke={24} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] text-text-subtle font-medium">Total</p>
            <p className="text-2xl font-bold text-text">{total.toLocaleString()}</p>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {distribution.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <span className="w-1 h-8 rounded-full" style={{ background: d.color }} />
              <div className="flex-1">
                <p className="text-[12px] font-medium text-text">{d.label}</p>
                <div className="h-1.5 bg-bg-soft rounded-full mt-1 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(d.pct / sum) * 100}%`, background: d.color }}
                  />
                </div>
              </div>
              <span className="text-[12px] font-bold text-text w-9 text-right">
                {d.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const DailyActivity = () => (
  <div className="bg-white rounded-2xl shadow-sm p-5 h-full">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[16px] font-semibold text-text">Daily Activity</h3>
      <button className="text-text-subtle hover:text-text">
        <HiOutlineDotsHorizontal size={18} />
      </button>
    </div>
    <div className="relative pl-5">
      <div className="absolute left-[5px] top-1.5 bottom-1.5 w-px bg-bordergray" />
      <ul className="space-y-4">
        {ACTIVITY.map((a, i) => (
          <li key={i} className="relative">
            <span className={`absolute -left-[18px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${TONE_DOT[a.tone]}`} />
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-semibold text-text">{a.title}</p>
              <span className="text-[10px] text-text-subtle whitespace-nowrap">{a.time}</span>
            </div>
            <p className="text-[11px] text-text-muted mt-0.5">{a.sub}</p>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const PipelineStage = ({ stage }) => {
  const Icon = stage.icon;
  return (
    <div className="flex flex-col items-center text-center px-2">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm border-4 border-white mb-2"
        style={{ background: stage.color }}
      >
        <Icon size={20} className="text-white" />
      </div>
      <p className="text-[11px] text-text-subtle font-medium">{stage.label}</p>
      <p className="text-[13px] font-bold mt-0.5" style={{ color: stage.color }}>
        {stage.value}
      </p>
    </div>
  );
};

const ActivePipeline = ({ pipeline }) => (
  <div className="bg-white rounded-2xl shadow-sm p-5">
    <h3 className="text-[16px] font-semibold text-primary mb-4">
      Active Lead Pipeline
    </h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {pipeline.map((s) => (
        <PipelineStage key={s.label} stage={s} />
      ))}
    </div>
  </div>
);

const InvoiceManagement = ({ invoices }) => {
  const [tab, setTab] = useState("Pending");
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[16px] font-semibold text-text">Invoice Management</h3>
        <div className="flex bg-bg-soft rounded-2xl p-1 gap-1">
          {INVOICE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-[11px] font-semibold rounded-xl transition-colors ${
                tab === t
                  ? "bg-linear-to-r from-select-blue to-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {invoices.map((inv) => (
          <div
            key={inv.title}
            className={`bg-bg-soft rounded-2xl border-l-4 ${inv.accent} p-5 flex flex-col gap-1`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold tracking-wider text-text-muted">
                {inv.title}
              </p>
              {inv.trend === "up" ? (
                <FiArrowUpRight size={14} className="text-emerald-500" />
              ) : (
                <FiArrowDownRight size={14} className="text-rose-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-text">{inv.amount}</p>
            <p className={`text-[11px] ${inv.subColor}`}>{inv.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const MaterialInventory = ({ materials }) => (
  <div className="bg-white rounded-2xl shadow-sm p-5 h-full">
    <h3 className="text-[16px] font-semibold text-text mb-4">Material Inventory</h3>
    <div className="space-y-3">
      {materials.map((m) => (
        <div
          key={m.code}
          className={`flex items-center gap-3 bg-bg-soft rounded-xl border-l-4 ${m.accent} px-3.5 py-3`}
        >
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-text-subtle shrink-0">
            <FiPackage size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono tracking-wider text-text-subtle">{m.code}</p>
            <p className="text-[13px] font-bold text-text truncate">{m.name}</p>
            <p className="text-[10px] text-text-muted">{m.note}</p>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              m.status === "in"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }`}
          >
            {m.status === "in" ? "In Stock" : "Out of Stock"}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const ProjectStatus = ({ projects }) => (
  <div className="bg-white rounded-2xl shadow-sm p-5 h-full">
    <h3 className="text-[16px] font-semibold text-text mb-4">Project Status &amp; Timeline</h3>
    <div className="space-y-3">
      {projects.map((p) => (
        <div key={p.code} className="flex items-center gap-3 bg-bg-soft rounded-xl px-3.5 py-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-text-subtle shrink-0">
            <FiFileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono tracking-wider text-text-subtle">{p.code}</p>
            <p className="text-[13px] font-bold text-text truncate">{p.name}</p>
            <p className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
              <FiCalendar size={10} /> Target {p.target}
            </p>
          </div>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <FiCheckCircle size={10} /> {p.status}
          </span>
        </div>
      ))}
    </div>
  </div>
);

// ─── Main ────────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const data = useMemo(() => {
    const leads = getMergedLeads();
    const clients = getMergedClients();
    const library = listLibrary();

    const countStatus = (status) =>
      leads.filter((l) => l.status?.toLowerCase() === status.toLowerCase()).length;

    const inquiry = countStatus("Inquiry");
    const qualified = countStatus("Qualified");
    const proposal = countStatus("Proposal");
    const negotiation = countStatus("Negotiation");
    const won = countStatus("Won");
    const lost = countStatus("Lost");
    const onHold = countStatus("On Hold");

    const dropOff = (from, to) =>
      from > 0 ? Math.round(((from - to) / from) * 100) : 0;

    // Stats cards — aligned to actual pipeline statuses + drop-off badges
    const stats = [
      {
        label: "Inquiry",
        value: inquiry.toLocaleString(),
        sub: "Incoming leads",
        badge: { text: `${leads.length} Total`, tone: "emerald" },
        accent: "bg-emerald-400",
      },
      {
        label: "Qualified",
        value: qualified.toLocaleString(),
        sub: "Validated leads",
        badge: { text: `${dropOff(inquiry, qualified)}% Drop Off`, tone: "sky" },
        accent: "bg-sky-400",
      },
      {
        label: "Proposal",
        value: proposal.toLocaleString(),
        sub: "Quotations sent",
        badge: { text: `${dropOff(qualified, proposal)}% Drop Off`, tone: "violet" },
        accent: "bg-violet-400",
      },
      {
        label: "Negotiation",
        value: negotiation.toLocaleString(),
        sub: "Active deals",
        badge: { text: `${dropOff(proposal, negotiation)}% Drop Off`, tone: "amber" },
        accent: "bg-amber-300",
      },
      {
        label: "Converted",
        value: won.toLocaleString(),
        sub: "Closed deals",
        badge: null,
        accent: "bg-purple-500",
      },
      {
        label: "Lost / Hold",
        value: (lost + onHold).toLocaleString(),
        sub: `${lost} lost · ${onHold} on hold`,
        badge: null,
        accent: "bg-rose-300",
      },
    ];

    // Lead distribution — by project location, top 4
    const palette = ["var(--color-emarold)", "var(--color-sky-blue)", "#8b5cf6", "#ef4444"];
    const locCounts = leads.reduce((acc, l) => {
      const key = l.location || "Other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const totalForDistribution = leads.length || 1;
    const topLocations = Object.entries(locCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const distribution = topLocations.map(([label, count], i) => ({
      label,
      pct: Math.round((count / totalForDistribution) * 100),
      color: palette[i],
    }));

    // Active pipeline strip — same status counts, with icons
    const pipeline = [
      { label: "Inquiry", value: `${inquiry} Leads`, icon: FiUserPlus, color: "#537BCC" },
      { label: "Qualified", value: `${qualified} Leads`, icon: FiPhone, color: "var(--color-primary)" },
      { label: "Proposal", value: `${proposal} Leads`, icon: FiFileText, color: "#3B1CEB" },
      { label: "Negotiation", value: `${negotiation} Leads`, icon: FiMapPin, color: "#54ab4e" },
      { label: "Converted", value: `${won} Leads`, icon: FiCheckCircle, color: "#008000" },
      { label: "Lost", value: `${lost} Leads`, icon: FiAlertTriangle, color: "#ba1a1a" },
    ];

    // Invoice management — derived from client paymentStatus + budgets
    const sumBudgets = (status) =>
      clients
        .filter((c) => c.paymentStatus === status)
        .reduce((s, c) => s + parseBudgetLakhs(c.budget), 0);

    const paidAmount = sumBudgets("completed");
    const pendingAmount = sumBudgets("pending");
    const failedAmount = sumBudgets("failed");

    const countPayment = (status) =>
      clients.filter((c) => c.paymentStatus === status).length;

    const invoices = [
      {
        title: "PAID INVOICES",
        amount: formatLakhs(paidAmount),
        sub: `${countPayment("completed")} clients paid in full`,
        accent: "border-emerald-400",
        subColor: "text-emerald-500",
        trend: "up",
      },
      {
        title: "PENDING AMOUNT",
        amount: formatLakhs(pendingAmount),
        sub: `${countPayment("pending")} awaiting payment`,
        accent: "border-violet-500",
        subColor: "text-violet-500",
        trend: "up",
      },
      {
        title: "OVERDUE",
        amount: formatLakhs(failedAmount),
        sub: `${countPayment("failed")} failed payments`,
        accent: "border-rose-400",
        subColor: "text-rose-500",
        trend: "down",
      },
    ];

    // Material inventory — top 3 from item library
    const materialAccents = ["border-emerald-400", "border-rose-400", "border-amber-400"];
    const materials = library.slice(0, 3).map((item, i) => ({
      code: `STK-${String(i + 13).padStart(3, "0")}`,
      name: item.description?.split(" — ")[0] || item.description || "Library item",
      note: item.materials?.[0]?.spec
        ? `${item.materials[0].name} · ${item.materials[0].spec}`
        : `Unit: ${item.unit} · ₹${item.rate}/${item.unit}`,
      status: i === 1 ? "out" : "in",
      accent: materialAccents[i % materialAccents.length],
    }));

    // Projects — completed-payment clients become active projects
    const projects = clients
      .filter((c) => c.paymentStatus === "completed")
      .slice(0, 4)
      .map((c) => ({
        code: c.clientID,
        name: `${c.location} · ${c.clientName}`,
        target: c.joinDate,
        status: "On Track",
      }));

    return {
      stats,
      distribution,
      pipeline,
      invoices,
      materials,
      projects,
      totalLeads: leads.length,
    };
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-overallbg p-1.5 font-manrope">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        {data.stats.map((s) => (
          <StatCard key={s.label} stat={s} />
        ))}
      </div>

      {/* Lead Distribution + Daily Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <LeadDistribution distribution={data.distribution} total={data.totalLeads} />
        <DailyActivity />
      </div>

      {/* Active Lead Pipeline */}
      <div className="mb-4">
        <ActivePipeline pipeline={data.pipeline} />
      </div>

      {/* Invoice Management */}
      <div className="mb-4">
        <InvoiceManagement invoices={data.invoices} />
      </div>

      {/* Material Inventory + Project Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MaterialInventory materials={data.materials} />
        <ProjectStatus projects={data.projects} />
      </div>
    </div>
  );
};

export default Dashboard;
