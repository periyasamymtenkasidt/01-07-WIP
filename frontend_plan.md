# Frontend Plan — Executive CRM (Digital Atelier / ARCHITECTURE WIP)

> Working plan for the React 19 frontend. Companion to `CLAUDE.md` (conventions),
> `FRONTEND_API.md` (wire contract), and `BACKEND_SPEC.md` (data shapes).
> `CLAUDE.md` is partly stale — this doc reflects the codebase as it actually
> stands today (32k+ lines across `src/`).

---

## 1. How to use this doc

- **Section 2** is the honest current-state snapshot — what's built, what's a stub, what's wired to the backend.
- **Section 3** is the architecture/conventions every new screen must follow.
- **Section 4** is the central thread of the project right now: the **localStorage → backend API migration**.
- **Section 5** is the module-by-module plan.
- **Section 6** is cross-cutting work.
- **Section 7** is the prioritized roadmap. Start there if you want the "what next".

---

## 2. Current state snapshot

The app is much further along than `CLAUDE.md` implies. There are **two apps in one bundle**: the **staff CRM** (`src/pages/`, `src/layouts/`) and the **client portal** (`src/clientportal/`). Both share the auth/token layer in `src/api/client.js`.

### 2.1 Build status by area

| Area | Status | Evidence |
|---|---|---|
| Auth (staff + client, RHF + yup) | ✅ Built | `pages/auth/Login.jsx` (435), dual schemas, `auth/auth.js` + `auth/clientAuth.js` |
| Leads | ✅ Built, 🔌 API-wired | `leads/` — `Leads` (447), `LeadEdit` (1602), forms, `ConvertToClientForm` (484) |
| Clients | ✅ Built, 🔌 API-wired | `clients/` — `Client` (315), `ClientProfile` (896) |
| Sites / Site Visits | ✅ Built, 🔌 API-wired (partial) | `sites/` incl. `DesignPipeline` (1120), `SurveyMeasurements` (869), `DesignReviewPanel` (527), `Feasibility` (386) |
| BOQ | ✅ Built, 💾 localStorage only | `boq/BOQEditor` (3338!), `BOQList` (375), `BOQPreview` (675); acceptance test in `scripts/acceptance-boq.mjs` |
| Master data | ✅ Built, 💾 localStorage (masters hydrate exists) | `master/ProposalMaster` (3191), `MaterialMaster` (759), `ItemLibrary` (447), `TermsAndConditions` (666), `ScheduleConfig` (414) |
| Procurement (RFQ/PO/GRN/Vendors/Takeoff) | ✅ Built, 💾 localStorage only | `procurement/` + `tabs/`; public `VendorQuoteForm` (243) |
| Projects (detail, schedule, negotiation) | ✅ Built, 💾 localStorage only | `projects/ProjectDetail` (1127), `ProjectSchedule` (1057) |
| Deals | ✅ Built, 💾 localStorage only | `deals/Deals.jsx` (794) |
| Dashboard | ✅ Built (mock-driven) | `dashboard/Dashboard.jsx` (566) |
| Client portal (8 pages) | ✅ Built, 💾 mostly localStorage; 🔌 `PortalStageApproval` API-wired | `clientportal/pages/` incl. `DesignsRenders` (1666), `PaymentMilestones` (379) |
| Settings | ✅ Built | `settings/Settings.jsx` (417) |
| **Accounts** | 🔴 Stub (1 div) | `pages/Accounts.jsx` (8) |
| **Pipeline** | 🔴 Stub (1 div) | `pages/Pipeline.jsx` (8) |
| **Analytics** | 🔴 Stub (1 div) | `pages/Analytics.jsx` (8) |
| **Reports** | 🔴 Stub (1 div) | `pages/Reports.jsx` (8) |
| **Support** | 🔴 Stub (1 div) | `pages/Support.jsx` (8) |

Legend: ✅ built · 🔴 stub · 🔌 reads from backend API · 💾 still localStorage-only.

### 2.2 The single most important fact

There is an in-flight **migration from localStorage to a real backend**. The
`src/api/` layer exists (9 resource modules over a shared `client.js`), but only
**leads, clients, sites, and one portal page** actually read from it. Everything
else still reads synchronously from `src/data/*Storage.js`.

The backend itself only exposes **Phases 0–2** today (auth, leads, clients,
quotes, masters, sites, design flow, client portal, files — per `FRONTEND_API.md`).
**Phase 3+ (BOQ, contracts, procurement, finance, schedule) is not yet available
server-side.** So the frontend has built UI ahead of the backend for those modules.

---

## 3. Architecture & conventions (follow these for every screen)

### 3.1 Data access layers (know which one you're touching)
1. **`src/api/*.js`** — async functions over `client.js` (`api()`/`apiList()`).
   Handles the `{status,data}` envelope, `401 → refresh → retry-once`, and `ApiError`.
   This is the target end-state for all data.
2. **`src/data/*Storage.js`** — synchronous localStorage modules. The legacy layer.
   Consumers read these at render time and refresh via `window` events
   (`leadDataChanged`, `designFlowChanged`, etc.).
3. **Hydration shims** — `data/leadsSync.js`, masters bootstrap (`api/bootstrapMasters.js`),
   `itemLibrary.js` pattern: after login, pull server data into the localStorage
   cache so existing synchronous consumers keep working unchanged. **Merge rule:
   local edits win**, never overwrite a good cache with an empty server response,
   no-op when logged out, fall back silently on error.

### 3.2 The migration pattern (how a module moves from 💾 to 🔌)
Two valid paths — pick per module:
- **Hydrate-in-place** (low risk, used for leads): add a `xSync.js` that pulls
  the API into the existing localStorage key + fires the existing change event.
  Zero consumer rewrites. Good for big, stable screens.
- **Read-through with `useAsync`** (target architecture): replace synchronous
  reads with `useAsync(() => listX(), deps, { events: [...] })` which gives
  loading/error state and re-runs on the listed window events. Used by the
  API-wired pages. Preferred for new/refactored screens.

### 3.3 UI conventions (from `CLAUDE.md` + observed code)
- **Colors:** only the `@theme` tokens in `index.css` (`bg-primary`, `text-muted`, …). No raw hex for themed colors.
- **Font:** `font-manrope` on layout roots, not per-element.
- **Forms:** `react-hook-form` + `yup` resolver + the shared `InputField` (handles text/email/select/textarea/error).
- **Tables:** shared `components/Table.jsx` + `components/table/` toolkit (Pagination, FilterDropdown, SortDropdown, ExportButton, DateRangePicker).
- **Modals:** shared `components/Modal.jsx`; many domain modals already exist (`QuoteModal`, `ItemFormModal`, `FeeProposalModal`, …) — reuse before adding.
- **Routing:** lazy-load page chunks (already the norm in `AppRoutes.jsx`); guard with `ProtectedRoute` / `ClientProtectedRoute`.
- **PDF/image export:** `html2canvas` + `utils/downloadQuoteImage.jsx`; money via `utils/formatAmount.js` / `numberToWords.js`.

### 3.4 Known architectural gaps
- **No state-management library.** Cross-component sync is done with `window` CustomEvents. This is brittle and will need React Query / Zustand as API reads spread (see §6.1).
- **No tests** beyond the BOQ acceptance script. No Vitest/RTL.
- **JS only**, no TypeScript/PropTypes.
- **Schedule activity log & client notifications** have no real identity / no real send (logged, not sent) — needs backend + auth (see `CLAUDE.md` Known Issues).

---

## 4. The data-layer migration (central workstream)

Goal: every 💾 module becomes 🔌, gated on backend phase availability.

| Module | Backend ready? | Frontend action |
|---|---|---|
| Leads | ✅ Phase 1 | Done (hydrate). Convert hot paths in `LeadEdit` to `useAsync` over time. |
| Clients | ✅ Phase 2 | Done. Audit `ClientProfile` (896) for remaining localStorage reads. |
| Quotes | ✅ Phase 2 | Wire `QuoteModal`/`QuotePreview` to `api/quotes.js`. |
| Masters (item/material/proposal/terms) | ✅ Phase 2 | `bootstrapMasters.js` exists — extend hydration to cover ProposalMaster + MaterialMaster fully. |
| Sites / design flow | ✅ Phase 2 | Partially wired (`Sites`, `DesignPipeline`). Finish `SurveyMeasurements`, `Feasibility`, `DesignReviewPanel`. |
| Files | ✅ Phase 2 | Route `ReusableFileUploader` + `fileStorage` through `api/files.js` (multipart). |
| Client portal | ✅ Phase 2 | Only `PortalStageApproval` wired. Migrate the other 7 portal pages via `api/portal.js`. |
| **BOQ** | ❌ Phase 3 | Keep localStorage; **build a thin `api/boq.js` seam now** so flip is cheap when backend lands. |
| **Procurement** | ❌ Phase 3 | Same — seam + keep `procurementStorage`/`rfqStorage`/`vendorStorage`. |
| **Projects / schedule** | ❌ Phase 3 | Same. |
| **Finance / contracts / change orders** | ❌ Phase 3 | Same (`projectFinance.js`, `contractStorage.js`, `changeOrderStorage.js`). |

**Rule of thumb:** don't rip out a working localStorage module until its backend
endpoint exists *and* a hydration/read-through replacement is tested. Use the
seam-first approach for Phase 3 modules so the cutover is a one-file change.

---

## 5. Module-by-module plan

### 5.1 Leads → Clients → Projects spine (highest business value)
- Finish converting `LeadEdit.jsx` (1602 lines) read paths to `useAsync`; it's the largest single screen and the riskiest localStorage dependency.
- `ConvertToClientForm` → ensure it writes through `api/clients.js` and triggers project creation.
- Projects are still localStorage-only — they're Phase 3 backend. Add the `api/projects.js` seam.

### 5.2 BOQ module (spec module 3)
- `BOQEditor.jsx` is 3338 lines — the most complex screen in the app. Before any backend wiring, **extract sub-components** (measurement sheet, tax summary block, signature block, category/room sections) to make it maintainable.
- Verify against spec: mandatory columns (Qty, Rate, L×H, Area, Amount), 18% GST CGST/SGST split, % discount, tax-summary block order, 4-signature block, finalization workflow gating "issue for procurement".
- Keep `scripts/acceptance-boq.mjs` green; add cases as logic changes.
- Add `api/boq.js` seam (Phase 3).

### 5.3 Procurement module (spec module 5)
- Tabs (RFQs, PurchaseOrders, GRN, Vendors, Takeoff) are built on localStorage. Confirm against spec: Vendor Master fields, **quotation comparison** (required), vendor payment tracking (still an open requirement — design the UI but mark TODO).
- Public `VendorQuoteForm` (`/vendor-quote/:rfqId`) is the no-login vendor submission — keep it backend-ready; it's the natural first procurement API touchpoint.
- Model vendor quote shape on the sample PDF (`SL | Description | HSN | Qty | Unit | MRP | Disc Rate | Amount`, CGST/SGST, round-off).

### 5.4 Master data (spec modules 4 & partial 2)
- `ProposalMaster` (3191) and `MaterialMaster` (759) are large — extend masters hydration so they're backend-backed read-through, then they stop being a sync-only liability.

### 5.5 Design + Design Review modules (spec modules 1 & 2)
- Backend design flow is **Phase 2 (available)**. The UI lives in `sites/DesignPipeline.jsx` (1120) and `DesignReviewPanel.jsx` (527).
- Verify the 10-stage workflow, 4-tier approval hierarchy (only Principal approves), revision counting, Design Comments register, and DCR form against the spec.
- This is a good early win because the backend is ready — prioritize wiring it.

### 5.6 Client portal
- Migrate the 7 still-local portal pages to `api/portal.js` (Phase 2 ready).
- `DesignsRenders.jsx` (1666) is huge — split it.
- Wire `sendNotification` in `ProjectSchedule.jsx` and portal SupportChat to a real channel when backend supports it (currently logged, not sent).

### 5.7 The 5 stubs (Accounts, Pipeline, Analytics, Reports, Support)
These are 1-div placeholders linked in the sidebar. Decide per item:
- **Pipeline** — likely overlaps with Deals/Dashboard funnel; either build a kanban or remove the nav entry to avoid dead links.
- **Analytics / Reports** — depend on aggregated backend data; defer until Phase 3 finance/schedule data exists.
- **Accounts** — finance module, Phase 3.
- **Support** — staff-side support; could mirror the portal `SupportChat`.
- **Action:** until built, either ship a consistent "Coming soon" empty-state component or hide the nav items. Don't leave raw `<div>Accounts</div>` shipping to users.

---

## 6. Cross-cutting work

### 6.1 State management (do this before the migration spreads further)
The `window`-event sync pattern won't scale as more screens go async. Introduce
**TanStack Query (React Query)** for server cache (dedupe, loading/error, invalidation)
and keep `useAsync` only for trivial cases. Map existing window events to query
invalidations so the migration is incremental, not a big-bang.

### 6.2 Error & loading UX
- `ApiError` carries HTTP status — standardize handling: 401 → login, 403 → hide action, 404 → not-found, 409/422 → explain (per `FRONTEND_API.md §11`).
- Add a shared loading skeleton + error toast so every `useAsync` screen looks consistent.

### 6.3 Testing
- Stand up **Vitest + React Testing Library** (still absent).
- Cover the money/tax math first (`formatAmount`, `numberToWords`, BOQ tax summary) — highest correctness risk.

### 6.4 Cleanup / tech debt
- `CLAUDE.md` is stale (says pages are stubs that are now fully built; missing client portal, BOQ, procurement, masters). **Refresh it.**
- Decommission `src/data/*Storage.js` modules as each migrates; track which are still load-bearing.
- Split the three mega-files: `BOQEditor` (3338), `ProposalMaster` (3191), `DesignsRenders` (1666).
- `helperConfigData/` → `utils/` rename (already noted in `CLAUDE.md`).

---

## 7. Prioritized roadmap

**P0 — Finish what the backend already supports (Phases 0–2)**
1. Stand up React Query (§6.1) — unblocks clean migration.
2. Complete Design + Design Review wiring (`DesignPipeline`, `DesignReviewPanel`) — backend ready, high spec value.
3. Finish sites/files migration (`SurveyMeasurements`, `Feasibility`, `api/files.js`).
4. Migrate the 7 client-portal pages to `api/portal.js`.
5. Wire quotes + extend masters hydration.

**P1 — Harden & de-risk**
6. Split `BOQEditor`, `ProposalMaster`, `DesignsRenders` into components.
7. Standardize loading/error UX + `ApiError` handling.
8. Vitest + RTL; cover tax/money math and BOQ acceptance.
9. Refresh `CLAUDE.md`.

**P2 — Build seams for Phase 3, fill stubs**
10. Add `api/boq.js`, `api/procurement.js`, `api/projects.js`, `api/finance.js` seams (no behavior change yet).
11. Replace the 5 stub pages with a real "Coming soon" empty state or hide their nav entries.

**P3 — Phase 3 backend lands**
12. Flip BOQ, procurement, projects, schedule, finance from localStorage to API via the seams.
13. Build Analytics / Reports / Accounts on real aggregated data.
14. Real client notifications (mail/SMS) at `ProjectSchedule.sendNotification` + portal chat.
