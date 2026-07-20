// Survey measurement storage + completeness — kept out of the component file so
// both SurveyMeasurements (UI) and SiteDetail (auto-status) can import it.
// Measurements are stored per site under `siteMeasurements_<siteID>` as a map of
// `area::element` → { length, breadth, height, nos }.

import { DIMENSIONAL_UNITS } from "./boqStorage";
import { getClient } from "./clientStorage";
import { TableData } from "./TableData";
import { getConfigForType, getLatestQuoteForParent } from "./QuotePresets";
import { resolveServiceTrack } from "./serviceTrack";
import { getSite } from "./siteStorage";
import { tokens } from "../api/client";
import { getMeasurements, putMeasurements } from "../api/sites";

// Backend write-through helper. Best-effort, fire-and-forget: a failed PUT must
// never break the optimistic local write, so we swallow every error.
const pushMeasure = (fn) => {
  try {
    Promise.resolve(fn()).catch((e) =>
      console.warn("surveyMeasureStorage: write-through failed", e),
    );
  } catch (e) {
    console.warn("surveyMeasureStorage: write-through threw", e);
  }
};

// Resolve the backend Mongo id for a site from its cached record. Sites are
// keyed locally by siteID (ST-…) but the API addresses them by Mongo `id`. If
// there's no cached `id`, the site is local-only → skip the API call.
const backendSiteId = (siteID) => getSite(siteID)?.id || null;

// Transform the local dims map ({ "area::scopeItemId|name": { length, breadth,
// height, nos, selectedMaterial, images } }) into the API's measurements array
// ([{ area, scopeItemId, elementName, length, breadth, height, nos,
// selectedMaterial, images }]). The map key encodes "area::<scopeItemId or
// name>"; we split on the first "::" to recover the area and the trailing ref.
const dimsToMeasurementsArray = (dims) =>
  Object.entries(dims || {}).map(([key, d]) => {
    const sep = key.indexOf("::");
    const area = sep >= 0 ? key.slice(0, sep) : "";
    const ref = sep >= 0 ? key.slice(sep + 2) : key;
    return {
      area,
      // The key carries either the stable scopeItemId or (legacy) the element
      // name. We can't distinguish them from the key alone, so send the ref as
      // both — the backend upserts by area+scopeItemId and keeps elementName.
      scopeItemId: ref,
      elementName: d?.elementName ?? ref,
      length: Number(d?.length) || 0,
      breadth: Number(d?.breadth) || 0,
      height: Number(d?.height) || 0,
      nos: Number(d?.nos) || 0,
      selectedMaterial: d?.selectedMaterial ?? null,
      images: Array.isArray(d?.images) ? d.images : [],
    };
  });

// Resolve the site's source lead (site → client → sourceLeadId → lead) so the
// survey can use the SAME works the schedule does.
export const getSiteLead = (site) => {
  const client = getClient(site.clientID);
  const leadId = client?.sourceLeadId;
  if (!leadId) return null;
  let leads = [];
  try {
    leads = JSON.parse(localStorage.getItem("newLeadsData") || "[]");
  } catch {
    leads = [];
  }
  return [...leads, ...TableData].find((l) => l.proposalId === leadId) || null;
};

// Works to measure — STRICTLY from the client's quote (what was proposed/sent),
// never the generic master preset. Prefer the lead's saved quoteScopeItems;
// otherwise fall back to the latest saved proposal/quote for that lead (the
// same source the schedule uses), since "Send Proposal" doesn't always write
// quoteScopeItems back onto the lead.
const proposalBasisKey = (siteID) => `siteProposalBasis_${siteID}`;

const readProposalBasis = (siteID) => {
  try {
    return JSON.parse(localStorage.getItem(proposalBasisKey(siteID)) || "null");
  } catch {
    return null;
  }
};

const getScopeItemsForSite = (site) => {
  const frozen = readProposalBasis(site.siteID);
  const lead = getSiteLead(site);
  // For direct clients (no source lead), quotes are keyed by clientID.
  // Only resolve the quote if the client's proposal has been confirmed on
  // the Client Profile page (proposalConfirmed: true).
  const directClient = !lead ? getClient(site.clientID) : null;
  const quoteParentId = lead?.proposalId ?? (directClient?.proposalConfirmed ? site.clientID : null);
  const latestQuote = quoteParentId ? getLatestQuoteForParent(quoteParentId) : null;

  // Return the frozen snapshot only when it was built from the same quote that
  // is still the latest. If a newer proposal has been sent (different quoteId),
  // fall through so the basis is refreshed from the new quote's scope items —
  // this ensures Sync from App always reflects the latest sent proposal.
  if (frozen?.items?.length) {
    const latestQuoteId = latestQuote?.quoteId || null;
    if (!latestQuoteId || frozen.quoteId === latestQuoteId) {
      return frozen.items;
    }
    // A newer proposal was sent — clear the stale snapshot and rebuild below.
    try { localStorage.removeItem(proposalBasisKey(site.siteID)); } catch { /* ignore */ }
  }

  // A saved proposal is the commercial source of truth. The lead-level scope
  // is retained only as a fallback for older records that have no saved quote.
  let items = latestQuote?.scopeItems?.length
    ? latestQuote.scopeItems
    : lead?.quoteScopeItems || [];
  const presetKey = latestQuote?.presetKey || lead?.quotePreset || site.propertyPreset;
  const propertyType = latestQuote?.propertyType || lead?.propertyType || site.siteType;
  if (!items.length) {
    items = getConfigForType(presetKey, propertyType)?.scopeItems || [];
  }
  if (items.length) {
    try {
      localStorage.setItem(
        proposalBasisKey(site.siteID),
        JSON.stringify({
          presetKey,
          propertyType,
          items,
          quoteId: latestQuote?.quoteId || null,
          baseline: latestQuote
            ? {
                subtotal: Number(latestQuote.subtotal) || 0,
                gst: Number(latestQuote.gst) || 0,
                grandTotal: Number(latestQuote.grandTotal) || 0,
              }
            : null,
          snapshottedAt: new Date().toISOString(),
        }),
      );
    } catch (error) {
      console.error("Failed to snapshot the site proposal basis:", error);
    }
  }
  return items;
};

export const measurementsKey = (siteID) => `siteMeasurements_${siteID}`;
export const elKey = (area, name, scopeItemId = "") =>
  scopeItemId ? `${area}::${scopeItemId}` : `${area}::${name}`;

// Prefer the stable scope id key, with a legacy name-key fallback so existing
// surveys migrate naturally the next time a row is edited.
export const getElementMeasurement = (dims, area, el) =>
  dims?.[elKey(area, el.name, el.scopeItemId)] ||
  dims?.[elKey(area, el.name)] ||
  {};

// The site's service track (Interiors/Architecture), resolved via its source lead.
// For direct clients (no lead), fall back to the serviceTrack stored on the site
// itself (populated from the client record in siteStorage).
export const getSiteServiceTrack = (site) =>
  resolveServiceTrack(getSiteLead(site) || site || {});

export const readDims = (siteID) => {
  try {
    return JSON.parse(localStorage.getItem(measurementsKey(siteID)) || "{}");
  } catch {
    return {};
  }
};

export const writeDims = (siteID, dims) => {
  try {
    localStorage.setItem(measurementsKey(siteID), JSON.stringify(dims));
  } catch (error) {
    console.error("Failed to save survey measurements:", error);
    return false;
  }
  // Backend write-through: bulk-upsert the measurements. Resolve the Mongo id
  // from the cached site; skip if local-only. Best-effort — never blocks.
  const id = backendSiteId(siteID);
  if (id) pushMeasure(() => putMeasurements(id, dimsToMeasurementsArray(dims)));
  return true;
};

// Backend hydration: pull the server's measurements into the local dims map so
// readDims() reads them. No-op when logged out; on any error or empty/invalid
// response it leaves the existing localStorage untouched. Reconstructs the map
// key (`area::scopeItemId|name`) from each row using the same elKey scheme.
export async function hydrateMeasurements(siteID) {
  if (!tokens.access()) return;
  const id = backendSiteId(siteID);
  if (!id) return;
  let data;
  try {
    data = await getMeasurements(id);
  } catch (e) {
    console.warn("hydrateMeasurements: failed to fetch measurements", e);
    return;
  }
  // Tolerate bare array or { measurements: [...] } wrapper.
  const rows = Array.isArray(data) ? data : data?.measurements;
  if (!Array.isArray(rows) || rows.length === 0) return;

  const dims = {};
  for (const r of rows) {
    const area = r.area || "";
    const key = elKey(area, r.elementName, r.scopeItemId);
    dims[key] = {
      length: Number(r.length) || 0,
      breadth: Number(r.breadth) || 0,
      height: Number(r.height) || 0,
      nos: Number(r.nos) || 0,
      ...(r.selectedMaterial ? { selectedMaterial: r.selectedMaterial } : {}),
      ...(Array.isArray(r.images) ? { images: r.images } : {}),
      ...(r.elementName ? { elementName: r.elementName } : {}),
    };
  }
  try {
    localStorage.setItem(measurementsKey(siteID), JSON.stringify(dims));
  } catch (error) {
    console.error("hydrateMeasurements: failed to write dims:", error);
    return;
  }
  window.dispatchEvent(new Event("siteDataChanged"));
}

export const customItemsKey = (siteID) => `siteCustomItems_${siteID}`;

export const readCustomItems = (siteID) => {
  try {
    return JSON.parse(localStorage.getItem(customItemsKey(siteID)) || "[]");
  } catch {
    return [];
  }
};

export const writeCustomItems = (siteID, items) => {
  try {
    localStorage.setItem(customItemsKey(siteID), JSON.stringify(items));
    window.dispatchEvent(new Event("siteDataChanged"));
    return true;
  } catch (error) {
    console.error("Failed to save custom survey items:", error);
    return false;
  }
};

// Qty for a work = Length × Breadth × Height, multiplying whichever of the
// three are filled in (floor area = L×B, wall area = L×H, a one-off = all
// three) — applies the same way for every unit, since the dimensions
// captured on site are the same regardless of how the work is billed. Nos is
// captured SEPARATELY and is NOT multiplied in. If no dimensions were
// entered at all, a pure count-based work falls back to its Nos value.
export const qtyFor = (unit, d) => {
  const info = DIMENSIONAL_UNITS[unit];
  const L = Number(d?.length) || 0;
  const B = Number(d?.breadth) || 0;
  const H = Number(d?.height) || 0;
  const nos = Number(d?.nos) || 1;
  if (info?.kind === "length") return L * nos;
  if (info?.kind === "area") {
    const secondDimension = B || H;
    return L && secondDimension ? L * secondDimension * nos : 0;
  }
  return Number(d?.nos) || 0;
};

// True once any of length/breadth/height has been entered — i.e. this work's
// qty came from dimensions rather than a plain count.
export const hasDimsEntered = (d) =>
  [d?.length, d?.breadth, d?.height].some((v) => Number(v) > 0);

// The unit a measured qty should be labeled/counted as. Dimensional units
// (sqft/sqm/rmt/mm) keep their own label. Any other unit (nos, ls, ...) that
// was actually measured via L×B×H reads as sqft — that's what the number
// represents on site, regardless of the work's billing unit.
export const measuredUnitFor = (unit) => unit;

// Works for a site, grouped by room, straight from its sample-quote preset.
// Each scope item IS a work (added in Proposal Master from the Item Master) —
// it carries its own itemName, unit, days and materials. We group the works by
// their room so the surveyor measures room by room. Whatever works exist on the
// preset show up here automatically — nothing is hardcoded.
export const areasForSite = (site) => {
  const items = getScopeItemsForSite(site);
  const customItems = readCustomItems(site.siteID);
  const allItems = [...items, ...customItems];
  const groups = new Map();
  for (const s of allItems) {
    const room = s.area || s.heading || "Unassigned";
    if (!groups.has(room)) groups.set(room, []);
    // hasRate distinguishes a real per-unit price (e.g. an Item Master rate)
    // from a flat lump-sum room line that only ever had a total ₹ amount —
    // the latter has nothing to multiply by a measured quantity, so callers
    // must not re-price it by sqft (see getSurveyVsProposalVariance).
    const hasRate = Number(s.rate) > 0 || !!s.isCustom;
    groups.get(room).push({
      // Stable scope identity used by the BOQ, contract and execution rails.
      // Custom site works use their own generated id as the same identity.
      scopeItemId: s.scopeItemId || s.id || null,
      masterId: s.masterId || s.itemId || null,
      name: s.itemName || s.description || s.area || "Work",
      unit: s.unit || "nos",
      // Carry the quoted rate AND the assumed quantity so the BOQ stage can show
      // Quoted (assumed qty × rate) vs Measured (survey qty × same rate). The
      // rate is the fixed anchor; only the quantity flexes.
      rate: Number(s.rate) || Number(s.amount) || 0,
      qty: Number(s.qty) || 0,
      hasRate,
      amount: Number(s.amount) || 0,
      days: s.days,
      materials: s.materials || [],
      isCustom: !!s.isCustom,
    });
  }
  return [...groups.entries()].map(([area, elements]) => ({ area, elements }));
};

// The exact proposal snapshot used by both the survey gate and frozen BOQ.
// It comes from the same rows shown to the surveyor, so later master edits do
// not silently change the comparison source midway through a site visit.
export const getProposalBaselineForSite = (site) => {
  // Ensure the snapshot exists before reading its commercial totals.
  getScopeItemsForSite(site);
  const frozen = readProposalBasis(site.siteID);
  const areas = areasForSite(site);
  const subtotal = areas.reduce(
    (sum, area) =>
      sum +
      area.elements.reduce(
        (areaSum, el) => areaSum + (el.isCustom ? 0 : Number(el.amount) || 0),
        0,
      ),
    0,
  );
  const calculated = {
    subtotal,
    gst: (subtotal * 18) / 100,
    grandTotal: subtotal * 1.18,
  };
  const saved = frozen?.baseline;
  return {
    subtotal: Number(saved?.subtotal) || calculated.subtotal,
    gst: Number(saved?.gst) || calculated.gst,
    grandTotal: Number(saved?.grandTotal) || calculated.grandTotal,
    quoteId: frozen?.quoteId || null,
    presetKey: frozen?.presetKey || null,
    propertyType: frozen?.propertyType || null,
    snapshottedAt: frozen?.snapshottedAt || null,
  };
};

// A reliable inline (SVG) placeholder image — renders offline, labeled by room.
const dummyImage = (label, hue) =>
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="180">` +
      `<rect width="280" height="180" fill="hsl(${hue},45%,86%)"/>` +
      `<rect x="0" y="150" width="280" height="30" fill="hsl(${hue},45%,70%)"/>` +
      `<text x="14" y="170" font-family="sans-serif" font-size="13" fill="hsl(${hue},45%,28%)">${label}</text>` +
      `<text x="50%" y="48%" font-family="sans-serif" font-size="15" font-weight="bold" fill="hsl(${hue},45%,40%)" text-anchor="middle">SURVEY PHOTO</text>` +
      `</svg>`,
  );

// Simulate the field app's payload: for each WORK it fills the measurement +
// its own photos (shown below that work). Used by the "Sync from app" demo —
// dimensions are derived from the qty on the latest sent proposal so the
// synced measurements match what was quoted.
export const generateAppSurveyData = (site) => {
  const areas = areasForSite(site);
  const dims = {};
  areas.forEach((a, ai) => {
    const hue = (ai * 47) % 360;
    a.elements.forEach((el) => {
      const key = elKey(a.area, el.name, el.scopeItemId);
      const info = DIMENSIONAL_UNITS[el.unit];
      const qty = Number(el.qty) || 0;
      let m;
      if (!info || info.kind === "volume") {
        // nos-type or volume: qty maps directly to a count
        m = { nos: qty || 1 };
      } else if (info.kind === "length") {
        // Linear unit: qty IS the measured length
        m = { length: qty || 1, nos: 1 };
      } else {
        // Area unit (sqft/sqm): derive a realistic length × breadth pair whose
        // product equals the quoted qty. Use the square root as the length so
        // the two sides stay roughly proportional, then back-calculate breadth.
        if (qty > 0) {
          const length = Math.round(Math.sqrt(qty) * 10) / 10 || 1;
          const breadth = Math.round((qty / length) * 100) / 100;
          m = { length, breadth, nos: 1 };
        } else {
          m = { length: 0, breadth: 0, nos: 1 };
        }
      }
      // The work's own photos (from the app), shown below its measurement.
      m.images = [1, 2, 3, 4].map((n) => dummyImage(`${el.name} · ${n}`, hue));
      dims[key] = m;
    });
  });
  return { dims };
};

// Completeness/total state — used by the UI and by SiteDetail's auto-status.
export const getSurveyMeasureState = (site) => {
  const areas = areasForSite(site);
  const dims = readDims(site.siteID);
  let total = 0;
  let measured = 0;
  let totalSqft = 0;
  areas.forEach((a) =>
    a.elements.forEach((el) => {
      total += 1;
      const d = getElementMeasurement(dims, a.area, el);
      const q = qtyFor(el.unit, d);
      if (q > 0) measured += 1;
      if (measuredUnitFor(el.unit, d) === "sqft") totalSqft += q;
    }),
  );
  return {
    total,
    measured,
    complete: total > 0 && measured === total,
    totalSqft,
    hasPreset: areas.length > 0,
  };
};

// A survey matches the proposal while its measured, material-adjusted total is
// within tolerance of the baseline for the property preset + type chosen by the
// client. Tolerance is the GREATER of a flat floor and a percentage of the
// proposal — so small jobs keep a sensible minimum allowance and large jobs
// scale up instead of tripping on a fixed ₹ band. Lower totals are always
// allowed; only the upper band gates Design (and even then it can be approved).
const SURVEY_VARIANCE_FLOOR = 15000; // ₹ minimum allowance
const SURVEY_VARIANCE_PCT = 5; // % of the proposal, whichever is larger
const GST_PERCENT = 18;

// ── Survey variance approval ────────────────────────────────────────────────
// When a survey comes in over tolerance, a Senior/Principal Architect can sign
// off on the overage (with a reason) instead of being hard-blocked. The
// approval is stored per site and is scoped to the overage it was granted for —
// if the survey later grows beyond that figure, the approval goes stale and
// must be renewed (see getSurveyVsProposalVariance).
export const varianceApprovalKey = (siteID) => `siteVarianceApproval_${siteID}`;

export const getSurveyVarianceApproval = (siteID) => {
  try {
    return JSON.parse(
      localStorage.getItem(varianceApprovalKey(siteID)) || "null",
    );
  } catch {
    return null;
  }
};

export const approveSurveyVariance = (
  siteID,
  { by, reason, forDifference } = {},
) => {
  const record = {
    approved: true,
    by: by || "Principal Architect",
    reason: reason || "",
    forDifference: Math.round(Number(forDifference) || 0),
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(varianceApprovalKey(siteID), JSON.stringify(record));
  } catch (e) {
    console.error("Failed to save survey variance approval:", e);
    return null;
  }
  return record;
};

export const clearSurveyVarianceApproval = (siteID) => {
  try {
    localStorage.removeItem(varianceApprovalKey(siteID));
  } catch (e) {
    console.error("Failed to clear survey variance approval:", e);
  }
};

export const getSurveyVsProposalVariance = (site) => {
  const areas = areasForSite(site);
  const dims = readDims(site.siteID);
  const lead = getSiteLead(site);
  const quote = lead ? getLatestQuoteForParent(lead.proposalId) : null;

  let quotedSqft = 0;
  let measuredSqft = 0;
  let quotedAmount = 0;
  let measuredAmount = 0;

  areas.forEach((a) =>
    a.elements.forEach((el) => {
      const d = getElementMeasurement(dims, a.area, el);
      const measuredQty = qtyFor(el.unit, d);
      const activeRate = d?.selectedMaterial?.grade
        ? Number(d.selectedMaterial.rate) || el.rate
        : el.rate;
      if (el.hasRate) {
        // Genuinely priced per unit — re-price at the measured quantity,
        // same fixed rate (or updated material rate).
        const quotedQty = Number(el.qty) || 0;
        quotedAmount += quotedQty * el.rate;
        measuredAmount += measuredQty * activeRate;
      } else {
        // Flat lump-sum room line — there's no real per-unit price to scale
        // by sqft, so carry the quoted amount through unchanged instead of
        // multiplying a measured sqft figure by a rupee total.
        quotedAmount += el.amount || 0;
        measuredAmount += el.amount || 0;
      }
      if (el.unit === "sqft") quotedSqft += Number(el.qty) || 0;
      if (measuredUnitFor(el.unit, d) === "sqft") measuredSqft += measuredQty;
    }),
  );

  // Use the inquiry's selected property preset + type as the proposal anchor.
  // Sent quote/scope totals remain fallbacks for older client records.
  const proposalBaseline = getProposalBaselineForSite(site);
  const presetTotal = proposalBaseline.grandTotal;
  quotedAmount = presetTotal || Number(quote?.grandTotal) || quotedAmount;
  const measuredTotal = measuredAmount * (1 + GST_PERCENT / 100);

  const pctOver = (measuredVal, quotedVal) =>
    quotedVal > 0 ? ((measuredVal - quotedVal) / quotedVal) * 100 : 0;

  const sqftIncreasePct = pctOver(measuredSqft, quotedSqft);
  const amountIncreasePct = pctOver(measuredTotal, quotedAmount);
  const amountDifference = measuredTotal - quotedAmount;
  // Hybrid tolerance: the greater of the flat floor and a % of the proposal.
  const maxVarianceAmount = Math.max(
    SURVEY_VARIANCE_FLOOR,
    Math.round((SURVEY_VARIANCE_PCT / 100) * quotedAmount),
  );
  const amountWithinTolerance =
    quotedAmount > 0 && amountDifference <= maxVarianceAmount;
  const amountOverLimit = quotedAmount > 0 && !amountWithinTolerance;

  // A prior sign-off only covers the overage it was granted for. If the survey
  // has since grown beyond that figure, the approval is stale and Design is
  // blocked again until it's renewed. (A tiny epsilon absorbs rounding.)
  const approval = getSurveyVarianceApproval(site.siteID);
  const approvalValid =
    amountOverLimit &&
    !!approval?.approved &&
    amountDifference <= (Number(approval.forDifference) || 0) + 1;

  return {
    quotedSqft,
    measuredSqft,
    sqftIncreasePct,
    // Sqft remains informational; only the amount band gates matching.
    sqftOverLimit: false,
    quotedAmount,
    measuredAmount: measuredTotal,
    amountDifference,
    amountIncreasePct,
    amountWithinTolerance,
    amountOverLimit,
    maxVarianceAmount,
    variancePct: SURVEY_VARIANCE_PCT,
    // Sign-off state: approval that still covers the current overage, plus the
    // effective gate for Design (over limit AND not covered by a valid approval).
    approval: approval || null,
    approvalValid,
    blocksDesign: amountOverLimit && !approvalValid,
    comparisonSource: presetTotal
      ? "property-preset"
      : quote?.grandTotal
        ? "sent-quote"
        : "scope",
  };
};
