// Self-serve organisation accounts (local-first).
//
// The backend exposes no register endpoint yet — auth is login/refresh/me only,
// and multi-tenant/org onboarding is still an open question (see BACKEND_SPEC.md
// §"Single firm or multi-tenant?"). So a new organisation that signs up from the
// public site is stored in localStorage and its admin can sign in against that
// local record, exactly like the rest of the app's optimistic-local pattern.
//
// SECURITY NOTE: this is a front-end stopgap, NOT real auth. Credentials live in
// the browser and the "token" is a local marker. When `POST /auth/register`
// lands, replace `registerOrganisation` with a real call and drop the local
// session path in `loginStaff` — this module is the single seam to swap.

import { tokens } from "../api/client";
import { saveOrgProfile } from "../data/orgProfile";

const STORAGE_KEY = "org_accounts";

const readAccounts = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const writeAccounts = (list) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

const normEmail = (e) => String(e || "").trim().toLowerCase();

// Reversible obfuscation only — keeps plaintext out of the raw store, but is NOT
// a real hash. Real password hashing belongs on the backend.
const enc = (s) => {
  try {
    return btoa(unescape(encodeURIComponent(s)));
  } catch {
    return s;
  }
};

export const findAdminByEmail = (email) => {
  const target = normEmail(email);
  return readAccounts().find((a) => normEmail(a.admin?.email) === target) || null;
};

// Validate signup credentials against a locally-registered org admin.
// Returns the sanitised user (no password) on success, else null.
export function verifyOrgAdmin(email, password) {
  const account = findAdminByEmail(email);
  if (!account) return null;
  if (account.admin.password !== enc(password)) return null;
  return {
    id: account.orgId,
    name: account.admin.name,
    email: account.admin.email,
    role: "admin",
    orgId: account.orgId,
    orgName: account.organisation.name,
    local: true,
  };
}

// Create a new organisation + its first admin. Throws if the email is taken.
// On success it also seeds the firm-wide org profile so client-facing documents
// (BOQ/quotes/invoices) carry the new organisation's details.
export function registerOrganisation({ organisation, admin }) {
  if (findAdminByEmail(admin.email)) {
    throw new Error("An account with this email already exists. Try signing in.");
  }

  const orgId = `ORG-${Date.now().toString(36).toUpperCase()}`;
  const record = {
    orgId,
    organisation: {
      name: organisation.name.trim(),
      gstin: (organisation.gstin || "").trim().toUpperCase(),
      city: (organisation.city || "").trim(),
      state: (organisation.state || "").trim(),
      phone: (organisation.phone || "").trim(),
    },
    admin: {
      name: admin.name.trim(),
      email: admin.email.trim(),
      password: enc(admin.password),
    },
    createdAt: new Date().toISOString(),
  };

  writeAccounts([...readAccounts(), record]);

  // Make the new organisation the active firm profile.
  saveOrgProfile({
    name: record.organisation.name,
    gstin: record.organisation.gstin,
    city: record.organisation.city || undefined,
    state: record.organisation.state || undefined,
    phone: record.organisation.phone || undefined,
    email: record.admin.email,
  });

  return { orgId, email: record.admin.email, name: record.admin.name };
}

// Start a local staff session for a locally-verified admin. Sets a marker token
// under the shared key so `isAuthenticated()` and the layouts work unchanged.
// The backend will 401 this token; the hydrate helpers already fall back silently.
export function startLocalStaffSession(user) {
  tokens.set({
    accessToken: `local.${enc(user.email)}.${Date.now()}`,
    refreshToken: "",
    audience: "staff",
  });
}
