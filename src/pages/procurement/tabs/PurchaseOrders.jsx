import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { listAllPurchaseOrders } from "../../../data/procurementStorage";
import Table from "../../../components/Table";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE = {
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};

const FILTERS = [
  { id: "active", label: "Active", test: (p) => p.status !== "received" },
  { id: "received", label: "Received", test: (p) => p.status === "received" },
  { id: "all", label: "All", test: () => true },
];

const PurchaseOrders = () => {
  const navigate = useNavigate();

  const columns = [
    { key: "sno", label: "Sno" },
    {
      key: "id",
      label: "PO",
      render: (v, item) => (
        <span
          className="cursor-pointer hover:underline text-textcolor"
          onClick={(e) => { e.stopPropagation(); navigate(`/procurement/po/${item.id}`); }}
        >
          {v}
        </span>
      ),
    },
    {
      key: "clientName",
      label: "Project",
      render: (v, item) => (
        <span
          className="cursor-pointer hover:underline"
          onClick={(e) => { e.stopPropagation(); navigate(`/procurement/po/${item.id}`); }}
        >
          {v || "—"}
        </span>
      ),
    },
    { key: "vendorName", label: "Vendor", render: (v) => v || "—" },
    { key: "itemCount", label: "Items" },
    { key: "total", label: "Total", render: (v) => fmtINR(v) },
    {
      key: "status",
      label: "Status",
      render: (v) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${STATUS_STYLE[v] || "bg-gray-100 text-gray-500"}`}
        >
          {String(v).replace(/_/g, " ")}
        </span>
      ),
    },
  ];
  const [version] = useState(0);
  const [filter, setFilter] = useState("active");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pos = useMemo(() => listAllPurchaseOrders(), [version]);

  const activeCount = useMemo(
    () => pos.filter(FILTERS[0].test).length,
    [pos],
  );

  const filtered = useMemo(
    () => pos.filter(FILTERS.find((f) => f.id === filter).test),
    [pos, filter],
  );

  const totalValue = useMemo(
    () => filtered.reduce((s, p) => s + (Number(p.total) || 0), 0),
    [filtered],
  );

  const data = useMemo(
    () =>
      filtered.map((p, i) => ({
        ...p,
        sno: String(i + 1).padStart(2, "0"),
        itemCount: p.items?.length || 0,
      })),
    [filtered],
  );

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-[11.5px] font-semibold transition-all ${
                filter === f.id
                  ? "bg-active-bg text-select-blue"
                  : "text-text-muted hover:text-textcolor"
              }`}
            >
              {f.label}
              {f.id === "active" && activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-text-muted">
          {filtered.length} PO{filtered.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-textcolor">
            {fmtINR(totalValue)}
          </span>
        </p>
      </div>

      <div className="flex-1 min-h-0">
        <Table
          columns={columns}
          data={data}
          rowsPerPage={8}
          activeRowKey="id"
          emptyMessage="No purchase orders in this view."
          sortFields={[
            { key: "id", label: "PO ID" },
            { key: "clientName", label: "Project" },
            { key: "vendorName", label: "Vendor" },
            { key: "total", label: "Total" },
          ]}
          exportConfig={{
            filename: "purchase_orders_export",
            columns: [
              { label: "PO", key: "id" },
              { label: "Project", key: "clientName" },
              { label: "Vendor", key: "vendorName" },
              { label: "Items", key: "itemCount" },
              { label: "Total", key: "total" },
              { label: "Status", key: "status" },
            ],
          }}
        />
      </div>
    </div>
  );
};

export default PurchaseOrders;
