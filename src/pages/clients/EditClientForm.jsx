import { useState, useMemo, useEffect } from "react";
import { GrLocation } from "react-icons/gr";
import { Loader2, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import InputField from "../../components/InputField";
import Modal from "../../components/Modal";
import TrackPicker from "../../components/TrackPicker";
import {
  PROJECT_INTENTS,
  CLIENT_TYPES,
  REQUIREMENT_TYPES,
  BUILDING_USES,
  resolveServiceTrack,
} from "../../data/serviceTrack";
import {
  getPresetKeys,
  getPropertyTypesForPreset,
  generateInvestmentBands,
  computeTotals,
  getConfigForType,
  getPresetTotalDays,
} from "../../data/QuotePresets";
import { addWorkingDaysISO } from "../../data/scheduleStorage";

const INQUIRY_SOURCES = [
  "Walk-in", "Referral", "Social Media", "Website", "Cold Call", "Other",
];


const editClientSchema = yup.object().shape({
  clientName: yup.string().trim().required("Client Name is required"),
  clientPhone: yup
    .string()
    .required("Phone Number is required")
    .transform((v) => v?.replace(/\s/g, ""))
    .matches(/^\d{10}$/, "Must be a 10-digit number"),
  whatsappNumber: yup
    .string()
    .transform((v) => (v ? v.replace(/\s/g, "") : v))
    .matches(/^\d{10}$/, { message: "Must be a 10-digit number", excludeEmptyString: true })
    .notRequired(),
  clientEmail: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
  referralPersonName: yup.string().when("inquirySource", {
    is: "Referral",
    then: (s) => s.required("Referral Person Name is required"),
    otherwise: (s) => s.notRequired(),
  }),
  referralPersonEmail: yup.string().when("inquirySource", {
    is: "Referral",
    then: (s) =>
      s.required("Referral Person Email is required")
        .trim()
        .matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"),
    otherwise: (s) => s.notRequired(),
  }),
  serviceTrack: yup.string().required("Project type is required"),
  projectIntent: yup.string().when("serviceTrack", {
    is: "Architecture",
    then: (s) => s.required("Project Intent is required"),
    otherwise: (s) => s.notRequired(),
  }),
  location: yup.string().when("serviceTrack", {
    is: "Interiors",
    then: (s) => s.required("Property Type is required"),
    otherwise: (s) => s.notRequired(),
  }),
  locationSecondary: yup.string().trim().required("City / Location is required"),
});

const SectionHeader = ({ children, hint }) => (
  <div className="mb-4">
    <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-select-blue">
      <span className="w-0.5 h-3.5 bg-select-blue rounded-full shrink-0" />
      {children}
    </h2>
    {hint && <p className="text-[11px] text-text-subtle mt-1 ml-3.5">{hint}</p>}
  </div>
);

function EditClientForm({ initialData, onClose, onSave }) {
  const track = resolveServiceTrack(initialData);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(editClientSchema),
    defaultValues: {
      clientName: initialData?.clientName || "",
      clientPhone: initialData?.clientPhone || "",
      whatsappNumber: initialData?.whatsappNumber || "",
      clientEmail: initialData?.clientEmail || "",
      clientType: initialData?.clientType || "",
      inquirySource: initialData?.inquirySource || "",
      referralPersonName: initialData?.referralPersonName || "",
      referralPersonEmail: initialData?.referralPersonEmail || "",
      serviceTrack: track,
      projectIntent: initialData?.projectIntent || "",
      requirementType: initialData?.requirementType || "",
      buildingUse: initialData?.buildingUse || "",
      plotArea: initialData?.plotArea || "",
      quotePreset: initialData?.quotePreset || "",
      location: initialData?.location || "",
      investmentRange: track === "Interiors"
        ? (initialData?.investmentRange || initialData?.budget || "")
        : "",
      processionDate: (() => {
        const pd = initialData?.possessionDate;
        if (!pd) return "";
        const parts = pd.split(".");
        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : pd;
      })(),
      indicativeBudget: track === "Architecture" ? (initialData?.indicativeBudget || initialData?.budget || "") : "",
      locationSecondary: initialData?.locationSecondary || "",
      architecturalNotes: initialData?.architecturalNotes || "",
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [possessionTouched, setPossessionTouched] = useState(!!initialData?.possessionDate);

  const serviceTrack = watch("serviceTrack");
  const inquirySource = watch("inquirySource");
  const quotePreset = watch("quotePreset");
  const propertyTypeValue = watch("location");
  const investmentRange = watch("investmentRange");
  const possessionValue = watch("processionDate");
  const isArch = serviceTrack === "Architecture";

  const presetKeys = getPresetKeys();
  const propertyTypeOptions = quotePreset ? getPropertyTypesForPreset(quotePreset) : [];

  const baseline = useMemo(() => {
    const cfg = getConfigForType(quotePreset, propertyTypeValue);
    const totals = cfg ? computeTotals(cfg.scopeItems || []) : null;
    return totals?.grandTotal || 0;
  }, [quotePreset, propertyTypeValue]);

  const investmentBands = useMemo(() => {
    const bands = generateInvestmentBands(baseline);
    if (investmentRange && !bands.includes(investmentRange)) return [investmentRange, ...bands];
    return bands;
  }, [baseline, investmentRange]);

  const totalScopeDays = useMemo(
    () => getPresetTotalDays(quotePreset, propertyTypeValue),
    [quotePreset, propertyTypeValue],
  );

  const estimateISO = useMemo(
    () => (totalScopeDays > 0 ? addWorkingDaysISO(new Date(), totalScopeDays) : ""),
    [totalScopeDays],
  );

  const timelineTight =
    !!possessionValue && !!estimateISO && possessionValue < estimateISO;

  useEffect(() => {
    if (possessionTouched) return;
    if (estimateISO) setValue("processionDate", estimateISO);
  }, [estimateISO, possessionTouched, setValue]);

  const handlePresetChange = (e) => {
    setValue("quotePreset", e.target.value, { shouldValidate: true });
    setValue("location", "", { shouldValidate: false });
    setValue("investmentRange", "", { shouldValidate: false });
    setPossessionTouched(false);
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await onSave?.({
        ...data,
        investment: isArch ? (data.indicativeBudget || "") : (data.investmentRange || ""),
        budget: isArch ? (data.indicativeBudget || "") : (data.investmentRange || ""),
        propertyType: isArch ? "" : (data.location || ""),
        possessionDate: isArch
          ? ""
          : data.processionDate
            ? data.processionDate.split("-").reverse().join(".")
            : "",
      });
      onClose?.();
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
        form="edit-client-form"
        disabled={isSubmitting}
        className="min-w-[140px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-lg bg-select-blue text-white text-sm font-medium hover:bg-primary shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <><Loader2 size={14} className="animate-spin" />Saving…</>
        ) : "Save Changes"}
      </button>
    </div>
  );

  return (
    <Modal
      title="Edit Client"
      subtitle="Update client and project details"
      onClose={isSubmitting ? undefined : onClose}
      footer={footer}
    >
      <form id="edit-client-form" onSubmit={handleSubmit(onSubmit)} noValidate>

        {/* ── Contact Information ─────────────────────────────────────── */}
        <div className="mb-6">
          <SectionHeader>Contact Information</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              name="clientName"
              label="Client Name"
              type="text"
              register={register("clientName")}
              error={errors.clientName?.message}
              placeholder="Full name"
              lettersOnly
            />
            <InputField
              name="clientPhone"
              label="Phone Number"
              type="tel"
              register={register("clientPhone")}
              error={errors.clientPhone?.message}
              placeholder="10-digit number"
              numericOnly
            />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <InputField
              name="clientEmail"
              label="Email Address"
              type="email"
              register={register("clientEmail")}
              error={errors.clientEmail?.message}
              placeholder="example@domain.com"
            />
            <InputField
              name="inquirySource"
              label="Inquiry Source"
              type="select"
              register={register("inquirySource")}
              options={INQUIRY_SOURCES}
              error={errors.inquirySource?.message}
            />
          </div>
          <div className={inquirySource === "Referral" ? "grid grid-cols-2 gap-4 mt-4" : "hidden"}>
            <InputField
              name="referralPersonName"
              label="Referral Person Name"
              type="text"
              register={register("referralPersonName")}
              error={errors.referralPersonName?.message}
              placeholder="Name of referring person"
              lettersOnly
            />
            <InputField
              name="referralPersonEmail"
              label="Referral Person Email"
              type="email"
              register={register("referralPersonEmail")}
              error={errors.referralPersonEmail?.message}
              placeholder="referrer@domain.com"
            />
          </div>
        </div>

        <div className="border-t border-border mb-6" />

        {/* ── Project Type ──────────────────────────────────────────────── */}
        <div className="mb-6">
          <SectionHeader hint="Determines the delivery pipeline for this client.">
            Project Type
          </SectionHeader>
          <TrackPicker
            value={serviceTrack}
            onChange={(v) => setValue("serviceTrack", v, { shouldValidate: true })}
          />
          {errors.serviceTrack?.message && (
            <p className="text-red-500 text-[10px] mt-1">{errors.serviceTrack.message}</p>
          )}
        </div>

        <div className="border-t border-border mb-6" />

        {/* ── Architecture Project ──────────────────────────────────────── */}
        {isArch && (
          <div className="mb-6">
            <SectionHeader hint="Building from land — pricing follows feasibility, not a preset.">
              Architecture Project
            </SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                name="projectIntent"
                label="Project Intent"
                type="select"
                register={register("projectIntent")}
                options={PROJECT_INTENTS}
                error={errors.projectIntent?.message}
              />
              <InputField
                name="requirementType"
                label="Requirement Type"
                type="select"
                register={register("requirementType")}
                options={REQUIREMENT_TYPES}
                error={errors.requirementType?.message}
              />
              <InputField
                name="buildingUse"
                label="Building Use"
                type="select"
                register={register("buildingUse")}
                options={BUILDING_USES}
                error={errors.buildingUse?.message}
              />
              <InputField
                name="plotArea"
                label="Plot Area"
                type="text"
                placeholder="e.g. 2400 sqft"
                register={register("plotArea")}
                error={errors.plotArea?.message}
              />
              <InputField
                name="whatsappNumber"
                label="WhatsApp Number"
                type="tel"
                register={register("whatsappNumber")}
                error={errors.whatsappNumber?.message}
                placeholder="10-digit number"
                numericOnly
              />
              <InputField
                name="clientType"
                label="Client Type"
                type="select"
                register={register("clientType")}
                options={CLIENT_TYPES}
                error={errors.clientType?.message}
              />
            </div>
          </div>
        )}

        {/* ── Interiors: merged Project Details ────────────────────────── */}
        {!isArch && (
          <div className="mb-6">
            <SectionHeader hint="The preset defines the scope package; property type narrows it further.">
              Project Details
            </SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                name="quotePreset"
                label="Property Preset"
                type="select"
                value={quotePreset}
                onChange={handlePresetChange}
                options={presetKeys}
                error={errors.quotePreset?.message}
              />
              <InputField
                name="location"
                label="Property Type"
                type="select"
                register={register("location")}
                options={propertyTypeOptions}
                placeholder={quotePreset ? "Select Property Type" : "Select a preset first"}
                disabled={!quotePreset}
                error={errors.location?.message}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <InputField
                name="investmentRange"
                label="Investment Range"
                type="select"
                register={register("investmentRange")}
                options={investmentBands}
                placeholder={
                  investmentBands.length ? "Choose a range" : "Pick preset + type first"
                }
                error={errors.investmentRange?.message}
              />
              <div>
                <InputField
                  name="processionDate"
                  label="Possession Date"
                  type="date"
                  register={{
                    ...register("processionDate"),
                    onChange: (e) => {
                      setPossessionTouched(true);
                      return register("processionDate").onChange(e);
                    },
                  }}
                  error={errors.processionDate?.message}
                />
                {!possessionTouched && totalScopeDays > 0 && (
                  <p className="text-[10.5px] text-text-subtle mt-1">
                    Auto-estimated · {totalScopeDays} working days from today.
                  </p>
                )}
                {timelineTight && (
                  <p className="text-[10.5px] text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} className="shrink-0" />
                    Tighter than our estimate (
                    {new Date(estimateISO).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                    ). Timeline is at-risk.
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <InputField
                name="locationSecondary"
                label="City / Location"
                type="text"
                placeholder="e.g. Chennai, Tamil Nadu"
                register={register("locationSecondary")}
                error={errors.locationSecondary?.message}
                icon={GrLocation}
              />
            </div>
          </div>
        )}

        {/* ── Architecture: Project Details ─────────────────────────────── */}
        {isArch && (
          <div className="mb-6">
            <SectionHeader>Project Details</SectionHeader>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                name="indicativeBudget"
                label="Construction Budget"
                type="text"
                placeholder="e.g. ₹2–2.5 Cr"
                register={register("indicativeBudget")}
                error={errors.indicativeBudget?.message}
              />
              <InputField
                name="locationSecondary"
                label="City / Location"
                type="text"
                placeholder="e.g. Chennai, Tamil Nadu"
                register={register("locationSecondary")}
                error={errors.locationSecondary?.message}
                icon={GrLocation}
              />
            </div>
          </div>
        )}

        <div className="border-t border-border mb-6" />

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <div className="mb-2">
          <SectionHeader>Notes</SectionHeader>
          <InputField
            type="textarea"
            name="architecturalNotes"
            label="Notes"
            register={register("architecturalNotes")}
            error={errors.architecturalNotes?.message}
            placeholder="Design preferences, site conditions, special requirements…"
            rows={3}
          />
        </div>

      </form>
    </Modal>
  );
}

export default EditClientForm;
