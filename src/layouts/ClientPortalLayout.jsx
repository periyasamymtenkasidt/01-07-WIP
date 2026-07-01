import React, { useState, useEffect } from "react";
import { useNavigate, useParams, NavLink, Outlet, useLocation } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa6";
import { RiMoneyRupeeCircleFill } from "react-icons/ri";
import { FaRegFilePdf } from "react-icons/fa6";
import {
  Mail,
  Loader2,
  ArrowLeft,
  Home,
  Calendar,
  MessageCircleMore,
  LogOut,
  Phone,
  FileText,
  Activity,
  MapPin,
  Image as ImageIcon,
  Bell
} from "lucide-react";
import { getClient, getAllClients } from "../data/clientStorage";
import { getActiveClientId, clientLogout } from "../auth/clientAuth";
import { PAYMENT_MILESTONES } from "../data/MilestoneConfig";
import { getAllSites, saveSite } from "../data/siteStorage";
import wipLogo from "../assets/images/Logo.png";
import ClientAvatar from "../assets/images/Client_avatar.png";

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

const ClientPortalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clientId: routeClientId } = useParams();

  const getDynamicTitle = () => {
    const path = location.pathname;
    if (path.endsWith("/dashboard")) return "Client Dashboard";
    if (path.endsWith("/designs-renders")) return "Designs & Renders";
    if (path.endsWith("/quotes")) return "Project Estimates & Quotes";
    if (path.endsWith("/calendar")) return "Site Visits & Calendar";
    if (path.endsWith("/milestones")) return "Payment Milestones";
    if (path.endsWith("/invoice")) return "GST Invoices";
    if (path.endsWith("/chat")) return "Support & Chat";
    return "Client Profile";
  };
  const [clientId, setClientId] = useState(routeClientId || getActiveClientId());
  const [client, setClient] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [associatedLead, setAssociatedLead] = useState(null);

  const [site, setSite] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

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
  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [appointments, setAppointments] = useState(() => {
    const saved = localStorage.getItem(`clientAppointments_${clientId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback to default
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
  const [chatMessage, setChatMessage] = useState("");
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem(`clientMessages_${clientId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallback to default
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

  // Define client sidebar module menus
  const clientModules = [
    { id: "dashboard", label: "Dashboard", icon: Home, path: "dashboard" },
    { id: "milestones", label: "Payment Milestones", icon: RiMoneyRupeeCircleFill, path: "payment-milestones" },
    { id: "quotes", label: "Project Quotes", icon: FaRegFilePdf, path: "project-quotes" },
    { id: "appointments", label: "Site Visits & Calendar", icon: Calendar, path: "site-visits-calendar" },
    { id: "gallery", label: "Designs & Renders", icon: ImageIcon, path: "designs-renders" },
    { id: "support", label: "Support & Chat", icon: MessageCircleMore, path: "support-chat" },
    { id: "invoices", label: "GST Invoice", icon: FileText, path: "gst-invoice" },
  ];

  return (
    <div className="min-h-screen bg-overallbg text-textcolor flex w-full font-sans overflow-hidden h-screen">
      
      {/* Left Sidebar Module Bar */}
      <aside className="w-20 md:w-64 bg-white border-r border-bordergray flex flex-col justify-between shrink-0 h-full p-4 z-40 shadow-sm">
        <div className="flex flex-col gap-2">
          {/* Logo */}
          <div className="mb-6 hidden md:flex items-center gap-3 px-2">
            <img src={wipLogo} alt="WIP Logo" className="h-8 w-auto object-contain" />
            <div className="flex flex-col border-l border-paleorange/40 pl-3 leading-none">
              <p className="text-[10px] uppercase tracking-[0.3em] text-dark-yellow font-bold">
                Client Portal
              </p>
            </div>
          </div>

          {/* Module list */}
          {clientModules.map((m) => {
            const Icon = m.icon;
            return (
              <NavLink
                key={m.id}
                to={`/client-portal/${clientId}/${m.path}`}
                className={({ isActive }) =>
                  `flex flex-col font-semibold md:flex-row items-center gap-1 md:gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "bg-active-bg text-select-blue md:border-r-4 md:border-select-blue font-bold shadow-sm"
                      : "text-grey hover:bg-active-bg hover:text-darkgray"
                  }`
                }
              >
                <Icon size={20} />
                <span className="text-[9px] md:text-[13.5px] leading-tight text-center md:text-left whitespace-nowrap">
                  {m.label}
                </span>
              </NavLink>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="border-t border-bordergray/60 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <img src={ClientAvatar} alt="Client" className="w-8 h-8 rounded-full object-cover border border-bordergray" />
            <div className="hidden md:block text-left leading-none">
              <p className="text-xs font-bold text-darkgray truncate w-32">{client.clientName}</p>
              <p className="text-[10px] text-text-subtle mt-0.5">{client.clientID}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center md:justify-start gap-3 w-full px-3 py-2.5 rounded-xl border border-bordergray text-grey hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all cursor-pointer shadow-sm"
            title="Log Out"
          >
            <LogOut size={16} />
            <span className="hidden md:inline text-xs font-bold">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Title bar */}
        <div className="px-6 sm:px-10 pt-6 flex justify-between items-center shrink-0 relative">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-bordergray hover:bg-gray-50 text-gray-500 transition-all shadow-sm cursor-pointer animate-all"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-[26px] font-bold text-darkgray leading-tight">
                {getDynamicTitle()}
              </h1>
              <p className="text-[13px] text-gray-500 mt-1">
                Clients — {client.clientName}
              </p>
            </div>
          </div>

          {/* Notifications Bell Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-bordergray hover:bg-gray-50 text-gray-500 transition-all shadow-sm cursor-pointer relative"
              title="Notifications"
            >
              <Bell size={18} />
              {notifications.some((n) => !n.read) && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-bordergray rounded-2xl shadow-xl z-50 p-4 text-left max-h-96 overflow-y-auto">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100 mb-3">
                  <h4 className="text-xs font-bold text-darkgray uppercase tracking-wider">Notifications</h4>
                  {notifications.some((n) => !n.read) && (
                    <button
                      onClick={() => markAllNotificationsAsRead()}
                      className="text-[10px] font-bold text-purple hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No notifications yet</p>
                ) : (
                  <div className="space-y-3">
                    {notifications.map((n) => (
                      <div key={n.id} className={`flex gap-3 p-2 rounded-xl transition-colors hover:bg-slate-50 ${!n.read ? "bg-blue-50/30" : ""}`}>
                        <div className="mt-0.5 shrink-0">
                          {n.type === "success" && <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />}
                          {n.type === "upload" && <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />}
                          {n.type === "approval" && <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5" />}
                          {n.type === "info" && <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-darkgray truncate">{n.title}</p>
                          <p className="text-[11px] text-gray-500 leading-snug mt-0.5 whitespace-pre-wrap">{n.text}</p>
                          <p className="text-[9px] text-gray-400 mt-1 font-semibold">{n.timestamp}</p>
                        </div>
                        {!n.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2 self-start shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-6 sm:p-10 flex flex-col lg:flex-row gap-6 overflow-y-auto">
          
          {/* Left Column - Sidebar Info */}
          {location.pathname.endsWith("/dashboard") && (
            <div className="w-full lg:w-1/3 flex flex-col gap-6 min-w-0 shrink-0">
              {/* Profile Card */}
              <div className="bg-white rounded-[20px] p-8 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <img
                    src={ClientAvatar}
                    alt=""
                    className="w-28 h-28 rounded-full border-[3px] border-white shadow-md object-cover"
                  />
                  <div className="absolute bottom-2 right-2 w-4 h-4 bg-emerald-500 border-[3px] border-white rounded-full" />
                </div>

                <h3 className="text-[22px] font-bold text-dark-blue mb-1">
                  {client.clientName}
                </h3>
                <p className="text-[12px] font-medium text-gray-400 mb-2">
                  {client.clientID}
                </p>

                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusStyle(client.paymentStatus || "pending")}`}
                >
                  {client.paymentStatus || "PENDING"}
                </span>

                {isConverted && (
                  <span className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-teal-600">
                    Converted from Lead #{client.sourceLeadId}
                  </span>
                )}

                {client.joinDate && (
                  <p className="mt-2 text-[11px] text-text-muted">
                    Client since {client.joinDate}
                  </p>
                )}
              </div>

              {/* Profile Info Details Grid */}
              <div className="bg-white rounded-[20px] shadow-[0_2px_10px_-4px_rgba(0,0,0,0.1)] p-6 text-left">
                <h4 className="text-[13px] font-bold text-darkgray uppercase tracking-wider border-b border-gray-100 pb-3 mb-4">
                  Profile Details
                </h4>
                <div className="space-y-4">
                  {[
                    { label: "Phone Number", value: client.phone || "—", icon: Phone },
                    { label: "Email", value: client.email || "—", icon: Mail },
                    { label: "Property Preset", value: client.quotePreset || "—" },
                    { label: "Property Type", value: client.propertyType || "Apartment" },
                    { label: "Location", value: client.location || "—", icon: MapPin },
                    { label: "Budget", value: client.budget || "—", icon: RiMoneyRupeeCircleFill },
                  ].map(({ label, value, icon: Icon }, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-medium flex items-center gap-1.5">
                        {Icon && <Icon size={12} />}
                        {label}
                      </span>
                      <p className="font-bold text-darkgray text-right truncate pl-4 max-w-[160px]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Right Column - Stats and Sub-Module View */}
          <div className={`${location.pathname.endsWith("/dashboard") ? "w-full lg:w-2/3" : "w-full"} flex flex-col gap-6 min-w-0`}>
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
      </div>
    </div>
  );
};

export default ClientPortalLayout;
