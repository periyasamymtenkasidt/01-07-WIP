import React, { useState } from "react";
import { GrLocation } from "react-icons/gr";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import InputField from "../../components/InputField";
import Modal from "../../components/Modal";

const addClientSchema = yup.object().shape({
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
  "Luxury Villa",
  "Apartment",
  "Penthouse",
  "Independent House",
  "Duplex",
  "Studio Apartment",
  "Farm House",
  "Beach House",
];

const FIELD_CONFIG = {
  clientInfo: [
    {
      name: "clientName",
      label: "Client Name",
      type: "text",
      placeholder: "Full name",
    },
    {
      name: "clientPhone",
      label: "Phone Number",
      type: "tel",
      placeholder: "10-digit number",
    },
    {
      name: "clientEmail",
      label: "Email Address",
      type: "email",
      placeholder: "example@domain.com",
    },
  ],
  propertyDetails: [
    {
      name: "location",
      label: "Property Type",
      type: "select",
      options: propertyTypes,
    },
    {
      name: "locationSecondary",
      label: "City / Location",
      type: "text",
      placeholder: "e.g. Powai, Mumbai",
      icon: GrLocation,
    },
    {
      name: "budget",
      label: "Budget",
      type: "text",
      placeholder: "e.g. ₹60 – 70L",
    },
  ],
};

const SectionHeader = ({ children }) => (
  <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-select-blue mb-4">
    <span className="w-0.5 h-3.5 bg-select-blue rounded-full shrink-0" />
    {children}
  </h2>
);

function AddClientForm({ onClose, onAddClient }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(addClientSchema),
    defaultValues: INITIAL_FORM_STATE,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const paymentStatus = watch("paymentStatus");

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await onAddClient?.(data);
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
        onClick={() => {
          reset(INITIAL_FORM_STATE);
        }}
        disabled={isSubmitting}
        className="text-sm font-medium cursor-pointer text-text-muted hover:text-text transition-colors disabled:opacity-50"
      >
        Clear
      </button>
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
        form="add-client-form"
        disabled={isSubmitting}
        className="min-w-[140px] flex items-center justify-center gap-2 px-7 py-2.5 rounded-lg bg-select-blue text-white text-sm font-medium hover:bg-primary shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Processing…
          </>
        ) : "Add Client"}
      </button>
    </div>
  );

  return (
    <Modal
      title="Add Client"
      subtitle="Enter client and property details"
      onClose={isSubmitting ? undefined : onClose}
      footer={footer}
    >
      <form id="add-client-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* Client Information */}
        <div className="mb-6">
          <SectionHeader>Client Information</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            {FIELD_CONFIG.clientInfo.slice(0, 2).map(field)}
          </div>
          <div className="mt-4">{field(FIELD_CONFIG.clientInfo[2])}</div>
        </div>

        {/* Property Details */}
        <div className="mb-6">
          <SectionHeader>Property Details</SectionHeader>
          <div className="grid grid-cols-2 gap-4">
            {FIELD_CONFIG.propertyDetails.map(field)}
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <SectionHeader>Payment Status</SectionHeader>
          <div>
            <p className="text-[13px] font-medium text-text mb-2">
              Current Status
            </p>
            <div className="flex gap-2">
              {paymentStatuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    setValue("paymentStatus", status, { shouldValidate: true })
                  }
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
              <p className="text-red-500 text-[11px] mt-1">
                {errors.paymentStatus.message}
              </p>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default AddClientForm;
