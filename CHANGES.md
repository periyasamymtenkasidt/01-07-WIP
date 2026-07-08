# Working Changes — Feature Notes

Documents the current uncommitted working-tree changes (25 modified files, 1 new,
1 deleted). Grouped by feature, each with the intent, the files touched, and the
end-to-end workflow.

> Scope note: the short-lived "BOQ discipline / track" experiment (an explicit
> `track` field on BOQ records) was **reverted** and is intentionally **not**
> covered here.

---

## 1. `NumericInput` — safe numeric entry

**New:** `src/components/NumericInput.jsx`

A drop-in replacement for `<input type="number">` on amount / rate / qty fields.
It renders a `type="text"` box with `inputMode="decimal"` and sanitises input as
it's typed — digits and a single decimal point only — avoiding number-input
quirks (spinner arrows, `e`/`+`/`-`/scientific notation, scroll-to-change). Its
`onChange` hands back the already-cleaned **string** (not the DOM event).

**Adopted in:**
- `src/pages/master/itemMaster/RateBuildupModal.jsx` — component qty, wastage %,
  labour rate, overhead %, margin %.
- `src/pages/procurement/RfqDetail.jsx` — per-vendor rate cells.
- `src/pages/procurement/RfqFormModal.jsx` — line qty.
- `src/pages/procurement/VendorQuoteForm.jsx` — vendor rate cells.
- `src/components/QuoteModal.jsx` — editable qty on library-added scope rows.

**Workflow:** user types in any rate/qty field → non-numeric keystrokes are
rejected live → call sites store the sanitised value directly, so downstream
math (`qty × rate`) never receives a malformed number.

---

## 2. Unified Library Picker + master-linked scope

**Deleted:** `src/components/LibraryPickerModal.jsx`
**Changed:** `src/components/ItemFormModal.jsx`, `src/components/QuoteModal.jsx`

The standalone `LibraryPickerModal` is removed. The picker that already lives in
the Item Master flow (`LibraryPicker` in `ItemFormModal.jsx`) is now `export`ed
and reused by `QuoteModal`'s "Pick from Library", so there is one picker.

Key fix — **master identity is preserved**. When a library item is pulled into a
scope/BOQ line:
- the library item's own `id` is moved into `masterId` (it no longer overwrites
  the scope row's `id`);
- `hsn`, `gstPercent`, `areaFactor`, `recipes`, `defaultGrade` and `materials`
  are carried across.

This is what makes grade mapping, rate sync and library sync work for a picked
item. Picked rows are then priced through their Item Master grade recipe (same
path preset scope rows use); flat-rate items keep their own rate.

**Workflow:** Quote/BOQ editor → "Pick from Library" → single-select → row is
added with `masterId` + recipe → priced by grade → shown as an editable,
badged row (see §3).

---

## 3. Library-added scope rows: editable qty, badge, highlight

**Changed:** `src/components/QuoteModal.jsx`, `src/components/QuotePreview.jsx`

Rows added via "Pick from Library" (`_userAdded`) carry no assumed quantity, so:
- they get an **editable Quantity field** (`NumericInput`) driving
  `amount = qty × rate`, always editable even on a first send;
- they render with an **"Added from Library"** badge and active-blue tint;
- `QuotePreview` gains `highlightAdded` (tints these rows) — an on-screen editing
  aid only, left **off** for the printed/saved client quote so the deliverable
  stays clean.

`QuotePreview` also gains `syncFromMaster` (default `true`): saved quotes
reconcile against the current master template; the **live preview** inside
`QuoteModal` passes `syncFromMaster={false}` so it shows exactly the rows the
form currently holds (in-session adds/removes/edits), grade suffix intact.

---

## 4. Auto-adjusted project size from scope changes

**Changed:** `src/utils/sizeRangeValidation.js`, `src/components/QuoteModal.jsx`,
`src/components/QuotePreview.jsx`

New helpers:
- `sizeToNumber(val)` — first numeric group of a size string.
- `scopeAreaSqft(scopeItems)` — Σ qty of the `sqft`-unit rows.
- `formatSizeWithAddition(original, delta)` — renders
  `Base X + Added Y = Z Sq Ft (Extended)` / `... - Removed ... (Reduced)`, or the
  plain size when delta is 0.

`QuoteModal` snapshots `baselineScopeSqft` once at load, then computes
`addedScopeSqft = currentScopeSqft − baseline`. Adding sqft scope raises it,
deleting existing scope lowers it, so the two **net out**. The value is persisted
on the quote (`baselineScopeSqft`, `sizeAddedSqft`) so it survives a resend and
prints correctly.

**Workflow:** open quote (baseline captured) → add/remove sqft scope → header +
size field show the adjusted breakdown live → send → sent/printed quote shows the
same adjusted size via `QuotePreview`.

---

## 5. Interior vs Architecture BOQ line-item view

**Changed:** `src/pages/boq/BOQEditor.jsx`, `src/pages/boq/BOQPreview.jsx`

The architecture-only item-detail fields (floor, work category, drawing ref,
brand/finish, item/billing/scope type, execution, remarks & spec) are now hidden
for **interior** BOQs, keeping their line-item view lean. The discipline is
derived from the BOQ's linked site service track (`getSiteServiceTrack`);
standalone BOQs (no site) still show everything so nothing is silently hidden.

- Editor: `isInteriorBoq` flows into `ItemRow` → `ItemDetailsRow` as
  `hideArchDetails`, which wraps the arch-only field block.
- Preview: the hierarchy / detail / scope / remarks lines are gated by
  `!isInteriorBoq`.

---

## 6. BOQ rate-analysis shows ₹ amounts, not just %

**Changed:** `src/pages/boq/BOQEditor.jsx`

`raAverages` now also totals **rupee** margin and PCE across the BOQ
(`Σ per-unit amount × item qty` from each item's computed rate analysis). The
summary renders `12.5% · ₹1,20,000` instead of a bare percentage.

---

## 7. RFQ de-duplication / merge by scope

**Changed:** `src/data/rfqStorage.js`

`createRfq` no longer blindly spawns a new RFQ. It computes a **scope signature**
(sorted, de-duplicated set of line-item keys, keyed on the material **name**, with
`materialId` only as a fallback). If an **open** RFQ (not `awarded`/`closed`) for
the same contract already covers that exact scope, the newly-invited vendors are
folded into it; otherwise a fresh RFQ is created.

Keying on name lets a take-off RFQ (lines carry `materialId`) and a
manually-typed RFQ (no `materialId`) for the same material reconcile into one
request. Awarded/closed RFQs are frozen and never merged into.

**Workflow:** raise RFQ for a scope → invite Vendor A → raise "same" RFQ, invite
Vendor B → B is merged into the existing open RFQ, one comparison grid, no
duplicate.

---

## 8. Purchase Order as a printable document

**Changed:** `src/pages/procurement/PoDetail.jsx`, `src/index.css`

The PO detail page is now a print-friendly **letterhead document**
(`po-print-area`): org logo/GSTIN header, vendor + order-meta cards, line table,
and a **GST summary** (18% on the basic ordered value, split CGST/SGST intra-state
with rounded halves that sum to the total) plus amount-in-words. Interactive
controls (Back, Receive all, Save-as-PDF, Print) sit in `modal-no-print` regions.
`index.css` adds `.po-print-area` to the print-isolation rules alongside the
existing quote/BOQ print areas.

**Workflow:** Purchase Orders list → open PO → review letterhead document →
Print / Save as PDF (controls excluded from the printout) → Receive all when
goods arrive.

---

## 9. Design review: every reviewer clears the checklist

**Changed:** `src/data/designFlowStorage.js`,
`src/pages/sites/components/DesignReviewPanel.jsx`

Storage layer (`designFlowStorage.js`):
- New `checklistAllYes(stage)` — every checklist row explicitly **Yes** — and
  `blankChecklist()` helper.
- `internalApprove` now gates on `checklistAllYes` for **any** step (not just the
  Principal); the final step additionally requires `openCommentsCount === 0`.
- Advancing to the next reviewer **resets the checklist** so each person in the
  chain independently reviews and clears every item; a kickback
  (`internalRequestChanges`) also clears it so the whole hierarchy re-reviews on
  resubmit.

UI (`DesignReviewPanel.jsx`): the advance gate uses `allYes && (!isFinal ||
openCount === 0)`; the banner is reworded to name the acting role and show
`yes/total` progress.

---

## 10. Portal: graduated free-revision warning

**Changed:** `src/clientportal/pages/PortalStageApproval.jsx`

The stage revision banner is now graduated by how many free revisions remain:
`≥4` green, `3` amber, `2–1` red, `0` (chargeable) orange — instead of a binary
green/orange.

---

## 11. Leads & inquiry: no auto-selected preset / property type

**Changed:** `src/pages/leads/NewInquiriesform.jsx`,
`src/pages/leads/EditInquiryform.jsx`, `src/pages/leads/LeadEdit.jsx`,
`src/pages/clients/ClientProfile.jsx`

- **New / Edit inquiry forms:** removed `DEFAULT_PRESET` / `buildPresetState`.
  Property Preset and Property Type now start **empty** — the user must pick them.
  Changing the preset clears the type and derived size range (no silent default);
  `trigger("propertyType")` surfaces the required-error on pick/submit, not the
  instant a preset is chosen.
- **`LeadEdit`:** `quotePreset` / `quoteSizeRange` are **removed** from
  `UI_ONLY_FIELDS` so they reconcile from the server like real lead fields (fixes
  the detail page disagreeing with the list, e.g. "3 BHK" vs "1 BHK");
  `architecturalNotes` is now persisted; `propertyType` no longer falls back to
  `location`.
- **`ClientProfile`:** `propertyType` no longer falls back to `location`; the
  quote modal is opened with proper `presetData` (preset / type / size range from
  the client or associated lead).

---

## 12. Item library re-seeds from an empty store

**Changed:** `src/data/itemLibrary.js`

`listLibrary()` now treats a stored **empty array** as "not seeded yet" and
re-seeds the defaults, instead of returning empty. A one-time blank (empty
backend sync, bulk delete, migration) no longer leaves "Pick from Library"
permanently empty. A non-empty stored list stays authoritative.

---

## 13. Survey seed: area works no longer double

**Changed:** `src/data/surveyMeasureStorage.js`

`generateAppSurveyData` seeds area-measured works with `nos = 1` (qty =
length × breadth for a single face), fixing the spurious `L × B × 2` doubling.

---

## 14. Client portal: removed in-portal approval-package sign-off

**Changed:** `src/clientportal/pages/DesignsRenders.jsx` (~310 lines removed)

The client-side "Design Approval Package" digital sign-off block (its state,
`handleApprovePackage`, the change-request modal and related UI) is removed.
Stage approval flows through the dedicated `PortalStageApproval` path instead.

---

### File index

| Area | Files |
|---|---|
| New / removed | `+ components/NumericInput.jsx`, `- components/LibraryPickerModal.jsx` |
| Utilities / CSS | `utils/sizeRangeValidation.js`, `index.css` |
| Data layer | `data/rfqStorage.js`, `data/itemLibrary.js`, `data/surveyMeasureStorage.js`, `data/designFlowStorage.js` |
| Quote | `components/QuoteModal.jsx`, `components/QuotePreview.jsx`, `components/ItemFormModal.jsx` |
| BOQ | `pages/boq/BOQEditor.jsx`, `pages/boq/BOQPreview.jsx`, `pages/master/itemMaster/RateBuildupModal.jsx` |
| Procurement | `pages/procurement/PoDetail.jsx`, `PoFormModal.jsx`, `RfqDetail.jsx`, `RfqFormModal.jsx`, `VendorQuoteForm.jsx` |
| Leads / clients | `pages/leads/NewInquiriesform.jsx`, `EditInquiryform.jsx`, `LeadEdit.jsx`, `pages/clients/ClientProfile.jsx` |
| Sites / portal | `pages/sites/components/DesignReviewPanel.jsx`, `clientportal/pages/PortalStageApproval.jsx`, `clientportal/pages/DesignsRenders.jsx` |
