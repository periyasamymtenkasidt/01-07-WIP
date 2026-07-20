import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { listContracts } from "../../data/contractStorage";
import { listVendors } from "../../data/vendorStorage";
import { createRfq } from "../../data/rfqStorage";
import NumericInput from "../../components/NumericInput";

// Shared "send RFQ" modal, used by the RFQs tab (blank) and the Take-off tab
// (pre-filled with BOQ material lines + the linked contract). Mirrors
// PoFormModal's dual-use shape, but lines carry no rate (that's what's being
// asked for) and vendor selection invites several suppliers, not just one.

const blankLine = () => ({ name: "", qty: 1, unit: "nos" });

const RfqFormModal = ({
  open,
  onClose,
  onSaved,
  initialLines = null,
  initialContractId = "",
  initialClientName = "",
}) => {
  const contracts = listContracts();
  const vendors = listVendors();

  const [contractId, setContractId] = useState(initialContractId || "");
  const [vendorIds, setVendorIds] = useState([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [lines, setLines] = useState(
    initialLines?.length ? initialLines : [blankLine()],
  );

  // Re-seed when opened with new take-off lines / contract.
  useEffect(() => {
    if (!open) return;
    setContractId(initialContractId || "");
    setVendorIds([]);
    setShowVendorModal(false);
    setExpectedDeliveryDate("");
    setLines(
      initialLines?.length
        ? initialLines.map((l) => ({ ...l }))
        : [blankLine()],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const today = new Date().toISOString().split("T")[0];

  const toggleVendor = (id) =>
    setVendorIds((ids) =>
      ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id],
    );

  const dateValid = !!expectedDeliveryDate && expectedDeliveryDate >= today;

  const canSave =
    contractId &&
    vendorIds.length > 0 &&
    lines.some((l) => l.name) &&
    dateValid;

  const save = () => {
    if (!canSave) return;
    createRfq(contractId, {
      vendorIds,
      expectedDeliveryDate,
      clientName: (() => {
        const c = contracts.find((ct) => ct.id === contractId);
        return c?.clientName || initialClientName || "";
      })(),
      items: lines
        .filter((l) => l.name)
        .map((l) => ({
          name: l.name,
          spec: l.spec || "",
          qty: Number(l.qty) || 0,
          unit: l.unit || "nos",
          materialId: l.materialId || null,
        })),
    });
    onSaved?.();
    onClose?.();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-bordergray">
            <h3 className="text-[15px] font-bold text-textcolor">Send RFQ</h3>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-textcolor"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4">
            <div>
              <span className="text-[12px] font-semibold text-text-muted block">Client Name</span>
              <div className="mt-1 w-full border border-bordergray bg-bg-soft rounded-lg px-3 py-2 text-[13px] text-text-muted select-none cursor-default">
                {(() => {
                  const c = contracts.find((c) => c.id === contractId);
                  if (c) return `${c.clientName} · ${c.id}`;
                  if (initialClientName) return initialClientName;
                  return "—";
                })()}
              </div>
            </div>

            <div>
              <span className="text-[12px] font-semibold text-text-muted block">
                Expected Delivery Date{" "}
                <span className="text-red-500">*</span>
              </span>
              <input
                type="date"
                min={today}
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className={`mt-1 w-full border rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white ${
                  dateValid
                    ? "border-bordergray"
                    : "border-red-300 bg-red-50"
                }`}
              />
              {!expectedDeliveryDate && (
                <p className="mt-1 text-[11px] text-red-500">
                  Required — specify when materials are needed.
                </p>
              )}
              {expectedDeliveryDate && !dateValid && (
                <p className="mt-1 text-[11px] text-red-500">
                  Delivery date cannot be in the past.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-text-subtle">
                  Invited Vendors
                </p>
                <button
                  type="button"
                  onClick={() => setShowVendorModal(true)}
                  className="px-3 py-1.5 bg-select-blue/10 hover:bg-select-blue/20 text-select-blue rounded-lg text-[12px] font-semibold flex items-center gap-1.5 border border-select-blue/20 transition-colors"
                >
                  <Plus size={13} /> Choose Vendors
                </button>
              </div>

              {vendorIds.length === 0 ? (
                <p className="text-[12px] text-text-subtle italic py-2">
                  No vendors selected yet. Click "Choose Vendors" to add.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 p-3 bg-bg-soft border border-bordergray rounded-lg">
                  {vendorIds.map((id) => {
                    const v = vendors.find((vendor) => vendor.id === id);
                    if (!v) return null;
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-bordergray rounded-lg text-[12px] text-textcolor font-medium shadow-2xs"
                      >
                        {v.name}
                        <button
                          type="button"
                          onClick={() => toggleVendor(id)}
                          className="text-text-subtle hover:text-red-500 rounded p-0.5"
                          title="Remove vendor"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold uppercase tracking-wider text-text-subtle">
                  Line items
                </p>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      placeholder="Material"
                      value={l.name}
                      readOnly
                      className="flex-1 border border-bordergray bg-bg-soft rounded-lg px-2.5 py-1.5 text-[13px] text-text-muted select-none cursor-default"
                    />
                    <NumericInput
                      placeholder="Qty"
                      value={l.qty}
                      readOnly
                      className="w-20 border border-bordergray bg-bg-soft rounded-lg px-2 py-1.5 text-[13px] text-text-muted select-none cursor-default text-right"
                    />
                    <input
                      placeholder="Unit"
                      value={l.unit}
                      readOnly
                      className="w-20 border border-bordergray bg-bg-soft rounded-lg px-2 py-1.5 text-[13px] text-text-muted select-none cursor-default"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-bordergray">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:bg-bg-soft"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!canSave}
              className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40"
            >
              Send RFQ
            </button>
          </div>
        </div>
      </div>

      <VendorSelectionModal
        open={showVendorModal}
        onClose={() => setShowVendorModal(false)}
        vendors={vendors}
        selectedIds={vendorIds}
        onToggle={toggleVendor}
      />
    </>
  );
};

const VendorSelectionModal = ({
  open,
  onClose,
  vendors,
  selectedIds,
  onToggle,
}) => {
  const [search, setSearch] = useState("");

  if (!open) return null;

  const filtered = vendors.filter((v) => {
    const query = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(query) ||
      (v.category && v.category.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl border border-bordergray">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bordergray">
          <div>
            <h4 className="text-[14px] font-bold text-textcolor">
              Choose Vendors
            </h4>
            <p className="text-[11px] text-text-muted mt-0.5">
              Select one or more vendors to receive this RFQ
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-textcolor p-1 hover:bg-bg-soft rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-bordergray bg-bg-soft/40">
          <input
            type="text"
            placeholder="Search by vendor name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-bordergray rounded-lg px-3 py-1.5 text-[13px] focus:outline-none focus:border-select-blue bg-white"
          />
        </div>

        {/* Vendor List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2">
          {filtered.map((v) => {
            const isSelected = selectedIds.includes(v.id);
            return (
              <div
                key={v.id}
                onClick={() => onToggle(v.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? "bg-select-blue/5 border-select-blue shadow-xs"
                    : "bg-white border-bordergray hover:border-text-subtle/50"
                }`}
              >
                <div className="flex-1 min-w-0 pr-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-textcolor truncate">
                      {v.name}
                    </p>
                    {v.category && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-sm bg-bg-soft text-text-subtle text-[9px] font-bold uppercase tracking-wider border border-bordergray">
                        {v.category}
                      </span>
                    )}
                  </div>
                  {v.contactPerson && (
                    <p className="text-[11px] text-text-muted mt-0.5 truncate">
                      {v.contactPerson} {v.phone && `· ${v.phone}`}
                    </p>
                  )}
                </div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected
                      ? "bg-select-blue border-select-blue text-white"
                      : "border-bordergray"
                  }`}
                >
                  {isSelected && (
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[12px] text-text-subtle italic">
                {vendors.length === 0
                  ? "No vendors found. Please add vendors in the Vendors tab."
                  : "No vendors match your search."}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-bordergray bg-bg-soft/40">
          <p className="text-[11.5px] text-text-muted">
            <span className="font-bold text-textcolor tabular-nums">
              {selectedIds.length}
            </span>{" "}
            selected
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-select-blue text-white text-[12px] font-semibold rounded-lg hover:bg-blue-950 transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default RfqFormModal;