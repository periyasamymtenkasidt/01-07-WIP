import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Trash2,
  Users,
  Package,
  Send,
  AlertTriangle,
  Info,
} from "lucide-react";
import {
  getVendor,
  updateVendor,
  deleteVendor,
} from "../../data/vendorStorage";

import { listAllRfqs } from "../../data/rfqStorage";
import { listAllPurchaseOrders } from "../../data/procurementStorage";
import InputField from "../../components/InputField";

const fmtINR = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;


const Field = ({ label, value }) => (
  <div>
    <p className="text-[9.5px] font-bold text-text-subtle uppercase tracking-wider">{label}</p>
    <p className="text-[13px] text-textcolor mt-0.5">{value || "—"}</p>
  </div>
);

const PO_STATUS_STYLE = {
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
};
const RFQ_STATUS_STYLE = {
  sent: "bg-blue-100 text-blue-700",
  quoted: "bg-amber-100 text-amber-700",
  awarded: "bg-purple-100 text-purple-700",
  closed: "bg-emerald-100 text-emerald-700",
};

// Full vendor profile — replaces "see everything only inside the edit modal".
// Adds the contract/SLA terms and the materials-supplied catalog link the
// vendor master was missing, plus a read-only history of every RFQ this
// vendor was invited to and every PO raised against them.
const VendorProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  // version bumps force a localStorage re-read after save/delete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const vendor = useMemo(() => getVendor(id), [id, version]);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const startEdit = () => {
    setForm({ ...vendor });
    setEditing(true);
  };
  const cancelEdit = () => {
    setForm(null);
    setEditing(false);
  };
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));



  const save = () => {
    if (!form.name) return;
    updateVendor(id, {
      ...form,
      creditDays: Number(form.creditDays) || 0,
      deliveryLeadDays: Number(form.deliveryLeadDays) || 0,
    });
    setVersion((v) => v + 1);
    setEditing(false);
    setForm(null);
  };

  const remove = () => {
    setShowDeleteConfirm(true);
  };

  // version bumps force a localStorage re-read after this vendor's RFQs/POs change.
  const rfqHistory = useMemo(
    () => listAllRfqs().filter((r) => r.quotes.some((q) => q.vendorId === id)),
    [id, version], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const poHistory = useMemo(
    () => listAllPurchaseOrders().filter((p) => p.vendorId === id),
    [id, version], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const stats = useMemo(() => {
    const invited = rfqHistory.length;
    const quoted = rfqHistory.filter((r) => r.quotes.find((q) => q.vendorId === id)?.quotedAt).length;
    const awarded = rfqHistory.filter((r) => r.awardedVendorId === id).length;
    const poValue = poHistory.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return { invited, quoted, awarded, poCount: poHistory.length, poValue };
  }, [rfqHistory, poHistory, id]);

  if (!vendor) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-text-subtle gap-3">
        <Users size={28} className="opacity-40" />
        <p className="text-[13px]">Vendor not found.</p>
        <button
          onClick={() => navigate("/procurement?tab=vendors")}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <ArrowLeft size={13} /> Back to Vendors
        </button>
      </div>
    );
  }

  const v = editing ? form : vendor;

  return (
    <div className="h-full overflow-y-auto p-6">
      <button
        onClick={() => navigate("/procurement?tab=vendors")}
        className="flex items-center gap-1.5 text-[12px] font-semibold text-text-muted hover:text-textcolor mb-4"
      >
        <ArrowLeft size={14} /> Back to Vendors
      </button>

      {/* Header */}
      <div className="bg-white border border-bordergray rounded-2xl p-5 mb-5 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-[17px] font-bold text-textcolor">{vendor.name}</h1>
          </div>
          <p className="text-[12px] text-text-muted">
            {vendor.category || "Uncategorized"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
              >
                <X size={13} /> Cancel
              </button>
              <button
                onClick={save}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
              >
                <Save size={13} /> Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={remove}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-200 text-red-500 text-[12px] font-semibold hover:bg-red-50"
              >
                <Trash2 size={13} /> Delete
              </button>
              <button
                onClick={startEdit}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
              >
                <Edit3 size={13} /> Edit Profile
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-bordergray rounded-xl p-3">
          <p className="text-[9.5px] font-bold text-text-subtle uppercase tracking-wider">RFQs Invited</p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">{stats.invited}</p>
        </div>
        <div className="bg-white border border-bordergray rounded-xl p-3">
          <p className="text-[9.5px] font-bold text-text-subtle uppercase tracking-wider">RFQs Awarded</p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">{stats.awarded}</p>
        </div>
        <div className="bg-white border border-bordergray rounded-xl p-3">
          <p className="text-[9.5px] font-bold text-text-subtle uppercase tracking-wider">Purchase Orders</p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">{stats.poCount}</p>
        </div>
        <div className="bg-white border border-bordergray rounded-xl p-3">
          <p className="text-[9.5px] font-bold text-text-subtle uppercase tracking-wider">Total PO Value</p>
          <p className="text-[16px] font-bold text-textcolor tabular-nums">{fmtINR(stats.poValue)}</p>
        </div>
      </div>

      {/* Contact, Compliance & Banking */}
      <div className="bg-white border border-bordergray rounded-2xl p-5">
        <h3 className="text-[12.5px] font-bold text-textcolor uppercase tracking-wider mb-4">
          Contact, Compliance &amp; Banking
        </h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Vendor Name" value={v.name} onChange={(e) => set({ name: e.target.value })} required />
                <InputField label="Category" value={v.category} onChange={(e) => set({ category: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Phone" value={v.phone} onChange={(e) => set({ phone: e.target.value })} />
                <InputField type="email" label="Email" value={v.email} onChange={(e) => set({ email: e.target.value })} />
              </div>
              <InputField label="GSTIN" value={v.gstin} onChange={(e) => set({ gstin: e.target.value })} />
              <InputField label="PAN" value={v.pan} onChange={(e) => set({ pan: e.target.value })} />
              <InputField label="Address" value={v.address} onChange={(e) => set({ address: e.target.value })} />

            </div>

            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-2 border-b border-bordergray pb-1">
                Banking Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Bank Name" value={v.bankName} onChange={(e) => set({ bankName: e.target.value })} />
                <InputField label="Account Holder" value={v.bankAccountHolder} onChange={(e) => set({ bankAccountHolder: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Account Number" value={v.bankAccountNumber} onChange={(e) => set({ bankAccountNumber: e.target.value })} />
                <InputField label="IFSC Code" value={v.bankIfsc} onChange={(e) => set({ bankIfsc: e.target.value })} />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone" value={vendor.phone} />
              <Field label="Email" value={vendor.email} />
              <Field label="GSTIN" value={vendor.gstin} />
              <Field label="PAN" value={vendor.pan} />
              <div className="col-span-2">
                <Field label="Address" value={vendor.address} />
              </div>
              {vendor.accessCode && (
                <div className="col-span-2 flex items-center justify-between gap-4 px-4 py-3 bg-select-blue/5 border border-select-blue/20 rounded-xl">
                  <div>
                    <p className="text-[9.5px] font-bold text-text-subtle uppercase tracking-wider">Quote Access Code</p>
                    <p className="font-mono text-[18px] font-bold text-select-blue tracking-widest mt-0.5">{vendor.accessCode}</p>
                  </div>
                  <p className="text-[10.5px] text-text-muted leading-relaxed max-w-[200px] text-right">
                    Share once with the vendor. They use this code to identify themselves on all quote requests.
                  </p>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-[11px] font-bold text-text-subtle uppercase tracking-wider mb-3 border-b border-bordergray pb-1">
                Banking Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank Name" value={vendor.bankName} />
                <Field label="Account Holder" value={vendor.bankAccountHolder} />
                <Field label="Account Number" value={vendor.bankAccountNumber} />
                <Field label="IFSC Code" value={vendor.bankIfsc} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        <div className="bg-white border border-bordergray rounded-2xl p-5">
          <h3 className="text-[12.5px] font-bold text-textcolor uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Send size={13} /> RFQ History
          </h3>
          {rfqHistory.length === 0 ? (
            <p className="text-[12px] text-text-subtle">Not invited to any RFQs yet.</p>
          ) : (
            <div className="space-y-2">
              {rfqHistory.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/procurement/rfq/${r.id}`)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-bordergray hover:bg-bg-soft/40 text-left"
                >
                  <span>
                    <span className="text-[12.5px] font-semibold text-textcolor">{r.id}</span>
                    <span className="block text-[10.5px] text-text-muted">{r.clientName || "—"}</span>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${RFQ_STATUS_STYLE[r.status] || "bg-gray-100 text-gray-500"}`}
                  >
                    {r.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-bordergray rounded-2xl p-5">
          <h3 className="text-[12.5px] font-bold text-textcolor uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Package size={13} /> Purchase Order History
          </h3>
          {poHistory.length === 0 ? (
            <p className="text-[12px] text-text-subtle">No purchase orders placed yet.</p>
          ) : (
            <div className="space-y-2">
              {poHistory.map((p) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/procurement/po/${p.id}`)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-bordergray hover:bg-bg-soft/40 text-left"
                >
                  <span>
                    <span className="text-[12.5px] font-semibold text-textcolor">{p.id}</span>
                    <span className="block text-[10.5px] text-text-muted">{p.clientName || "—"}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-textcolor">{fmtINR(p.total)}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PO_STATUS_STYLE[p.status] || "bg-gray-100 text-gray-500"}`}
                    >
                      {String(p.status).replace(/_/g, " ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={`Delete "${vendor?.name || "Vendor"}"?`}
          message="Are you sure you want to delete this vendor? This cannot be undone."
          confirmLabel="Delete Vendor"
          danger={true}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={() => {
            deleteVendor(id);
            setShowDeleteConfirm(false);
            navigate("/procurement?tab=vendors");
          }}
        />
      )}
    </div>
  );
};

const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onCancel}
  >
    <div
      className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-5 flex items-start gap-3">
        <span
          className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
            danger
              ? "bg-red-50 text-red-500"
              : "bg-select-blue/10 text-select-blue"
          }`}
        >
          {danger ? <AlertTriangle size={18} /> : <Info size={18} />}
        </span>
        <div>
          <h3 className="text-[14px] font-bold text-textcolor">{title}</h3>
          <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      <div className="px-5 py-3 bg-bg-soft border-t border-bordergray flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg border border-bordergray bg-white text-[12px] font-semibold text-text-muted hover:text-textcolor"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          autoFocus
          className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white shadow-sm ${
            danger
              ? "bg-red-500 hover:bg-red-600"
              : "bg-select-blue hover:bg-primary"
          }`}
        >
          {confirmLabel || "Confirm"}
        </button>
      </div>
    </div>
  </div>
);

export default VendorProfile;