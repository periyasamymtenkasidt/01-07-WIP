// Merged client lookup used by BOQs, quotes, and any form that needs to
// auto-fill from an existing client. Mirrors the merge logic in Client.jsx
// (static seed + localStorage adds, minus soft-deleted IDs).

import { ClientTableData } from "./ClientTableData";
import { tokens } from "../api/client";
import { listClients } from "../api/clients";

const NEW_KEY = "newClientsData";
const DELETED_KEY = "deletedClients";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
};

export const getAllClients = () => {
  const newClients = readJson(NEW_KEY, []);
  const deleted = readJson(DELETED_KEY, []);
  const base = [...ClientTableData];
  const trulyNew = [];

  newClients.forEach((nc) => {
    const idx = base.findIndex((c) => c.clientID === nc.clientID);
    if (idx >= 0) base[idx] = nc;
    else trulyNew.push(nc);
  });

  return [...trulyNew, ...base].filter((c) => !deleted.includes(c.clientID));
};

export const getClient = (clientID) => {
  if (!clientID) return null;
  return getAllClients().find((c) => c.clientID === clientID) || null;
};

// Clients write-through cache hydration (the clients module still uses the
// local write-through cache; leads have since moved to a backend-only list):
// the clients list is still read SYNCHRONOUSLY out of localStorage
// `newClientsData` by Client.jsx / ClientProfile.jsx, so this pulls the
// backend's clients into that same cache after login rather than rewiring every
// consumer to async. Safe-by-default: no-op when logged out, never overwrites
// good local edits with an empty/garbage server response, falls back silently.
//
// Merge is by clientID so any unsynced local edits survive (local copy wins on
// conflict); server records carry their Mongo `id` so later mutations can
// resolve the backend id. Fires `leadDataChanged` (already listened in several
// places) so open lists refresh without adding a new event wiring.
export async function hydrateClients() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await listClients({ limit: 200 });
  } catch (e) {
    console.warn("hydrateClients: keeping local clients —", e?.message || e);
    return;
  }
  // Tolerate the paged envelope ({ data:[...], page, total, pages }) or a bare
  // array — the backend isn't fully uniform.
  const server = Array.isArray(data) ? data : data?.data;
  if (!Array.isArray(server) || server.length === 0) return;

  let local = [];
  try {
    local = JSON.parse(localStorage.getItem(NEW_KEY) || "[]");
    if (!Array.isArray(local)) local = [];
  } catch {
    local = [];
  }

  // Keep every local record (local edits win), then append server records whose
  // clientID we don't already hold locally.
  const localIds = new Set(local.map((c) => c.clientID));
  const merged = [
    ...local,
    ...server.filter((s) => s.clientID && !localIds.has(s.clientID)),
  ];

  localStorage.setItem(NEW_KEY, JSON.stringify(merged));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("leadDataChanged"));
  }
}

// Flatten a client record into the shape the BOQ Client & Project section
// expects. Lets the editor stay decoupled from the client data schema.
export const clientToBoqFields = (c) => {
  if (!c) return { client: {}, project: {} };
  return {
    client: {
      id: c.clientID,
      name: c.clientName || "",
      phone: c.clientPhone || "",
      email: c.clientEmail || "",
      address: c.locationSecondary || "",
      gstin: c.gstin || "",
    },
    project: {
      name: c.projectName || c.locationSecondary || "",
      propertyType: c.location || "",
      address: c.locationSecondary || "",
      sizeRange: c.sizeRange || "",
    },
  };
};
