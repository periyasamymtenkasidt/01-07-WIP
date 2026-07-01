# Executive CRM — CLAUDE.md

## Project Overview
React 19 CRM application for Digital Atelier. Manages leads, clients, pipeline, analytics, and invoicing. Currently in active development — many pages are stubs.

The client is an **architecture & interior design firm** (ARCHITECTURE WIP, Chennai; GST jurisdiction India). The CRM is the front of a larger operations platform — the full target product is specified in the requirements PDFs in `src/assets/` and summarized below. Most of that scope is **not yet built**; the existing leads/clients/pipeline UI is the starting slice.

## Business Requirements (source: `src/assets/Requirements - Software.pdf`)
The spec defines **five modules** covering the full project lifecycle from inquiry to defect-liability handover. Currency is **INR (₹)**; GST applies.

### 1. Design Module
End-to-end design workflow (10 stages): Project Initiation → Site Analysis → Concept Design → Schematic Design → Detailed Design Development → Visualization & Presentation → Construction Documentation (incl. BOQ) → Execution → Handover → Post-Completion Support.
- **Approval hierarchy:** Intern → Junior Architect → Senior Architect → Principal Architect. Only the **Principal Architect** can give final design approval.
- Track **number of design revisions** allowed and a **design status workflow** per stage.

### 2. Design Review Module
- **Design Review Checklist** — ~18 yes/no items (client requirements, space planning, circulation, furniture, materials, colour, lighting, ceiling/HVAC coordination, dimensions, A/S/MEP coordination, accessibility, safety, specs, office standards, sheet numbering, renders-match-drawings).
- **Design Comments register** — `Comment No. | Drawing/Sheet Ref | Comment | Raised By | Date | Status (Open/In Progress/Closed)`.
- **Design Change Request (DCR)** — `DCR No. | Project | Date | Requested By | Design Stage | Description | Reason | Impact on Cost | Impact on Schedule | Reviewed By | Approved By | Status`.
- Comment workflow: Review Meeting → Comments Logged → Assigned to Designer → Revision Completed → Internal Verification → Status Updated → Client Confirmation.
- **Approval stages:** Internal Design Review → Internal Design Approval → Client Review → Client Approval → Detailed Design Approval → Construction Drawing Approval → Issue for Construction (IFC). Approved revisions get a revision number and become the controlled version.

### 3. BOQ (Bill of Quantities) Module
- **Structure:** general/category-wise first (false ceiling, paint, etc.), then **room-wise** (curtains, carpentry, doors, decor).
- **Measurement sheet columns:** `Item No. | Description | Location | Length(m) | Width(m) | Height(m) | Qty | Unit | Remarks`.
- **Mandatory BOQ columns:** Quantity, Rate per Quantity, Length & Height, Area, Amount.
- **Tax:** 18% GST (split CGST/SGST for intra-state). **Discount:** percentage basis.
- **Tax summary block:** Subtotal (before tax) → Discount → Taxable Amount → GST → Other Taxes → Grand Total.
- **Signature block:** Prepared By / Reviewed By / Approved By / Client Approval.
- **Finalization rules:** quantities verified vs approved drawings → specs confirmed by design team → unit rates validated vs vendor quotes/market → calcs/tax/discount checked → reviewed by Project Architect/PM → client approval → only approved BOQs issued for tendering/procurement.

### 4. Material Sheet Module
Master material list (Google Sheet referenced in spec). Master-data creation feature.

### 5. Vendor Sheet Module
- **Vendor Master:** `Vendor ID | Name | Category | Contact Person | Phone | Email | Location | GST No. | Remarks` (e.g. V001 ABC Furniture, V002 XYZ Lighting).
- **Quotation comparison: required** (compare vendor quotes).
- **Vendor payment tracking: to be developed** (open requirement, no defined process yet).
- **Vendor Quotation Sample:** `src/assets/ARCHITECTURE WIP_59276_22-04-2026.pdf` — a real East India Company sanitaryware quotation (₹43,122 incl. tax). Note its shape for the quotation data model: `SL No. | Description | HSN | Qty | Unit | MRP | Disc. Rate | Amount`, with MRP→discounted-rate, HSN codes, CGST/SGST split, round-off, and a final amount.

> Note: the second PDF's filename suggests "architecture" but it is the **vendor quotation sample**, not an app architecture document.

## Tech Stack
| Tool | Version |
|---|---|
| React | 19.2.4 |
| Vite | 8.0.4 |
| Tailwind CSS | 4.2.2 (Vite plugin, no tailwind.config.js) |
| React Router | 7.14.1 |
| Lucide React | icons |
| React Icons | icons (tb, io, hi, pi, md, fi, fa, vsc, gr) |

## Commands
```bash
npm run dev      # start dev server
npm run build    # production build
npm run lint     # eslint
npm run preview  # preview build
```

## Folder Structure
```
src/
├── App.jsx                        # Root — renders AppRoutes
├── main.jsx                       # Entry — BrowserRouter + ReactDOM
├── index.css                      # Tailwind @import + @theme tokens
├── routes/
│   └── AppRoutes.jsx              # All route definitions
├── layouts/
│   ├── MainLayout.jsx             # Authenticated shell (Header + Sidebar + Outlet)
│   ├── Header.jsx                 # Top bar — search, notifications, avatar
│   └── Sidebar.jsx                # Collapsible nav — Menus + SupportMenu
├── pages/
│   ├── auth/
│   │   ├── Login.jsx              # Login page with glassmorphism right panel
│   │   └── ForgotPassword.jsx
│   ├── leads/
│   │   ├── Leads.jsx              # Leads list with table, tabs, filter/sort/export
│   │   ├── LeadEdit.jsx           # Lead detail + edit
│   │   ├── LeadDetails.jsx
│   │   ├── NewInquiriesform.jsx
│   │   └── EditInquiryform.jsx
│   ├── clients/
│   │   ├── Client.jsx             # Clients list (mirrors Leads structure)
│   │   ├── ClientProfile.jsx
│   │   ├── Addclientform.jsx
│   │   └── EditClientForm.jsx
│   ├── Dashboard.jsx              # Pipeline funnel + invoice cards
│   ├── Accounts.jsx               # Placeholder
│   ├── Pipeline.jsx               # Placeholder
│   ├── Analytics.jsx              # Placeholder
│   ├── Reports.jsx                # Placeholder
│   ├── Support.jsx                # Placeholder
│   └── Signout.jsx                # Clears localStorage + navigates to /
├── components/
│   ├── Table.jsx                  # Reusable data table with active row highlight
│   ├── Pagination.jsx             # Desktop + mobile responsive pagination
│   ├── InputField.jsx             # Unified input/select/textarea with error state
│   └── DateRangePicker.jsx        # Custom calendar range picker
├── data/
│   ├── TableData.jsx              # Mock leads data
│   └── ClientTableData.jsx        # Mock clients data
├── helperConfigData/
│   └── helperData.jsx             # Nav menus (Menus, SupportMenu, LeadsHeader)
└── assets/
    └── images/                    # ALL image assets live here
        ├── Google.png
        ├── HomePage.png
        ├── avatar.png
        ├── Client_avatar.png
        └── avatar-profile-user.svg
```

## Routing
```
/                    → Login
/forgot-password     → ForgotPassword
/ (MainLayout)
  /dashboard         → Dashboard
  /leads             → Leads
  /leads/:id         → LeadEdit
  /clients           → Client
  /clients/:id       → ClientProfile
  /accounts          → Accounts
  /pipeline          → Pipeline
  /analytics         → Analytics
  /reports           → Reports
  /support           → Support
  /signout           → Signout
```

## Color Tokens (index.css @theme)
All colors are defined as CSS variables in `src/index.css` and available as Tailwind utility classes.

| Variable | Hex | Tailwind Class |
|---|---|---|
| `--color-primary` | `#1a2b4d` | `text-primary`, `bg-primary` |
| `--color-select-blue` | `#1e3a8a` | `text-select-blue`, `bg-select-blue` |
| `--color-overallbg` | `#f4f4f4` | `bg-overallbg` |
| `--color-surface` | `#ffffff` | `bg-surface` |
| `--color-bg-soft` | `#f1f5f9` | `bg-bg-soft` |
| `--color-active-bg` | `#e2eefe` | `bg-active-bg` |
| `--color-bordergray` | `#e2e8f0` | `border-bordergray` |
| `--color-textcolor` | `#0f172a` | `text-textcolor` |
| `--color-text-muted` | `#64748b` | `text-text-muted` |
| `--color-text-subtle` | `#94a3b8` | `text-text-subtle` |
| `--color-grey` | `#475569` | `text-grey` |
| `--color-secondary` | `#9ca3af` | `text-secondary` |

**Always use these tokens** — do not hardcode hex values for these colors.

## Key Conventions

### Components
- `Table` — accepts `columns`, `data`, `activeRow`, `onRowClick`, `activeRowKey`
- `InputField` — handles `type="text"`, `"email"`, `"select"`, `"textarea"` in one component
- `Pagination` — purely controlled: `currentPage`, `totalPages`, `onPageChange`
- `DateRangePicker` — returns `{ start, end }` as `YYYY-MM-DD` strings via `onApply`

### Data flow (Leads / Client pages)
- Static mock data in `data/` is the base
- New records added via form are stored in `localStorage` and merged with mock data via `useMemo`
- Deleted record IDs are stored separately in `localStorage`
- No backend or API layer yet

### Sidebar state
- Sidebar owns its own `open` state — do not lift it to MainLayout
- `navClass` helper function handles active/inactive NavLink styling
- Menu config lives in `helperConfigData/helperData.jsx` (Menus, SupportMenu)

### Auth pages
- Login uses a glassmorphism right panel: `bg-[#E9E9FF]/40 backdrop-blur-xl border-l border-white/80`
- Left panel shows `HomePage.png` as background image
- Auth state is localStorage-backed via `src/auth/auth.js` (`login` / `logout` / `isAuthenticated`) — not real auth, but routes are now guarded
- Login sets the token then redirects to the intended URL (`state.from`), falling back to `/dashboard`; `Signout.jsx` clears the token

### Font
- `font-manrope` — apply on root layout containers, not individual elements

## Asset Imports
All assets live in `src/assets/images/`. Always use the full path:
```js
import avatar from "../../assets/images/avatar.png";     // from pages/
import avatar from "../assets/images/avatar.png";        // from layouts/
```
Filename casing matters on Linux — use exact casing (`Client_avatar.png`, not `client_avatar.png`).

## Known Issues / TODOs
- No state management library — will be needed as features grow
- `data/` folder is mock only — needs a real API integration layer
- `helperConfigData/` should be renamed to `utils/`
- `Support.jsx` is a placeholder — needs implementation
- `ErrorBoundary` logs to `console.error` — wire to a real error tracker (Sentry) when available
- No tests yet — Vitest + React Testing Library not set up
- JS only — no TypeScript / PropTypes
- Schedule activity log has no user identity — entries (work-start confirmed, room marked done, client notified) are timestamped but can't record *who* did them. Needs a backend + auth before it's a real audit trail.
- Client notifications are **logged, not sent** — the "Notify client" action in `ProjectSchedule.jsx` (`sendNotification`) only appends a timeline entry. Wire a mail/SMS service there when available; that function is the single send point.

## Resolved
- ✅ Protected routes — `ProtectedRoute` (`routes/ProtectedRoute.jsx`) guards all app routes; unauthenticated visits redirect to login and remember the intended URL
- ✅ Error boundary — `components/ErrorBoundary.jsx` wraps the app with a recoverable fallback
- ✅ 404 handling — catch-all route renders `pages/NotFound.jsx` in-shell (inside the authenticated layout)
