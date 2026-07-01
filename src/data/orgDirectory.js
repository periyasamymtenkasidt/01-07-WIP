// Local directory of provisioned organisations — a private cache, NOT a public
// listing. It is written when a firm is provisioned through the admin console and
// read back ONLY by the admin-gated console (/admin/orgs) as an offline fallback.
//
// SECURITY: organisation names are tenant-identifying, so we deliberately do not
// expose this list on any public/unauthenticated surface (landing page, login).
// There is intentionally no public "list firms" endpoint or fetch helper here.

const STORAGE_KEY = "org_directory";

// → [{ firmId: "FRM-001", name: "ARCHITECTURE WIP", slug: "architecture-wip" }]
export function getOrgs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Add or update an org (dedup by firmId when present, else by slug). Returns the
// stored entry. Most-recent stays last.
export function rememberOrg({ firmId, name, slug } = {}) {
  const entry = { firmId: firmId || "", name: name || "", slug: slug || "" };
  const list = getOrgs().filter((o) => {
    if (entry.firmId && o.firmId) return o.firmId !== entry.firmId;
    if (entry.slug && o.slug) return o.slug !== entry.slug;
    return true;
  });
  list.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return entry;
}
