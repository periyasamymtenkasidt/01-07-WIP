import { useState, useMemo, useEffect } from "react";
import { FiPlusCircle } from "react-icons/fi";
import { ClientTableData } from "../../data/ClientTableData";
import { hydrateClients } from "../../data/clientStorage";
import { createClient } from "../../api/clients";
import AddClientForm from "./Addclientform";
import Table from "../../components/Table";
import { useNavigate } from "react-router-dom";

const MAIN_TABS = ["Clients"];

const SUB_TABS = {
  0: ["All", "Completed", "Pending", "Unfullfilled"],
};

// null means no filter (show all)
const SUB_TAB_STATUS = {
  "0-0": null,
  "0-1": "completed",
  "0-2": "pending",
  "0-3": "unfulfilled",
};

const Client = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState(0);

  const [newClients, setNewClients] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("newClientsData") || "[]");
    } catch {
      return [];
    }
  });

  const [deletedClients] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("deletedClients") || "[]");
    } catch {
      return [];
    }
  });

  // Pull the backend's clients into the local cache on mount, then refresh the
  // list from localStorage whenever the cache changes (hydrate fires
  // `leadDataChanged`, which ClientProfile edits/deletes also dispatch). Reads
  // stay synchronous; the network call is best-effort and never blocks the UI.
  useEffect(() => {
    const refresh = () => {
      try {
        setNewClients(JSON.parse(localStorage.getItem("newClientsData") || "[]"));
      } catch {
        setNewClients([]);
      }
    };
    hydrateClients();
    window.addEventListener("leadDataChanged", refresh);
    return () => window.removeEventListener("leadDataChanged", refresh);
  }, []);

  // Full merged dataset (new + static, minus deleted)
  const allClients = useMemo(() => { 
    const baseData = [...ClientTableData];
    const trulyNew = [];

    newClients.forEach((newClient) => {
      const idx = baseData.findIndex((c) => c.clientID === newClient.clientID);
      if (idx >= 0) {
        baseData[idx] = newClient;
      } else {
        trulyNew.push(newClient);
      }
    });

    return [...trulyNew, ...baseData].filter(
      (item) => !deletedClients.includes(item.clientID),
    );
  }, [newClients, deletedClients]);

  // Apply sub-tab filter + renumber sno
  const tableData = useMemo(() => {
    const filterStatus = SUB_TAB_STATUS[`${activeMainTab}-${activeSubTab}`];
    const filtered = filterStatus
      ? allClients.filter(
          (c) => c.paymentStatus?.toLowerCase() === filterStatus,
        )
      : allClients;
    return filtered.map((item, index) => ({
      ...item,
      sno: String(index + 1).padStart(2, "0"),
    }));
  }, [allClients, activeMainTab, activeSubTab]);

  // On add: POST to the backend (server assigns the real clientID = BL-YYYY-###
  // and a Mongo `id` used for later mutations), then mirror it into the local
  // merged cache so the not-yet-async table reflects it immediately. Same
  // write-through + graceful-fallback discipline as the leads/masters migration:
  // if the POST fails we still keep the client locally under a provisional id.
  const handleAddClient = async (newClientData) => {
    const maxStaticId = ClientTableData.reduce((max, c) => {
      const n = parseInt(c.clientID.split("-").pop(), 10);
      return n > max ? n : max;
    }, 0);
    const nextNum = maxStaticId + newClients.length + 1;
    const today = new Date();
    const joinDate = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`;

    // Body for POST /clients (camelCase; required: clientName, serviceTrack).
    // The Add form only collects a subset of fields; map what's available and
    // omit the rest so the server can fill defaults.
    const body = {
      clientName: newClientData.clientName,
      serviceTrack: newClientData.serviceTrack || "Interiors",
      phone: newClientData.clientPhone,
      email: newClientData.clientEmail,
      propertyType: newClientData.location,
      location: newClientData.locationSecondary,
      sizeRange: newClientData.sizeRange || "",
      budget: newClientData.budget,
      projectValue: newClientData.projectValue,
      gstin: newClientData.gstin,
      stateCode: newClientData.stateCode,
      billingAddress: newClientData.billingAddress,
      paymentStatus: newClientData.paymentStatus,
    };

    let created = null;
    try {
      created = await createClient(body); // server assigns clientID + id
    } catch (err) {
      console.warn(
        "createClient failed — saving client locally only:",
        err?.message || err,
      );
    }

    // Provisional clientID only if the server didn't give us one (offline/failure).
    const clientID =
      created?.clientID || `BL-2026-${String(nextNum).padStart(3, "0")}`;

    // Local record keeps the table's existing field shape; merge the server
    // record on top so server-computed fields (clientID, id, …) win.
    const newClient = {
      sno: nextNum,
      clientName: newClientData.clientName,
      clientPhone: newClientData.clientPhone,
      clientEmail: newClientData.clientEmail,
      location: newClientData.location,
      locationSecondary: newClientData.locationSecondary,
      budget: newClientData.budget,
      paymentStatus: newClientData.paymentStatus,
      joinDate,
      ...(created || {}),
      clientID,
    };
    const updated = [newClient, ...newClients];
    setNewClients(updated);
    localStorage.setItem("newClientsData", JSON.stringify(updated));
  };

  const columns = [
    { key: "sno", label: "S.No" },
    { key: "clientID", label: "Client ID" },
    { key: "clientName", label: "Client Name" },
    { key: "clientPhone", label: "Client Phone" },
    { key: "clientEmail", label: "Client Email" },
    {
      key: "Address",
      label: "Address",
      render: (_, item) => (
        <div className="flex flex-col items-center">
          <span className="text-gray-500 text-[15px]">{item.location}</span>
          <span className="text-select-blue text-[10px] leading-tight mt-0.5">
            {item.locationSecondary}
          </span>
        </div>
      ),
    },
    { key: "budget", label: "Budget" },
    {
      key: "paymentStatus",
      label: "Payment Status",
      render: (_, item) => {
        const statusStyles = {
          completed: "bg-green-100 text-green-700",
          pending: "bg-yellow-100 text-yellow-700",
          failed: "bg-red-100 text-red-600",
          cancelled: "bg-gray-100 text-gray-500",
        };
        const style =
          statusStyles[item.paymentStatus?.toLowerCase()] ||
          "bg-gray-100 text-gray-600";
        return (
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${style}`}
          >
            {item.paymentStatus}
          </span>
        );
      },
    },
  ];

  const isClients = activeMainTab === 0;
  const subtitle = isClients
    ? `${MAIN_TABS[0]} - ${SUB_TABS[0][activeSubTab]}`
    : MAIN_TABS[activeMainTab];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Table
        title="Clients"
        subtitle={subtitle}
        mainTabs={MAIN_TABS}
        onMainTabChange={(idx) => {
          setActiveMainTab(idx);
          setActiveSubTab(0);
        }}
        subTabs={isClients ? SUB_TABS[0] : undefined}
        onSubTabChange={setActiveSubTab}
        columns={isClients ? columns : []}
        data={isClients ? tableData : []}
        rowsPerPage={8}
        clickableColumns={isClients ? ["clientID", "clientName"] : []}
        onCellClick={
          isClients
            ? (item) => navigate(`/clients/${item.clientID}`)
            : undefined
        }
        activeRowKey="clientID"
        emptyMessage={
          isClients ? "No clients found." : "Project Caliber view — coming soon"
        }
        actions={
          isClients && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 bg-linear-to-r from-select-blue to-dark-blue text-white rounded-lg px-8 py-2.5 text-sm font-medium"

            >
              <FiPlusCircle />
              Add Client
            </button>
          )
        }
        sortFields={
          isClients
            ? [
                { key: "clientName", label: "Client Name" },
                { key: "clientID", label: "Client ID" },
                { key: "budget", label: "Budget" },
                { key: "paymentStatus", label: "Payment Status" },
              ]
            : undefined
        }
        filterFields={
          isClients
            ? [
                {
                  key: "paymentStatus",
                  label: "Payment Status",
                  options: ["Completed", "Pending", "Failed", "Cancelled"],
                },
              ]
            : undefined
        }
        dateRangeField={
          isClients
            ? {
                key: "joinDate",
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
          isClients
            ? {
                filename: "clients_export",
                columns: [
                  { label: "Sno", key: "sno" },
                  { label: "Client ID", key: "clientID" },
                  { label: "Client Name", key: "clientName" },
                  { label: "Client Phone", key: "clientPhone" },
                  { label: "Client Email", key: "clientEmail" },
                  {
                    label: "Location",
                    render: (item) =>
                      `${item.location} - ${item.locationSecondary}`,
                  },
                  { label: "Budget", key: "budget" },
                  { label: "Payment Status", key: "paymentStatus" },
                ],
              }
            : undefined
        }
      />

      {showForm && (
        <AddClientForm
          onClose={() => setShowForm(false)}
          onAddClient={handleAddClient}
        />
      )}
    </div>
  );
};

export default Client;
