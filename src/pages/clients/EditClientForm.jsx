import React, { useState } from "react";
import { GrLocation } from "react-icons/gr";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import InputField from "../../components/InputField";
import Modal from "../../components/Modal";

const editClientSchema = yup.object().shape({
  clientName: yup.string().trim().required("Client Name is required"),
  clientPhone: yup
    .string()
    .required("Phone Number is required")
    .transform((v) => v?.replace(/\s/g, ""))
    .matches(/^\d{10}$/, "Must be a 10-digit number"),
  clientEmail: yup
    .string()
    .required("Email Address is required")
    .trim()
    .matches(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      "Enter a valid email address",
    ),
  location: yup.string().required("Property Type is required"),
  locationSecondary: yup
    .string()
    .trim()
    .required("City / Location is required"),
  budget: yup.string().trim().required("Budget is required"),
  paymentStatus: yup.string().required("Payment Status is required"),
});

const INITIAL_FORM_STATE = {
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  location: "",
  locationSecondary: "",
  budget: "",
  paymentStatus: "",
};

const paymentStatuses = ["Completed", "Pending", "Unfulfilled"];

const propertyTypes = [
  "Luxury Villa", "Apartment", "Penthouse", "Independent House",
  "Duplex", "Studio Apartment", "Farm House", "Beach House",
];

const FIELD_CONFIG = {
  clientInfo: [
    { name: "clientName", label: "Client Name", type: "text", placeholder: "Full name" },
    {
      name: "clientPhone", label: "Phone Number", type: "tel", placeholder: "10-digit number",
    },
    {
      name: "clientEmail", label: "Email Address", type: "email", placeholder: "example@domain.com",
    },
  ],
  propertyDetails: [
    { name: "location", label: "Property Type", type: "select", options: propertyTypes },
    { name: "locationSecondary", label: "City / Location", type: "text", placeholder: "e.g. Powai, Mumbai", icon: GrLocation },
    { name: "budget", label: "Budget", type: "text", placeholder: "e.g. ₹60 – 70L" },
  ],
};

const SectionHeader = ({ children }) => (
  <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-select-blue mb-4">
    <span className="w-0.5 h-3.5 bg-select-blue rounded-full shrink-0" />
    {children}
  </h2>
);

function EditClientForm({ initialData, onClose, onSave, hasMilestones = false }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(editClientSchema),
    defaultValues: initialData
      ? {
          clientName: initialData.clientName || "",
          clientPhone: initialData.clientPhone || "",
          clientEmail: initialData.clientEmail || "",
          location: initialData.location || "",
          locationSecondary: initialData.locationSecondary || "",
          budget: initialData.budget || "",
          paymentStatus: initialData.paymentStatus || "",
        }
      : INITIAL_FORM_STATE,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentStatus = watch("paymentStatus");

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await onSave?.(data);
      onClose?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  const field = (cfg) => (
    <InputField
      key={cfg.name}
      name={cfg.name}
      label={cfg.label}
      type={cfg.type}
      register={register(cfg.name)}
      error={errors[cfg.name]?.message}
      placeholder={cfg.placeholder}
      options={cfg.options}
      icon={cfg.icon}
    />
  );

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
          <>
            <Loader2 size={14} className="animate-spin" />
            Saving…
          </>
        ) : "Save Changes"}
      </button>
    </div>
  );

  return (
    <Modal
      title="Edit Client"
      subtitle="Update client and property details"
      onClose={isSubmitting ? undefined : onClose}
      footer={footer}
    >
      <form id="edit-client-form" onSubmit={handleSubmit(onSubmit)} noValidate>

        <div className="mb-6">
          <SectionHeader>Client Information</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            {FIELD_CONFIG.clientInfo.slice(0, 2).map(field)}
          </div>
          <div className="mt-4">{field(FIELD_CONFIG.clientInfo[2])}</div>
        </div>

        <div className="border-t border-border mb-6" />

        <div className="mb-6">
          <SectionHeader>Property Details</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            {FIELD_CONFIG.propertyDetails.map(field)}
          </div>
        </div>

        <div className="border-t border-border mb-6" />

        <div>
          <SectionHeader>Payment Status</SectionHeader>
          {hasMilestones ? (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-bg-soft border border-border">
              <div>
                <p className="text-[12px] font-semibold text-text-muted">Auto-managed by payment milestones</p>
                <p className="text-[11px] text-text-subtle mt-0.5">Status updates automatically as milestones are marked paid.</p>
              </div>
              <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                paymentStatus?.toLowerCase() === "completed" ? "bg-green-50 text-green-700 border-green-200" :
                paymentStatus?.toLowerCase() === "pending"   ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
                paymentStatus?.toLowerCase() === "failed"    ? "bg-red-50 text-red-600 border-red-200" :
                "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                {paymentStatus || "Pending"}
              </span>
            </div>
          ) : (
            <div>
              <p className="text-[13px] font-medium text-text mb-2">Current Status</p>
              <div className="flex gap-2">
                {paymentStatuses.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setValue("paymentStatus", status, { shouldValidate: true })}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize border transition-all ${
                      paymentStatus === status
                        ? "bg-active-bg border-select-blue text-select-blue"
                        : "bg-white border-border text-text-muted hover:bg-bg-soft"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              {errors.paymentStatus && (
                <p className="text-red-500 text-[11px] mt-1">{errors.paymentStatus.message}</p>
              )}
            </div>
          )}
        </div>

      </form>
    </Modal>
  );
}

export default EditClientForm;
