// Staff auth state — now backed by the real backend (FRONTEND_API.md §2).
//
// The original synchronous surface (login / logout / isAuthenticated) is kept so
// existing callers (ProtectedRoute, Signout, layouts) work unchanged. The real
// credential exchange happens in `loginStaff`, which the Login page awaits.

import { loginRequest, logoutRequest } from "../api/auth";
import { provisionFirm } from "../api/admin";
import { getAdminKey } from "./adminSession";
import { setLastOrg } from "../data/lastOrg";
import { rememberOrg } from "../data/orgDirectory";
import { tokens, ApiError } from "../api/client";
import {
  hydrateAllMasters,
  resetMastersBootstrap,
} from "../api/bootstrapMasters";
import {
  verifyOrgAdmin,
  startLocalStaffSession,
  registerOrganisation,
  clearCurrentUser,
} from "./orgAccounts";
import { saveOrgProfile, hydrateOrgProfile } from "../data/orgProfile";
import { seedDefaultTerms } from "../data/termsStorage";

// Staff login. Organisations created via self-serve signup live in localStorage
// (no backend register endpoint yet), so those credentials are checked first and
// sign in instantly via a local session. Everyone else goes to the real backend
// — POST /auth/login (audience "staff"), which stores access + refresh tokens and
// returns the authenticated user, throwing ApiError on failure.
// On success, kick off masters hydration in the background (don't block the
// redirect — consumers refresh via change-events as each master lands).
export async function loginStaff({ email, password }) {
  const localUser = verifyOrgAdmin(email, password);
  if (localUser) {
    startLocalStaffSession(localUser);
    // Record the org this session signed into so the app (Header) can show its
    // name, taken from the local admin record.
    rememberActiveOrg({ name: localUser.orgName });
    // The active firm namespace is now set, so seed this firm's default T&C
    // (idempotent — no-op if already seeded for this org).
    seedDefaultTerms();
    hydrateAllMasters({ force: true });
    return localUser;
  }

  // Credentials-only: the email resolves the firm server-side and the token
  // carries firmId — we send nothing but email + password.
  const user = await loginRequest({ email, password, audience: "staff" });
  // The active firm namespace is now set, so seed this firm's default T&C
  // (idempotent — no-op if already seeded for this org).
  seedDefaultTerms();
  // Post-login boot: pull the firm-wide org profile (used on BOQ/quote/invoice
  // docs) and kick off masters hydration. Both are background — don't block the
  // redirect; consumers refresh via change-events as each master lands.
  hydrateOrgProfile();
  hydrateAllMasters({ force: true });
  return user;
}

// Persist the org a staff session signed into as the active firm so the
// authenticated shell (Header) can show its name. Backend logins are
// credentials-only and don't return an org, so this is fed by the local admin
// record; the firm-wide profile is hydrated separately via the org-profile API.
// No-op when we have nothing meaningful to record.
function rememberActiveOrg({ firmId, name, slug } = {}) {
  const ref = {
    firmId: (firmId || "").trim(),
    name: (name || "").trim(),
    slug: (slug || "").trim(),
  };
  if (!ref.name && !ref.firmId) return;
  setLastOrg(ref);
  rememberOrg(ref);
}

// Organisation provisioning (platform back-office, admin-gated). Calls
// POST /api/admin/firms with the in-memory `x-admin-key`, which creates the
// tenant's registry row, its own database, a seeded org_profile and the first
// admin user. On success we remember the firm (for the admin console listing +
// branding) and seed the local org profile so documents carry it immediately.
//
// This does NOT log anyone in — the operator hands the new admin their
// credentials, and that admin signs in via the firm's /login page.
//
// If the API is unreachable (dev without a backend), fall back to a local org
// account so the flow stays demoable — same local-first resilience as loginStaff.
// A real server rejection (401 bad admin key, 409 slug taken, 422 validation) is
// an ApiError and is surfaced, NOT swallowed by the fallback.
// Returns { firm, admin } describing the created organisation.
export async function createOrganisation({ firm, admin }) {
  try {
    const res = await provisionFirm({ firm, admin }, getAdminKey());
    // Be tolerant of the firm payload's shape — it may arrive wrapped
    // (`{ firm: {...} }`) or flat, and the id may be `firm_id` / `firmId` / `id`.
    // The id is registry metadata shown in the admin console; login never uses
    // it (it's credentials-only), so a missing id is non-fatal.
    const created = res?.firm || res || {};
    const firmId =
      created.firm_id || created.firmId || created.id ||
      res?.firm_id || res?.firmId || "";
    const orgRef = {
      firmId,
      name: created.name || firm.name,
      slug: created.slug || firm.slug,
    };
    setLastOrg(orgRef);
    // Add to the login picker so this firm is selectable on the sign-in page.
    rememberOrg(orgRef);
    // Seed the active firm profile so client-facing docs carry the new org
    // before its admin's first login hydrates the server copy.
    saveOrgProfile({
      name: created.name || firm.name,
      gstin: created.gstin || firm.gstin || undefined,
      city: created.city || firm.city || undefined,
      state: created.state || firm.state || undefined,
      phone: created.phone || firm.phone || undefined,
    });
    return { firm: created, admin: res?.admin || admin };
  } catch (err) {
    // Server responded with an error envelope (401/409/422/…) → surface it.
    if (err instanceof ApiError) throw err;
    // Network/transport failure (fetch rejected) → local-first fallback so the
    // org is creatable and its admin can sign in even without a backend.
    registerOrganisation({
      organisation: {
        name: firm.name,
        gstin: firm.gstin,
        city: firm.city,
        state: firm.state,
        phone: firm.phone,
      },
      admin,
    });
    const localRef = { firmId: "", name: firm.name, slug: firm.slug };
    setLastOrg(localRef);
    rememberOrg(localRef);
    return { firm: { name: firm.name, slug: firm.slug, local: true }, admin };
  }
}

// Authenticated == a staff access token is present. Token validity is enforced
// server-side; an expired token triggers the refresh flow on first use.
export function isAuthenticated() {
  return Boolean(tokens.access());
}

export function logout() {
  logoutRequest();
  resetMastersBootstrap();
  clearCurrentUser();
}

// Back-compat shim: older flows called login() with a placeholder token. Tokens
// are now set by loginStaff(), so this is a no-op kept so existing imports
// compile. Prefer loginStaff().
export function login() {}
