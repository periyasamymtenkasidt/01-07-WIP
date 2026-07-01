// Per-project room schedule. localStorage-backed (`projectSchedule_<proposalId>`).
//
// Model: the schedule is PARALLEL. Every room starts on Day 0 and runs its own
// `days` (working days) independently — the overall project ends with the
// LONGEST room. Day 0 = the Booking Token paid date (milestone id 1), or a
// manual `workStart` fallback. Dates are computed, never typed per-room.
// Status is DERIVED from those dates (not manually set); health/escalation
// derive from the Master → Schedule config.
//
// Durations, timelines and possession math are all in DAYS. Each room also
// carries `shiftsPerDay` — shifts worked per day (sourced from the Schedule
// Master, the single source for shift requirements). This is an independent
// execution-planning dimension:
//   • Total Planned Shifts = days × shiftsPerDay (team allocation).
//   • Progress = shiftsDone / totalPlanned × 100.
// shiftsPerDay does NOT change the day-based timeline.
//
// Stored shape: { workStart: "YYYY-MM-DD" | "", rooms: [ {id, room, description,
// days, shiftsPerDay, shiftsDone, owner, status, note} ] } — array order IS the
// sequence.

import { getConfigForType, getLatestQuoteForParent } from "./QuotePresets";
import { getMilestonesForLead } from "./LeadStatusConfig";
import {
  getScheduleConfig,
  getEscalationRole,
  getRoomDefaultShiftsPerDay,
} from "./scheduleConfig";

const key = (proposalId) => `projectSchedule_${proposalId}`;

export function getSchedule(proposalId) {
  try {
    const raw = localStorage.getItem(key(proposalId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSchedule(proposalId, schedule) {
  localStorage.setItem(key(proposalId), JSON.stringify(schedule));
  window.dispatchEvent(new Event("scheduleChanged"));
}

let _seq = 0;
const newId = () => `t${Date.now().toString(36)}_${_seq++}`;

export function makeRoom(partial = {}) {
  const cfg = getScheduleConfig();
  return {
    id: newId(),
    room: "",
    description: "",
    days: "", // working days — drives the timeline
    shiftsPerDay: "", // shifts worked per day (from Schedule Master); planning only
    shiftsDone: 0, // shifts completed so far — progress tracking
    owner: "",
    status: cfg.statuses[0] || "Not Started",
    done: false, // manual override: marks a room complete regardless of dates
    note: "",
    amount: 0,
    materials: [],
    quantity: "1 Unit",
    measurement: "—",
    ...partial,
  };
}

// One schedule ROOM per area, summarizing the works under it. Scope items are
// now works (e.g. "False Ceiling", "TV Unit") that share a room, so we group by
// area — otherwise a room with two works would show as two "Living Room" rows.
export function seedRoomsFromProposal(lead) {
  if (!lead) return [];
  const cfg = getConfigForType(lead.quotePreset, lead.propertyType);
  const items = lead.quoteScopeItems || getLatestQuoteForParent(lead.proposalId)?.scopeItems || cfg?.scopeItems || [];
  const status0 = getScheduleConfig().statuses[0] || "Not Started";

  const byRoom = new Map();
  for (const s of items) {
    const room = s.area || s.room || "Unassigned";
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room).push(s);
  }

  return [...byRoom.entries()].map(([room, works]) => {
    // Each work carries its own days (timeline) and shiftsPerDay (execution
    // rate). shiftsPerDay comes from the work's own value if present, else the
    // Schedule Master default for that scope name.
    const workRows = works.map((w) => {
      const name = w.itemName || w.description || "Work";
      const shiftsPerDay =
        w.shiftsPerDay != null && w.shiftsPerDay !== ""
          ? Number(w.shiftsPerDay) || 0
          : Number(getRoomDefaultShiftsPerDay(name)) || 0;
      return { name, days: Number(w.days) || 0, shiftsPerDay };
    });
    const roomDays = workRows.reduce((sum, w) => sum + (Number(w.days) || 0), 0);
    // Total Planned Shifts across the room's works = Σ (days × shiftsPerDay).
    const totalPlanned = workRows.reduce(
      (sum, w) => sum + (Number(w.days) || 0) * (Number(w.shiftsPerDay) || 0),
      0,
    );
    // Representative room rate so a single number can be shown; getRoomShiftPlan
    // still derives the exact total from the works.
    const roomShiftsPerDay = roomDays > 0 ? Math.round(totalPlanned / roomDays) : 0;
    return makeRoom({
      room,
      // The individual works under this room, each with its own days/shiftsPerDay
      // — the schedule lists them below the room heading.
      works: workRows,
      // Room duration = sum of its works' days (done in sequence within the room).
      days: roomDays || "",
      shiftsPerDay: roomShiftsPerDay || "",
      status: status0,
      amount: works.reduce((sum, w) => sum + (Number(w.amount) || 0), 0),
      materials: works.flatMap((w) => w.materials || []),
      quantity: `${works.length} work${works.length === 1 ? "" : "s"}`,
      measurement: "—",
    });
  });
}

// Saved schedule, or a seeded (unsaved) one. Pure — no write during render.
export function getOrSeedSchedule(lead) {
  const base = {
    workStart: "",
    delayNote: "",
    delayAttribution: "", // "client" | "our" — who caused the 7-day post-payment delay
    clientApproved: false, // client signed off on the work-start date
    breachReason: "", // "client" | "our" — who caused a possession breach
    confirmedAt: "", // ISO timestamp; once set the start is locked
    rooms: [],
  };
  if (!lead) return base;
  const saved = getSchedule(lead.proposalId);
  if (saved)
    return {
      ...base,
      workStart: saved.workStart || "",
      delayNote: saved.delayNote || "",
      delayAttribution: saved.delayAttribution || "",
      clientApproved: !!saved.clientApproved,
      breachReason: saved.breachReason || "",
      confirmedAt: saved.confirmedAt || "",
      rooms: saved.rooms || [],
    };
  return { ...base, rooms: seedRoomsFromProposal(lead) };
}

// ── Working-day math ─────────────────────────────────────────────────────────
// Every day counts — Sundays are now included in schedule calculations.
const isNonWorkingDay = () => false;

function nextWorkingDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  while (isNonWorkingDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

// Advance `n` working days from `date` (Sundays included — every day counts).
function addWorkingDays(date, n) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    if (!isNonWorkingDay(d)) added += 1;
  }
  return d;
}

// Count working days in the inclusive range [from, to]; 0 if from is after to.
// Used so countdowns are in the SAME unit as durations (working days), e.g. a
// 20-working-day room reads "20d left" on its first day, not ~27 calendar days.
function workingDaysInclusive(from, to) {
  const a = new Date(from);
  a.setHours(0, 0, 0, 0);
  const b = new Date(to);
  b.setHours(0, 0, 0, 0);
  if (a > b) return 0;
  let count = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    if (!isNonWorkingDay(d)) count += 1;
  }
  return count;
}

// Date that is `n` working days from `fromDate` (Sundays included), as an ISO
// "YYYY-MM-DD" string. Returns "" for a non-positive/invalid count. Local-time
// formatting (not toISOString) so the date doesn't shift across timezones.
export function addWorkingDaysISO(fromDate, n) {
  const start = new Date(fromDate);
  if (Number.isNaN(start.getTime()) || !n || n <= 0) return "";
  const d = addWorkingDays(start, Math.round(n));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const parseDDMMYYYY = (s) => {
  const [d, m, y] = (s || "").split(".").map(Number);
  if (!d || !m || !y) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

// Day-0 anchor from the Booking Token (milestone id 1) once it's paid.
export function getBookingDate(milestones) {
  const booking = (milestones || []).find(
    (m) => m.id === 1 && m.status === "paid",
  );
  return booking?.paidDate ? parseDDMMYYYY(booking.paidDate) : null;
}

// Resolve Day 0. Once the booking is paid, work starts on the confirmed
// `workStart` if it's on/after the payment date (else the payment date itself),
// and `bookingDate` is returned so the UI can flag a gap. Before payment, the
// manual `workStart` is a provisional anchor.
export function resolveAnchor(lead, schedule) {
  const booking = getBookingDate(getMilestonesForLead(lead));
  let manual = null;
  if (schedule?.workStart) {
    const d = new Date(`${schedule.workStart}T00:00:00`);
    if (!Number.isNaN(d.getTime())) manual = d;
  }
  if (booking) {
    const date = manual && manual >= booking ? manual : booking;
    return { date, source: "booking", bookingDate: booking };
  }
  if (manual) return { date: manual, source: "manual", bookingDate: null };
  return { date: null, source: null, bookingDate: null };
}

// PARALLEL model: every room starts on the same Day-0 anchor and runs its own
// `days` (working days) independently. Rooms with no/zero duration are returned
// unscheduled. Returns a new array: [{ ...room, start: Date|null, end: Date|null }].
export function computeChain(rooms, anchorDate) {
  if (!anchorDate) return rooms.map((r) => ({ ...r, start: null, end: null }));
  const start0 = nextWorkingDay(anchorDate);
  return rooms.map((r) => {
    // Timeline is driven by `days` (working days) — unchanged by shifts.
    const days = Math.max(0, Number(r.days) || 0);
    if (days <= 0) return { ...r, start: null, end: null };
    const start = new Date(start0);
    const end = days > 1 ? addWorkingDays(start, days - 1) : new Date(start);
    return { ...r, start, end };
  });
}

// Effective status. A manual `done` flag wins (the only manual override).
// Otherwise it's derived from dates — but only once work has actually `started`
// (Booking Token paid). Before that everything reads "Not Started" so nothing
// shows as in-progress/overdue until the project is Won and booked.
export function deriveStatus(room, started = true) {
  if (!started || !room?.start) return "Not Started";
  if (room?.done) return "Done"; // manual override, only once work has started
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today < room.start ? "Not Started" : "In Progress";
}

// Overall project end = the latest room end (parallel model); null if none.
export function getProjectEnd(chain) {
  const ends = chain.map((r) => r.end).filter(Boolean);
  return ends.length ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;
}

// ── Shift-based execution planning & progress ───────────────────────────────
// shiftsPerDay (from the Schedule Master) is the execution rate, kept SEPARATE
// from the day-based timeline. It answers two questions the timeline can't:
//   • team allocation — shiftsPerDay shifts (teams) run per working day, giving
//     Total Planned Shifts = days × shiftsPerDay. When a room groups several
//     works, the total is the exact Σ (work.days × work.shiftsPerDay).
//   • progress — `shiftsDone` of Total Planned Shifts completed.

export function getRoomShiftPlan(room) {
  const days = Math.max(0, Number(room?.days) || 0);
  // Prefer the exact per-work total when the room groups works; otherwise fall
  // back to the room-level rate × days.
  const works = Array.isArray(room?.works) ? room.works : null;
  const totalPlanned = works?.length
    ? works.reduce(
        (sum, w) => sum + (Number(w.days) || 0) * (Number(w.shiftsPerDay) || 0),
        0,
      )
    : days * Math.max(0, Number(room?.shiftsPerDay) || 0);
  // Representative rate for display (exact when the works share one rate).
  const shiftsPerDay =
    days > 0 ? Math.round(totalPlanned / days) : Math.max(0, Number(room?.shiftsPerDay) || 0);
  return { days, shiftsPerDay, totalPlanned };
}

export function getRoomShiftProgress(room) {
  const { totalPlanned } = getRoomShiftPlan(room);
  // A room flagged done is 100% regardless of the recorded count.
  const done = room?.done
    ? totalPlanned
    : Math.min(totalPlanned, Math.max(0, Number(room?.shiftsDone) || 0));
  const pct = totalPlanned > 0 ? Math.round((done / totalPlanned) * 100) : 0;
  return { done, total: totalPlanned, pct };
}

// Project-level shift roll-up across all rooms (for progress tracking).
export function getProjectShiftSummary(rooms) {
  return (rooms || []).reduce(
    (acc, r) => {
      const { done, total } = getRoomShiftProgress(r);
      acc.done += done;
      acc.total += total;
      return acc;
    },
    { done: 0, total: 0 },
  );
}

export const RAG_CHIP = {
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-600",
  none: "bg-gray-100 text-gray-500",
};

// Health for a room given its computed end date + status.
export function getRoomHealth(end, status, config = getScheduleConfig()) {
  const isDone = String(status || "").toLowerCase() === "done";
  if (isDone)
    return { rag: "green", state: "done", label: "Done", daysOverdue: 0, role: null };
  if (!end)
    return { rag: "none", state: "unscheduled", label: "—", daysOverdue: 0, role: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today > end) {
    const dayAfterEnd = new Date(end);
    dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
    const daysOverdue = workingDaysInclusive(dayAfterEnd, today);
    const role = getEscalationRole(daysOverdue, config);
    return {
      rag: "red",
      state: "overdue",
      daysOverdue,
      role,
      label: role ? `${daysOverdue}d overdue → ${role}` : `${daysOverdue}d overdue`,
    };
  }

  // Working days remaining, inclusive of today (so the first day of an N-day
  // room reads "Nd left" — same unit as the duration).
  const left = workingDaysInclusive(today, end);
  if (left <= (Number(config.amberWindowDays) || 0)) {
    return {
      rag: "amber",
      state: "due-soon",
      daysOverdue: 0,
      role: null,
      label: left <= 1 ? "Due today" : `${left}d left`,
    };
  }
  return { rag: "green", state: "on-track", daysOverdue: 0, role: null, label: `${left}d left` };
}

// Roll-up: overdue room count for a project (resolves anchor itself).
export function getProjectOverdueCount(lead) {
  const schedule = getSchedule(lead?.proposalId);
  if (!schedule?.rooms?.length) return 0;
  const { date, source } = resolveAnchor(lead, schedule);
  if (source !== "booking") return 0; // no overdue until work has actually begun
  const config = getScheduleConfig();
  return computeChain(schedule.rooms, date).filter(
    (r) => getRoomHealth(r.end, deriveStatus(r, true), config).state === "overdue",
  ).length;
}

// Slack (float) for a project: possession date minus planned completion.
// Planned completion = the longest room's end (parallel model) from the
// resolved anchor. Negative slack = over-committed. `level`: "over" (red),
// "tight" (≤5 days buffer, amber), "ok", or "none" when there's nothing to
// compare (no schedule or no possession date). Days are calendar days.
export const SLACK_TIGHT_DAYS = 5;

// Possession (handover) date for a lead, parsed from its "DD.MM.YYYY" string.
export function getPossessionDate(lead) {
  return parseDDMMYYYY(lead?.possessionDate);
}

// Days the planned completion overshoots possession (>0 means breached), for a
// given chain end date. Returns 0 when there's no possession date or no overshoot.
export function getBreachDays(possession, plannedEnd) {
  if (!possession || !plannedEnd || plannedEnd <= possession) return 0;
  return Math.round((plannedEnd - possession) / 86400000);
}

export function getProjectSlack(lead) {
  const possession = parseDDMMYYYY(lead?.possessionDate);
  const schedule = getSchedule(lead?.proposalId);
  let plannedEnd = null;
  if (schedule?.rooms?.length) {
    const { date } = resolveAnchor(lead, schedule);
    plannedEnd = getProjectEnd(computeChain(schedule.rooms, date));
  }
  if (!possession || !plannedEnd) {
    return { possession, plannedEnd, slackDays: null, level: "none" };
  }
  const slackDays = Math.round((possession - plannedEnd) / 86400000);
  const level =
    slackDays < 0 ? "over" : slackDays <= SLACK_TIGHT_DAYS ? "tight" : "ok";
  return { possession, plannedEnd, slackDays, level };
}
