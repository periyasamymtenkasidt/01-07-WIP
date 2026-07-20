import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Search, AlertTriangle, Info } from "lucide-react";
import { listVendors, addVendor, deleteVendor } from "../../../data/vendorStorage";
import InputField from "../../../components/InputField";
import Table from "../../../components/Table";

const blank = {
  name: "",
  category: "",
  email: "",
  phone: "",
  gstin: "",
  pan: "",
  address: "",
  bankName: "",
  bankAccountHolder: "",
  bankAccountNumber: "",
  bankIfsc: "",
};

const Vendors = () => {
  const navigate = useNavigate();

  const columns = [
    { key: "sno", label: "Sno" },
    {
      key: "name",
      label: "Vendor",
      render: (v, item) => (
        <span
          className="cursor-pointer hover:underline text-textcolor"
          onClick={(e) => { e.stopPropagation(); navigate(`/procurement/vendors/${item.id}`); }}
        >
          {v}
        </span>
      ),
    },
    { key: "category", label: "Category", render: (v) => v || "—" },
    { key: "gstin", label: "GSTIN", render: (v) => v || "—" },
    { key: "phone", label: "Phone", render: (v) => v || "—" },
    { key: "address", label: "Address", render: (v) => v || "—" },
  ];
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => listVendors(), [version]);

  const [creating, setCreating] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const base = q
      ? list.filter(
          (v) =>
            (v.name || "").toLowerCase().includes(q) ||
            (v.category || "").toLowerCase().includes(q) ||
            (v.phone || "").toLowerCase().includes(q),
        )
      : list;
    return base.map((v, i) => ({ ...v, sno: String(i + 1).padStart(2, "0") }));
  }, [list, searchQuery]);

  const handleSave = (e) => {
    e.preventDefault();
    if (!creating.name) return;
    addVendor(creating);
    refresh();
    setCreating(null);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-[13px] text-text-muted">
            {searchQuery
              ? `${filteredList.length} match${filteredList.length === 1 ? "" : "es"} of `
              : ""}
            {list.length} vendor{list.length === 1 ? "" : "s"}
          </p>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendors..."
              className="bg-white border border-bordergray rounded-lg pl-7 pr-3 py-1.5 text-[11.5px] placeholder:text-text-subtle focus:outline-none focus:border-select-blue/40 w-[200px]"
            />
          </div>
        </div>
        <button
          onClick={() => setCreating({ ...blank })}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <Plus size={14} /> Add Vendor
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Table
          columns={columns}
          data={filteredList}
          rowsPerPage={8}
          activeRowKey="id"
          emptyMessage="No vendors found."
        />
      </div>

      {/* Add Vendor Modal */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col"
          >
            <div className="px-5 py-4 border-b border-bordergray flex items-center justify-between bg-bg-soft">
              <h3 className="text-[13px] font-extrabold text-textcolor uppercase tracking-wide">
                Add Vendor
              </h3>
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="h-6 w-6 flex items-center justify-center rounded-full text-text-muted hover:bg-bordergray hover:text-textcolor transition-all"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[70vh] grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-text-subtle uppercase tracking-wider border-b border-bordergray pb-1">
                  Contact &amp; Basic Details
                </h4>
                <InputField label="Vendor Name" value={creating.name} onChange={(e) => setCreating((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Greenply Distributors" required />
                <InputField label="Category" value={creating.category} onChange={(e) => setCreating((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Plywood & Laminates" required />
                <InputField label="Phone" value={creating.phone} onChange={(e) => setCreating((p) => ({ ...p, phone: e.target.value }))} placeholder="e.g. 98450 11223" required />
                <InputField type="email" label="Email" value={creating.email} onChange={(e) => setCreating((p) => ({ ...p, email: e.target.value }))} placeholder="e.g. accounts@vendor.com" />
                <InputField label="Address" value={creating.address || ""} onChange={(e) => setCreating((p) => ({ ...p, address: e.target.value }))} placeholder="e.g. Peenya, Bengaluru" required />
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-bold text-text-subtle uppercase tracking-wider border-b border-bordergray pb-1">
                  Compliance &amp; Banking
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="GSTIN" value={creating.gstin || ""} onChange={(e) => setCreating((p) => ({ ...p, gstin: e.target.value }))} placeholder="e.g. 29ABCDE1234F1Z5" />
                  <InputField label="PAN" value={creating.pan || ""} onChange={(e) => setCreating((p) => ({ ...p, pan: e.target.value }))} placeholder="e.g. ABCDE1234F" />
                </div>
                <div className="space-y-3 pt-2">
                  <h5 className="text-[10px] font-bold text-textcolor uppercase tracking-wide">Bank Account Info</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Bank Name" value={creating.bankName || ""} onChange={(e) => setCreating((p) => ({ ...p, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" required />
                    <InputField label="Account Holder" value={creating.bankAccountHolder || ""} onChange={(e) => setCreating((p) => ({ ...p, bankAccountHolder: e.target.value }))} placeholder="e.g. Greenply Distributors" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Account Number" value={creating.bankAccountNumber || ""} onChange={(e) => setCreating((p) => ({ ...p, bankAccountNumber: e.target.value }))} placeholder="e.g. 50100..." required />
                    <InputField label="IFSC Code" value={creating.bankIfsc || ""} onChange={(e) => setCreating((p) => ({ ...p, bankIfsc: e.target.value }))} placeholder="e.g. HDFC0001234" required />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-bordergray bg-bg-soft flex items-center justify-end gap-2">
              <button type="button" onClick={() => setCreating(null)} className="px-4 py-2 border border-bordergray bg-white rounded-lg text-[12px] font-semibold text-text-muted hover:text-textcolor">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all">Add Vendor</button>
            </div>
          </form>
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete Vendor?"
          message="Are you sure you want to delete this vendor? This cannot be undone."
          confirmLabel="Delete Vendor"
          danger
          onCancel={() => setConfirmDeleteId(null)}
          onConfirm={() => { deleteVendor(confirmDeleteId); setConfirmDeleteId(null); refresh(); }}
        />
      )}
    </div>
  );
};

const ConfirmDialog = ({ title, message, confirmLabel, danger, onCancel, onConfirm }) => (
  <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="p-5 flex items-start gap-3">
        <span className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${danger ? "bg-red-50 text-red-500" : "bg-select-blue/10 text-select-blue"}`}>
          {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-textcolor">{title}</h3>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">{message}</p>
        </div>
      </div>
      <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor">Cancel</button>
        <button type="button" onClick={onConfirm} autoFocus className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm ${danger ? "bg-red-500 hover:bg-red-600" : "bg-select-blue hover:bg-primary"}`}>{confirmLabel || "Confirm"}</button>
      </div>
    </div>
  </div>
);

export default Vendors;
