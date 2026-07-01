// Firm-wide org profile — the "who is issuing this document" data that
// BOQPreview (and eventually quotes/invoices) stamp onto client-facing
// documents. Single record, mirrors the read/write style of clientStorage.js
// but for one object instead of a list.

import { getOrgProfile as getOrgProfileApi, putOrgProfile } from "../api/masters";
import { tokens } from "../api/client";

const STORAGE_KEY = "org_profile";

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMaster = (fn) => {
  try {
    Promise.resolve(fn()).catch(() => {});
  } catch {
    /* ignore */
  }
};

export const DEFAULT_ORG_PROFILE = {
  name: "Digital Atelier",
  tagline: "Interior Architecture & Design",
  addressLine: "",
  city: "Bengaluru",
  state: "Karnataka",
  // 2-digit GST state code for the firm's registered state (e.g. "29"
  // Karnataka, "33" Tamil Nadu) — used to resolve IGST vs CGST+SGST when the
  // org's GSTIN itself is missing or malformed.
  stateCode: "29",
  phone: "+91 80 4000 0000",
  email: "hello@digitalatelier.in",
  website: "",
  gstin: "29AAAAA0000A1Z5",
  pan: "",
  logoDataUrl: "",
  bankName: "",
  bankAccount: "",
  bankIfsc: "",
  bankBranch: "",
  upi: "",
  defaultValidity: "30 days from issue",
  defaultWarranty: "",
  defaultNotes: "",
};

export const getOrgProfile = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ORG_PROFILE, ...JSON.parse(raw) };
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_ORG_PROFILE };
};

export const saveOrgProfile = (profile) => {
  const next = { ...DEFAULT_ORG_PROFILE, ...profile };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  // Backend write-through: push the merged profile in the background.
  pushMaster(() => putOrgProfile(next));
  return next;
};

// Backend hydration: pull the server copy into the local cache. No-op when
// logged out; on any error or empty/invalid response it leaves the seeded
// localStorage untouched. This module has no change event, so none is fired.
// Writes localStorage directly (not via saveOrgProfile) to avoid an echo PUT.
export async function hydrateOrgProfile() {
  if (!tokens.access()) return;
  let data;
  try {
    data = await getOrgProfileApi();
  } catch (e) {
    console.warn("hydrateOrgProfile: failed to fetch org profile", e);
    return;
  }
  // Tolerate a bare object or an { orgProfile: {...} } / { profile: {...} } wrapper.
  const profile = data?.orgProfile || data?.profile || data;
  if (!profile || typeof profile !== "object" || Object.keys(profile).length === 0)
    return;
  const next = { ...DEFAULT_ORG_PROFILE, ...profile };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
