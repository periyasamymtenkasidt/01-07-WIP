import { useState, useMemo } from "react";
import { FileBox, Send, ArrowLeft, PackageCheck } from "lucide-react";
import Table from "../../../components/Table";
import { listBoqs, getBoq } from "../../../data/boqStorage";
import { buildTakeoffFromBoq } from "../../../data/procurementStorage";
import { getContractByClient } from "../../../data/contractStorage";
import { listRfqs } from "../../../data/rfqStorage";
import RfqFormModal from "../RfqFormModal";

// Derive procurement status for each material from existing RFQs.
// Returns a map of normalised material name → highest status reached.
const buildMaterialStatusMap = (contractId) => {
  if (!contractId) return {};
  const rfqs = listRfqs(contractId);
  const map = {};
  const RANK = { sent: 1, quoted: 2, awarded: 3, closed: 4 };
  rfqs.forEach((rfq) => {
    rfq.items.forEach((item) => {
      const key = (item.name || "").trim().toLowerCase();
      if (!key) return;
      const cur = RANK[map[key]?.status] || 0;
      const next = RANK[rfq.status] || 0;
      if (next > cur) map[key] = { status: rfq.status, poId: rfq.poId };
    });
  });
  return map;
};

const PROC_BADGE = {
  sent:    { label: "RFQ Sent",       cls: "bg-amber-50 border-amber-200 text-amber-700" },
  quoted:  { label: "Quote Received", cls: "bg-blue-50 border-blue-200 text-blue-700" },
  awarded: { label: "Awarded",        cls: "bg-violet-50 border-violet-200 text-violet-700" },
  closed:  { label: "PO Raised",      cls: "bg-emerald-50 border-emerald-200 text-emerald-700" },
};

// Only BOQs that have been completed and issued for procurement are eligible.
const ELIGIBLE_STATUS = "issued_for_procurement";

const takeoffKey = (t) => `${t.materialId || ""}|${t.name}|${t.spec || ""}`;

// ── BOQ selection table ───────────────────────────────────────────────────────
const BoqTable = ({ boqs, onSelect }) => {
  const columns = useMemo(
    () => [
      { key: "sno", label: "Sno" },
      {
        key: "id",
        label: "BOQ ID",
        render: (v, item) => (
          <span
            className="text-textcolor cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
          >
            {v}
          </span>
        ),
      },
      {
        key: "title",
        label: "Title",
        render: (v, item) => (
          <span
            className="text-textcolor cursor-pointer hover:underline"
            onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
          >
            {v || "Untitled BOQ"}
          </span>
        ),
      },
      { key: "clientName", label: "Client", render: (v) => v || "—" },
      {
        key: "status",
        label: "Status",
        render: () => (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[10.5px] font-medium text-indigo-700">
            <PackageCheck size={11} />
            Issued for Procurement
          </span>
        ),
      },
    ],
    [onSelect],
  );

  return (
    <Table
      columns={columns}
      data={boqs.map((b, i) => ({ ...b, sno: String(i + 1).padStart(2, "0") }))}
      rowsPerPage={8}
      activeRowKey="id"
      emptyMessage={
        <div className="flex flex-col items-center gap-3">
          <PackageCheck size={32} className="text-text-subtle opacity-50" />
          <p className="text-[13px] font-semibold text-text-muted">
            No BOQs issued for procurement yet
          </p>
          <p className="text-[12px] text-text-subtle max-w-xs">
            A BOQ must be completed and issued for procurement from the BOQ
            editor before it appears here.
          </p>
        </div>
      }
    />
  );
};

// ── Take-off view ─────────────────────────────────────────────────────────────
const TakeoffView = ({ boqId, boq, onBack }) => {
  const takeoff = useMemo(() => (boq ? buildTakeoffFromBoq(boq) : []), [boq]);
  const [rfqModal, setRfqModal] = useState(false);
  const [deselected, setDeselected] = useState(() => new Set());
  const [seededFor, setSeededFor] = useState(boqId);
  const [statusMap, setStatusMap] = useState(() =>
    buildMaterialStatusMap(getContractByClient(boq?.client?.id)?.id || "")
  );

  if (boqId !== seededFor) {
    setSeededFor(boqId);
    setDeselected(new Set());
  }

  const toggleOne = (t) =>
    setDeselected((prev) => {
      const next = new Set(prev);
      const k = takeoffKey(t);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const allSelected = takeoff.length > 0 && deselected.size === 0;
  const toggleAll = () =>
    setDeselected(allSelected ? new Set(takeoff.map(takeoffKey)) : new Set());

  const selectedTakeoff = takeoff.filter((t) => !deselected.has(takeoffKey(t)));

  const contractId = useMemo(() => {
    const cid = boq?.client?.id;
    return cid ? getContractByClient(cid)?.id || boqId : boqId;
  }, [boq, boqId]);

  const rfqLines = selectedTakeoff.map((t) => ({
    name: t.name,
    spec: t.spec,
    qty: Math.round(t.estimatedQty) || 1,
    unit: t.unit,
    materialId: t.materialId,
  }));

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span className="text-text-subtle">|</span>
          <div>
            <p className="text-[13px] font-bold text-textcolor leading-tight">
              {boq?.title || "Untitled BOQ"}
            </p>
            {boq?.client?.name && (
              <p className="text-[11px] text-text-muted">{boq.client.name}</p>
            )}
          </div>
        </div>

        {takeoff.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted">
              {selectedTakeoff.length} of {takeoff.length} selected
            </span>
            <button
              disabled={selectedTakeoff.length === 0}
              onClick={() => setRfqModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-select-blue text-select-blue text-[12px] font-semibold hover:bg-select-blue/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send RFQ <Send size={13} />
            </button>
          </div>
        )}
      </div>

      {takeoff.length === 0 ? (
        <div className="text-center py-12 text-text-subtle">
          <FileBox size={24} className="mx-auto mb-2 opacity-50" />
          This BOQ has no materials attached to its line items yet.
        </div>
      ) : (
        <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5"
                    title="Select all"
                  />
                </th>
                <th className="text-left font-bold px-4 py-3">Material</th>
                <th className="text-left font-bold px-4 py-3">Spec</th>
                <th className="text-right font-bold px-4 py-3">Est. Qty</th>
                <th className="text-left font-bold px-4 py-3">Unit</th>
                <th className="text-left font-bold px-4 py-3">Used in</th>
                <th className="text-left font-bold px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {takeoff.map((t, i) => {
                const checked = !deselected.has(takeoffKey(t));
                const matKey = (t.name || "").trim().toLowerCase();
                const procStatus = statusMap[matKey];
                const badge = procStatus ? PROC_BADGE[procStatus.status] : null;
                return (
                  <tr
                    key={i}
                    onClick={() => toggleOne(t)}
                    className={`border-t border-bordergray hover:bg-bg-soft/40 cursor-pointer ${checked ? "" : "opacity-50"}`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(t)}
                        className="h-3.5 w-3.5"
                      />
                    </td>
                    <td className="px-4 py-3 text-textcolor">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{t.spec || "—"}</td>
                    <td className="px-4 py-3 text-right text-textcolor">
                      {Math.round(t.estimatedQty).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{t.unit}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {t.usedIn.join(", ") || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {badge ? (
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <RfqFormModal
        open={rfqModal}
        onClose={() => {
          setRfqModal(false);
          setStatusMap(buildMaterialStatusMap(contractId));
        }}
        initialLines={rfqLines}
        initialContractId={contractId}
        initialClientName={boq?.client?.name || ""}
      />
    </>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const Takeoff = () => {
  const eligibleBoqs = useMemo(
    () => listBoqs().filter((b) => b.status === ELIGIBLE_STATUS),
    [],
  );
  const [boqId, setBoqId] = useState(null);
  const boq = useMemo(() => (boqId ? getBoq(boqId) : null), [boqId]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {boqId && boq ? (
        <div className="h-full overflow-y-auto p-6">
          <TakeoffView boqId={boqId} boq={boq} onBack={() => setBoqId(null)} />
        </div>
      ) : (
        <>
          <div className="px-6 pt-4 pb-2 shrink-0">
            <h2 className="text-[13px] font-bold text-textcolor">
              Select a BOQ
            </h2>
            <p className="text-[11.5px] text-text-muted mt-0.5">
              Only BOQs issued for procurement are listed below.
            </p>
          </div>
          <div className="flex-1 min-h-0">
            <BoqTable boqs={eligibleBoqs} onSelect={setBoqId} />
          </div>
        </>
      )}
    </div>
  );
};

export default Takeoff;
