// Active organisation breadcrumb — the firm the current session is working in,
// used by the authenticated shell (Header) to show the org's name.
//
// Why this exists: POST /auth/login is credentials-only and returns no `org`,
// and the firm-wide org-profile is only readable AFTER auth (and hydrated
// asynchronously). So we persist the org name from provisioning / local login as
// a fast, synchronous breadcrumb until the profile lands. It is display-only —
// the frontend never uses it to resolve the tenant (the email/token does that).
//
// See ORG_ONBOARDING_AND_AUTH_CONTRACT.txt — "TENANT RESOLUTION".

const STORAGE_KEY = "last_org";

// { firmId: "FRM-001", name: "ARCHITECTURE WIP", slug: "architecture-wip", logo: "" }
export function getLastOrg() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function setLastOrg({ firmId, name, slug, logo } = {}) {
  const record = {
    firmId: firmId || "",
    name: name || "",
    slug: slug || "",
    logo: logo || "",
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function clearLastOrg() {
  localStorage.removeItem(STORAGE_KEY);
}
