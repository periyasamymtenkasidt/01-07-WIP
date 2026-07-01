import React, { useState, useEffect } from "react";
import { getFile, storeFile } from "../../utils/fileStorage";
import { useOutletContext, useNavigate } from "react-router-dom";
import PortalStageApproval from "../pages/PortalStageApproval";
import { 
  CheckCircle2, 
  Clock, 
  Download, 
  MessageSquare,
  Send, 
  Paperclip, 
  UserCheck, 
  AlertCircle, 
  Maximize2, 
  ChevronRight, 
  X, 
  CornerDownRight, 
  AtSign,
  FileText,
  Bookmark
} from "lucide-react";

const DesignsRenders = () => {
  const navigate = useNavigate();
  const { 
    client, 
    site, 
    updateSite, 
    addClientNotification,
    milestones,
    setMilestones,
    formatAmount
  } = useOutletContext();

  const drawings = site?.drawings || [];
  const revisions = site?.revisions || [];
  const discussions = site?.discussionHistory || [];

  const [localUrls, setLocalUrls] = useState({});

  useEffect(() => {
    if (!site) return;
    const loadLocalFiles = async () => {
      const urls = { ...localUrls };
      let updated = false;

      // 1. drawings
      for (const d of drawings) {
        if (d.id && !urls[d.id]) {
          const file = await getFile(d.id);
          if (file) {
            urls[d.id] = URL.createObjectURL(file);
            updated = true;
          }
        }
        if (d.versions) {
          for (const ver of d.versions) {
            const verKey = `${d.id}-${ver.version}`;
            if (!urls[verKey]) {
              const file = await getFile(verKey);
              if (file) {
                urls[verKey] = URL.createObjectURL(file);
                updated = true;
              }
            }
          }
        }
      }

      // 2. discussions attachments
      for (const comment of discussions) {
        if (comment.attachments) {
          for (const file of comment.attachments) {
            if (file.id && !urls[file.id]) {
              const fObj = await getFile(file.id);
              if (fObj) {
                urls[file.id] = URL.createObjectURL(fObj);
                updated = true;
              }
            }
          }
        }
      }

      // 3. revisions attached files
      for (const rev of revisions) {
        if (rev.attachedFiles) {
          for (const file of rev.attachedFiles) {
            if (file.id && !urls[file.id]) {
              const fObj = await getFile(file.id);
              if (fObj) {
                urls[file.id] = URL.createObjectURL(fObj);
                updated = true;
              }
            }
          }
        }
      }

      if (updated) {
        setLocalUrls(urls);
      }
    };
    loadLocalFiles();
  }, [site, drawings, discussions, revisions]);

  const getPortalSettings = () => {
    const defaults = {
      freeRevisionLimit: 3,
      additionalRevisionCost: 5000,
      gstPercentage: 18,
      turnaroundDuration: 5,
      requirePaymentBeforeWork: true,
    };
    if (client && client.clientID) {
      const clientSaved = localStorage.getItem(`client_portal_settings_${client.clientID}`);
      if (clientSaved) {
        try {
          return { ...defaults, ...JSON.parse(clientSaved) };
        } catch (e) {
          // fallback
        }
      }
    }
    const saved = localStorage.getItem("client_portal_settings");
    if (saved) {
      try {
        return { ...defaults, ...JSON.parse(saved) };
      } catch (e) {
        return defaults;
      }
    }
    return defaults;
  };

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingPaymentRevision, setPendingPaymentRevision] = useState(null);

  const handlePayForRevisionLater = (rev) => {
    const settings = getPortalSettings();
    // Find existing milestone for this revision
    const matchingMilestone = milestones.find(m => m.isRevision && (m.revisionId === rev.id || (m.pendingRevisionData && m.pendingRevisionData.id === rev.id)));
    if (matchingMilestone) {
      // Redirect to Payment Milestones with highlight
      navigate(`/client-portal/${client.clientID}/payment-milestones?highlight=${matchingMilestone.id}`);
    } else {
      // Generate a milestone if missing, then redirect
      const gstAmt = Math.round(settings.additionalRevisionCost * (settings.gstPercentage / 100));
      const totalAmt = settings.additionalRevisionCost + gstAmt;
      const newMilestone = {
        id: `ms-rev-${Date.now()}`,
        name: `Additional Design Revision (Revision No: ${rev.revisionNumber})`,
        total: totalAmt,
        base: settings.additionalRevisionCost,
        gstAmt: gstAmt,
        status: "pending",
        paidDate: "",
        paymentReference: "",
        paymentBank: "",
        isRevision: true,
        revisionId: rev.id
      };
      const updatedMilestones = [...milestones, newMilestone];
      setMilestones(updatedMilestones);
      localStorage.setItem(`clientMilestones_${client.clientID}`, JSON.stringify(updatedMilestones));
      navigate(`/client-portal/${client.clientID}/payment-milestones?highlight=${newMilestone.id}`);
    }
  };

  const [activeTab, setActiveTab] = useState("all"); // all, 2d, 3d, approved
  
  // Modal states
  const [selectedDrawing, setSelectedDrawing] = useState(null); // Lightbox
  const [selectedDrawingForFeedback, setSelectedDrawingForFeedback] = useState(null); // Feedback Modal
  
  // Review inputs
  const [feedbackStatus, setFeedbackStatus] = useState("Approve"); // Approve / Changes
  const [feedbackText, setFeedbackText] = useState("");
  
  // Discussion inputs
  const [chatText, setChatText] = useState("");
  const [chatAttachments, setChatAttachments] = useState([]);
  const [replyToId, setReplyToId] = useState(null);

  // Approval Package request changes input
  const [showApprovalChangeModal, setShowApprovalChangeModal] = useState(false);
  const [approvalChangeText, setApprovalChangeText] = useState("");
  const [agreedToDigitalSign, setAgreedToDigitalSign] = useState(false);

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={40} className="text-gray-300 mb-3" />
        <h4 className="text-sm font-bold text-darkgray uppercase tracking-wider mb-1">No Active Project Linked</h4>
        <p className="text-xs text-gray-400">Please contact support to link your site with the design workspace.</p>
      </div>
    );
  }

  // Local helpers
  const designStage = site.designStatus || "In Progress";
  const progressPct = site.progress || 0;
  const portalSettings = getPortalSettings();

  const getRevisionNumberValue = (value) => {
    if (!value) return null;
    const match = String(value).match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  };

  const getMilestoneRevisionNumber = (milestone) => {
    return (
      milestone.revisionNum ||
      getRevisionNumberValue(milestone.pendingRevisionData?.revisionNumber) ||
      getRevisionNumberValue(milestone.description) ||
      getRevisionNumberValue(milestone.name)
    );
  };

  const submittedRevisionNumbers = revisions.map((rev, idx) => getRevisionNumberValue(rev.revisionNumber) || idx + 1);

  const nextRevisionNumber = submittedRevisionNumbers.length > 0 ? Math.max(...submittedRevisionNumbers) + 1 : 1;
  const freeRevisionsUsed = Math.min(
    revisions.filter((rev, idx) => (getRevisionNumberValue(rev.revisionNumber) || idx + 1) <= portalSettings.freeRevisionLimit).length,
    portalSettings.freeRevisionLimit
  );

  const findExistingPendingRevisionMilestone = (revisionNum) => {
    return milestones.find((m) =>
      m.isRevision &&
      m.status !== "paid" &&
      getMilestoneRevisionNumber(m) === revisionNum
    );
  };

  const createPendingRevisionMilestone = (revisionNum, pendingRevisionData) => {
    const gstAmt = Math.round(portalSettings.additionalRevisionCost * (portalSettings.gstPercentage / 100));
    const totalAmt = portalSettings.additionalRevisionCost + gstAmt;
    return {
      id: `ms-rev-${Date.now()}`,
      name: "Additional Design Revision",
      revisionNum,
      description: `Revision #${revisionNum}`,
      total: totalAmt,
      base: portalSettings.additionalRevisionCost,
      gstAmt,
      status: "pending",
      paidDate: "",
      paymentReference: "",
      paymentBank: "",
      isRevision: true,
      pendingRevisionData
    };
  };

  const queuePaidRevisionPayment = (revisionNum, pendingRevisionData) => {
    const existingMilestone = findExistingPendingRevisionMilestone(revisionNum);
    const revisionMilestone = existingMilestone || createPendingRevisionMilestone(revisionNum, pendingRevisionData);

    if (!existingMilestone) {
      const updatedMilestones = [...milestones, revisionMilestone];
      setMilestones(updatedMilestones);
      localStorage.setItem(`clientMilestones_${client.clientID}`, JSON.stringify(updatedMilestones));
    }

    addClientNotification(
      "Revision Payment Required",
      `Revision V${revisionNum} requires payment of ${formatAmount(revisionMilestone.total)} before work can begin.`,
      "warning"
    );

    setPendingPaymentRevision({
      revision: {
        id: revisionMilestone.pendingRevisionData.id,
        revisionNumber: `V${revisionNum}`
      },
      milestone: revisionMilestone
    });
    setShowPaymentModal(true);
  };

  // Filter drawings visible to client
  const visibleDrawings = drawings.filter(d => d.visibleToClient !== false);

  // Filtered lists for tabs
  const drawings2D = visibleDrawings.filter(d => d.category === "2D Drawings");
  const drawings3D = visibleDrawings.filter(d => d.category === "3D Drawings");
  const approvedDrawings = visibleDrawings.filter(d => d.status === "Approved");

  const getFilteredDrawings = () => {
    switch (activeTab) {
      case "2d": return drawings2D;
      case "3d": return drawings3D;
      case "approved": return approvedDrawings;
      default: return visibleDrawings;
    }
  };

  // Determine stage progress indicators
  const STAGES = [
    { label: "Default Design", key: "default-design" },
    { label: "Redesign", key: "redesign" },
    { label: "2D/3D Drawings", key: "drawings" },
    { label: "Client Approval", key: "approval" }
  ];

  const getStageStatus = (stageLabel) => {
    if (site.approvalStatus === "Approved") return "Completed";
    
    // Default Design Stage
    if (stageLabel === "Default Design") {
      return site.designStatus === "Completed" || site.designStatus === "In Progress" ? "Completed" : "In Progress";
    }
    
    // Redesign Stage
    if (stageLabel === "Redesign") {
      const hasRevisions = revisions.length > 0;
      if (!hasRevisions) return "Pending";
      const allResolved = revisions.every(r => r.status === "Completed");
      return allResolved ? "Completed" : "In Progress";
    }
    
    // Drawings Stage
    if (stageLabel === "2D/3D Drawings") {
      const allApproved = drawings2D.length > 0 && drawings2D.every(d => d.status === "Approved");
      if (allApproved) return "Completed";
      if (drawings.length > 0) return "In Progress";
      return "Pending";
    }
    
    // Client Approval Stage
    if (stageLabel === "Client Approval") {
      if (site.approvalStatus === "Approved") return "Completed";
      if (site.approvalStatus === "Sent" || site.approvalStatus === "Viewed") return "In Progress";
      return "Pending";
    }

    return "Pending";
  };

  // Deliverable action review handlers
  const openFeedbackModal = (drawing) => {
    setSelectedDrawingForFeedback(drawing);
    setFeedbackStatus("Approve");
    setFeedbackText("");
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    if (!selectedDrawingForFeedback) return;

    const dateStr = new Date().toLocaleDateString("en-IN");
    const timestampStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const nextRevNum = nextRevisionNumber;
    const isPaid = nextRevNum > portalSettings.freeRevisionLimit;

    if (feedbackStatus === "Reject") {
      const confirmed = window.confirm("Are you sure you want to reject this design? This action cannot be undone.");
      if (!confirmed) return;

      const systemComment = {
        id: `comm-sys-${Date.now()}`,
        author: "Client",
        text: `❌ Rejected drawing/render: **${selectedDrawingForFeedback.name}**\nReason: ${feedbackText}`,
        timestamp: `${dateStr} ${timestampStr}`,
        attachments: []
      };

      const updatedDrawings = drawings.map(d => {
        if (d.id === selectedDrawingForFeedback.id) {
          return {
            ...d,
            status: "Rejected",
            reviewer: client.clientName,
            reviewDate: `${dateStr} ${timestampStr}`,
            reviewComments: feedbackText
          };
        }
        return d;
      });

      const newActivity = {
        id: `act-${Date.now()}`,
        text: `Client rejected drawing "${selectedDrawingForFeedback.name}" with reason: "${feedbackText}".`,
        user: client.clientName,
        time: `${timestampStr} ${dateStr}`,
        timestamp: `${timestampStr} ${dateStr}`
      };

      const updatedSite = {
        ...site,
        drawings: updatedDrawings,
        discussionHistory: [...discussions, systemComment],
        activities: [newActivity, ...(site.activities || [])]
      };

      updateSite(updatedSite);
      addClientNotification(
        "Design Asset Rejected",
        `Rejected "${selectedDrawingForFeedback.name}" design asset.`,
        "error"
      );
      setSelectedDrawingForFeedback(null);
      return;
    }

    if (feedbackStatus === "Changes") {
      if (isPaid) {
        queuePaidRevisionPayment(nextRevNum, {
          id: `rev-${Date.now()}`,
          revisionNumber: `V${nextRevNum}`,
          date: dateStr,
          uploadedBy: "Client (Portal)",
          notes: `Feedback on "${selectedDrawingForFeedback.name}": ${feedbackText}`,
          status: "Pending",
          category: "Drawing Feedback",
          affectedRooms: selectedDrawingForFeedback.name,
          attachedFiles: [],
          drawingId: selectedDrawingForFeedback.id
        });
        setSelectedDrawingForFeedback(null);
        return;
      }

      // If complimentary
      const newRevision = {
        id: `rev-${Date.now()}`,
        revisionNumber: `V${nextRevNum}`,
        date: dateStr,
        uploadedBy: "Client (Portal)",
        notes: `Feedback on "${selectedDrawingForFeedback.name}": ${feedbackText}`,
        status: "Pending",
        category: "Drawing Feedback",
        affectedRooms: selectedDrawingForFeedback.name,
        attachedFiles: []
      };

      const systemComment = {
        id: `comm-sys-${Date.now()}`,
        author: "Client",
        text: `⚠️ Requested changes on: **${selectedDrawingForFeedback.name}**\nFeedback: ${feedbackText}`,
        timestamp: `${dateStr} ${timestampStr}`,
        attachments: []
      };

      const updatedDrawings = drawings.map(d => {
        if (d.id === selectedDrawingForFeedback.id) {
          return {
            ...d,
            status: "Under Review",
            reviewer: "Client",
            reviewDate: dateStr,
            reviewComments: feedbackText || "Changes requested."
          };
        }
        return d;
      });

      const updatedSite = {
        ...site,
        drawings: updatedDrawings,
        designStatus: "In Progress",
        revisions: [...revisions, newRevision],
        discussionHistory: [...discussions, systemComment],
        activities: [
          {
            id: `act-${Date.now()}`,
            text: `Client requested changes for drawing "${selectedDrawingForFeedback.name}" and logged Revision Request V${nextRevNum}.`,
            user: client.clientName,
            timestamp: `${timestampStr} ${dateStr}`
          },
          ...(site.activities || [])
        ]
      };

      updateSite(updatedSite);
      addClientNotification(
        "Revision Request Submitted",
        `Created revision logs for "${selectedDrawingForFeedback.name}".`,
        "info"
      );
      setSelectedDrawingForFeedback(null);

    } else {
      const updatedDrawings = drawings.map(d => {
        if (d.id === selectedDrawingForFeedback.id) {
          return {
            ...d,
            status: "Approved",
            reviewer: "Client",
            reviewDate: dateStr,
            reviewComments: feedbackText || "Approved by client."
          };
        }
        return d;
      });

      const systemComment = {
        id: `comm-sys-${Date.now()}`,
        author: "Client",
        text: `✅ Approved drawing/render: **${selectedDrawingForFeedback.name}**`,
        timestamp: `${dateStr} ${timestampStr}`,
        attachments: []
      };

      const updatedSite = {
        ...site,
        drawings: updatedDrawings,
        discussionHistory: [...discussions, systemComment],
        activities: [
          {
            id: `act-${Date.now()}`,
            text: `Client approved drawing "${selectedDrawingForFeedback.name}".`,
            user: client.clientName,
            timestamp: `${timestampStr} ${dateStr}`
          },
          ...(site.activities || [])
        ]
      };

      updateSite(updatedSite);
      addClientNotification(
        "Drawing Approved",
        `Approved design asset "${selectedDrawingForFeedback.name}".`,
        "success"
      );
      setSelectedDrawingForFeedback(null);
    }
  };

  // Client Approval Center Handlers
  const handleApprovePackage = () => {
    if (!agreedToDigitalSign) {
      alert("Please confirm the digital signature acknowledgement first.");
      return;
    }

    const dateStr = new Date().toLocaleDateString("en-IN");
    const timestampStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const updatedDrawings = drawings.map(d => ({
      ...d,
      status: "Approved",
      reviewer: "Client",
      reviewDate: dateStr,
      reviewComments: "Approved via Design Approval Package sign-off."
    }));

    const systemComment = {
      id: `comm-sys-app-${Date.now()}`,
      author: "Client",
      text: `🎉 **Digitally Signed & Approved Final Design Package!** \nProject transitions to Site Execution phase.`,
      timestamp: `${dateStr} ${timestampStr}`,
      attachments: []
    };

    const updatedSite = {
      ...site,
      drawings: updatedDrawings,
      approvalStatus: "Approved",
      designStatus: "Completed",
      progress: 100,
      digitalAcknowledgementVerified: true,
      discussionHistory: [...discussions, systemComment],
      activities: [
        {
          id: `act-app-${Date.now()}`,
          text: "Client approved and signed the entire final design package.",
          user: client.clientName,
          timestamp: `${timestampStr} ${dateStr}`
        },
        ...(site.activities || [])
      ],
      approvalHistory: [
        {
          version: "V1",
          status: "Approved",
          date: dateStr,
          comments: "Signed-off and approved by client."
        },
        ...(site.approvalHistory || [])
      ]
    };

    updateSite(updatedSite);
    addClientNotification(
      "Project Design Approved",
      "Congratulations! You have signed off the design phase. Ready for execution.",
      "success"
    );
  };

  const handleRequestPackageChanges = (e) => {
    e.preventDefault();
    if (!approvalChangeText.trim()) return;

    const dateStr = new Date().toLocaleDateString("en-IN");
    const timestampStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const nextRevNum = nextRevisionNumber;
    const isPaid = nextRevNum > portalSettings.freeRevisionLimit;

    if (isPaid) {
      queuePaidRevisionPayment(nextRevNum, {
        id: `rev-pkg-${Date.now()}`,
        revisionNumber: `V${nextRevNum}`,
        date: dateStr,
        uploadedBy: "Client (Portal)",
        notes: `Design Package Revision: ${approvalChangeText}`,
        status: "Pending",
        category: "Package Feedback",
        affectedRooms: "Entire Package",
        attachedFiles: []
      });
      setShowApprovalChangeModal(false);
      setApprovalChangeText("");
    } else {
      const newRevision = {
        id: `rev-pkg-${Date.now()}`,
        revisionNumber: `V${nextRevNum}`,
        date: dateStr,
        uploadedBy: "Client (Portal)",
        notes: `Design Package Revision: ${approvalChangeText}`,
        status: "Pending",
        category: "Package Feedback",
        affectedRooms: "Entire Package",
        attachedFiles: []
      };

      const systemComment = {
        id: `comm-sys-pkg-${Date.now()}`,
        author: "Client",
        text: `❌ **Requested changes on Approval Package (Revision V${nextRevNum}):** \n${approvalChangeText}`,
        timestamp: `${dateStr} ${timestampStr}`,
        attachments: []
      };

      const updatedSite = {
        ...site,
        approvalStatus: "Pending",
        designStatus: "In Progress",
        revisions: [...revisions, newRevision],
        discussionHistory: [...discussions, systemComment],
        activities: [
          {
            id: `act-pkg-${Date.now()}`,
            text: `Client requested changes on the overall design package (Logged Revision V${nextRevNum}).`,
            user: client.clientName,
            timestamp: `${timestampStr} ${dateStr}`
          },
          ...(site.activities || [])
        ]
      };

      updateSite(updatedSite);
      addClientNotification(
        "Approval Package Changes Requested",
        `Revision V${nextRevNum} requested for design package layout.`,
        "info"
      );
      setShowApprovalChangeModal(false);
      setApprovalChangeText("");
    }
  };

  // Discussion Handlers
  const handleMentionClick = (name) => {
    setChatText((prev) => prev + ` @${name} `);
  };

  const handleFileUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileId = `chat-file-${Date.now()}-${Math.random().toString().slice(2, 8)}`;
    await storeFile(fileId, file);
    const url = URL.createObjectURL(file);
    setChatAttachments((prev) => [
      ...prev,
      {
        id: fileId,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: file.name.split(".").pop().toUpperCase(),
        url
      }
    ]);
  };

  const handleSendDiscussion = (e) => {
    e.preventDefault();
    if (!chatText.trim() && chatAttachments.length === 0) return;

    const dateStr = new Date().toLocaleDateString("en-IN");
    const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const newComment = {
      id: `comm-${Date.now()}`,
      author: "Client",
      text: chatText,
      timestamp: `${dateStr} ${timeStr}`,
      attachments: chatAttachments,
      replyTo: replyToId
    };

    const updatedSite = {
      ...site,
      discussionHistory: [...discussions, newComment]
    };

    updateSite(updatedSite);
    setChatText("");
    setChatAttachments([]);
    setReplyToId(null);

    // Dynamic notification when client responds to a designer
    if (chatText.includes("@Priya")) {
      addClientNotification(
        "Mention Sent",
        "Your message was tagged to Designer Priya S.",
        "info"
      );
    }
  };

  // Nest comment replies helper
  const renderReplies = (parentId) => {
    const replies = discussions.filter(c => c.replyTo === parentId);
    if (replies.length === 0) return null;

    return (
      <div className="ml-8 mt-2 space-y-2 border-l-2 border-slate-100 pl-4">
        {replies.map((r) => (
          <div key={r.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-slate-700">{r.author}</span>
              <span className="text-[10px] text-gray-400">{r.timestamp}</span>
            </div>
            <p className="text-slate-600 whitespace-pre-wrap">{r.text}</p>
            {r.attachments && r.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {r.attachments.map((file, fidx) => (
                  <a
                    key={fidx}
                    href={localUrls[file.id] || file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2 py-0.5 text-[10px] text-purple hover:underline"
                  >
                    <Paperclip size={10} />
                    {file.name}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 sm:p-8 space-y-8  text-left">
      
      {/* Title Header */}
      <div className="border-b border-gray-150 pb-4 shrink-0 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h3 className="text-lg font-bold text-darkgray uppercase tracking-wider">Designs & Renders</h3>
          <p className="text-xs text-gray-400 mt-1">Review plans, leave feedback, request modifications, and approve final drawings.</p>
        </div>
        
        {/* Overall Progress Widget */}
        <div className="flex items-center  gap-4 bg-slate-50 border border-slate-100 px-4 py-2 rounded-[20px] shadow-xs">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 font-bold uppercase block">Design Progress</span>
            <span className="text-sm font-black text-purple">{progressPct}% Complete</span>
          </div>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="bg-purple h-full" style={{ width: `${progressPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* Staged design sign-off (only for sites taken through the survey freeze) */}
      <PortalStageApproval site={site} clientName={client?.clientName} />

      {/* Stepper overview */}
      <div className="bg-white rounded-[20px] border border-slate-100 p-4 shadow-sm shrink-0">
        <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Workspace Design Stages</h4>
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4">
          {STAGES.map((st, idx) => {
            const status = getStageStatus(st.label);
            const isCompleted = status === "Completed";
            const isInProgress = status === "In Progress";
            
            return (
              <div key={st.key} className="flex items-center flex-1 min-w-[130px] last:flex-none">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCompleted ? "bg-emerald-500 text-white" : isInProgress ? "bg-purple text-white ring-4 ring-purple/15" : "bg-slate-100 text-slate-400"
                  }`}>
                    {isCompleted ? "✓" : idx + 1}
                  </div>
                  <div>
                    <span className={`text-xs font-bold block ${isCompleted ? "text-emerald-600" : isInProgress ? "text-purple" : "text-slate-400"}`}>
                      {st.label}
                    </span>
                    <span className="text-[9px] font-semibold text-gray-400 uppercase leading-none">{status}</span>
                  </div>
                </div>
                {idx < STAGES.length - 1 && (
                  <div className="hidden md:block flex-1 h-0.5 bg-slate-100 mx-4"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Conditional Client Approval Center */}
      {(site.approvalStatus === "Sent" || site.approvalStatus === "Viewed" || site.approvalStatus === "Approved" || (site.approvalStatus === "Pending" && site.approvalHistory && site.approvalHistory.length > 0)) && (
        <div className="bg-gradient-to-br from-indigo-50/40 via-purple-50/10 to-transparent border border-indigo-100/70 rounded-[20px] p-6 shadow-sm shrink-0">
          <div className="flex justify-between items-start flex-wrap gap-4 border-b border-indigo-100/40 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                <UserCheck size={20} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">Final Design Approval Package</h4>
                <p className="text-[11px] text-gray-400 mt-0.5">The design team has submitted these files for your sign-off.</p>
              </div>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-[10px] font-bold border uppercase ${
              site.approvalStatus === "Approved" 
                ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                : site.approvalStatus === "Pending"
                  ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse"
                  : "bg-amber-50 border-amber-200 text-amber-700 animate-pulse"
            }`}>
              {site.approvalStatus === "Approved" 
                ? "Design Package Approved" 
                : site.approvalStatus === "Pending"
                  ? "Changes Requested"
                  : "Sign-off Requested"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs mb-5">
            <div className="space-y-3">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Package Deliverables</span>
              <ul className="space-y-2 font-medium text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Approved Floor Plans & Elevation Details</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Final 3D Photorealistic Room Renders</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Theme selection: <strong className="text-slate-800">{site.themeSelection || "Warm Contemporary"}</strong></span>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Design Notes</span>
              <p className="text-slate-500 italic bg-white p-3 rounded-xl border border-slate-100/60 leading-relaxed max-h-24 overflow-y-auto font-medium">
                {site.designNotes || "No specific final notes loaded."}
              </p>
            </div>
          </div>

          {site.approvalStatus !== "Approved" ? (
            <div className="flex items-center justify-between border-t border-indigo-100/40 pt-4 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="digi-sign" 
                  checked={agreedToDigitalSign}
                  onChange={(e) => setAgreedToDigitalSign(e.target.checked)}
                  className="w-4 h-4 text-purple focus:ring-purple border-slate-200 rounded cursor-pointer"
                />
                <label htmlFor="digi-sign" className="text-[11px] font-bold text-slate-600 select-none cursor-pointer">
                  I approve the layout, measurements, and materials described in this design package.
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowApprovalChangeModal(true)}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-[11px] font-bold text-slate-700 transition-colors cursor-pointer"
                >
                  Request Changes
                </button>
                <button
                  onClick={handleApprovePackage}
                  disabled={!agreedToDigitalSign}
                  className={`px-5 py-2 rounded-xl text-[11px] font-bold text-white transition-all shadow-sm cursor-pointer ${
                    agreedToDigitalSign ? "bg-purple hover:bg-dark-blue" : "bg-slate-300 cursor-not-allowed"
                  }`}
                >
                  Approve Design Package
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between text-xs text-left">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="font-bold text-emerald-800">You signed off on this design package on {site.approvalHistory?.[0]?.date || "12.06.2026"}. Ready for physical construction!</span>
              </div>
              <button 
                onClick={() => alert("Downloading package zip...")}
                className="flex items-center gap-1 text-[11px] font-bold text-purple hover:underline cursor-pointer"
              >
                <Download size={13} />
                Download Package
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Tabbed Grid deliverables & reviews */}
      <div className="flex-1 min-h-0 flex flex-col space-y-4">
        
        {/* Navigation categories */}
        <div className="flex justify-between items-center border-b border-gray-150 pb-2 shrink-0 flex-wrap gap-2">
          <div className="flex gap-1.5">
            {[
              { id: "all", label: "All Files" },
              { id: "2d", label: "2D Drawings" },
              { id: "3d", label: "3D Renders" },
              { id: "approved", label: "Approved Files" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === tab.id 
                    ? "bg-purple text-white" 
                    : "text-gray-500 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
            {getFilteredDrawings().length} deliverables visible
          </span>
        </div>

        {/* Deliverables Grid */}
        <div className="w-full py-2">
          {getFilteredDrawings().length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <p className="text-xs font-bold text-slate-400">No deliverables found under this filter.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredDrawings().map((d) => {
                const is3D = d.category === "3D Drawings";
                const drawingUrl = localUrls[d.id] || d.fileUrl;
                return (
                  <div 
                    key={d.id} 
                    className="border border-bordergray/60 rounded-[20px] overflow-hidden shadow-xs hover:shadow-md transition-all bg-white flex flex-col group text-left"
                  >
                    {/* Visual aspect preview */}
                    <div className="relative aspect-video overflow-hidden bg-slate-100">
                      <img 
                        src={drawingUrl || "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80"} 
                        alt={d.name} 
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" 
                      />
                      
                      {/* Top labels */}
                      <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                        <span className="px-2 py-0.5 text-[9px] uppercase font-extrabold bg-slate-950/80 text-white rounded-md tracking-wider">
                          {d.category === "3D Drawings" ? "3D Render" : "2D CAD"}
                        </span>
                      </div>

                      {/* Status Badges */}
                      <div className="absolute top-2.5 right-2.5">
                        <span className={`px-2 py-0.5 text-[9px] uppercase font-bold rounded-md border ${
                          d.status === "Approved" 
                            ? "bg-emerald-500 border-emerald-600 text-white" 
                            : d.status === "Rejected"
                              ? "bg-rose-500 border-rose-600 text-white"
                              : d.status === "Under Review" 
                                ? "bg-amber-500 border-amber-600 text-white animate-pulse" 
                                : "bg-slate-700 border-slate-800 text-white"
                        }`}>
                          {d.status}
                        </span>
                      </div>

                      {/* Hover Overlay triggers Maximize */}
                      <button 
                        onClick={() => setSelectedDrawing({ ...d, fileUrl: drawingUrl })}
                        className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white cursor-pointer"
                        title="View Full Screen"
                      >
                        <Maximize2 size={24} className="scale-75 group-hover:scale-100 transition-transform" />
                      </button>
                    </div>

                    {/* Metadata Card Info */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-darkgray leading-tight group-hover:text-purple transition-colors break-words whitespace-normal">
                          {d.name}
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2.5 text-[10px] text-gray-400 font-semibold border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-slate-400">Version</span>
                            <span className="text-slate-600 font-bold">{d.version || "V1"}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-slate-400">Size</span>
                            <span className="text-slate-600 font-bold">{d.fileSize || "1.2 MB"}</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-gray-400 font-semibold mt-2 flex items-center gap-1">
                          <Clock size={11} />
                          Uploaded: {d.uploadDate || "12.06.2026"}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                        <button 
                          onClick={() => openFeedbackModal(d)}
                          className="text-[11px] font-bold text-slate-500 hover:text-purple flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <MessageSquare size={12} />
                          Review Asset
                        </button>

                        <a 
                          href={drawingUrl || "#"} 
                          download={d.name}
                          target="_blank" 
                          rel="noreferrer" 
                          onClick={(e) => {
                            if (!drawingUrl) {
                              e.preventDefault();
                              alert("Draft files have no download attachment yet.");
                            }
                          }}
                          className="text-[11px] font-bold text-purple hover:text-dark-blue flex items-center gap-1 transition-colors"
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Two-Column split for Discussions and Revision History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-4 border-t border-slate-150 shrink-0">
        
        {/* Left Column: Revision History log (5/12 width) */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
            <h4 className="text-xs font-bold text-darkgray uppercase tracking-wider flex items-center gap-2">
              <Clock size={13} className="text-slate-400" />
              Revision Logs
            </h4>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
              Free Revisions: {freeRevisionsUsed} / {portalSettings.freeRevisionLimit} Used
            </span>
          </div>

          {revisions.length === 0 ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-[20px] text-center">
              <p className="text-[11px] font-semibold text-gray-400">No revisions logged for this design yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-[11px] text-darkgray">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-gray-400 font-bold uppercase tracking-wider text-[9px]">
                    <th className="p-2.5">No.</th>
                    <th className="p-2.5">Type</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Payment</th>
                    <th className="p-2.5 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {revisions.map((rev, idx) => {
                    const revNum = getRevisionNumberValue(rev.revisionNumber) || idx + 1;
                    const isPaid = rev.isPaid || revNum > portalSettings.freeRevisionLimit;
                    const typeLabel = isPaid ? "Paid" : "Free";
                    const amtLabel = isPaid ? formatAmount(rev.amount || 5000) : "₹0";
                    const payStatus = rev.paymentStatus || (isPaid ? "Paid" : "N/A");
                    
                    return (
                      <tr key={rev.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-2.5 font-extrabold text-slate-800">
                          {rev.revisionNumber || `V${idx + 1}`}
                        </td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isPaid ? "bg-purple/10 text-purple border border-purple/20" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                            rev.status === "Completed" 
                              ? "bg-emerald-50 text-emerald-700" 
                              : rev.status === "In Progress"
                                ? "bg-blue-50 text-blue-700"
                                : rev.status === "Awaiting Payment"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-750"
                          }`}>
                            {rev.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-gray-500">
                          {rev.status === "Awaiting Payment" ? (
                            <button
                              onClick={() => handlePayForRevisionLater(rev)}
                              className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[9px] font-bold cursor-pointer transition-colors shadow-xs"
                            >
                              Pay Now
                            </button>
                          ) : (
                            <span className="text-[10px]">{payStatus}</span>
                          )}
                        </td>
                        <td className="p-2.5 text-slate-700 font-extrabold text-right">{amtLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Design Workspace Discussion (7/12 width) */}
        <div className="lg:col-span-7 flex flex-col border border-slate-200/80 rounded-[20px] overflow-hidden bg-white shadow-xs">
          {/* Chat Header */}
          <div className="bg-slate-50 p-3 border-b border-slate-150 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare size={15} className="text-purple" />
              <span className="text-xs font-bold text-slate-700">Design Discussions</span>
            </div>
            
            {/* Quick Tagging Buttons */}
            <div className="flex gap-1">
              <button 
                onClick={() => handleMentionClick("Priya S. (Designer)")}
                className="text-[9px] font-bold bg-white hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 flex items-center gap-0.5 cursor-pointer"
              >
                <AtSign size={8} /> Designer
              </button>
              <button 
                onClick={() => handleMentionClick("Vijay K. (Coordinator)")}
                className="text-[9px] font-bold bg-white hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 flex items-center gap-0.5 cursor-pointer"
              >
                <AtSign size={8} /> Coordinator
              </button>
            </div>
          </div>

          {/* Chat message history log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/20 text-xs">
            {discussions.length === 0 ? (
              <p className="text-center text-gray-400 py-20 italic">No messages sent yet. Leave a design comment below.</p>
            ) : (
              discussions.map((msg) => {
                const isClient = msg.author === "Client";
                return (
                  <div key={msg.id} className="space-y-1">
                    <div className={`flex flex-col ${isClient ? "items-end" : "items-start"}`}>
                      {/* Message Bubble wrapper */}
                      <div className={`max-w-[85%] rounded-2xl p-3 shadow-xs border ${
                        isClient 
                          ? "bg-purple text-white border-purple-600 rounded-br-none" 
                          : "bg-white text-slate-800 border-slate-200 rounded-bl-none"
                      }`}>
                        
                        {/* Author line */}
                        <div className="flex justify-between items-center gap-4 mb-1 border-b border-white/20 pb-0.5">
                          <span className="font-extrabold uppercase text-[9px] opacity-80">{msg.author}</span>
                          <span className="text-[8px] opacity-70">{msg.timestamp}</span>
                        </div>

                        {/* Text */}
                        <p className="leading-relaxed whitespace-pre-wrap font-medium">{msg.text}</p>

                        {/* Attachments inside bubble */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1 border-t border-white/20 pt-1.5">
                            {msg.attachments.map((file, fidx) => (
                              <a 
                                key={fidx} 
                                href={localUrls[file.id] || file.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="flex items-center gap-1 text-[9px] font-bold hover:underline truncate"
                              >
                                <Paperclip size={9} />
                                {file.name} ({file.size})
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Reply Button link */}
                      {!msg.replyTo && (
                        <button
                          onClick={() => setReplyToId(msg.id)}
                          className="text-[9px] font-extrabold text-purple hover:underline mt-0.5 block pr-1"
                        >
                          Reply
                        </button>
                      )}
                    </div>

                    {/* Nested replies */}
                    {renderReplies(msg.id)}
                  </div>
                );
              })
            )}
          </div>

          {/* Reply alert bar */}
          {replyToId && (
            <div className="bg-amber-50 px-3 py-1 text-[10px] text-amber-700 font-bold border-t border-amber-100 flex justify-between items-center shrink-0">
              <span className="flex items-center gap-1">
                <CornerDownRight size={10} />
                Replying to message...
              </span>
              <button 
                onClick={() => setReplyToId(null)}
                className="text-amber-500 hover:text-amber-800"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Form input controls */}
          <form onSubmit={handleSendDiscussion} className="p-3 border-t border-slate-150 bg-white shrink-0 space-y-2">
            
            {/* Attachment list previews */}
            {chatAttachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {chatAttachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700">
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button 
                      type="button" 
                      onClick={() => setChatAttachments(prev => prev.filter((_, i) => i !== idx))}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              {/* File upload attachment */}
              <div className="relative">
                <input 
                  type="file" 
                  id="chat-attach-file" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                <label 
                  htmlFor="chat-attach-file" 
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer transition-colors"
                  title="Attach File"
                >
                  <Paperclip size={16} />
                </label>
              </div>

              {/* Text input */}
              <input
                type="text"
                placeholder="Type your design feedback or comment here..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                className="flex-1 text-xs border border-slate-200 rounded-xl px-3 bg-white focus:outline-none focus:border-purple font-medium"
              />

              {/* Submit */}
              <button
                type="submit"
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple hover:bg-dark-blue text-white shadow-sm transition-colors cursor-pointer"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* LIGHTBOX MODAL: FULL SCREEN DELIVERABLE VIEW */}
      {selectedDrawing && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedDrawing(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top title bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-darkgray uppercase tracking-wider">{selectedDrawing.name}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5">Category: {selectedDrawing.category} · Version {selectedDrawing.version}</p>
              </div>
              <button 
                onClick={() => setSelectedDrawing(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-gray-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Media Area */}
            <div className="flex-1 bg-slate-900 flex items-center justify-center min-h-[300px] overflow-hidden p-2">
              <img 
                src={selectedDrawing.fileUrl || "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80"} 
                alt={selectedDrawing.name} 
                className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-md"
              />
            </div>

            {/* Bottom Details Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-between items-center text-xs">
              <div className="space-y-1 font-semibold text-slate-500">
                <p>Uploaded by: {selectedDrawing.uploadedBy || "Design Team"}</p>
                <p>Status: <strong className={selectedDrawing.status === "Approved" ? "text-emerald-600" : selectedDrawing.status === "Rejected" ? "text-rose-600" : "text-purple"}>{selectedDrawing.status}</strong></p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    openFeedbackModal(selectedDrawing);
                    setSelectedDrawing(null);
                  }}
                  className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-100 rounded-xl font-bold text-slate-700 cursor-pointer"
                >
                  Review / Add Feedback
                </button>
                <a
                  href={selectedDrawing.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-purple text-white hover:bg-dark-blue rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Download size={13} />
                  Download File
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FEEDBACK SUBMISSION MODAL */}
      {selectedDrawingForFeedback && (
        <div 
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
          onClick={() => setSelectedDrawingForFeedback(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedDrawingForFeedback(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>

            <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-2">Review Design Asset</h4>
            <p className="text-xs text-gray-400 mb-4">
              Submit your feedback or approval status for <span className="font-bold text-slate-700">"{selectedDrawingForFeedback.name}"</span>.
            </p>

            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
              {/* Option Choice */}
              <div className="grid grid-cols-3 gap-2">
                <label className={`flex flex-col items-center justify-center p-2.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                  feedbackStatus === "Approve" ? "border-purple bg-purple/5" : "border-slate-200"
                }`}>
                  <input
                    type="radio"
                    name="feedback-status"
                    checked={feedbackStatus === "Approve"}
                    onChange={() => setFeedbackStatus("Approve")}
                    className="mb-1.5 text-purple focus:ring-purple border-slate-200 cursor-pointer"
                  />
                  <span className="text-[10px] font-extrabold text-slate-700 text-center">Approve Asset</span>
                </label>
                
                <label className={`flex flex-col items-center justify-center p-2.5 border rounded-xl cursor-pointer hover:bg-slate-50 transition-colors ${
                  feedbackStatus === "Changes" ? "border-purple bg-purple/5" : "border-slate-200"
                }`}>
                  <input
                    type="radio"
                    name="feedback-status"
                    checked={feedbackStatus === "Changes"}
                    onChange={() => setFeedbackStatus("Changes")}
                    className="mb-1.5 text-purple focus:ring-purple border-slate-200 cursor-pointer"
                  />
                  <span className="text-[10px] font-extrabold text-slate-700 text-center">Request Changes</span>
                </label>

                <label className={`flex flex-col items-center justify-center p-2.5 border rounded-xl cursor-pointer hover:bg-rose-50 transition-colors ${
                  feedbackStatus === "Reject" ? "border-rose-500 bg-rose-50" : "border-slate-200"
                }`}>
                  <input
                    type="radio"
                    name="feedback-status"
                    checked={feedbackStatus === "Reject"}
                    onChange={() => setFeedbackStatus("Reject")}
                    className="mb-1.5 text-rose-500 focus:ring-rose-500 border-slate-200 cursor-pointer"
                  />
                  <span className="text-[10px] font-extrabold text-rose-700 text-center">Reject Design</span>
                </label>
              </div>

              {/* Feedback Text notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  {feedbackStatus === "Approve" 
                    ? "Approval Notes (Optional)" 
                    : feedbackStatus === "Reject"
                      ? "Rejection Reason (Required)"
                      : "Revisions Feedback Description"}
                </label>
                <textarea
                  rows={4}
                  required={feedbackStatus === "Changes" || feedbackStatus === "Reject"}
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder={
                    feedbackStatus === "Approve" 
                      ? "E.g. Looks perfect, proceed with production." 
                      : feedbackStatus === "Reject"
                        ? "Please provide the reason for rejecting this design."
                        : "E.g. Please increase the ceiling height profile by 3 inches."
                  }
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-purple resize-none bg-slate-50/50 font-semibold"
                />
              </div>

              {/* Actions submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDrawingForFeedback(null)}
                  className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer ${
                    feedbackStatus === "Reject" 
                      ? "bg-rose-600 hover:bg-rose-700" 
                      : "bg-purple hover:bg-dark-blue"
                  }`}
                >
                  {feedbackStatus === "Reject" ? "Reject Design" : "Submit Review"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* APPROVAL PACKAGE CHANGE REQUEST MODAL */}
      {showApprovalChangeModal && (
        <div
          className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-[100] flex items-center justify-center p-4"
          onClick={() => setShowApprovalChangeModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowApprovalChangeModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-purple/10 rounded-xl flex items-center justify-center text-purple shrink-0">
                <FileText size={18} />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                  Request Design Package Changes
                </h4>
                <p className="text-xs text-gray-400">
                  Share the updates needed before approving the final package.
                </p>
              </div>
            </div>

            <form onSubmit={handleRequestPackageChanges} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Change Request Details
                </label>
                <textarea
                  rows={5}
                  required
                  value={approvalChangeText}
                  onChange={(e) => setApprovalChangeText(e.target.value)}
                  placeholder="E.g. Please update the wardrobe finish and revise the living room TV wall elevation."
                  className="w-full text-xs border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-purple resize-none bg-slate-50/50 font-semibold"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApprovalChangeModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple hover:bg-dark-blue text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  Submit Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADDITIONAL REVISION PAYMENT MODAL */}
      {showPaymentModal && pendingPaymentRevision && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[24px] max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-left border border-slate-100">
            <button
              onClick={() => {
                setShowPaymentModal(false);
                setPendingPaymentRevision(null);
              }}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-gray-500 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="space-y-6">
              <div>
                <h4 className="text-base font-extrabold text-slate-800 uppercase tracking-wider mb-1">
                  Additional Revision Payment Required
                </h4>
                <p className="text-xs text-gray-400">
                  You have utilized all complimentary revisions. Please complete payment to authorize this change request.
                </p>
              </div>

              {/* Info block */}
              <div className="bg-slate-50 border border-slate-200/50 p-4 rounded-2xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center font-semibold text-slate-700">
                  <span>Free Revisions Used</span>
                  <span className="font-extrabold text-slate-900">{portalSettings.freeRevisionLimit}/{portalSettings.freeRevisionLimit}</span>
                </div>
                <div className="flex justify-between items-center font-semibold text-slate-700">
                  <span>Current Revision</span>
                  <span className="font-extrabold text-purple">#{pendingPaymentRevision.revision.revisionNumber.replace(/v/i, '')}</span>
                </div>
                <div className="flex justify-between items-center font-semibold text-slate-700">
                  <span>Additional Revision Cost</span>
                  <span className="font-extrabold text-slate-900">{formatAmount(pendingPaymentRevision.milestone.base)}</span>
                </div>
                <div className="flex justify-between items-center font-semibold text-slate-700">
                  <span>GST</span>
                  <span className="font-extrabold text-slate-900">{formatAmount(pendingPaymentRevision.milestone.gstAmt)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200/40 pt-2.5 font-bold text-slate-850">
                  <span>Total</span>
                  <span className="text-purple font-extrabold">{formatAmount(pendingPaymentRevision.milestone.total)}</span>
                </div>
              </div>

              {/* Auto-created milestone info */}
              <div className="bg-purple/5 border border-purple/15 p-3 rounded-xl text-[11px] text-slate-700 font-medium space-y-1">
                <p className="font-bold text-slate-800">Pending Milestone Created:</p>
                <p>Additional Design Revision — Revision #{pendingPaymentRevision.revision.revisionNumber.replace(/v/i, '')}</p>
                <p>Status: <span className="font-bold text-amber-600">Pending Payment</span></p>
                <p>Amount: <span className="font-bold text-purple">{formatAmount(pendingPaymentRevision.milestone.total)}</span></p>
              </div>

              {/* Alert note */}
              <div className="flex gap-2 bg-amber-50 border border-amber-200/50 p-3 rounded-xl text-[11px] text-amber-800 font-semibold leading-relaxed">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>
                  Redesign work will commence only after this milestone payment is completed and verified. No revision request will be created until payment is confirmed.
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setPendingPaymentRevision(null);
                  }}
                  className="flex-1 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowPaymentModal(false);
                    const milestoneId = pendingPaymentRevision.milestone.id;
                    setPendingPaymentRevision(null);
                    navigate(`/client-portal/${client.clientID}/payment-milestones?highlight=${milestoneId}`);
                  }}
                  className="flex-1 py-2.5 bg-purple hover:bg-dark-blue text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer text-center"
                >
                  Proceed to Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DesignsRenders;
