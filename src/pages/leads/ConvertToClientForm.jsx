import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Modal from "../../components/Modal";
import InputField from "../../components/InputField";

const convertToClientSchema = yup.object().shape({
  clientName: yup.string().required("Client Name is required"),
  clientPhone: yup
    .string()
    .required("Phone Number is required")
    .transform((v) => v?.replace(/\s/g, ""))
    .matches(/^\d{10}$/, "Must be a 10-digit number"),
  clientEmail: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
  addressLine1: yup.string().required("Door no, building & street is required"),
  city: yup.string().required("City is required"),
  state: yup.string().required("State is required"),
  pincode: yup
    .string()
    .required("PIN Code is required")
    .matches(/^\d{6}$/, "Must be a 6-digit PIN code"),
  projectValue: yup.string().required("Confirmed Project Value is required"),
  totalDueValue: yup.string().required("Total Due Value is required"),
  // Interiors-only — Architecture has no package preset.
  quotePreset: yup.string().when("serviceTrack", {
    is: "Architecture",
    then: (s) => s.notRequired(),
    otherwise: (s) => s.required("Property Preset is required"),
  }),
  propertyType: yup.string().when("serviceTrack", {
    is: "Architecture",
    then: (s) => s.notRequired(),
    otherwise: (s) => s.required("Property Type is required"),
  }),
});
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import { formatAmount } from "../../utils/formatAmount";
import {
  getConfigForType,
  computeTotals,
  getPresetKeys,
  getPropertyTypesForPreset,
  getLatestQuoteForParent,
} from "../../data/QuotePresets";
import { formatSizeRange } from "../../utils/sizeRangeValidation";
import { resolveServiceTrack } from "../../data/serviceTrack";

// Parse a lead's investment range (e.g. "₹60L-70L", "₹50L – ₹1Cr", "₹1-1.2Cr")
// and return the midpoint as a number, used to auto-suggest the confirmed
// project value at conversion time.
const parseInvestmentMidpoint = (str) => {
  if (!str) return 0;
  const clean = str.replace(/[₹\s]/g, "");
  const parts = clean.split(/[-–]/);
  const parseOne = (s) => {
    const num = parseFloat(s.replace(/[^\d.]/g, ""));
    if (isNaN(num)) return 0;
    if (/cr/i.test(s)) return num * 10000000;
    if (/l/i.test(s)) return num * 100000;
    return num;
  };
  // If only the trailing part has a unit ("60-70L"), apply it to both
  if (parts.length === 2) {
    const tailUnit = /cr/i.test(parts[1]) ? 1e7 : /l/i.test(parts[1]) ? 1e5 : 1;
    const headHasUnit = /cr|l/i.test(parts[0]);
    const a = headHasUnit ? parseOne(parts[0]) : parseOne(parts[0]) * tailUnit;
    const b = parseOne(parts[1]);
    return Math.round((a + b) / 2);
  }
  return Math.round(parseOne(parts[0]));
};

// Resolve property type + city across two lead shapes:
//  - static TableData: { location: "Luxury Villa", locationSecondary: "Beverly Hills, CA" }
//  - new lead form:    { propertyType: "Penthouse", location: "Chennai" }
const resolveLeadAddress = (lead) => {
  const parts = lead.location?.includes(",")
    ? lead.location.split(",")
    : [lead.location || "", lead.locationSecondary || ""];
  const primary = parts[0]?.trim() || "";
  const secondary = parts.slice(1).join(",").trim() || "";

  if (lead.propertyType) {
    return {
      propertyType: lead.propertyType,
      city: primary || "",
    };
  }
  return {
    propertyType: primary || "",
    city: secondary || "",
  };
};

const SectionHeader = ({ children }) => (
  <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-select-blue mb-4">
    <span className="w-0.5 h-3.5 bg-select-blue rounded-full shrink-0" />
    {children}
  </h2>
);

function ConvertToClientForm({ lead, onClose, onConvert }) {
  const navigate = useNavigate();
  const { propertyType, city } = resolveLeadAddress(lead);
  
  const latestQuote = useMemo(() => {
    return getLatestQuoteForParent(lead.proposalId);
  }, [lead.proposalId]);

  const isArch = resolveServiceTrack(lead) === "Architecture";

  const presetKeys = useMemo(() => getPresetKeys(), []);
  // Architecture has no package preset — don't fall back to an interiors one.
  const activePreset = isArch
    ? ""
    : latestQuote?.presetKey || lead.quotePreset || (presetKeys.includes("2BHK") ? "2BHK" : presetKeys[0]);
  const activePropertyType = isArch
    ? lead.projectIntent || lead.scope || ""
    : latestQuote?.propertyType || lead.propertyType || propertyType || getPropertyTypesForPreset(activePreset)[0] || "";
  const activeSizeRange = latestQuote?.sizeRange || "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(convertToClientSchema),
    defaultValues: {
      clientName: lead.clientName || "",
      clientPhone: lead.phone || "",
      clientEmail: lead.email || "",
      location: activePropertyType,
      locationSecondary: city,
      addressLine1: "",
      addressLine2: "",
      city: city,
      state: "",
      pincode: "",
      landmark: "",
      quotePreset: activePreset,
      propertyType: activePropertyType,
      serviceTrack: isArch ? "Architecture" : "Interiors",
      projectValue: "",
      totalDueValue: "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPreset = watch("quotePreset");
  const selectedType = watch("propertyType");

  const activeCfg = useMemo(() => {
    if (!selectedPreset || !selectedType) return null;
    return getConfigForType(selectedPreset, selectedType);
  }, [selectedPreset, selectedType]);

  const activeTotals = useMemo(() => {
    // Architecture's contract value at appointment is the DESIGN FEE.
    if (isArch) {
      const feeTotal = Number(lead.feeProposal?.total) || 0;
      return {
        subtotal: feeTotal,
        gst: Math.round(feeTotal * 0.18),
        grandTotal: Math.round(feeTotal * 1.18),
      };
    }
    if (latestQuote) {
      return {
        subtotal: latestQuote.subtotal,
        gst: latestQuote.gst,
        grandTotal: latestQuote.grandTotal,
      };
    }
    if (!activeCfg) return { subtotal: 0, gst: 0, grandTotal: 0 };
    return computeTotals(activeCfg.scopeItems || []);
  }, [isArch, lead.feeProposal, latestQuote, activeCfg]);

  const numericValue = activeTotals.subtotal;
  const suggestedValue = parseInvestmentMidpoint(lead.investment);

  useEffect(() => {
    if (activeTotals) {
      setValue("projectValue", formatAmount(activeTotals.subtotal));
      setValue("totalDueValue", formatAmount(activeTotals.grandTotal));
    }
  }, [activeTotals, setValue]);

  useEffect(() => {
    setValue("location", selectedType);
  }, [selectedType, setValue]);

  const handlePresetChange = (e) => {
    const key = e.target.value;
    setValue("quotePreset", key, { shouldValidate: true });
    const types = getPropertyTypesForPreset(key);
    const firstType = types[0] || "";
    setValue("propertyType", firstType, { shouldValidate: true });
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await onConvert?.(data, numericValue);
      onClose?.();
      navigate("/clients");
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <div className="flex justify-end items-center gap-4">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-bg-soft transition-all disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="convert-client-form"
        disabled={isSubmitting}
        className="min-w-[160px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-lg bg-select-blue text-white text-sm font-medium hover:bg-primary shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Converting…
          </>
        ) : (
          "Convert to Client"
        )}
      </button>
    </div>
  );

  return (
    <Modal
      title="Convert to Client"
      subtitle="Auto-filled from the qualified lead — review and confirm the project value"
      onClose={isSubmitting ? undefined : onClose}
      footer={footer}
    >
      <form
        id="convert-client-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <div className="mb-6">
          <SectionHeader>Client Information</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              name="clientName"
              label="Client Name"
              type="text"
              register={register("clientName")}
              error={errors.clientName?.message}
              placeholder="Full name"
            />
            <InputField
              name="clientPhone"
              label="Phone Number"
              type="tel"
              register={register("clientPhone")}
              error={errors.clientPhone?.message}
              placeholder="10-digit number"
            />
          </div>
          <div className="mt-4">
            <InputField
              name="clientEmail"
              label="Email Address"
              type="email"
              register={register("clientEmail")}
              error={errors.clientEmail?.message}
              placeholder="example@domain.com"
            />
          </div>
        </div>

        <div className="border-t border-border mb-6" />

        <div className="mb-6">
          <SectionHeader>Property Configuration</SectionHeader>
          <div className="rounded-xl border border-border bg-bg-soft px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-bold text-text">
                {activePreset.replace(/^(\d+)(BHK)$/i, "$1 BHK")}
                {activePropertyType ? ` / ${activePropertyType}` : ""}
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                {formatSizeRange(activeSizeRange)}
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-subtle">
              Proposal Preset
            </span>
          </div>
          {/* Hidden inputs to preserve react-hook-form registration and values for submission */}
          <input type="hidden" {...register("quotePreset")} />
          <input type="hidden" {...register("propertyType")} />
          <input type="hidden" {...register("serviceTrack")} />
        </div>

        <div className="border-t border-border mb-6" />

        <div className="mb-6">
          <SectionHeader>Site Address</SectionHeader>
          <p className="text-[11px] text-text-muted mb-3 -mt-2">
            Full address is required for site visits, 3D drawings, and material
            delivery.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <InputField
              name="addressLine1"
              label="Address Line 1 (Door no, Building, Street)"
              type="text"
              register={register("addressLine1")}
              error={errors.addressLine1?.message}
              placeholder="e.g. Flat 3B, Marina Heights, 14th Cross Road"
            />
            <InputField
              name="addressLine2"
              label="Address Line 2 (Area, Landmark) — optional"
              type="text"
              register={register("addressLine2")}
              placeholder="e.g. Indiranagar, near Metro Station"
            />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <InputField
              name="city"
              label="City"
              type="text"
              register={register("city")}
              error={errors.city?.message}
              placeholder="e.g. Chennai"
            />
            <InputField
              name="state"
              label="State"
              type="text"
              register={register("state")}
              error={errors.state?.message}
              placeholder="e.g. Tamil Nadu"
            />
            <InputField
              name="pincode"
              label="PIN Code"
              type="text"
              register={register("pincode")}
              error={errors.pincode?.message}
              placeholder="6-digit PIN"
            />
          </div>
        </div>

        <div className="border-t border-border mb-6" />

        <div>
          <SectionHeader>Project Value &amp; Payment Milestones</SectionHeader>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <InputField
              name="projectValue"
              label="Confirmed Project Value"
              type="text"
              register={register("projectValue")}
              error={errors.projectValue?.message}
              readOnly={true}
              className="cursor-not-allowed opacity-80"
            />
            <InputField
              name="totalDueValue"
              label="Total Due Value"
              type="text"
              register={register("totalDueValue")}
              error={errors.totalDueValue?.message}
              readOnly={true}
              className="cursor-not-allowed opacity-80"
            />
          </div>
          {lead.investment && (
            <p className="mt-2 text-[11px] text-text-muted mb-4">
              Lead budget range:&nbsp;
              <span className="font-semibold text-text">{lead.investment}</span>
              {suggestedValue > 0 && (
                <>
                  &nbsp;· Suggested midpoint:&nbsp;
                  <span className="font-semibold text-select-blue">
                    {formatAmount(suggestedValue)}
                  </span>
                </>
              )}
            </p>
          )}

          {numericValue > 0 && (
            <div className="mt-5 rounded-xl border border-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_48px_110px_80px_110px] bg-bg-soft px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                <span>Milestone</span>
                <span className="text-center">%</span>
                <span className="text-right">Base</span>
                <span className="text-right">GST 18%</span>
                <span className="text-right">Total Due</span>
              </div>

              {PAYMENT_MILESTONES.map((m, idx) => {
                const base = Math.round((numericValue * m.pct) / 100);
                const gstAmt = Math.round((base * m.gst) / 100);
                const total = base + gstAmt;
                return (
                  <div
                    key={m.id}
                    className={`grid grid-cols-[1fr_48px_110px_80px_110px] px-4 py-3 items-center text-[13px] ${idx < PAYMENT_MILESTONES.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-active-bg text-select-blue text-[10px] font-bold flex items-center justify-center shrink-0">
                        {m.id}
                      </span>
                      <span className="font-medium text-text">{m.name}</span>
                    </div>
                    <span className="text-center font-bold text-select-blue">
                      {m.pct}%
                    </span>
                    <span className="text-right text-text-muted">
                      {formatAmount(base)}
                    </span>
                    <span className="text-right text-orange-500 font-medium">
                      +{formatAmount(gstAmt)}
                    </span>
                    <span className="text-right font-bold text-text">
                      {formatAmount(total)}
                    </span>
                  </div>
                );
              })}

              {/* Totals row */}
              {(() => {
                const totalBase = PAYMENT_MILESTONES.reduce(
                  (s, m) => s + Math.round((numericValue * m.pct) / 100),
                  0,
                );
                const totalGst = PAYMENT_MILESTONES.reduce((s, m) => {
                  const base = Math.round((numericValue * m.pct) / 100);
                  return s + Math.round((base * m.gst) / 100);
                }, 0);
                return (
                  <div className="grid grid-cols-[1fr_48px_110px_80px_110px] px-4 py-3 bg-bg-soft border-t border-border text-[13px] font-bold">
                    <span className="text-text">Total</span>
                    <span className="text-center text-select-blue">100%</span>
                    <span className="text-right text-text-muted">
                      {formatAmount(totalBase)}
                    </span>
                    <span className="text-right text-orange-500">
                      +{formatAmount(totalGst)}
                    </span>
                    <span className="text-right text-text">
                      {formatAmount(totalBase + totalGst)}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}

export default ConvertToClientForm;
