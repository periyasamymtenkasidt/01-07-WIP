// Date format bridge for lead date fields (possessionDate, targetCompletion).
//
// The UI works in DD.MM.YYYY (what the table, detail view and pickers render,
// and what EditInquiryform parses back into its date inputs). The backend stores
// real Dates, so it rejects "13.08.2026" and serializes back an ISO string.
// Convert at the API boundary only: toApiDate() on the way out, toDisplayDate()
// on the way in.

// For the request body: accept the date input's YYYY-MM-DD or a DD.MM.YYYY
// display string and return YYYY-MM-DD (castable to a Date). Returns undefined
// for empty/unparseable input so the key is omitted from the JSON rather than
// sending "" — which itself fails the server's Date cast.
export const toApiDate = (v) => {
  if (!v) return undefined;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); // already ISO-ish
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s); // DD.MM.YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
};

// For rendering an API value: accept an ISO date/datetime (what the backend
// returns) and produce DD.MM.YYYY. Passes an already-formatted DD.MM.YYYY string
// or any non-date string through unchanged; empty → "". Uses the ISO prefix
// directly (no `new Date()`) to avoid timezone off-by-one on date-only values.
export const toDisplayDate = (v) => {
  if (!v) return "";
  const s = String(v);
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s; // already display format
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); // ISO date/datetime prefix
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return s;
};
