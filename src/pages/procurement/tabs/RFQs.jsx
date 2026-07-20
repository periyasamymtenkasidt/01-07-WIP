import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { listAllRfqs } from "../../../data/rfqStorage";
import Table from "../../../components/Table";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  sent: "bg-blue-100 text-blue-700",
  quoted: "bg-amber-100 text-amber-700",
  awarded: "bg-purple-100 text-purple-700",
  closed: "bg-emerald-100 text-emerald-700",
};

const StatusBadge = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${STATUS_STYLE[status] || "bg-gray-100 text-gray-500"}`}
  >
    {status}
  </span>
);

// ── Parent table: one row per client ─────────────────────────────────────────

const clientColumns = (onClientClick) => [
  { key: "sno", label: "Sno" },
  {
    key: "clientName",
    label: "Client / Project",
    render: (v) => (
      <span
        className="cursor-pointer hover:underline text-select-blue font-medium"
        onClick={() => onClientClick(v)}
      >
        {v || "—"}
      </span>
    ),
  },
  { key: "rfqCount", label: "RFQs" },
  {
    key: "groupLowest",
    label: "Lowest Quote",
    render: (v) => (v != null ? fmtINR(v) : "—"),
  },
];

// ── Child table: RFQs for a selected client ───────────────────────────────────

const rfqColumns = (navigate) => [
  { key: "sno", label: "Sno" },
  {
    key: "id",
    label: "RFQ",
    render: (v, item) => (
      <span
        className="cursor-pointer hover:underline text-textcolor"
        onClick={(e) => {
          e.stopPropagation();
          navigate(`/procurement/rfq/${item.id}`);
        }}
      >
        {v}
      </span>
    ),
  },
  { key: "itemCount", label: "Items" },
  { key: "vendorCount", label: "Vendors" },
  {
    key: "lowestQuote",
    label: "Lowest Quote",
    render: (v) => (v != null ? fmtINR(v) : "—"),
  },
  {
    key: "status",
    label: "Status",
    render: (v) => <StatusBadge status={v} />,
  },
];

// ── Main component ─────────────────────────────────────────────────────────────

const RFQs = () => {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState(null);

  const rfqs = useMemo(() => listAllRfqs(), []);

  // Group by client for the parent table
  const clientGroups = useMemo(() => {
    const map = new Map();
    rfqs.forEach((r) => {
      const key = r.clientName || "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });

    return Array.from(map.entries()).map(([clientName, items], idx) => {
      const allQuoted = items.flatMap((r) => r.quotes.filter((q) => q.quotedAt));
      const groupLowest =
        allQuoted.length > 0 ? Math.min(...allQuoted.map((q) => q.total)) : null;

      return {
        sno: String(idx + 1).padStart(2, "0"),
        clientName,
        rfqCount: items.length,
        groupLowest,
        uniqueStatuses: [...new Set(items.map((r) => r.status))],
      };
    });
  }, [rfqs]);

  // Enrich RFQs for the child table
  const childRfqs = useMemo(() => {
    if (!selectedClient) return [];
    return rfqs
      .filter((r) => (r.clientName || "—") === selectedClient)
      .map((r, i) => {
        const quoted = r.quotes.filter((q) => q.quotedAt);
        const lowestQuote =
          quoted.length > 0 ? Math.min(...quoted.map((q) => q.total)) : null;
        return {
          ...r,
          sno: String(i + 1).padStart(2, "0"),
          itemCount: r.items?.length || 0,
          vendorCount: r.quotes?.length || 0,
          lowestQuote,
        };
      });
  }, [rfqs, selectedClient]);

  // ── Child view ──
  if (selectedClient) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-3 shrink-0">
          <button
            onClick={() => setSelectedClient(null)}
            className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-primary transition-colors"
          >
            <ChevronLeft size={15} />
            All Clients
          </button>
          <span className="text-text-subtle text-[13px]">/</span>
          <span className="text-[13px] font-semibold text-primary">
            {selectedClient}
          </span>
          <span className="text-[12px] text-text-muted ml-1">
            ({childRfqs.length} RFQ{childRfqs.length === 1 ? "" : "s"})
          </span>
        </div>

        <div className="flex-1 min-h-0">
          <Table
            columns={rfqColumns(navigate)}
            data={childRfqs}
            rowsPerPage={8}
            activeRowKey="id"
            emptyMessage="No RFQs for this client."
            filterFields={[
              {
                key: "status",
                label: "Status",
                options: ["sent", "quoted", "awarded", "closed"],
              },
            ]}
            sortFields={[
              { key: "id", label: "RFQ ID" },
              { key: "itemCount", label: "Items" },
            ]}
            exportConfig={{
              filename: `rfqs_${selectedClient}`,
              columns: [
                { label: "RFQ", key: "id" },
                { label: "Items", key: "itemCount" },
                { label: "Vendors", key: "vendorCount" },
                { label: "Status", key: "status" },
              ],
            }}
          />
        </div>
      </div>
    );
  }

  // ── Parent view ──
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 shrink-0">
        <p className="text-[13px] text-text-muted">
          {clientGroups.length} client{clientGroups.length === 1 ? "" : "s"} ·{" "}
          {rfqs.length} RFQ{rfqs.length === 1 ? "" : "s"} total
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <Table
          columns={clientColumns(setSelectedClient)}
          data={clientGroups}
          rowsPerPage={8}
          activeRowKey="clientName"
          emptyMessage="No RFQs yet. Send one from Take-off or create one here."
          sortFields={[
            { key: "clientName", label: "Client" },
            { key: "rfqCount", label: "RFQ Count" },
          ]}
          exportConfig={{
            filename: "rfqs_by_client",
            columns: [
              { label: "Client", key: "clientName" },
              { label: "RFQs", key: "rfqCount" },
              { label: "Lowest Quote", key: "groupLowest" },
            ],
          }}
        />
      </div>
    </div>
  );
};

export default RFQs;
