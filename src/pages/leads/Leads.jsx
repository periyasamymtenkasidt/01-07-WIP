import { useState, useEffect } from "react";
import { FiPlusCircle, FiAlertTriangle } from "react-icons/fi";
import NewInquiriesform from "./NewInquiriesform";
import Table from "../../components/Table";
import { useNavigate } from "react-router-dom";
import { getBadgeClass } from "../../data/LeadStatusConfig";
import { resolveServiceTrack, SERVICE_TRACKS } from "../../data/serviceTrack";
import { createLead, listLeads } from "../../api/leads";
import { toApiDate, toDisplayDate } from "../../utils/leadDates";

const MAIN_TABS = ["Inquiries"];

const SUB_TABS = {
  0: ["New Inquiries", "Nurturing Inquiries", "Won Deals", "Dropped Inquiries"],
  1: ["Tab A", "Tab B", "Tab C"],
};

// Sub-tab → status mapping. Mirrors the standard pipeline: raw inquiries,
// active deals being worked, closed-won (client created), and lost/dropped.
const TAB_STATUSES = {
  "0-0": ["Inquiry"],
  "0-1": ["Qualified", "Proposal", "Negotiation", "On Hold"],
  "0-2": ["Won"],
  "0-3": ["Lost"],
};

// Leads are served by the backend (GET /leads). The tabs are just a client-side
// view over that one list, so we pull the leads once and filter by the tab's
// statuses. No localStorage, no static mock data — the server is the source of
// truth. Returns [] on failure (the table shows "No records found").
async function fetchTabData(mainTab, subTab) {
  const statuses = TAB_STATUSES[`${mainTab}-${subTab}`] ?? [];

  let res;
  try {
    res = await listLeads({ limit: 200 });
  } catch (err) {
    console.warn("fetchTabData: listLeads failed —", err?.message || err);
    return [];
  }
  // Tolerate the paged envelope ({ data, page, total, pages }) or a bare array.
  const all = Array.isArray(res) ? res : (res?.data ?? []);

  return all
    .filter((item) =>
      statuses.some((s) => item.status?.toLowerCase() === s.toLowerCase()),
    )
    // Normalize the service track onto every row so legacy leads (no field)
    // still filter correctly as Interiors/Architecture.
    .map((item, i) => ({
      ...item,
      serviceTrack: resolveServiceTrack(item),
      // Server returns dates as ISO. possessionDate is shown/parsed as
      // DD.MM.YYYY; targetCompletion keeps its YYYY-MM-DD convention.
      possessionDate: toDisplayDate(item.possessionDate),
      targetCompletion: toApiDate(item.targetCompletion) || "",
      sno: String(i + 1).padStart(2, "0"),
    }));
}

const Leads = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await fetchTabData(activeMainTab, activeSubTab);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      try {
        const result = await fetchTabData(activeMainTab, activeSubTab);
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    load();
    return () => controller.abort();
  }, [activeMainTab, activeSubTab]);

  // Re-load data when returning to the page (e.g. after edit/delete on profile)
  useEffect(() => {
    const handleFocus = () => {
      loadData();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [activeMainTab, activeSubTab]);

  // Listen for custom events dispatched from the profile page
  useEffect(() => {
    const handleLeadUpdate = () => {
      loadData();
    };
    window.addEventListener("leadDataChanged", handleLeadUpdate);
    return () =>
      window.removeEventListener("leadDataChanged", handleLeadUpdate);
  }, [activeMainTab, activeSubTab]);

  // When a new lead is added, POST to the backend (which assigns the real
  // proposalId = LD-YYYY-###), then re-read the tab from the server. The table
  // is backend-sourced now — there's no local mirror, so if the POST fails we
  // surface the error instead of silently saving the lead locally.
  const handleAddLead = async (formData) => {
    // Architecture has no package preset — don't let the form's interiors
    // defaults leak onto the lead.
    const isArch = (formData.serviceTrack || "Interiors") === "Architecture";

    // Body for POST /leads (camelCase; required: clientName, serviceTrack).
    const body = {
      clientName: formData.fullName,
      // Top-level branch — drives the delivery pipeline (Interiors/Architecture)
      serviceTrack: formData.serviceTrack || "Interiors",
      phone: formData.phoneNumber,
      email: formData.email,
      // "scope" is what the table column key reads — must match
      scope: formData.projectScope,
      location: formData.location?.trim() || "",
      locationSecondary: formData.locationSecondary?.trim() || "",
      status: formData.inquiryStatus || "Inquiry",
      investment: formData.investmentRange,
      // Send a Date-castable value (YYYY-MM-DD) — the server rejects the
      // DD.MM.YYYY display format; omitted entirely when blank.
      possessionDate: toApiDate(formData.processionDate),
      // Flagged at creation when the possession date is tighter than the
      // preset's estimated delivery — surfaced in the list below.
      timelineTight: !!formData.timelineTight,
      // Architecture-only intake (empty for Interiors)
      projectIntent: formData.projectIntent || "",
      plotArea: formData.plotArea || "",
      plotNumber: formData.plotNumber || "",
      landOwnership: formData.landOwnership || "",
      targetCompletion: toApiDate(formData.targetCompletion),
      indicativeBudget: formData.indicativeBudget || "",
      // Interiors-only preset fields — blank for Architecture.
      propertyType: isArch ? "" : formData.propertyType,
      architecturalNotes: formData.architecturalNotes,
      inquirySource: formData.inquirySource,
      // Referral details — only meaningful when inquirySource is 'Referral'
      referralPersonName: formData.referralPersonName || "",
      referralPersonEmail: formData.referralPersonEmail || "",
      // Property preset captured at inquiry — used as the starting
      // template when the Send Proposal flow opens later.
      quotePreset: isArch ? "" : formData.quotePreset,
      quoteSizeRange: isArch ? "" : formData.quoteSizeRange,
    };

    try {
      await createLead(body); // server assigns proposalId (LD-YYYY-###)
    } catch (err) {
      console.error("createLead failed —", err?.message || err);
      alert(
        "Couldn't save this inquiry — the server rejected it or is unreachable. Please try again.",
      );
      return;
    }

    // Re-read the tab from the backend so the new lead appears with its
    // server-assigned proposalId and any server-computed fields.
    const result = await fetchTabData(activeMainTab, activeSubTab);
    setData(result);
  };

  const columns = [
    { key: "sno", label: "Sno" },
    {
      key: "proposalId",
      label: "Proposal ID",
      render: (_, item) => (
        <span
          className=" cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/leads/${item.proposalId}`);
          }}
        >
          {item.proposalId}
        </span>
      ),
    },
    {
      key: "clientName",
      label: "Client Name",
      render: (_, item) => (
        <span
          className="cursor-pointer hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/leads/${item.proposalId}`);
          }}
        >
          {item.clientName}
        </span>
      ),
    },
    { key: "phone", label: "Phone" },
    {
      key: "scope",
      label: "Scope",
      render: (_, item) => {
        const presetKey = item.quotePreset || "";
        const propType = item.propertyType || "";
        if (!presetKey) return item.scope || "—";
        const formattedPresetKey = presetKey.replace(/^(\d+)(BHK)$/i, "$1 BHK");
        return `${formattedPresetKey} / ${propType}`;
      },
    },
    {
      key: "location",
      label: "Location",
      render: (_, item) => {
        const parts = item.location?.includes(",")
          ? item.location.split(",")
          : [item.location || "", item.locationSecondary || ""];
        const primary = parts[0]?.trim() || "—";
        const secondary = parts.slice(1).join(",").trim() || "";
        return (
          <div className="flex flex-col text-left">
            <span className="text-gray-900 leading-normal">{primary}</span>
            {secondary && (
              <span className="text-select-blue text-xs leading-tight mt-0.5">
                {secondary}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (_, item) => (
        <span
          className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase ${getBadgeClass(item.status)}`}
        >
          {item.status}
        </span>
      ),
    },
    { key: "investment", label: "Investment" },
    {
      key: "possessionDate",
      label: "Possession Date",
      render: (_, item) =>
        item.timelineTight ? (
          <span
            className="inline-flex items-center gap-1.5 text-red-600 font-semibold"
            title="Possession date is tighter than our estimated delivery — at-risk timeline"
          >
            <FiAlertTriangle size={13} className="shrink-0" />
            {item.possessionDate || "—"}
          </span>
        ) : (
          item.possessionDate || "—"
        ),
    },
  ];

  const isInquiries = activeMainTab === 0;

  const subtitle = isInquiries
    ? `${MAIN_TABS[0]} - ${SUB_TABS[0][activeSubTab]}`
    : `${MAIN_TABS[activeMainTab]}`;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Table
        title="Leads"
        subtitle={subtitle}
        mainTabs={MAIN_TABS}
        onMainTabChange={(idx) => {
          setActiveMainTab(idx);
          setActiveSubTab(0);
        }}
        actions={
          isInquiries && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-linear-to-r from-select-blue to-dark-blue text-white rounded-lg px-8 py-2.5 text-sm font-medium"
            >
              <FiPlusCircle />
              Add Inquiry
            </button>
          )
        }
        columns={isInquiries ? columns : []}
        data={isInquiries ? data : []}
        emptyMessage={
          isInquiries
            ? loading
              ? "Loading..."
              : "No records found."
            : "Project Caliber view — replace this with your component"
        }
        rowsPerPage={8}
        activeRowKey="proposalId"
        subTabs={isInquiries ? SUB_TABS[0] : undefined}
        onSubTabChange={setActiveSubTab}
        sortFields={
          isInquiries
            ? [
                { key: "proposalId", label: "Proposal ID" },
                { key: "clientName", label: "Client Name" },
                { key: "investment", label: "Investment" },
                { key: "possessionDate", label: "Possession Date" },
              ]
            : undefined
        }
        filterFields={
          isInquiries
            ? [
                {
                  key: "status",
                  label: "Status",
                  options: [
                    "Inquiry",
                    "Qualified",
                    "Proposal",
                    "Negotiation",
                    "Won",
                    "On Hold",
                    "Lost",
                  ],
                },
                {
                  key: "serviceTrack",
                  label: "Service Track",
                  options: SERVICE_TRACKS,
                },
              ]
            : undefined
        }
        dateRangeField={
          isInquiries
            ? {
                key: "possessionDate",
                parse: (value) => {
                  const parts = value?.split(".");
                  if (parts?.length === 3)
                    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                  return null;
                },
              }
            : undefined
        }
        exportConfig={
          isInquiries
            ? {
                filename: "leads_export",
                columns: [
                  { label: "Sno", key: "sno" },
                  { label: "Proposal ID", key: "proposalId" },
                  { label: "Client Name", key: "clientName" },
                  { label: "Phone", key: "phone" },
                  { label: "Scope", key: "scope" },
                  {
                    label: "Location",
                    render: (item) =>
                      `${item.location} - ${item.locationSecondary}`,
                  },
                  { label: "Status", key: "status" },
                  { label: "Investment", key: "investment" },
                  { label: "Possession Date", key: "possessionDate" },
                ],
              }
            : undefined
        }
      />

      {showForm && (
        <NewInquiriesform
          onClose={() => setShowForm(false)}
          onAddLead={handleAddLead}
        />
      )}
    </div>
  );
};

export default Leads;
