// Platform back-office API — firm (tenant) provisioning.
//
// This is the admin-gated counterpart to the public auth endpoints. It brings an
// organisation into existence: a registry row (FRM-###), a NEW physical database
// for the tenant, a seeded org_profile, and the firm's FIRST admin user.
//
// PUBLIC FRONTEND NOTE: this is reached only from the internal /admin screens and
// requires the secret `x-admin-key`. Org users never call it.
// Contract: ORG_ONBOARDING_AND_AUTH_CONTRACT.txt — ENDPOINT A.

import { api } from "./client";

// GET /api/admin/ping (x-admin-key) — side-effect-free admin-key check used by
// the /admin/login gate. Resolves when the key is valid; throws ApiError(401)
// when it isn't. Lets the gate verify the key BEFORE showing the create-org form
// (instead of only finding out on the create call).
// BACKEND: implement as a no-op that 200s on a valid x-admin-key, 401s otherwise.
export async function pingAdmin(adminKey) {
  return api("/admin/ping", {
    auth: false,
    headers: { "x-admin-key": adminKey },
  });
}

// GET /api/admin/firms (x-admin-key) → [ { firm_id, name, slug, status, plan,
// gstin, city, state, phone, createdAt } ]. The full provisioned-firm registry,
// used by the internal /admin/orgs console to list every organisation. Admin-key
// gated; org users never call it.
// BACKEND: list rows from the firm registry; this is the read counterpart of the
// POST /admin/firms provisioning call (ORG_ONBOARDING_AND_AUTH_CONTRACT.txt — ENDPOINT C).
export async function listFirms(adminKey) {
  const data = await api("/admin/firms", {
    auth: false,
    headers: { "x-admin-key": adminKey },
  });
  // Tolerate a bare array or an { firms: [...] } / { data: [...] } wrapper.
  const list = Array.isArray(data) ? data : data?.firms || data?.data || [];
  return Array.isArray(list) ? list : [];
}

// POST /api/admin/firms (x-admin-key) → { firm, admin }.
// `firm` carries the flat org fields (name, slug, gstin, city, state, phone,
// plan); `admin` is the nested first-admin block. Returns the created
// { firm: { firm_id, name, slug, ... }, admin: { id, email, ... } }.
export async function provisionFirm({ firm, admin }, adminKey) {
  return api("/admin/firms", {
    method: "POST",
    auth: false,
    headers: { "x-admin-key": adminKey },
    body: { ...firm, admin },
  });
}
