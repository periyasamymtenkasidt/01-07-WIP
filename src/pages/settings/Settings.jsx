import { useRef, useState } from "react";
import {
  Building2,
  Image as ImageIcon,
  Landmark,
  FileText,
  Save,
  Check,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Trash2,
} from "lucide-react";
import { getOrgProfile, saveOrgProfile } from "../../data/orgProfile";

const inputBase =
  "bg-white border border-bordergray text-[12px] text-textcolor rounded-lg px-3 py-2 w-full focus:outline-none focus:border-select-blue focus:ring-2 focus:ring-select-blue/15 transition-all placeholder:text-text-subtle";

// Resize an uploaded logo to a small square-ish footprint before it's
// stored as a data URL — keeps localStorage light regardless of the
// original image size.
const MAX_LOGO_DIM = 240;

const resizeImageFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image"));
      img.onload = () => {
        const scale = Math.min(1, MAX_LOGO_DIM / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

const Settings = () => {
  const [profile, setProfile] = useState(() => getOrgProfile());
  const [hasChanges, setHasChanges] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type, id: Date.now() });
    setTimeout(() => setToast(null), 2600);
  };

  const set = (changes) => {
    setProfile((p) => ({ ...p, ...changes }));
    setHasChanges(true);
  };

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      set({ logoDataUrl: dataUrl });
    } catch {
      showToast("Couldn't read that image — try a different file", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSave = () => {
    saveOrgProfile(profile);
    setHasChanges(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
    showToast("Organization profile saved", "success");
  };

  return (
    <div className="bg-overallbg font-sans h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-5 border-b border-bordergray/70 bg-overallbg/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-linear-to-br from-select-blue to-primary text-white flex items-center justify-center shadow-lg shadow-select-blue/20">
              <Building2 size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-textcolor leading-tight">
                Organization Profile
              </h1>
              <p className="text-[12px] text-text-muted mt-0.5">
                Firm details, GSTIN, bank info & logo — stamped onto every BOQ,
                quote & invoice you issue
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 cursor-pointer rounded-lg text-[12px] font-semibold transition-all shadow-md ${
              savedFlash
                ? "bg-emerald-500 text-white"
                : "bg-linear-to-br from-select-blue to-primary text-white hover:scale-[1.02]"
            } ${hasChanges && !savedFlash ? "animate-pulse ring-2 ring-select-blue/20" : ""}`}
          >
            {savedFlash ? <Check size={13} /> : <Save size={13} />}
            {savedFlash ? "Saved" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="px-6 py-5 max-w-5xl space-y-5">
        {/* Logo + brand */}
        <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
          <SectionHeader icon={<ImageIcon size={13} />} title="Logo & Brand" />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-5">
            <div className="flex flex-col items-center gap-2">
              <div className="h-24 w-24 rounded-xl border border-dashed border-bordergray bg-bg-soft/60 flex items-center justify-center overflow-hidden">
                {profile.logoDataUrl ? (
                  <img
                    src={profile.logoDataUrl}
                    alt="Logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-[10px] text-text-subtle text-center px-2">
                    No logo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-lg border border-bordergray bg-white text-[10.5px] font-semibold text-text-muted hover:bg-bg-soft hover:text-textcolor"
                >
                  Upload
                </button>
                {profile.logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => set({ logoDataUrl: "" })}
                    className="h-7 w-7 flex items-center justify-center rounded-md text-text-subtle hover:text-red-500 hover:bg-red-50"
                    title="Remove logo"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Firm Name">
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => set({ name: e.target.value })}
                  className={inputBase}
                />
              </Field>
              <Field label="Tagline">
                <input
                  type="text"
                  value={profile.tagline}
                  onChange={(e) => set({ tagline: e.target.value })}
                  className={inputBase}
                />
              </Field>
              <Field label="Website">
                <input
                  type="text"
                  value={profile.website}
                  onChange={(e) => set({ website: e.target.value })}
                  placeholder="www.example.com"
                  className={inputBase}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className={inputBase}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="text"
                  value={profile.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className={inputBase}
                />
              </Field>
            </div>
          </div>
        </section>

        {/* Address & GST */}
        <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
          <SectionHeader icon={<Building2 size={13} />} title="Registered Address & Tax" />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Address Line" className="lg:col-span-2">
              <input
                type="text"
                value={profile.addressLine}
                onChange={(e) => set({ addressLine: e.target.value })}
                placeholder="Street, area"
                className={inputBase}
              />
            </Field>
            <Field label="City">
              <input
                type="text"
                value={profile.city}
                onChange={(e) => set({ city: e.target.value })}
                className={inputBase}
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={profile.state}
                onChange={(e) => set({ state: e.target.value })}
                className={inputBase}
              />
            </Field>
            <Field
              label="GST State Code"
              hint="2-digit code, e.g. Karnataka = 29"
            >
              <input
                type="text"
                value={profile.stateCode}
                onChange={(e) =>
                  set({ stateCode: e.target.value.replace(/\D/g, "").slice(0, 2) })
                }
                placeholder="29"
                className={`${inputBase} tabular-nums`}
              />
            </Field>
            <Field label="GSTIN">
              <input
                type="text"
                value={profile.gstin}
                onChange={(e) => set({ gstin: e.target.value.toUpperCase() })}
                placeholder="29AAAAA0000A1Z5"
                className={`${inputBase} tabular-nums`}
              />
            </Field>
            <Field label="PAN">
              <input
                type="text"
                value={profile.pan}
                onChange={(e) => set({ pan: e.target.value.toUpperCase() })}
                placeholder="AAAAA0000A"
                className={`${inputBase} tabular-nums`}
              />
            </Field>
          </div>
        </section>

        {/* Bank details */}
        <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
          <SectionHeader icon={<Landmark size={13} />} title="Bank Details" />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Bank Name">
              <input
                type="text"
                value={profile.bankName}
                onChange={(e) => set({ bankName: e.target.value })}
                className={inputBase}
              />
            </Field>
            <Field label="Account Number">
              <input
                type="text"
                value={profile.bankAccount}
                onChange={(e) => set({ bankAccount: e.target.value })}
                className={`${inputBase} tabular-nums`}
              />
            </Field>
            <Field label="IFSC">
              <input
                type="text"
                value={profile.bankIfsc}
                onChange={(e) => set({ bankIfsc: e.target.value.toUpperCase() })}
                className={`${inputBase} tabular-nums`}
              />
            </Field>
            <Field label="Branch">
              <input
                type="text"
                value={profile.bankBranch}
                onChange={(e) => set({ bankBranch: e.target.value })}
                className={inputBase}
              />
            </Field>
            <Field label="UPI ID">
              <input
                type="text"
                value={profile.upi}
                onChange={(e) => set({ upi: e.target.value })}
                placeholder="firm@upi"
                className={inputBase}
              />
            </Field>
          </div>
        </section>

        {/* Defaults for new BOQs */}
        <section className="bg-white rounded-2xl border border-bordergray shadow-[0_1px_3px_rgba(15,23,42,0.04)] overflow-hidden">
          <SectionHeader icon={<FileText size={13} />} title="Defaults for New BOQs" />
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Validity">
              <input
                type="text"
                value={profile.defaultValidity}
                onChange={(e) => set({ defaultValidity: e.target.value })}
                placeholder="30 days from issue"
                className={inputBase}
              />
            </Field>
            <Field label="Warranty / Defect Liability">
              <input
                type="text"
                value={profile.defaultWarranty}
                onChange={(e) => set({ defaultWarranty: e.target.value })}
                placeholder="e.g. 12 months on hardware"
                className={inputBase}
              />
            </Field>
            <Field label="Notes / Terms" className="sm:col-span-2">
              <textarea
                value={profile.defaultNotes}
                onChange={(e) => set({ defaultNotes: e.target.value })}
                rows={4}
                placeholder="Default notes that prefill on new BOQs"
                className={`${inputBase} resize-none leading-relaxed`}
              />
            </Field>
          </div>
        </section>

        <p className="text-[10.5px] text-text-subtle flex items-center gap-1.5 pb-4">
          <Info size={11} className="shrink-0" />
          Editing this profile only affects new drafts and previews. BOQs
          already marked Sent keep the firm details that were stamped on them
          at send time.
        </p>
      </div>

      {toast && <SettingsToast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
};

const SectionHeader = ({ icon, title }) => (
  <div className="px-5 py-3 border-b border-bordergray flex items-center gap-2">
    <span className="text-select-blue">{icon}</span>
    <h3 className="text-[12px] font-bold text-textcolor">{title}</h3>
  </div>
);

const Field = ({ label, hint, className = "", children }) => (
  <div className={className}>
    <label className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
      <span>{label}</span>
      {hint && (
        <span className="text-[9.5px] font-normal text-text-subtle normal-case tracking-normal">
          {hint}
        </span>
      )}
    </label>
    {children}
  </div>
);

const SettingsToast = ({ toast, onClose }) => {
  const variants = {
    success: { bg: "bg-emerald-500", icon: <CheckCircle2 size={14} /> },
    error: { bg: "bg-red-500", icon: <AlertTriangle size={14} /> },
    info: { bg: "bg-select-blue", icon: <Info size={14} /> },
  };
  const v = variants[toast.type] || variants.info;
  return (
    <div className="fixed top-6 right-6 z-50">
      <div
        className={`${v.bg} text-white rounded-xl shadow-xl px-4 py-3 flex items-center gap-2.5 min-w-[260px] max-w-md`}
      >
        <span className="shrink-0">{v.icon}</span>
        <p className="text-[12px] font-medium flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-white/80 hover:text-white shrink-0"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default Settings;
