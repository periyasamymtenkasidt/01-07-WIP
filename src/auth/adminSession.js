// Platform-admin key — in-memory only.
//
// There is NO platform-admin LOGIN endpoint. Firm provisioning
// (POST /api/admin/firms) is gated by a static secret sent as the `x-admin-key`
// header (ORG_ONBOARDING_AND_AUTH_CONTRACT.txt — ENDPOINT A). The admin enters
// that key once on /admin/login; we hold it in a module variable and attach it
// to the provisioning call. It is deliberately NOT persisted — a page refresh
// clears it and the admin must re-enter it, so the secret never touches storage.
//
// The key is validated server-side on the create call (401 = wrong key); there
// is no separate verify endpoint.

let adminKey = "";

export const setAdminKey = (key) => {
  adminKey = String(key || "").trim();
};

export const getAdminKey = () => adminKey;

export const hasAdminKey = () => Boolean(adminKey);

export const clearAdminKey = () => {
  adminKey = "";
};
