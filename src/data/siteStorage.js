import { getAllClients } from "./clientStorage";
import { ClientTableData } from "./ClientTableData";
import { getSchedule, getProjectSlack } from "./scheduleStorage";
import { TableData } from "./TableData";
import { tokens } from "../api/client";
import {
  listSites,
  createSite,
  updateSite,
} from "../api/sites";

const SITES_OVERRIDE_KEY = "newSitesData";

// Backend write-through helper. Best-effort, fire-and-forget: a failed call must
// never break the optimistic local write, so we swallow every error.
const pushSite = (fn) => {
  try {
    Promise.resolve(fn()).catch((e) => console.warn("siteStorage: write-through failed", e));
  } catch (e) {
    console.warn("siteStorage: write-through threw", e);
  }
};

// Resolve the backend Mongo id for a site from the cached override record.
// Sites are identified locally by `siteID` (ST-YYYY-###) but the API addresses
// them by Mongo `id`. If we don't have an `id` cached for this siteID, the site
// is local-only and we SKIP the API call.
const backendIdFor = (siteID) => {
  const overrides = readJson(SITES_OVERRIDE_KEY, {});
  return overrides[siteID]?.id || null;
};

// Predefined supervisors for a rich demo experience
export const SUPERVISORS = ["Anand R.", "Vijay K.", "Sarah M.", "Priya S.", "Rahul G."];

// Predefined statuses
export const SITE_STATUSES = ["Survey", "Design", "Completed"];

const getDefaultPresetForType = (type) => {
  if (!type) return "2BHK";
  const t = type.toLowerCase();
  if (t.includes("studio")) return "1BHK";
  if (t.includes("penthouse")) return "3BHK";
  if (t.includes("villa")) return "Villa";
  if (t.includes("apartment")) return "2BHK";
  return "2BHK";
};

// Normalize legacy preset values written before the key format was standardised.
const PRESET_ALIASES = { "Studio": "1BHK", "1 BHK": "1BHK", "2 BHK": "2BHK", "3 BHK": "3BHK" };
const normalizePreset = (p) => (p && PRESET_ALIASES[p]) || p || "";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save to localStorage:", e);
  }
};

// Helper to get lead details by proposal ID
const getLead = (proposalId) => {
  if (!proposalId) return null;
  let newLeads = [];
  try {
    const saved = localStorage.getItem("newLeadsData");
    if (saved) newLeads = JSON.parse(saved);
  } catch {
    // Ignore malformed optional lead cache and continue with seeded data.
  }
  const allLeads = [...newLeads, ...TableData];
  return allLeads.find((l) => l.proposalId === proposalId) || null;
};

// Helper to format Date to DD.MM.YYYY
const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
};

// Static seed client IDs — these are established clients that always appear in
// Sites regardless of proposal/visit state.
const STATIC_CLIENT_IDS = new Set(ClientTableData.map((c) => c.clientID));

// Gate: direct clients (added via form, not converted from a lead) must have
// either confirmed their proposal or completed the preliminary site visit before
// they are eligible to enter the Site Visit stage. Newly created direct clients
// that haven't cleared either condition are excluded from the sites list.
const isSiteEligible = (c) => {
  if (STATIC_CLIENT_IDS.has(c.clientID)) return true; // seed data — always eligible
  if (c.sourceLeadId) return true;                     // converted from lead — already qualified
  return c.proposalConfirmed === true || c.prelimVisit?.done === true;
};

export const getAllSites = () => {
  const clients = getAllClients().filter(isSiteEligible);
  const overrides = readJson(SITES_OVERRIDE_KEY, {});

  // Generate dynamic sites list based on clients
  const baseSites = clients.map((c, index) => {
    const siteNum = c.clientID.split("-").pop() || String(index + 1);
    const siteID = `ST-2026-${siteNum}`;
    
    // Automation: check if there is an active project schedule.
    // Direct clients (no sourceLeadId) store their schedule under clientID.
    const scheduleId = c.sourceLeadId || c.clientID;
    const lead = getLead(c.sourceLeadId);
    const schedule = getSchedule(scheduleId);
    
    let autoProgress = null;
    let autoStatus = null;
    let autoTargetDate = null;
    let autoNotes = "Site inspection and preliminary survey completed.";

    if (schedule && schedule.rooms && schedule.rooms.length > 0) {
      const totalRooms = schedule.rooms.length;
      const completedRooms = schedule.rooms.filter((r) => r.done).length;
      
      // Compute progress percentage based on completed rooms
      autoProgress = Math.round((completedRooms / totalRooms) * 100);
      
      // Determine status based on progress and schedule state
      if (autoProgress === 100) {
        autoStatus = "Completed";
      } else if (autoProgress > 0) {
        autoStatus = "Design";
      } else {
        // Design is entered only through the frozen survey/feasibility gate.
        // A confirmed schedule alone must not create a Design site with no basis.
        autoStatus = "Survey";
      }

      // Sync target date with computed planned completion date from schedule
      if (lead) {
        const slackInfo = getProjectSlack(lead);
        if (slackInfo.plannedEnd) {
          autoTargetDate = formatDate(slackInfo.plannedEnd);
        }
      }

      // Sync notes with active delay details if any
      if (schedule.delayNote) {
        autoNotes = `Delay logged: ${schedule.delayNote}`;
      } else if (completedRooms > 0) {
        autoNotes = `${completedRooms} out of ${totalRooms} rooms completed. Work on track.`;
      } else if (schedule.confirmedAt) {
        autoNotes = "Work start date confirmed. Currently in Design / Prep phase.";
      } else {
        autoNotes = "Project won. Survey scheduled.";
      }
    }

    // Default fallbacks if no schedule exists
    const defaultTargetDate = "31.12.2026";

    // Design is complete only once the client has approved every stage.
    // AWAITING_CLIENT means submitted but not yet approved — not complete.
    // Read localStorage directly to avoid a circular import with designFlowStorage.
    let isDesignComplete = false;
    try {
      const flowRaw = localStorage.getItem(`designFlow_${siteID}`);
      if (flowRaw) {
        const flow = JSON.parse(flowRaw);
        isDesignComplete =
          flow?.stage === "DESIGN_COMPLETE" ||
          (Array.isArray(flow?.stages) &&
            flow.stages.length > 0 &&
            flow.stages.every((s) => s.reviewState === "APPROVED"));
      }
    } catch {
      // ignore
    }

    // Merge everything, prioritizing manual overrides
    const override = overrides[siteID] || {};

    // Get advance payment info from milestones
    let advancePaidDate = null;
    let isAdvancePaid = false;
    try {
      const savedMilestones = localStorage.getItem(`clientMilestones_${c.clientID}`);
      if (savedMilestones) {
        const milestones = JSON.parse(savedMilestones);
        const advanceMilestone = milestones.find(
          (m) => m.id === 1 || m.name?.toUpperCase()?.includes("ADVANCE")
        );
        if (advanceMilestone && advanceMilestone.status === "paid") {
          advancePaidDate = advanceMilestone.paidDate;
          isAdvancePaid = true;
        }
      }
    } catch (e) {
      console.error("Error reading client milestones in siteStorage", e);
    }

    // Start date follows the paid advance: a real manual start date is kept,
    // but the "Awaiting Advance Payment" placeholder yields to the paid date.
    const resolvedStartDate =
      override.startDate && override.startDate !== "Awaiting Advance Payment"
        ? override.startDate
        : advancePaidDate || "Awaiting Advance Payment";

    // Effective status: an executing/completed schedule wins; otherwise a saved
    // override; otherwise the schedule-derived stage.
    const resolvedStatus =
      isDesignComplete || override.status === "Completed"
        ? "Completed"
        : autoStatus === "Design" || autoStatus === "Completed"
          ? autoStatus
          : override.status !== undefined
            ? override.status
            : autoStatus;
    const hasSupervisor =
      (override.supervisor !== undefined ? override.supervisor : null) != null;

    // Stage-based progress milestones, so the bar tracks the project phase:
    //   not started 0 → survey 25 → design 50 → in progress 75 → completed 100.
    // A "Survey" site reads 0 until a supervisor is assigned (survey actually
    // begun), then 25. Derived from the resolved stage, so a stale saved override
    // can't inflate it (an old client-portal demo wrote 75% on survey sites).
    const resolvedProgress = (() => {
      switch (String(resolvedStatus || "").toLowerCase()) {
        case "completed":
          return 100;
        case "design":
          return 50;
        case "survey":
          return hasSupervisor ? 25 : 0;
        default:
          return 0;
      }
    })();

    const isArchClient = (c.serviceTrack || lead?.serviceTrack) === "Architecture";
    return {
      siteID,
      clientID: c.clientID,
      clientName: c.clientName,
      clientPhone: c.clientPhone || "",
      clientEmail: c.clientEmail || "",
      budget: c.budget || "",
      serviceTrack: c.serviceTrack || lead?.serviceTrack || "Interiors",
      projectIntent: lead?.projectIntent || c.projectIntent || "",
      propertyPreset: isArchClient ? "" : normalizePreset(override.propertyPreset || lead?.quotePreset || getDefaultPresetForType(c.location)),
      siteType: isArchClient ? (c.buildingUse || c.requirementType || "Architecture") : (c.location || "Residential"),
      location: c.locationSecondary || "Main City",
      fullAddress: c.siteAddress || c.locationSecondary || "Site Location",
      // Execution schedule wins once work starts/completes; before that the
      // explicit Survey/Design gate remains authoritative.
      targetDate: override.targetDate || autoTargetDate || defaultTargetDate,
      supervisor: override.supervisor !== undefined ? override.supervisor : null,
      notes: override.notes || autoNotes,
      ...override,
      // Status, progress, advance + start date are LIVE (schedule / stage /
      // milestones) — re-asserted AFTER the override spread so a stale saved
      // override can't mask them (e.g. an old 75% progress placeholder on a
      // survey-stage site).
      isAdvancePaid,
      advancePaidDate,
      startDate: resolvedStartDate,
      status: resolvedStatus,
      progress: resolvedProgress,
    };
  });

  // Handle any completely custom sites that aren't linked to a client
  const customSites = Object.values(overrides).filter(
    (s) => !baseSites.some((b) => b.siteID === s.siteID)
  );

  return [...baseSites, ...customSites];
};

export const getSite = (siteID) => {
  return getAllSites().find((s) => s.siteID === siteID) || null;
};

export const saveSite = (site) => {
  const overrides = readJson(SITES_OVERRIDE_KEY, {});
  overrides[site.siteID] = {
    ...overrides[site.siteID],
    ...site,
  };
  writeJson(SITES_OVERRIDE_KEY, overrides);
  window.dispatchEvent(new Event("siteDataChanged"));

  // Backend write-through: PATCH the changed fields. Resolve the Mongo id from
  // the cached record; if absent the site is local-only, so skip the API call.
  const backendId = backendIdFor(site.siteID);
  if (backendId) pushSite(() => updateSite(backendId, site));
};

export const createCustomSite = (siteData) => {
  const overrides = readJson(SITES_OVERRIDE_KEY, {});
  const sites = getAllSites();
  
  const nextNum = String(sites.length + 1).padStart(3, "0");
  const siteID = `ST-2026-${nextNum}`;
  
  const newSite = {
    siteID,
    clientName: siteData.clientName || "Unknown Client",
    propertyPreset: siteData.propertyPreset || "",
    siteType: siteData.siteType || "Residential",
    location: siteData.location || "Local",
    fullAddress: siteData.fullAddress || "Local Site Address",
    status: siteData.status || null,
    progress: siteData.progress || 0,
    startDate: siteData.startDate || new Date().toLocaleDateString("en-IN").replace(/\//g, "."),
    targetDate: siteData.targetDate || "31.12.2026",
    supervisor: siteData.supervisor || null,
    notes: siteData.notes || "New site registered.",
  };

  overrides[siteID] = newSite;
  writeJson(SITES_OVERRIDE_KEY, overrides);
  window.dispatchEvent(new Event("siteDataChanged"));

  // Backend write-through: create the site, then merge the server-assigned
  // Mongo `id` back onto the cached record so subsequent saves can PATCH it.
  // Best-effort — a failure leaves the optimistic local site untouched.
  pushSite(async () => {
    const created = await createSite({
      clientName: newSite.clientName,
      propertyPreset: newSite.propertyPreset,
      siteType: newSite.siteType,
      location: newSite.location,
      fullAddress: newSite.fullAddress,
      status: newSite.status,
      progress: newSite.progress,
      startDate: newSite.startDate,
      targetDate: newSite.targetDate,
      supervisor: newSite.supervisor,
      notes: newSite.notes,
    });
    const id = created?.id;
    if (!id) return;
    const current = readJson(SITES_OVERRIDE_KEY, {});
    current[siteID] = { ...current[siteID], id, siteId: created?.siteId };
    writeJson(SITES_OVERRIDE_KEY, current);
    window.dispatchEvent(new Event("siteDataChanged"));
  });

  return newSite;
};

// Backend hydration: pull the server's sites into the local override cache,
// keyed by siteID, so the synchronous getAllSites() reads them. No-op when
// logged out; on any error or empty/invalid response it leaves the existing
// localStorage untouched (never overwrites good local data with empty).
export async function hydrateSites() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await listSites({ limit: 200 });
  } catch (e) {
    console.warn("hydrateSites: failed to fetch sites", e);
    return;
  }
  // Tolerate paged ({ data: [...] }) or bare array responses.
  const list = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(list) || list.length === 0) return;

  const overrides = readJson(SITES_OVERRIDE_KEY, {});
  for (const s of list) {
    // The backend's site id (ST-YYYY-###) may arrive as `siteId`/`siteID`.
    const siteID = s.siteID || s.siteId;
    if (!siteID) continue;
    overrides[siteID] = { ...overrides[siteID], ...s, siteID };
  }
  writeJson(SITES_OVERRIDE_KEY, overrides);
  window.dispatchEvent(new Event("siteDataChanged"));
}

export const fetchSurveyMedia = async (siteID) => {
  // Simulate mobile app API network delay
  await new Promise((resolve) => setTimeout(resolve, 800));
  
  return {
    siteID,
    surveyedAt: "08.06.2026",
    device: "iPad Pro (Survey App v2.4)",
    rooms: [
      {
        name: "Living Room",
        images: ["/survey_living_room.png", "/survey_living_room_2.png", "/survey_living_room_3.png"],
        dimensions: "18' x 14'",
        notes: "Sufficient lighting. Outlets need realignment near TV panel wall.",
        status: "Done",
        checkedAt: "08.06.2026 10:15 AM",
      },
      {
        name: "Kitchen",
        images: ["/survey_kitchen.png", "/survey_kitchen_2.png", "/survey_kitchen_3.png"],
        dimensions: "12' x 10'",
        notes: "Plumbing inlet matches design. Modular kitchen height check ok.",
        status: "Done",
        checkedAt: "08.06.2026 10:45 AM",
      },
      {
        name: "Bathroom",
        images: ["/survey_bathroom.png", "/survey_bathroom_2.png", "/survey_bathroom_3.png"],
        dimensions: "8' x 6'",
        notes: "Waterproofing checked. Wall tile height needs to be 7 feet.",
        status: "Done",
        checkedAt: "08.06.2026 11:05 AM",
      },
      {
        name: "Bedroom",
        images: ["/survey_bedroom.png", "/survey_bedroom_2.png", "/survey_bedroom_3.png"],
        dimensions: "14' x 12'",
        notes: "Air conditioning piping provision ready. Wardrobe niche verified.",
        status: "Done",
        checkedAt: "08.06.2026 11:30 AM",
      },
    ]
  };
};
