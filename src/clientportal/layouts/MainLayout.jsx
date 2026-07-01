import React, { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation, Outlet } from "react-router-dom";
import { Loader2, Activity } from "lucide-react";
import { getClient, getAllClients } from "../../data/clientStorage";
import { getActiveClientId, clientLogout } from "../../auth/clientAuth";
import { PAYMENT_MILESTONES } from "../../data/MilestoneConfig";
import { getAllSites, saveSite } from "../../data/siteStorage";
import Header from "./Header";
import Sidebar from "./Sidebar";

const parseBudget = (budgetString) => {
  if (!budgetString) return 5000000;
  let cleanStr = budgetString.replace("₹", "").trim();
  if (cleanStr.includes("Cr")) {
    const val = parseFloat(cleanStr.replace("Cr", "").split("-")[0]);
    return val * 10000000;
  }
  if (cleanStr.includes("L")) {
    const parts = cleanStr.replace("L", "").split("-");
    const val = parseFloat(parts[0]);
    const val2 = parts[1] ? parseFloat(parts[1]) : val;
    return ((val + val2) / 2) * 100000;
  }
  return 5000000;
};

const formatAmount = (amount) => {
  if (!amount || amount <= 0) return "—";
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${amount.toLocaleString("en-IN")}`;
};

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clientId: routeClientId } = useParams();

  const getDynamicTitle = () => {
    const path = location.pathname;
    if (path.endsWith("/dashboard")) return "Dashboard";
    if (path.endsWith("/designs-renders")) return "Designs and Renders";
    if (path.endsWith("/project-quotes")) return "Project Quotes";
    if (path.endsWith("/site-visits-calendar")) return "Site Visit and Calendar";
    if (path.endsWith("/payment-milestones")) return "Payment Milestones";
    if (path.endsWith("/gst-invoice")) return "Invoice";
    if (path.endsWith("/support-chat")) return "Support";
    if (path.endsWith("/profile")) return "Profile";
    if (path.endsWith("/signout")) return "Sign Out";
    return "Client";
  };
  const [clientId, setClientId] = useState(routeClientId || getActiveClientId());
  const [client, setClient] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [associatedLead, setAssociatedLead] = useState(null);

  const [site, setSite] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (client) {
      const allSites = getAllSites();
      const foundSite = allSites.find((s) => s.clientID === client.clientID);
      if (foundSite) {
        let needsSave = false;

        // Initialize drawings if missing
        if (!foundSite.drawings || foundSite.drawings.length === 0) {
          const baseDrawings = [
            {
              id: "dr-1",
              name: "Floor Plan Layout",
              category: "2D Drawings",
              version: "V1",
              uploadedBy: "Rahul G.",
              uploadDate: "09.06.2026",
              status: "Approved",
              fileUrl: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
              fileSize: "1.2 MB",
              size: 1258291,
            },
            {
              id: "dr-2",
              name: "Electrical Layout",
              category: "2D Drawings",
              version: "V2",
              uploadedBy: "Rahul G.",
              uploadDate: "10.06.2026",
              status: "Under Review",
              fileUrl: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=800&q=80",
              fileSize: "1.8 MB",
              size: 1887436,
            },
            {
              id: "dr-3",
              name: "Living Room Render",
              category: "3D Drawings",
              version: "V1",
              uploadedBy: "Priya S.",
              uploadDate: "10.06.2026",
              status: "Draft",
              fileUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80",
              fileSize: "3.4 MB",
              size: 3565158,
            }
          ];

          foundSite.drawings = baseDrawings.map((d) => ({
            ...d,
            visibleToClient: true,
            reviewer: "",
            reviewDate: "",
            reviewComments: "",
            versions: [
              {
                version: d.version,
                name: d.name,
                url: d.fileUrl,
                uploadedBy: d.uploadedBy,
                uploadDate: d.uploadDate,
                fileSize: d.fileSize || "1.5 MB",
                size: d.size || 1572864,
                changeNotes: "Initial drawing upload.",
              }
            ]
          }));
          needsSave = true;
        }

        // Initialize revisions if missing
        if (!foundSite.revisions || foundSite.revisions.length === 0) {
          foundSite.revisions = [
            {
              id: "rev-1",
              revisionNumber: "V1",
              date: "09.06.2026",
              requestedBy: "Client (Ankit)",
              category: "Space Layout",
              description: "Requesting a partition between living room and dining area.",
              priority: "Medium",
              notes: "Added partition wall layout in 2D Floor Plan.",
              status: "Completed",
              attachedFiles: [
                {
                  id: "att-init-0",
                  name: "client_feedback_sketch.jpg",
                  type: "JPG",
                  uploadedBy: "Client (Ankit)",
                  uploadedDate: "09.06.2026",
                  version: "V1",
                  url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
                  size: 450000,
                  versions: [
                    {
                      version: "V1",
                      name: "client_feedback_sketch.jpg",
                      url: "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
                      uploadedBy: "Client (Ankit)",
                      uploadDate: "09.06.2026",
                      fileSize: "450 KB",
                      size: 450000,
                      changeNotes: "Initial client feedback attachment.",
                    }
                  ]
                }
              ]
            }
          ];
          needsSave = true;
        }

        // Initialize discussion history if missing
        if (!foundSite.discussionHistory || foundSite.discussionHistory.length === 0) {
          foundSite.discussionHistory = [
            {
              id: "comm-1",
              author: "Priya S. (Designer)",
              text: "Drafted the Scandinavian theme for the living room. Let me know what you think.",
              timestamp: "09.06.2026 11:20 AM",
              attachments: []
            },
            {
              id: "comm-2",
              author: "Vijay K. (Supervisor)",
              text: "The living room electrical points look aligned with the site survey layout.",
              timestamp: "09.06.2026 02:45 PM",
              attachments: []
            }
          ];
          needsSave = true;
        }

        // Initialize progress status parameters if missing
        if (foundSite.progress === undefined || foundSite.progress === 0) {
          foundSite.progress = 75;
          needsSave = true;
        }
        if (!foundSite.approvalStatus) {
          foundSite.approvalStatus = "Sent";
          needsSave = true;
        }
        if (!foundSite.designStatus) {
          foundSite.designStatus = "In Progress";
          needsSave = true;
        }

        // Initialize client notifications
        let clientNotifs = foundSite.clientNotifications;
        if (!clientNotifs || clientNotifs.length === 0) {
          clientNotifs = [
            {
              id: "notif-1",
              title: "Welcome to Design Workspace!",
              text: "Track progress, review renders, and request revisions here.",
              timestamp: "08.06.2026 10:00 AM",
              type: "info",
              read: false,
            },
          ];
          if (foundSite.drawings && foundSite.drawings.length > 0) {
            foundSite.drawings.forEach((d, idx) => {
              clientNotifs.push({
                id: `notif-dr-${d.id}-${idx}`,
                title: d.category === "3D Drawings" ? "New Render Uploaded" : "New Drawing Uploaded",
                text: `${d.name} (Version ${d.version}) uploaded by ${d.uploadedBy || "Priya S."}.`,
                timestamp: `${d.uploadDate || "10.06.2026"} 11:30 AM`,
                type: "upload",
                read: true,
              });
            });
          }
          if (foundSite.approvalStatus === "Sent" || foundSite.approvalStatus === "Viewed") {
            clientNotifs.push({
              id: "notif-app-req",
              title: "Design Approval Requested",
              text: "The design team has submitted the design package for your approval.",
              timestamp: "10.06.2026 05:00 PM",
              type: "approval",
              read: false,
            });
          }
          foundSite.clientNotifications = clientNotifs;
          needsSave = true;
        }

        if (needsSave) {
          saveSite(foundSite);
        }

        setSite(foundSite);
        setNotifications(clientNotifs);
      }
    }
  }, [client]);

  const updateSite = (updatedSiteOrFn) => {
    setSite((prevSite) => {
      const nextSite = typeof updatedSiteOrFn === "function" ? updatedSiteOrFn(prevSite) : updatedSiteOrFn;
      saveSite(nextSite);
      if (nextSite && nextSite.clientNotifications) {
        setNotifications(nextSite.clientNotifications);
      }
      return nextSite;
    });
  };

  const addClientNotification = (title, text, type = "info") => {
    const dateStr = new Date().toLocaleDateString("en-IN") + " " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const newNotif = {
      id: `notif-${Date.now()}`,
      title,
      text,
      timestamp: dateStr,
      type,
      read: false,
    };

    updateSite((prevSite) => {
      if (!prevSite) return prevSite;
      const updatedNotifs = [newNotif, ...(prevSite.clientNotifications || [])];
      return {
        ...prevSite,
        clientNotifications: updatedNotifs,
      };
    });
  };

  const markAllNotificationsAsRead = () => {
    updateSite((prevSite) => {
      if (!prevSite) return prevSite;
      const updatedNotifs = (prevSite.clientNotifications || []).map((n) => ({ ...n, read: true }));
      return {
        ...prevSite,
        clientNotifications: updatedNotifs,
      };
    });
  };

  // Appointments / Site Visits state
  const [appointments, setAppointments] = useState(() => {
    const saved = localStorage.getItem(`clientAppointments_${clientId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.log(e);
      }
    }
    return [
      {
        date: "12",
        month: "JAN",
        title: "Site Visit – Luxury Villa Review",
        time: "10:00 – 12:00",
        status: "Done",
        statusColor: "bg-[#E6F4EA] text-[#16A34A] border-[#DCFCE7]",
        type: "Site Review",
      },
      {
        date: "28",
        month: "JAN",
        title: "Electrical & Ceiling Layout Discussion",
        time: "14:00 – 15:30",
        status: "Done",
        statusColor: "bg-[#E6F4EA] text-[#16A34A] border-[#DCFCE7]",
        type: "Drawing Review",
      },
      {
        date: "14",
        month: "FEB",
        title: "Material & Flooring Selection",
        time: "11:00 – 12:30",
        status: "Done",
        statusColor: "bg-[#E6F4EA] text-[#16A34A] border-[#DCFCE7]",
        type: "Selection",
      },
      {
        date: "10",
        month: "JUN",
        title: "Site Progress Walkthrough",
        time: "10:00 – 11:30",
        status: "Scheduled",
        statusColor: "bg-[#E0F2FE] text-[#0284C7] border-[#BAE6FD]",
        type: "Site Visit",
      },
    ];
  });

  // Support / Message Log state
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`clientMessages_${clientId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.log(e);
      }
    }
    return [
      {
        sender: "designer",
        text: "Hello! We have uploaded the finalized 3D renders for the Living Room in the Designs gallery. Let us know your thoughts.",
        time: "Today, 10:15 AM",
      },
    ];
  });

  // Gallery items (Moodboards, Drawings, Renders)
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    if (routeClientId && routeClientId !== clientId) {
      setClientId(routeClientId);
    }
  }, [routeClientId]);

  useEffect(() => {
    const activeId = clientId;
    const cData = getClient(activeId);
    if (!cData) {
      const list = getAllClients();
      if (list.length > 0) {
        setClient(list[0]);
        loadMilestones(list[0].clientID, list[0]);
      }
    } else {
      setClient(cData);
      loadMilestones(activeId, cData);
    }
  }, [clientId]);

  // Load and merge admin drawings
  useEffect(() => {
    if (!clientId) return;
    const staticGallery = [
      {
        id: "gal-1",
        title: "Living Room 3D Render (Theme: Warm Contemporary)",
        category: "3D Render",
        url: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80",
        uploaded: "02.06.2026",
      },
      {
        id: "gal-2",
        title: "Floor Plan & Partition Details Layout",
        category: "CAD Drawing",
        url: "https://images.unsplash.com/photo-1503387762458-7e52f42855f9?auto=format&fit=crop&w=800&q=80",
        uploaded: "28.05.2026",
      },
      {
        id: "gal-3",
        title: "Moodboard - Master Bedroom Textures & Veneers",
        category: "Moodboard",
        url: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=80",
        uploaded: "20.05.2026",
      },
    ];

    const savedDrawings = localStorage.getItem(`siteDrawings_${clientId}`);
    if (savedDrawings) {
      try {
        const drawings = JSON.parse(savedDrawings);
        const visibleDrawings = drawings
          .filter((d) => d.visibleToClient)
          .map((d) => ({
            id: d.id,
            title: d.name,
            category: "CAD Drawing",
            url: d.fileUrl || "https://images.unsplash.com/photo-1503387762458-7e52f42855f9?auto=format&fit=crop&w=800&q=80",
            uploaded: d.date || "12.06.2026",
          }));
        setGallery([...staticGallery, ...visibleDrawings]);
      } catch (e) {
        setGallery(staticGallery);
      }
    } else {
      setGallery(staticGallery);
    }
  }, [clientId]);

  useEffect(() => {
    if (!client) return;
    const savedLeads = localStorage.getItem("newLeadsData");
    const leadsList = savedLeads ? JSON.parse(savedLeads) : [];
    const foundLead = leadsList.find(
      (l) =>
        l.proposalId === client.sourceLeadId ||
        l.convertedClientID === client.clientID
    ) || null;
    setAssociatedLead(foundLead);
  }, [client]);

  // Save appointments to localStorage
  useEffect(() => {
    if (clientId) {
      localStorage.setItem(`clientAppointments_${clientId}`, JSON.stringify(appointments));
    }
  }, [appointments, clientId]);

  // Save messages to localStorage
  useEffect(() => {
    if (clientId) {
      localStorage.setItem(`clientMessages_${clientId}`, JSON.stringify(messages));
    }
  }, [messages, clientId]);

  const loadMilestones = (cid, cData) => {
    const saved = localStorage.getItem(`clientMilestones_${cid}`);
    if (saved) {
      try {
        setMilestones(JSON.parse(saved));
      } catch (e) {
        generateDefaultMilestones(cid, cData);
      }
    } else {
      generateDefaultMilestones(cid, cData);
    }
  };

  const generateDefaultMilestones = (cid, cData) => {
    const val = parseBudget(cData.budget);
    const initialMilestones = PAYMENT_MILESTONES.map((m) => {
      const base = Math.round(val * (m.pct / 100));
      const gstAmt = Math.round(base * 0.18);
      const total = base + gstAmt;
      return {
        id: m.id,
        name: m.name,
        pct: m.pct,
        base,
        gstAmt,
        total,
        status: m.id === 1 ? "paid" : "pending",
        paidDate: m.id === 1 ? "15.05.2026" : "",
      };
    });
    localStorage.setItem(`clientMilestones_${cid}`, JSON.stringify(initialMilestones));
    setMilestones(initialMilestones);
  };

  const handleCreateAppointment = (subject, date, time) => {
    if (!subject || !date || !time) return;

    const dateParts = date.split("-");
    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = monthNames[parseInt(dateParts[1], 10) - 1] || "JUN";
    const day = dateParts[2] || "15";

    const newApt = {
      date: day,
      month,
      title: subject,
      time: time,
      status: "Pending Approval",
      statusColor: "bg-[#FEF3C7] text-pending border-[#FEEBBE]",
      type: "Client Request",
    };

    setAppointments([...appointments, newApt]);
  };

  const handleSendMessage = (text) => {
    if (!text.trim()) return;

    const newMsg = {
      sender: "client",
      text: text,
      time: "Just now",
    };

    const updated = [...messages, newMsg];
    setMessages(updated);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: "designer",
          text: "Thanks for writing! We have received your query. A project architect will get back to you shortly.",
          time: "Just now",
        },
      ]);
    }, 1500);
  };

  const handleLogout = () => {
    clientLogout();
    navigate("/client/login");
  };

  if (!client) {
    return (
      <div className="min-h-screen bg-overallbg flex justify-center items-center">
        <Loader2 className="animate-spin text-purple w-10 h-10" />
      </div>
    );
  }

  // Calculate metrics
  const paidCount = milestones.filter((m) => m.status === "paid").length;
  const pendingCount = milestones.length - paidCount;
  const totalContract = milestones.reduce((s, m) => s + m.total, 0);
  const totalCollected = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.total, 0);
  const remainingCollected = totalContract - totalCollected;

  const isConverted = !!client.sourceLeadId;
  const progressPct = totalContract > 0 ? Math.round((totalCollected / totalContract) * 100) : 0;

  const getStatusStyle = (status) => {
    const s = status?.toLowerCase();
    if (s === "pending") return "bg-[#FFF4E5] text-pending border-[#FFEDD5]";
    if (s === "completed") return "bg-[#E6F4EA] text-[#16A34A] border-[#DCFCE7]";
    return "bg-gray-100 text-gray-600 border-gray-200";
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-overallbg font-manrope">
      {/* Top Header */}
      <header className="shrink-0 sticky top-0 z-50">
        <Header
          client={client}
          clientId={clientId}
          notifications={notifications}
          markAllNotificationsAsRead={markAllNotificationsAsRead}
          handleLogout={handleLogout}
        />
      </header>

      <div className="flex-1 w-full flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="shrink-0 h-full overflow-y-auto scroll-hidden-bar">
          <Sidebar clientId={clientId} handleLogout={handleLogout} />
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-hidden flex flex-col">
          {/* Title bar */}
          <div className="px-6 sm:px-10 pt-4 pb-2 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-[26px] font-bold text-darkgray leading-tight">
                  {getDynamicTitle()}
                </h1>
                <p className="text-[13px] text-gray-500 mt-1">
                  Clients — {client.clientName}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 p-6 sm:p-10 flex flex-col lg:flex-row gap-6 overflow-y-auto">
            {/* The Left Column (Client Information) is REMOVED from the Dashboard as requested, since details are only displayed in the Client Profile page! */}

            {/* Right Column - Stats and Sub-Module View */}
            <div className={`${location.pathname.endsWith("/dashboard") ? "w-full lg:w-full" : "w-full"} flex flex-col gap-6 min-w-0 flex-1`}>
              {/* Stats Metric Cards */}
              {location.pathname.endsWith("/dashboard") && (
                <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 shrink-0 text-left">
                  <h3 className="flex items-center gap-2 text-[15px] font-bold text-darkgray border-b border-gray-100 pb-3 mb-4">
                    <Activity size={16} className="text-gray-500" /> Activity Summary
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100/50">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Stages</p>
                      <div className="text-[18px] font-extrabold text-slate-800">{milestones.length}</div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Stages Completed</p>
                      <div className="text-[18px] font-extrabold text-emerald-700">{paidCount}</div>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Stages Pending</p>
                      <div className="text-[18px] font-extrabold text-amber-700">{pendingCount}</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100/50">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total Project Value</p>
                      <div className="text-[18px] font-extrabold text-select-blue font-sans">
                        {formatAmount(totalContract)}
                      </div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Amount Paid</p>
                      <div className="text-[18px] font-extrabold text-emerald-700 font-sans">{formatAmount(totalCollected)}</div>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Balance Amount</p>
                      <div className="text-[18px] font-extrabold text-rose-700 font-sans">
                        {formatAmount(remainingCollected)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-module View Wrapper Card */}
              <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] flex flex-col flex-1">
                <Outlet context={{
                  client,
                  site,
                  updateSite,
                  notifications,
                  addClientNotification,
                  markAllNotificationsAsRead,
                  milestones,
                  setMilestones,
                  appointments,
                  setAppointments,
                  messages,
                  setMessages,
                  gallery,
                  setGallery,
                  totalContract,
                  totalCollected,
                  remainingCollected,
                  progressPct,
                  paidCount,
                  pendingCount,
                  associatedLead,
                  handleCreateAppointment,
                  handleSendMessage,
                  formatAmount,
                  parseBudget,
                  getStatusStyle
                }} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
