import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiPlusCircle } from "react-icons/fi";
import Table from "../../components/Table";
import AddSiteModal from "./components/AddSiteModal";
import {
  getAllSites,
  createCustomSite,
  saveSite,
  hydrateSites,
  SUPERVISORS,
} from "../../data/siteStorage";
import { getSiteLead } from "../../data/surveyMeasureStorage";
import { resolveServiceTrack } from "../../data/serviceTrack";

const SUB_TABS = ["All", "Survey", "Design", "In Progress", "Completed"];

const SUB_TAB_STATUS = {
  0: null,
  1: "survey",
  2: "design",
  3: "in progress",
  4: "completed",
};

const Sites = () => {
  const navigate = useNavigate();
  const [allSites, setAllSites] = useState(() => getAllSites());
  const [activeSubTab, setActiveSubTab] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Assign-surveyor flow (starts the survey from the table itself)
  const [assigningSite, setAssigningSite] = useState(null);
  const [assignSup, setAssignSup] = useState("");

  const handleAssignClick = (row) => {
    setAssigningSite(row);
    setAssignSup(row.supervisor || SUPERVISORS[0] || "");
  };

  const handleAssignConfirm = () => {
    if (!assigningSite || !assignSup) return;
    // Assigning a surveyor starts the survey → status Survey.
    saveSite({
      ...assigningSite,
      supervisor: assignSup,
      status: "Survey",
      progress: assigningSite.progress || 25,
    });
    setAllSites(getAllSites());
    setAssigningSite(null);
    window.dispatchEvent(new Event("siteDataChanged"));
  };

  useEffect(() => {
    const handler = () => {
      setAllSites(getAllSites());
    };
    window.addEventListener("siteDataChanged", handler);
    window.addEventListener("focus", handler);
    // Pull the backend's sites into the local cache on mount (best-effort).
    // hydrateSites dispatches `siteDataChanged` on success, refreshing the list.
    hydrateSites();
    return () => {
      window.removeEventListener("siteDataChanged", handler);
      window.removeEventListener("focus", handler);
    };
  }, []);

  // Filter and format data for the Table component
  const filteredData = useMemo(() => {
    const targetStatus = SUB_TAB_STATUS[activeSubTab];
    const filtered = targetStatus
      ? allSites.filter((s) => s.status?.toLowerCase() === targetStatus)
      : allSites;

    return filtered.map((site, index) => {
      // Resolve the service track (and project intent) from the source lead so
      // architecture sites don't show an interiors preset in the Scope column.
      const lead = getSiteLead(site);
      return {
        ...site,
        serviceTrack: resolveServiceTrack(lead || site),
        projectIntent: lead?.projectIntent || "",
        sno: String(index + 1).padStart(2, "0"),
      };
    });
  }, [allSites, activeSubTab]);

  const handleOpenDetails = (site) => {
    navigate(`/sitevisit/${site.siteID}`);
  };

  const handleAddSiteSubmit = async (siteData) => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    createCustomSite({
      ...siteData,
      status: null,
      progress: 0,
    });

    setAllSites(getAllSites());
    setShowAddModal(false);
    setIsSaving(false);
  };

  const columns = [
    { key: "sno", label: "S.No" },
    {
      key: "siteID",
      label: "Site ID",
      render: (val) => (
        <span className="cursor-pointer hover:underline font-medium text-gray-900">
          {val}
        </span>
      ),
    },
    {
      key: "clientName",
      label: "Client Name",
      render: (val) => (
        <span className="cursor-pointer hover:underline font-medium text-gray-900">
          {val}
        </span>
      ),
    },
    {
      key: "scope",
      label: "Scope",
      render: (_, row) => {
        if (row.serviceTrack === "Architecture") {
          return row.projectIntent
            ? `${row.projectIntent} · Architecture`
            : "Architecture";
        }
        const preset = row.propertyPreset;
        const siteType = row.siteType || "";
        const formattedPreset = preset ? preset.replace(/^(\d+)(BHK)$/i, "$1 BHK") : "";
        return formattedPreset ? `${formattedPreset} / ${siteType}` : siteType;
      },
    },
    {
      key: "location",
      label: "Location",
      render: (val) => {
        if (!val) return "—";
        const parts = val.includes(",") ? val.split(",") : [val, ""];
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
    { key: "supervisor", label: "Supervisor" },
    {
      key: "progress",
      label: "Progress",
      render: (val) => {
        const percentage = Number(val || 0);
        return (
          <div className="flex items-center gap-3 justify-center min-w-[120px]">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-select-blue h-2 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <span className="text-[11px] font-semibold text-darkgray">
              {percentage}%
            </span>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (val, row) => {
        // Not yet assigned → Assign starts the survey, right here in the table.
        // Gated on supervisor (not status) — the schedule auto-seeds a
        // "Survey" status as soon as a lead converts to a client, before
        // anyone has actually been assigned.
        if (!row.supervisor) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAssignClick(row);
              }}
              className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-select-blue text-white hover:bg-blue-950 transition-colors"
            >
              Assign
            </button>
          );
        }
        const statusColors = {
          survey: "bg-blue-100 text-blue-700",
          design: "bg-purple-100 text-purple-700",
          "in progress": "bg-amber-100 text-amber-700",
          completed: "bg-green-100 text-green-700",
        };
        const style =
          statusColors[val?.toLowerCase()] || "bg-gray-100 text-gray-600";
        return (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${style}`}
          >
            {val || "Not Started"}
          </span>
        );
      },
    },
    { key: "targetDate", label: "Target Completion" },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      <Table
        title="Project Sites"
        subtitle={`Sites - ${SUB_TABS[activeSubTab]}`}
        columns={columns}
        data={filteredData}
        emptyMessage="No sites found in this category."
        rowsPerPage={8}
        subTabs={SUB_TABS}
        onSubTabChange={setActiveSubTab}
        activeRowKey="siteID"
        onRowClick={handleOpenDetails}
        clickableColumns={["siteID", "clientName"]}
        onCellClick={handleOpenDetails}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-linear-to-r from-select-blue to-dark-blue text-white rounded-lg px-8 py-2.5 text-sm font-medium cursor-pointer hover:shadow-select-blue/30 hover:hover:scale-[1.02]"
          >
            <FiPlusCircle />
            Add Site
          </button>
        }
        sortFields={[
          { key: "clientName", label: "Client Name" },
          { key: "siteID", label: "Site ID" },
          { key: "progress", label: "Progress" },
          { key: "status", label: "Status" },
        ]}
        filterFields={[
          {
            key: "status",
            label: "Status",
            options: ["Survey", "Design", "In Progress", "Completed"],
          },
          {
            key: "supervisor",
            label: "Supervisor",
            options: SUPERVISORS,
          },
        ]}
        dateRangeField={{
          key: "targetDate",
          parse: (value) => {
            const parts = value?.split(".");
            if (parts?.length === 3)
              return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            return null;
          },
        }}
        exportConfig={{
          filename: "sites_export",
          columns: [
            { label: "S.No", key: "sno" },
            { label: "Site ID", key: "siteID" },
            { label: "Client Name", key: "clientName" },
            {
              label: "Scope",
              render: (row) => {
                if (row.serviceTrack === "Architecture") {
                  return row.projectIntent
                    ? `${row.projectIntent} · Architecture`
                    : "Architecture";
                }
                const preset = row.propertyPreset;
                const siteType = row.siteType || "";
                const formattedPreset = preset ? preset.replace(/^(\d+)(BHK)$/i, "$1 BHK") : "";
                return formattedPreset ? `${formattedPreset} / ${siteType}` : siteType;
              },
            },
            { label: "Location", key: "location" },
            { label: "Supervisor", key: "supervisor" },
            { label: "Progress (%)", key: "progress" },
            { label: "Status", key: "status" },
            { label: "Target Completion", key: "targetDate" },
          ],
        }}
      />

      {/* Add Site Modal */}
      {showAddModal && (
        <AddSiteModal
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddSiteSubmit}
          isSaving={isSaving}
          SUPERVISORS={SUPERVISORS}
        />
      )}

      {/* Assign Surveyor Modal — assigning starts the survey */}
      {assigningSite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setAssigningSite(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-bold text-textcolor mb-1">
              Assign Surveyor
            </h3>
            <p className="text-[12px] text-text-muted mb-4">
              {assigningSite.siteID} · {assigningSite.clientName} — assigning
              starts the survey.
            </p>
            <label className="block text-[12px] font-semibold text-text-muted mb-1">
              Surveyor / Supervisor
            </label>
            <select
              value={assignSup}
              onChange={(e) => setAssignSup(e.target.value)}
              className="w-full border border-bordergray rounded-lg px-3 py-2 text-[13px] text-textcolor bg-white mb-5"
            >
              {SUPERVISORS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssigningSite(null)}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold text-text-muted hover:bg-bg-soft"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignConfirm}
                disabled={!assignSup}
                className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white bg-select-blue hover:bg-blue-950 disabled:opacity-40"
              >
                Assign & Start Survey
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sites;
