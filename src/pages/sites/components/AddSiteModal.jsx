import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import Modal from "../../../components/Modal";
import InputField from "../../../components/InputField";
import {
  getPresetKeys,
  getPropertyTypesForPreset,
} from "../../../data/QuotePresets";

const toInputDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split(".");
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    return `${yyyy}-${mm}-${dd}`;
  }
  return dateStr;
};

const fromInputDate = (inputVal) => {
  if (!inputVal || typeof inputVal !== "string") return "";
  const parts = inputVal.split("-");
  if (parts.length === 3) {
    const [yyyy, mm, dd] = parts;
    return `${dd}.${mm}.${yyyy}`;
  }
  return inputVal;
};

const AddSiteModal = ({ onClose, onSubmit, isSaving, SUPERVISORS = [] }) => {
  const [clientName, setClientName] = useState("");
  const [propertyPreset, setPropertyPreset] = useState("");
  const [siteType, setSiteType] = useState("");
  const [location, setLocation] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientName || !propertyPreset || !siteType || !location) {
      alert(
        "Please fill in Client Name, Property Preset, Site Type, and Location.",
      );
      return;
    }
    onSubmit({
      clientName,
      propertyPreset,
      siteType,
      location,
      fullAddress,
      supervisor,
      targetDate,
      notes,
    });
  };

  return (
    <Modal
      title="Add Project Site"
      subtitle="Create a new project site and assign a supervisor"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2 rounded-lg border border-border text-sm font-medium text-text-muted hover:bg-bg-soft transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-site-form"
            disabled={isSaving}
            className="min-w-[120px] flex items-center justify-center gap-2 px-6 py-2 rounded-lg bg-select-blue text-white text-sm font-medium hover:bg-primary shadow-sm transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Adding…
              </>
            ) : (
              "Create Site"
            )}
          </button>
        </div>
      }
    >
      <form id="add-site-form" onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Client Name"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="e.g. Aarav Mehta"
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <InputField
            type="select"
            label="Property Preset"
            value={propertyPreset}
            onChange={(e) => {
              const preset = e.target.value;
              setPropertyPreset(preset);
              setSiteType(getPropertyTypesForPreset(preset)[0] || "");
            }}
            options={getPresetKeys()}
            placeholder="Select Property Preset"
            required
          />

          <InputField
            type="select"
            label="Site Type"
            value={siteType}
            onChange={(e) => setSiteType(e.target.value)}
            options={getPropertyTypesForPreset(propertyPreset)}
            placeholder="Select Property Type"
            disabled={!propertyPreset}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField
            label="City / Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Powai, Mumbai"
            required
          />

          <InputField
            label="Full Site Address"
            value={fullAddress}
            onChange={(e) => setFullAddress(e.target.value)}
            placeholder="Street address, building name etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <InputField
            type="select"
            label="Supervisor"
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            options={SUPERVISORS}
            placeholder="Select Supervisor"
          />

          <InputField
            type="date"
            label="Target Completion Date"
            value={toInputDate(targetDate)}
            onChange={(e) => setTargetDate(fromInputDate(e.target.value))}
          />
        </div>

        <InputField
          type="textarea"
          label="Initial Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Preliminary details or requirements for the site visit..."
        />
      </form>
    </Modal>
  );
};

export default AddSiteModal;
