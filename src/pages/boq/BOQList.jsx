import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Copy,
  TrendingUp,
  Hash,
  Layers,
  Wallet,
  ChevronRight,
  Ruler,
  X,
} from "lucide-react";
import { listBoqs, deleteBoq, duplicateBoq } from "../../data/boqStorage";
import { generateBoqFromSurvey, getDesignFlow } from "../../data/designFlowStorage";
import { getAllSites } from "../../data/siteStorage";
import { formatAmount } from "../../utils/formatAmount";

const STATUS_STYLES = {
  draft: {
    bg: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  sent: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200" },
  approved: {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  revised: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  issued_for_tender: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  signed: {
    bg: "bg-purple-100",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  issued_for_procurement: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
  procurement: {
    bg: "bg-indigo-100",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
};

const BOQList = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => listBoqs());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showSitePicker, setShowSitePicker] = useState(false);

  const refresh = () => setItems(listBoqs());

  // Sites that have a frozen survey (siteBasis set in their design flow)
  const frozenSites = useMemo(() => {
    const all = getAllSites();
    return all
      .map((s) => {
        const flow = getDesignFlow(s.siteID);
        if (!flow?.siteBasis) return null;
        return { siteID: s.siteID, name: s.clientName || s.siteID, boqId: flow.boqId || null };
      })
      .filter(Boolean);
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

  const stats = useMemo(() => {
    const totalValue = items.reduce(
      (s, b) => s + (Number(b.grandTotal) || 0),
      0,
    );
    const byStatus = items.reduce((acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    }, {});
    return {
      total: items.length,
      drafts: byStatus.draft || 0,
      approved: byStatus.approved || 0,
      totalValue,
    };
  }, [items]);

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!confirm(`Delete ${id}? This cannot be undone.`)) return;
    deleteBoq(id);
    refresh();
  };

  const handleDuplicate = (e, id) => {
    e.stopPropagation();
    const next = duplicateBoq(id);
    if (next) navigate(`/boq/${next.id}`);
  };

  const STATUS_TABS = [
    { value: "all", label: "All", count: stats.total },
    {
      value: "draft",
      label: "Drafts",
      count: items.filter((b) => b.status === "draft").length,
    },
    {
      value: "sent",
      label: "Sent",
      count: items.filter((b) => b.status === "sent").length,
    },
    { value: "approved", label: "Approved", count: stats.approved },
    {
      value: "issued_for_tender",
      label: "Tender",
      count: items.filter((b) => b.status === "issued_for_tender").length,
    },
    {
      value: "signed",
      label: "Signed",
      count: items.filter((b) => b.status === "signed").length,
    },
    {
      value: "issued_for_procurement",
      label: "Procurement",
      count: items.filter((b) => b.status === "issued_for_procurement" || b.status === "procurement").length,
    },
  ];

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-bordergray/70 bg-overallbg/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <FileText size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                Bill of Quantities
              </h1>
              <p className="text-[12px] text-text-muted mt-0.5">
                Detailed BOQs for measurement-based quotes & signed contracts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSitePicker(true)}
              className="flex items-center gap-1.5 px-4 py-2 border border-bordergray bg-white text-text-muted rounded-lg text-[12px] font-semibold hover:bg-bg-soft transition-all"
            >
              <Ruler size={13} /> From Survey
            </button>
            <button
              type="button"
              onClick={() => navigate("/boq/new")}
              className="flex items-center gap-1.5 px-4 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all"
            >
              <Plus size={13} /> New BOQ
            </button>
          </div>

          {/* Site picker modal */}
          {showSitePicker && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowSitePicker(false)}>
              <div className="bg-white rounded-2xl shadow-2xl border border-bordergray w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-bordergray">
                  <div>
                    <p className="text-[14px] font-bold text-textcolor">Generate BOQ from Survey</p>
                    <p className="text-[11.5px] text-text-muted mt-0.5">Select a site with a frozen survey</p>
                  </div>
                  <button type="button" onClick={() => setShowSitePicker(false)} className="rounded-lg p-1.5 text-text-subtle hover:bg-bg-soft">
                    <X size={15} />
                  </button>
                </div>
                <div className="px-3 py-3 max-h-72 overflow-y-auto">
                  {frozenSites.length === 0 ? (
                    <p className="py-8 text-center text-[12.5px] text-text-subtle">No sites with frozen surveys found.</p>
                  ) : (
                    <div className="space-y-1">
                      {frozenSites.map((s) => (
                        <button
                          key={s.siteID}
                          type="button"
                          onClick={() => handleFromSurvey(s.siteID)}
                          className="w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-left hover:bg-active-bg transition-colors"
                        >
                          <div>
                            <p className="text-[13px] font-semibold text-textcolor">{s.name}</p>
                            <p className="text-[11px] text-text-muted">{s.siteID}</p>
                          </div>
                          {s.boqId ? (
                            <span className="text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 border border-emerald-200 shrink-0">Open BOQ</span>
                          ) : (
                            <span className="text-[10px] font-bold rounded-full bg-blue-50 text-select-blue px-2 py-0.5 border border-blue-200 shrink-0">Generate</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <BentoStat
            icon={<Layers size={13} />}
            label="Total BOQs"
            value={stats.total}
            tint="blue"
          />
          <BentoStat
            icon={<Hash size={13} />}
            label="Drafts"
            value={stats.drafts}
            tint="orange"
          />
          <BentoStat
            icon={<TrendingUp size={13} />}
            label="Approved"
            value={stats.approved}
            tint="emerald"
          />
          <BentoStat
            icon={<Wallet size={13} />}
            label="Total Pipeline Value"
            value={formatAmount(stats.totalValue)}
            tint="purple"
          />
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Filters */}
        <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] p-3 mb-4 flex items-center justify-between flex-wrap gap-3">
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
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID, title, client"
              className="bg-bg-soft border border-transparent rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:bg-white focus:border-select-blue/30 w-[260px]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState
              isEmpty={items.length === 0}
              onCreate={() => navigate("/boq/new")}
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-bg-soft/60 border-b border-bordergray text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 text-left">BOQ ID</th>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-right">Items</th>
                  <th className="px-4 py-3 text-right">Grand Total</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Updated</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const s = STATUS_STYLES[b.status] || STATUS_STYLES.draft;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/boq/${b.id}`)}
                      className="border-b border-bordergray/60 hover:bg-active-bg/30 cursor-pointer group transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-select-blue tabular-nums">
                          {b.id}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[12.5px] font-semibold text-textcolor">
                          {b.title || "Untitled"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[11.5px] text-text-muted">
                          {b.clientName || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11.5px] font-semibold text-textcolor tabular-nums">
                          {b.itemCount || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[12.5px] font-bold text-textcolor tabular-nums">
                          {formatAmount(b.grandTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${s.bg} ${s.text} ${s.border}`}
                        >
                          {b.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-text-muted">
                          {formatDate(b.updatedAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(e, b.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-text-muted hover:text-textcolor hover:bg-bg-soft"
                            title="Duplicate"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, b.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                          <ChevronRight
                            size={13}
                            className="text-text-subtle ml-1"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const BentoStat = ({ icon, label, value, tint }) => {
  const tints = {
    blue: "from-blue-50 to-white text-blue-600 border-blue-100",
    purple: "from-purple-50 to-white text-purple-600 border-purple-100",
    orange: "from-orange-50 to-white text-orange-600 border-orange-100",
    emerald: "from-emerald-50 to-white text-emerald-600 border-emerald-100",
  };
  return (
    <div
      className={`relative bg-linear-to-br ${tints[tint]} border rounded-xl p-3 overflow-hidden`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="opacity-80">{icon}</span>
        <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </span>
      </div>
      <p className="text-[16px] font-bold text-textcolor tabular-nums leading-tight">
        {value}
      </p>
    </div>
  );
};

const EmptyState = ({ isEmpty, onCreate }) => (
  <div className="text-center py-16 px-6">
    <div className="h-14 w-14 rounded-2xl bg-linear-to-br from-select-blue/10 to-active-bg flex items-center justify-center mx-auto mb-3 border border-bordergray">
      <FileText size={20} className="text-select-blue" />
    </div>
    <p className="text-[14px] font-bold text-textcolor">
      {isEmpty ? "No BOQs yet" : "No matches"}
    </p>
    <p className="text-[12px] text-text-muted mt-1 max-w-sm mx-auto">
      {isEmpty
        ? "Create a detailed Bill of Quantities once you have measurements — it becomes the basis of the signed contract."
        : "Try a different search term or status filter."}
    </p>
    {isEmpty && (
      <button
        type="button"
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all"
      >
        <Plus size={13} /> Create First BOQ
      </button>
    )}
  </div>
);

export default BOQList;
