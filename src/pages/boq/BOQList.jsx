import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  Search,
  TrendingUp,
  Hash,
  Layers,
  Wallet,
} from "lucide-react";
import { listBoqs } from "../../data/boqStorage";
import { generateBoqFromSurvey, getDesignFlow } from "../../data/designFlowStorage";
import { getAllSites } from "../../data/siteStorage";
import { formatAmount } from "../../utils/formatAmount";
import Table from "../../components/Table";

const STATUS_STYLES = {
  draft:                  { bg: "bg-slate-100",  text: "text-slate-700",  border: "border-slate-200"  },
  sent:                   { bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200"   },
  approved:               { bg: "bg-emerald-100",text: "text-emerald-700",border: "border-emerald-200"},
  revised:                { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  issued_for_tender:      { bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  signed:                 { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  issued_for_procurement: { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
  procurement:            { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
  survey_ready:           { bg: "bg-teal-100",   text: "text-teal-700",   border: "border-teal-200"   },
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const BOQList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => listBoqs());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refresh = () => setItems(listBoqs());

  const frozenSites = useMemo(() => {
    return getAllSites()
      .map((s) => {
        const flow = getDesignFlow(s.siteID);
        // Survey must be frozen
        if (!flow?.siteBasis) return null;
        // Design pipeline must also be complete
        const designDone =
          flow.stage === "DESIGN_COMPLETE" ||
          (Array.isArray(flow.stages) &&
            flow.stages.length > 0 &&
            flow.stages.every((st) => st.reviewState === "APPROVED"));
        if (!designDone) return null;
        const b = flow.siteBasis;
        return {
          siteID: s.siteID,
          name: s.clientName || s.siteID,
          boqId: flow.boqId || null,
          measured: Number(b.measured) || 0,
          total: Number(b.total) || 0,
          totalSqft: Number(b.totalSqft) || 0,
        };
      })
      .filter(Boolean)
      .filter((s) => !s.boqId);
  }, []);

  const handleFromSurvey = (siteID) => {
    const flow = getDesignFlow(siteID);
    if (flow?.boqId) {
      navigate(`/boq/${flow.boqId}`);
      setShowSitePicker(false);
      return;
    }
    const boqId = generateBoqFromSurvey(siteID);
    if (boqId) {
      refresh();
      navigate(`/boq/${boqId}`);
    } else {
      alert(
        "Couldn't generate the BOQ. This usually means browser storage is full — remove some old BOQs or sites to free space, then try again.",
      );
    }
    setShowSitePicker(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return (
        b.id.toLowerCase().includes(q) ||
        (b.title || "").toLowerCase().includes(q) ||
        (b.clientName || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, statusFilter]);

  const surveyReadyRows = useMemo(
    () =>
      frozenSites.map((s, i) => ({
        _surveyReady: true,
        sno: String(i + 1).padStart(2, "0"),
        id: "—",
        title: s.name,
        clientName: s.name,
        itemCount: s.total > 0 ? `${s.measured}/${s.total} rooms` : "—",
        grandTotal: null,
        status: "survey_ready",
        updatedAt: null,
        siteID: s.siteID,
        totalSqft: s.totalSqft,
      })),
    [frozenSites],
  );

  const tableData = useMemo(
    () => [
      ...surveyReadyRows,
      ...filtered.map((b, i) => ({
        ...b,
        sno: String(surveyReadyRows.length + i + 1).padStart(2, "0"),
      })),
    ],
    [surveyReadyRows, filtered],
  );

  const stats = useMemo(() => {
    const totalValue = items.reduce((s, b) => s + (Number(b.grandTotal) || 0), 0);
    const byStatus = items.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
    return { total: items.length, drafts: byStatus.draft || 0, approved: byStatus.approved || 0, totalValue };
  }, [items]);

  const STATUS_TABS = [
    { value: "all",                   label: "All",         count: stats.total },
    { value: "draft",                  label: "Drafts",      count: items.filter((b) => b.status === "draft").length },
    { value: "sent",                   label: "Sent",        count: items.filter((b) => b.status === "sent").length },
    { value: "approved",               label: "Approved",    count: stats.approved },
    { value: "issued_for_procurement", label: "Procurement", count: items.filter((b) => b.status === "issued_for_procurement" || b.status === "procurement").length },
  ];

  const STATUS_LABELS = {
    draft:                  "Draft",
    sent:                   "Sent",
    approved:               "Approved",
    revised:                "Revised",
    issued_for_tender:      "For Tender",
    signed:                 "Signed",
    issued_for_procurement: "Procurement",
    procurement:            "Procurement",
    survey_ready:           "Survey Ready",
  };

  const columns = [
    { key: "sno", label: "Sno", className: "text-center" },
    {
      key: "id",
      label: "BOQ ID",
      className: "text-center",
      render: (v, item) =>
        item._surveyReady ? (
          <span className="text-text-subtle text-[12px]">—</span>
        ) : (
          <span
            className="cursor-pointer hover:underline text-select-blue font-medium"
            onClick={() => navigate(`/boq/${item.id}`)}
          >
            {v}
          </span>
        ),
    },
    {
      key: "title",
      label: "Title",
      className: "text-center",
      render: (v, item) =>
        item._surveyReady ? (
          <span className="font-medium text-textcolor">{v}</span>
        ) : (
          <span
            className="cursor-pointer hover:underline font-medium"
            onClick={() => navigate(`/boq/${item.id}`)}
          >
            {v || "Untitled"}
          </span>
        ),
    },
    { key: "clientName", label: "Client", className: "text-center", render: (v) => v || "—" },
    {
      key: "itemCount",
      label: "Items",
      className: "text-center",
      render: (v, item) =>
        item._surveyReady ? (
          <span className="text-[11px] text-text-muted">{v}</span>
        ) : (
          v || 0
        ),
    },
    {
      key: "grandTotal",
      label: "Grand Total",
      className: "text-center",
      render: (v, item) =>
        item._surveyReady ? (
          <span className="text-text-subtle">—</span>
        ) : (
          formatAmount(v)
        ),
    },
    {
      key: "status",
      label: "Status",
      className: "text-center",
      render: (v, item) => {
        const s = STATUS_STYLES[v] || STATUS_STYLES.draft;
        const label = STATUS_LABELS[v] ?? v.replace(/_/g, " ");
        return item._surveyReady ? (
          <button
            type="button"
            onClick={() => handleFromSurvey(item.siteID)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-select-blue text-white text-[10.5px] font-semibold hover:bg-primary transition-all"
          >
            <Plus size={10} /> Generate BOQ
          </button>
        ) : (
          <span className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase ${s.bg} ${s.text}`}>
            {label}
          </span>
        );
      },
    },
    { key: "updatedAt", label: "Updated", className: "text-center", render: (v) => formatDate(v) },
  ];

  return (
    <div className="bg-overallbg font-manrope h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-bordergray/70 bg-overallbg/80 backdrop-blur-xl sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-textcolor leading-tight">Bill of Quantities</h1>
              <p className="text-[12px] text-text-muted mt-0.5">Detailed BOQs for measurement-based quotes & signed contracts</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BentoStat icon={<Layers size={13} />}    label="Total BOQs"           value={stats.total}                  tint="blue"    />
          <BentoStat icon={<Hash size={13} />}      label="Drafts"               value={stats.drafts}                 tint="orange"  />
          <BentoStat icon={<TrendingUp size={13} />} label="Approved"            value={stats.approved}               tint="emerald" />
          <BentoStat icon={<Wallet size={13} />}    label="Total Pipeline Value" value={formatAmount(stats.totalValue)} tint="purple" />
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-6 pt-3 pb-2 shrink-0">
        <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setStatusFilter(t.value)}
                className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all ${
                  statusFilter === t.value
                    ? "bg-active-bg text-select-blue border border-select-blue/30"
                    : "text-text-muted hover:bg-bg-soft border border-transparent"
                }`}
              >
                {t.label}
                <span className="ml-1.5 text-[10px] opacity-70">{t.count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID, title, client"
              className="bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30 w-[260px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 px-6 pb-4">
        <Table
          columns={columns}
          data={tableData}
          rowsPerPage={6}
          emptyMessage={
            items.length === 0 ? "No BOQs found." : "No matches for the current search or filter."
          }
          sortFields={[
            { key: "id",         label: "BOQ ID"      },
            { key: "title",      label: "Title"        },
            { key: "grandTotal", label: "Grand Total"  },
            { key: "updatedAt",  label: "Last Updated" },
          ]}
          exportConfig={{
            filename: "boq_export",
            columns: [
              { label: "BOQ ID",      key: "id"          },
              { label: "Title",       key: "title"       },
              { label: "Client",      key: "clientName"  },
              { label: "Items",       key: "itemCount"   },
              { label: "Grand Total", key: "grandTotal"  },
              { label: "Status",      key: "status"      },
            ],
          }}
        />
      </div>
    </div>
  );
};

const BentoStat = ({ icon, label, value, tint }) => {
  const tints = {
    blue:    "from-blue-50 to-white text-blue-600 border-blue-100",
    purple:  "from-purple-50 to-white text-purple-600 border-purple-100",
    orange:  "from-orange-50 to-white text-orange-600 border-orange-100",
    emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-100",
  };
  return (
    <div className={`relative bg-linear-to-br ${tints[tint]} border rounded-xl p-3 overflow-hidden`}>
      <div className="flex items-center justify-between mb-1">
        <span className="opacity-80">{icon}</span>
        <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <p className="text-[16px] font-bold text-textcolor tabular-nums leading-tight">{value}</p>
    </div>
  );
};

export default BOQList;
