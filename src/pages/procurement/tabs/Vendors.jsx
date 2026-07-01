import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2, X, Users, ShieldCheck } from "lucide-react";
import { listVendors, addVendor, deleteVendor } from "../../../data/vendorStorage";
import InputField from "../../../components/InputField";

const blank = {
  name: "",
  category: "",
  contactPerson: "",
  email: "",
  phone: "",
};

// List + quick-create only. Full detail, editing, contract/SLA terms,
// materials-supplied catalog and RFQ/PO history all live on the vendor
// profile page (VendorProfile.jsx), reached by clicking a row.
const Vendors = () => {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  // version bumps force a localStorage re-read after add/delete.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const list = useMemo(() => listVendors(), [version]);

  const [creating, setCreating] = useState(null);

  const handleSave = (e) => {
    e.preventDefault();
    if (!creating.name) return;
    addVendor(creating);
    refresh();
    setCreating(null);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (!window.confirm("Delete this vendor? This cannot be undone.")) return;
    deleteVendor(id);
    refresh();
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] text-text-muted">
          {list.length} vendor{list.length === 1 ? "" : "s"}
        </p>
        <button
          onClick={() => setCreating({ ...blank })}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-select-blue text-white text-[12px] font-semibold hover:bg-blue-950"
        >
          <Plus size={14} /> Add Vendor
        </button>
      </div>

      <div className="bg-white border border-bordergray rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-soft text-text-muted text-[11px] uppercase tracking-wider">
              <th className="text-left font-bold px-4 py-3">Vendor</th>
              <th className="text-left font-bold px-4 py-3">Category</th>
              <th className="text-left font-bold px-4 py-3">GSTIN</th>
              <th className="text-left font-bold px-4 py-3">Phone</th>
              <th className="text-left font-bold px-4 py-3">Terms</th>
              <th className="text-right font-bold px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-subtle">
                  <Users size={20} className="mx-auto mb-2 opacity-50" />
                  No vendors yet.
                </td>
              </tr>
            ) : (
              list.map((v) => (
                <tr
                  key={v.id}
                  onClick={() => navigate(`/procurement/vendors/${v.id}`)}
                  className="border-t border-bordergray hover:bg-bg-soft/40 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold text-textcolor">{v.name}</div>
                    {v.contactPerson && (
                      <div className="text-[11px] text-text-muted">{v.contactPerson}</div>
                    )}
                    {v.msmeRegistered && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                        <ShieldCheck size={10} /> MSME {v.msmeCategory || ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{v.category || "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{v.gstin || "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{v.phone || "—"}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {v.creditDays ? `Net ${v.creditDays}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={(e) => handleDelete(e, v.id)}
                      className="text-text-muted hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Add — full profile (contract/SLA, materials supplied, etc.) is
          filled in afterwards on the vendor's own profile page. */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
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

            <div className="p-5 space-y-4">
              <InputField
                label="Vendor Name"
                value={creating.name}
                onChange={(e) => setCreating((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Greenply Distributors"
                required
              />
              <InputField
                label="Category"
                value={creating.category}
                onChange={(e) => setCreating((p) => ({ ...p, category: e.target.value }))}
                placeholder="e.g. Plywood & Laminates"
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Contact Person"
                  value={creating.contactPerson}
                  onChange={(e) => setCreating((p) => ({ ...p, contactPerson: e.target.value }))}
                  placeholder="e.g. Ravi Kumar"
                />
                <InputField
                  label="Phone"
                  value={creating.phone}
                  onChange={(e) => setCreating((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. 98450 11223"
                />
              </div>
              <InputField
                type="email"
                label="Email"
                value={creating.email}
                onChange={(e) => setCreating((p) => ({ ...p, email: e.target.value }))}
                placeholder="e.g. accounts@vendor.com"
              />
              <p className="text-[11px] text-text-subtle">
                GSTIN, banking, contract/SLA terms and materials supplied can be added next, on the vendor's profile page.
              </p>
            </div>

            <div className="px-5 py-3 border-t border-bordergray bg-bg-soft flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(null)}
                className="px-4 py-2 border border-bordergray bg-white rounded-lg text-[12px] font-semibold text-text-muted hover:text-textcolor"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-linear-to-br from-select-blue to-primary text-white rounded-lg text-[12px] font-semibold shadow-md hover:scale-[1.02] transition-all"
              >
                Add Vendor
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Vendors;
