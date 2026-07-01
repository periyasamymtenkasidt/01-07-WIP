// Room presets for the Proposal Master heading picker.
//
// This is intentionally SEPARATE from the Schedule Master scope presets
// (`rooms` in data/scheduleConfig.js). The Schedule Master groups work by the
// static scope/work-item it schedules (False Ceiling, Wardrobe, …); the
// Proposal Master groups scope rows by the physical ROOM they belong to
// (Living Room, Kitchen, Master Bedroom, …). Keeping the two lists apart lets
// each evolve without disturbing the other. localStorage-backed so it works
// without a backend; a backend later just syncs the same shape.

import { getProposalRooms as getProposalRoomsApi, putProposalRooms } from "../api/masters";
import { tokens } from "../api/client";

const KEY = "proposalRooms";

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore */
  }
};

// Default rooms shown in the Proposal Master "Room / Category" heading picker.
// `days` is optional (left blank for rooms — duration lives on the work item).
export const DEFAULT_PROPOSAL_ROOMS = [
  { name: "Living Room", days: "" },
  { name: "Dining", days: "" },
  { name: "Kitchen", days: "" },
  { name: "Master Bedroom", days: "" },
  { name: "Bedroom 2", days: "" },
  { name: "Bedroom 3", days: "" },
  { name: "Kids Bedroom", days: "" },
  { name: "Guest Bedroom", days: "" },
  { name: "Bathroom", days: "" },
  { name: "Master Bathroom", days: "" },
  { name: "Foyer", days: "" },
  { name: "Study / Home Office", days: "" },
  { name: "Pooja Room", days: "" },
  { name: "Balcony", days: "" },
  { name: "Utility", days: "" },
  { name: "Staircase", days: "" },
];

// Coerce rooms to [{ name, days }] — tolerates a string-array format and
// partial blobs so older saved configs keep working.
function normalizeRooms(rooms) {
  if (!Array.isArray(rooms)) return DEFAULT_PROPOSAL_ROOMS;
  return rooms
    .map((r) =>
      typeof r === "string"
        ? { name: r.trim(), days: "" }
        : { name: (r?.name || "").trim(), days: r?.days ?? "" },
    )
    .filter((r) => r.name);
}

export function getProposalRooms() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PROPOSAL_ROOMS;
    const saved = JSON.parse(raw);
    const rooms = normalizeRooms(saved.rooms || saved);
    return rooms.length ? rooms : DEFAULT_PROPOSAL_ROOMS;
  } catch {
    return DEFAULT_PROPOSAL_ROOMS;
  }
}

export function saveProposalRooms(rooms) {
  const normalized = normalizeRooms(rooms);
  localStorage.setItem(KEY, JSON.stringify({ rooms: normalized }));
  window.dispatchEvent(new Event("proposalRoomsChanged"));
  // Backend write-through: push the normalized rooms in the background.
  pushMaster(() => putProposalRooms({ rooms: normalized }));
}

// Backend hydration: pull the server copy into the local cache, then fire the
// existing change event so listeners refresh. No-op when logged out; on any
// error or empty/invalid response it leaves the seeded localStorage untouched.
// Writes localStorage directly (not via saveProposalRooms) to avoid an echo PUT.
export async function hydrateProposalRooms() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getProposalRoomsApi();
  } catch (e) {
    console.warn("hydrateProposalRooms: failed to fetch proposal rooms", e);
    return;
  }
  // Tolerate a bare array or a { rooms: [...] } wrapper.
  const rooms = normalizeRooms(Array.isArray(data) ? data : data?.rooms);
  if (!rooms.length) return;
  localStorage.setItem(KEY, JSON.stringify({ rooms }));
  window.dispatchEvent(new Event("proposalRoomsChanged"));
}

export function resetProposalRooms() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("proposalRoomsChanged"));
}

// Append a new room to the list and persist. Returns the updated list. No-op
// (returns current) if the name already exists (case-insensitive).
export function addProposalRoom(name, days = "") {
  const trimmed = (name || "").trim();
  const rooms = getProposalRooms();
  if (!trimmed) return rooms;
  if (rooms.some((r) => r.name.toUpperCase() === trimmed.toUpperCase())) return rooms;
  const next = [...rooms, { name: trimmed, days }];
  saveProposalRooms(next);
  return next;
}

// ── Heading helpers (drop-in replacements for the schedule-backed ones the
//    Proposal heading flow previously consumed) ──────────────────────────────

// Room presets as heading options — [{ name, days }] — the single source for
// the Proposal Master heading picker's "Room / Category Presets" list.
export function getProposalRoomPresets() {
  return getProposalRooms().map((r) => ({ name: r.name, days: r.days ?? "" }));
}

// All headings, optionally filtered by room/category name. Returns
// [{ name, category }]. A room has no sub-headings, so a matched room returns
// itself; an unknown category returns itself as a single heading.
export function getProposalRoomHeadings(category = null) {
  const rooms = getProposalRooms();
  if (!category) {
    return rooms.map((r) => ({ name: r.name, category: r.name }));
  }
  const cat = category.trim().toUpperCase();
  const matched = rooms.filter((r) => r.name.trim().toUpperCase() === cat);
  if (matched.length > 0) {
    return matched.map((r) => ({ name: r.name, category: r.name }));
  }
  return [{ name: category.trim(), category: category.trim() }];
}

// Extract the parent room/category from a heading. The longest room name that
// is a prefix of the heading wins (so "KITCHEN - Island Area" → "Kitchen").
// Falls back to the heading itself.
export function getCategoryFromProposalHeading(headingName) {
  if (!headingName) return "";
  const upper = headingName.trim().toUpperCase();
  const rooms = getProposalRooms()
    .map((r) => r.name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length); // longest first
  for (const room of rooms) {
    if (upper === room.toUpperCase() || upper.startsWith(room.toUpperCase() + " - ")) {
      return room;
    }
  }
  return headingName.trim();
}

// Persist a brand-new heading. A custom heading like "KITCHEN - Island Area"
// stays under its parent room, so there's nothing extra to store — kept for
// signature compatibility with the previous schedule-backed helper.
export function addProposalRoomHeading() {
  return getProposalRoomPresets();
}
