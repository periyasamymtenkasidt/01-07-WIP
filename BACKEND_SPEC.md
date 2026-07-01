# Backend Specification — Digital Atelier (Executive CRM)

> **Purpose.** This is a self-contained brief for a backend team to build the server, database, and API for the Digital Atelier interior/architecture practice-management app **independently of the frontend**. The frontend (React 19 + Vite) currently stores everything in the browser (`localStorage` + `IndexedDB`); this document specifies the backend that replaces that storage with a real, multi-user, authenticated system.
>
> Every entity, field, ID format, and relationship below was extracted from the live frontend storage modules in `src/data/`. Where this doc says "confirm against `<file>`", the backend team should read that file for the exact leaf shape before finalising.
>
> **Currency:** INR (₹). **Tax:** Indian GST. **Region:** India (Tamil Nadu org by default).

---

## 1. How the frontend is built (why migration is clean)

The React app **never touches `localStorage` directly from components.** All persistence goes through ~30 "storage modules" in `src/data/` (e.g. `clientStorage.js`, `siteStorage.js`, `designFlowStorage.js`). Each exposes synchronous CRUD functions (`getX`, `saveX`, `listX`) and dispatches a `window` event on change.

**Implication for the backend:** the integration seam is those storage modules. The backend exposes a REST/RPC API; the frontend team reimplements each storage module's *internals* to call that API (becoming `async`). The UI changes are mostly `await`/loading-state, not rewrites. **Build the API to mirror these modules' verbs**, and migration is a data-layer swap rather than a rewrite.

The one real cost on the frontend side: today's storage calls are **synchronous**; the network is **async**. That ripple is the frontend team's job — but the API should be designed to make it painless (batch reads, embedded relations, optimistic-friendly responses).

---

## 2. Recommended stack

| Layer | Recommendation | Why |
|---|---|---|
| **DB** | **PostgreSQL** | Data is highly relational (lead→client→site→contract→procurement). JSONB for the few flexible leaf shapes. |
| **Backend platform** | **Supabase** (managed Postgres + Auth + Storage + Realtime + auto REST) — *or* **Node + NestJS/Express + Prisma + Postgres** if self-hosting is required | Supabase gives Auth, file Storage, Row-Level Security, and realtime out of the box — it directly solves the app's two biggest gaps (no auth, no shared state) with the least work. Choose custom Node only if there's a hard reason to avoid a BaaS. |
| **Auth** | Supabase Auth (email/OTP + JWT), or Auth0 / custom JWT | Enables the real **Intern→Principal identity chain** and a separate **client-portal** audience. |
| **File storage** | Supabase Storage / S3-compatible bucket | Replaces the current `IndexedDB` blob store (`wipFileStore`). |
| **Realtime** | Supabase Realtime / WebSocket | Replaces the current `window` change-events so multiple users/devices stay in sync. |

The rest of this spec is **stack-agnostic**: tables are plain Postgres, endpoints are REST. It maps onto Supabase (tables + RLS + PostgREST) or a custom Node API equally.

---

## 3. Cross-cutting conventions

- **IDs.** Keep the app's human-readable business IDs as a unique column, but use a DB surrogate PK (`uuid` or `bigint`) for FKs. Business-ID formats:
  | Entity | Format | Entity | Format |
  |---|---|---|---|
  | Lead | `LD-YYYY-###` | Contract | `CON-YYYY-###` |
  | Client | `BL-YYYY-###` | RFQ | `RFQ-YYYY-###` |
  | Site | `ST-YYYY-###` | Purchase Order | `PO-YYYY-###` |
  | Quote | `QT-YYYY-###` | Change Order | `CO-YYYY-###` |
  | BOQ | `BOQ-YYYY-###` | Design Comment | `DC-###` (per project) |
  | DCR (design change) | `DCR-###` | — | — |

  The `YYYY` is the calendar year; `###` is a zero-padded per-year (or per-parent) sequence. Sequence generation **must move server-side** (today it's client-computed and race-prone).
- **Money.** Store as `numeric(14,2)` rupees. Never floats. GST percent as `numeric(5,2)`. Default GST = **18%**, split CGST/SGST for intra-state, IGST for inter-state (decided by comparing org `state_code` vs client `state_code`).
- **Dates.** Persist as `date`/`timestamptz` (ISO). The frontend displays `DD.MM.YYYY` — that's a display concern, not storage.
- **Soft deletes.** Use `deleted_at timestamptz null` (the app currently keeps a `deletedClients` list — replace with this).
- **Audit.** Every table: `created_at`, `updated_at`, plus `created_by`, `updated_by` (FK → `users`). This is what unlocks the real audit trail the app can't currently produce.
- **Two service tracks.** `service_track ∈ {Interiors, Architecture}` branches intake fields **and** the design pipeline. Many tables carry it.
- **Flexible leaves.** Deeply nested, variable arrays (scope items, rate recipes, checklist rows, schedule rooms, deliverables) are specified as `jsonb` to match the app's shapes. Promote to child tables only where you need to query/aggregate across them (noted per table).

---

## 4. Authentication & roles (RBAC)

Two **audiences**:

### 4a. Staff users (the firm)
`users` table; role drives permissions **and** the design-approval chain.

```
role ∈ { Intern, Junior Architect, Senior Architect, Principal Architect,
         Project Architect, Design Head, Project Manager, Procurement, Admin }
```

- The **internal design review chain is ordered**: `Intern → Junior Architect → Senior Architect → Principal Architect`. The Principal is the sole final authoriser (per requirements PDF).
- Today the acting role is *chosen at click time* (no identity). With auth, the server must enforce: **the user performing an internal sign-off holds the role for the current step.** This converts the enforced *sequence* into an enforced *identity chain*.

### 4b. Client portal users
Separate audience (`client_users`), scoped to **their own** `client_id` only (Row-Level Security). They can: view design deliverables submitted to them, approve / request revision on stages in `AWAITING_CLIENT`, view milestones/invoices, see site-visit calendar. They must **never** see internal review, costs/margin, vendor, or procurement data.

### 4c. Permission matrix (high level)
| Capability | Intern | Jr/Sr Arch | Principal | PM/Proc | Admin | Client |
|---|---|---|---|---|---|---|
| Edit design deliverables | ✅ (own) | ✅ | ✅ | — | ✅ | — |
| Internal sign-off (own step) | ✅ step0 | ✅ steps | ✅ final | — | ✅ | — |
| Approve BOQ / contract | — | — | ✅ | ✅ | ✅ | — |
| Vendor / RFQ / PO | — | — | view | ✅ | ✅ | — |
| Approve design (client side) | — | — | — | — | — | ✅ |
| See margin / cost | — | — | ✅ | ✅ | ✅ | ❌ |

---

## 5. Data model (PostgreSQL)

Grouped by domain. Core chain tables get full DDL; supporting tables get column specs. `id uuid pk default gen_random_uuid()`, `created_at/updated_at timestamptz`, and `created_by/updated_by` are implied on every table unless noted.

### 5.1 Sales — Leads & Clients

```sql
create table leads (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   text unique not null,              -- LD-YYYY-###
  client_name   text not null,
  phone         text,
  email         text,
  scope         text,                              -- brief scope text
  property_type text,                              -- Apartment, Villa, ...
  location      text,                              -- locality/address
  status        text not null,                     -- Inquiry|Qualified|Proposal|Negotiation|Won|On Hold|Lost
  service_track text not null,                     -- Interiors|Architecture
  inquiry_source text,                             -- Website|Social Media|Referral|Walk-in|Cold Call
  investment    text,                              -- budget band display
  lost_reason   text,
  -- Interiors-only:
  quote_preset  text,                              -- 1BHK|2BHK|3BHK|Villa
  quote_grade   text,                              -- economy|premium|luxury
  quote_size_range text,                           -- sqft band
  possession_date date,
  -- Architecture-only:
  project_intent text,                             -- Residential Building|Commercial|...
  plot_area     text,
  plot_number   text,
  land_ownership text,                             -- Owned|Under purchase|Disputed/Unknown
  indicative_budget text,
  target_completion date,
  converted_client_id uuid references clients(id), -- set on Win
  deleted_at    timestamptz
);

create table lead_activities (                     -- was leadActivity_<proposalId>
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  type        text not null,                       -- email|call|note
  subject     text,
  body        text,
  recipient_email text,
  at          timestamptz not null default now(),
  created_by  uuid references users(id)
);

create table clients (
  id            uuid primary key default gen_random_uuid(),
  client_id     text unique not null,              -- BL-YYYY-###
  client_name   text not null,
  phone         text,
  email         text,
  service_track text not null,
  property_type text,
  location      text,
  size_range    text,
  budget        text,                              -- display
  project_value numeric(14,2),                     -- ex-GST numeric
  payment_status text,                             -- completed|pending|failed|overdue
  join_date     date,
  source_lead_id uuid references leads(id),        -- back-link to lead
  -- GST/billing identity (used on invoices/BOQ):
  gstin         text,
  state_code    text,
  billing_address text,
  deleted_at    timestamptz
);
```

### 5.2 Quotes & Proposal masters

```sql
create table quotes (                              -- was quotes_<parentId>
  id           uuid primary key default gen_random_uuid(),
  quote_id     text unique not null,               -- QT-YYYY-###
  parent_type  text not null,                      -- lead|contract
  parent_id    uuid not null,                      -- FK to leads.id (or contracts.id)
  recipient_name text,
  recipient_email text,
  preset_key   text,                               -- 1BHK|2BHK|3BHK|Villa
  property_type text,
  grade        text,                               -- economy|premium|luxury
  scope_items  jsonb not null default '[]',        -- snapshot; shape in §6
  inclusions   jsonb default '[]',
  exclusions   jsonb default '[]',
  subtotal     numeric(14,2),
  gst          numeric(14,2),
  grand_total  numeric(14,2),
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table quote_documents (                     -- was leadDocuments_<leadId>: immutable sent-PDF archive
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  quote_id    uuid not null references quotes(id),
  file_name   text,
  sent_to     text,
  sent_at     timestamptz,
  grand_total numeric(14,2),
  snapshot    jsonb not null                       -- full immutable quote record
);
```

**Master/config tables** (single-row or small reference sets; mostly `jsonb` payloads, editable in the app's "Master" module):
- `quote_presets` — per preset key (1BHK/2BHK/3BHK/Villa): `label`, `configurations jsonb` (each config: propertyType, sizeRange, scopeItems[], inclusions[], exclusions[]). Confirm against `QuotePresets.js`.
- `proposal_rooms` — `[{name, days}]` room/heading presets. (`proposalRooms.js`)
- `item_master` — rate library; see §5.6.
- `material_master` — price catalog; see §5.6.
- Rate build-up recipes (economy/premium/luxury) live as `recipes jsonb` on `item_master` rows. Computed rate formula in §7. (`rateBuildup.js`, `gradeMapping.js`)

### 5.3 Sites & Survey

```sql
create table sites (
  id            uuid primary key default gen_random_uuid(),
  site_id       text unique not null,              -- ST-YYYY-###
  client_id     uuid not null references clients(id),
  property_preset text,
  site_type     text,
  full_address  text,
  status        text not null default 'Survey',    -- Survey|Design|In Progress|Completed
  progress      int default 0,                     -- 0..100 (often derived from schedule)
  target_date   date,
  supervisor    text,
  notes         text,
  start_date    date,
  is_advance_paid boolean default false,
  advance_paid_date date,
  deleted_at    timestamptz
);

-- Survey measurements: one row per measured element. (was siteMeasurements_<siteID> map)
create table site_measurements (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references sites(id) on delete cascade,
  area          text not null,                     -- room/area
  scope_item_id text,                              -- stable scope id (preferred key)
  element_name  text,                              -- legacy key fallback
  length        numeric, breadth numeric, height numeric, nos numeric,
  selected_material jsonb,                         -- {materialId,grade,name,rate,specifications,gstPercent}
  images        jsonb default '[]',                -- [{fileId, ...}] -> file_objects
  unique (site_id, area, scope_item_id)
);

-- Frozen proposal basis at survey freeze. IMMUTABLE once written. (was siteProposalBasis_<siteID>)
create table site_proposal_basis (
  site_id      uuid primary key references sites(id) on delete cascade,
  preset_key   text,
  property_type text,
  quote_id     uuid references quotes(id),
  items        jsonb not null,                     -- frozen scope items
  baseline     jsonb not null,                     -- {subtotal, gst, grandTotal}
  snapshotted_at timestamptz not null default now()
);

create table site_custom_items (                   -- was siteCustomItems_<siteID>
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  area        text, item_name text, unit text,
  qty numeric, rate numeric(14,2), amount numeric(14,2),
  is_custom   boolean default true
);
```

**Feasibility (Architecture only)** — `feasibility` table keyed by `site_id`, columns `legal jsonb, planning jsonb, survey jsonb, documents jsonb, decision text (Go|No-Go), decided_at, history jsonb`. Confirm against `feasibilityStorage.js`.

### 5.4 Design flow & internal review **(the module just built — specify precisely)**

```sql
create table design_flows (                        -- was designFlow_<siteID>
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null unique references sites(id) on delete cascade,
  track        text not null,                      -- Interiors|Architecture
  current_stage text,                              -- DESIGN_<KEY> | DESIGN_COMPLETE
  site_basis   jsonb not null,                     -- immutable snapshot (measurements, areas, proposalBaseline, frozenAt, arch fields)
  fee          jsonb,                              -- {builtUpArea, feeRatePerSqft} (Architecture)
  boq_id       uuid references boqs(id),
  history      jsonb not null default '[]',        -- [{at, action}]
  archived     boolean default false
);

create table design_stages (
  id            uuid primary key default gen_random_uuid(),
  flow_id       uuid not null references design_flows(id) on delete cascade,
  stage_key     text not null,                     -- CONCEPT|DEVELOPMENT|DRAWINGS|BOQ | SCHEMATIC|DESIGN_DEV|APPROVALS|CONSTRUCTION_DOCS|TENDER|CONSTRUCTION_ADMIN
  ordinal       int not null,                      -- position in pipeline
  review_state  text not null,                     -- LOCKED|DRAFTING|INTERNAL_REVIEW|AWAITING_CLIENT|REVISION_REQUESTED|APPROVED
  round         int not null default 1,
  rounds_included int not null default 2,          -- free revision rounds; beyond = billable
  deliverables  jsonb not null default '[]',       -- [{id,type,name,fileId|src,mime}]
  approvals     jsonb not null default '[]',       -- CLIENT-side history [{round,decision(APPROVED|REVISION),by,comment,at}]
  -- internal review (the new feature):
  internal_step int not null default 0,            -- 0=Intern .. 3=Principal
  internal_signoffs jsonb not null default '[]',   -- [{role,decision(APPROVED|CHANGES),comment,round,at, user_id}]
  internal_kickback jsonb,                          -- {role,comment,at} when returned to team
  checklist     jsonb not null default '[]',       -- 17 rows: [{value:'yes'|'no'|null, comment}]
  boq_snapshot  jsonb,                             -- BOQ stage computed bill (areas, totals, variance)
  tender        jsonb,                             -- TENDER stage {builtUpArea, constructionRate, bids[], awarded}
  submitted_at  timestamptz, approved_at timestamptz,
  unique (flow_id, stage_key)
);

create table design_comments (                     -- DC-### register, per stage
  id          uuid primary key default gen_random_uuid(),
  stage_id    uuid not null references design_stages(id) on delete cascade,
  comment_no  text not null,                        -- DC-### (sequential across the flow)
  drawing_ref text,
  comment     text not null,
  raised_by   text,                                 -- role/name (free; Client/Design Head/etc.)
  status      text not null default 'Open',         -- Open|In Progress|Closed
  resolution  text,                                 -- REQUIRED when status=Closed
  closed_at   timestamptz,
  at          timestamptz not null default now(),
  created_by  uuid references users(id)
);
```

**Pipelines (seed data, by track):**
- Interiors: `CONCEPT → DEVELOPMENT → DRAWINGS → BOQ`
- Architecture: `SCHEMATIC → DESIGN_DEV → APPROVALS → CONSTRUCTION_DOCS → TENDER → CONSTRUCTION_ADMIN` (each has a `feeWeight` for staged design-fee billing)

**Design Review Checklist (17 items, seed):** client requirements addressed; aligns with concept; space planning functional; circulation clear; furniture practical; materials approved; colour consistent; lighting adequate; ceiling coordinated w/ lighting & HVAC; dimensions checked; A/S/MEP coordinated; accessibility; safety; material specs complete; drawings follow office standards; sheet numbers/titles correct; renders match drawings.

> Optional but recommended for a normalized **DCR (Design Change Request)** record (PDF §2): a `design_change_requests` table — `dcr_no, project_id, requested_by, design_stage, description, reason, cost_impact numeric, schedule_impact_days int, reviewed_by, approved_by, status`. The frontend currently models variations via change orders (§5.7); DCR can map onto that or be its own table.

### 5.5 BOQ

```sql
create table boqs (
  id            uuid primary key default gen_random_uuid(),
  boq_id        text unique not null,              -- BOQ-YYYY-###
  title         text,
  status        text not null default 'draft',     -- draft|sent|approved
  parent_type   text,                              -- lead|client|contract
  parent_id     uuid,
  site_id       uuid references sites(id),
  client        jsonb,                             -- {name,phone,email,address,gstin,state}
  project       jsonb,                             -- {name,propertyType,address,siteID}
  discount      jsonb,                             -- {type:'percent'|'amount', value}
  labor_percent numeric(5,2) default 0,
  contingency_percent numeric(5,2) default 0,
  payment_terms jsonb,                             -- [{percent,label}] must sum 100
  org_snapshot  jsonb,
  -- survey-integration / variance:
  proposal_baseline jsonb, quoted_subtotal numeric(14,2), quoted_total numeric(14,2),
  measured_subtotal numeric(14,2), measured_total numeric(14,2),
  survey_variance numeric(14,2), survey_within_tolerance boolean,
  survey_frozen_at timestamptz, survey_stale boolean default false, revision int default 1,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table boq_sections (
  id          uuid primary key default gen_random_uuid(),
  boq_id      uuid not null references boqs(id) on delete cascade,
  name        text not null,                       -- room/category
  scope_item_id text,
  ordinal     int
);

create table boq_items (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references boq_sections(id) on delete cascade,
  scope_item_id text, master_id uuid references item_master(id),
  description text, spec text, hsn text,
  unit        text, qty numeric, rate numeric(14,2), amount numeric(14,2),
  gst_percent numeric(5,2) default 18,
  discount    jsonb,                               -- {type,value}
  dimensions  jsonb,                               -- {enabled,length,breadth,height,nos}
  materials   jsonb default '[]',
  -- survey-sourced fields:
  quoted_qty numeric, quoted_rate numeric(14,2), quoted_amount numeric(14,2),
  measured_qty numeric, measured_rate numeric(14,2), measured_amount numeric(14,2),
  survey_variance numeric(14,2), is_site_custom boolean default false, is_variation boolean default false
);
```
BOQ **totals are computed** (do not store as source of truth; compute on read or in a view): subtotal → line discounts → BOQ discount → labour% → contingency% → GST-by-rate → grand total. Formula in §7.

### 5.6 Masters — Items & Materials

```sql
create table item_master (                         -- was item_library
  id uuid primary key default gen_random_uuid(),
  description text not null, unit text, rate numeric(14,2), days numeric,
  hsn text, gst_percent numeric(5,2) default 18,
  materials jsonb default '[]',                     -- [{name,spec}]
  recipes  jsonb,                                   -- {economy,premium,luxury} build-ups
  default_grade text, tags jsonb default '[]',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table material_master (                     -- was material_library
  id uuid primary key default gen_random_uuid(),
  name text not null, specifications text,
  rate numeric(14,2), unit text, hsn text, gst_percent numeric(5,2) default 18,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
```
**Units enum:** `sqft, sqm, rmt, mm, nos, set, pair, ltr, kg, lot, ls, day`.

### 5.7 Procurement, Contracts & Execution

```sql
create table vendors (                             -- was vendor_master
  id uuid primary key default gen_random_uuid(),
  name text not null, category text,
  contact_person text, email text, phone text, address text,
  gstin text, pan text,
  msme_registered boolean, msme_category text, udyam_number text,
  tds_section text, tds_rate numeric(5,2),
  bank_name text, bank_account_number text, bank_ifsc text, bank_account_holder text,
  credit_days int, delivery_lead_days int,
  quality_terms text, penalty_terms text, contract_valid_till date,
  material_ids jsonb default '[]',                 -- materials supplied
  created_at timestamptz default now()
);

create table contracts (
  id uuid primary key default gen_random_uuid(),
  contract_id text unique not null,                -- CON-YYYY-###
  client_id uuid not null references clients(id),
  lead_id uuid references leads(id),
  boq_id uuid references boqs(id),
  status text not null default 'signed',           -- signed|in_progress|completed|on_hold
  base_value numeric(14,2),                         -- ex-GST at signing
  margin_percent numeric(5,2),
  timeline_days int,
  scope_snapshot jsonb not null default '[]',       -- frozen scope at signing
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table rfqs (                                -- was rfqs_<contractId>
  id uuid primary key default gen_random_uuid(),
  rfq_id text unique not null,                      -- RFQ-YYYY-###
  contract_id uuid not null references contracts(id) on delete cascade,
  items jsonb not null default '[]',                -- [{materialId,name,spec,qty,unit}]
  quotes jsonb not null default '[]',               -- [{vendorId,lines[],total,notes,quotedAt}]
  status text not null default 'sent',              -- sent|quoted|awarded|closed
  awarded_vendor_id uuid references vendors(id),
  po_id uuid,
  created_at timestamptz default now()
);

create table purchase_orders (                     -- was purchaseOrders_<contractId>
  id uuid primary key default gen_random_uuid(),
  po_id text unique not null,                       -- PO-YYYY-###
  contract_id uuid not null references contracts(id) on delete cascade,
  vendor_id uuid references vendors(id),
  items jsonb not null default '[]',                -- [{materialId,name,spec,qty,unit,rate,amount}]
  total numeric(14,2), actual_cost numeric(14,2),
  status text not null default 'draft',             -- draft|ordered|partially_received|received
  expected_on date,
  grns jsonb default '[]',                          -- goods received notes
  created_at timestamptz default now()
);

create table change_orders (                       -- was changeOrders_<contractId>
  id uuid primary key default gen_random_uuid(),
  co_id text unique not null,                       -- CO-YYYY-###
  contract_id uuid not null references contracts(id) on delete cascade,
  description text, value numeric(14,2),
  scope_item_id text, items jsonb,
  adds_milestone boolean default false,
  status text not null default 'proposed',          -- proposed|client_approved|rejected
  approved_at timestamptz, created_at timestamptz default now()
);

create table work_packages (                       -- was workPackages_<contractId>
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  scope_item_id text, trade text, title text,
  subcontractor_id uuid references vendors(id), subcontractor_name text,
  work_order_value numeric(14,2), actual_cost numeric(14,2),
  status text not null default 'Not Started',        -- Not Started|In Progress|Done|Blocked
  created_at timestamptz default now()
);

create table payment_milestones (                  -- was clientMilestones_<clientID>
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  milestone_no int not null,                         -- 1..4
  name text not null,                                -- ADVANCE|STAGEWISE A|STAGEWISE B|REMAINING
  pct numeric(5,2) not null,                         -- 40/30/25/5
  base numeric(14,2), gst numeric(14,2),
  status text not null default 'pending',            -- pending|paid|overdue
  due_date date, paid_date date
);

create table project_schedules (                   -- was projectSchedule_<proposalId>
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  work_start date, delay_note text, delay_attribution text,
  client_approved boolean default false, breach_reason text, confirmed_at timestamptz,
  rooms jsonb not null default '[]'                  -- parallel-room model; shape in §6
);
```

### 5.8 Config / org / files

- `org_profile` — single row: name, tagline, address, city, state, **state_code**, phone, email, website, **gstin**, pan, logo (store in bucket, keep URL), bank_* , upi, default_validity, default_warranty, default_notes. (`orgProfile.js`)
- `terms` — global inclusions/exclusions per category (`STATUTORY|DELIVERY|PAYMENTS|TECHNICAL|GENERAL`), each `[{text,isDefault}]`. (`termsStorage.js`)
- `property_types` — string list, user-extensible. (`propertyTypeStorage.js`)
- `schedule_config` — `amberWindowDays`, `escalationTiers[]`, room/scope duration presets, statuses. (`scheduleConfig.js`)
- `file_objects` — replaces IndexedDB `wipFileStore`: `id, name, mime, size, bucket_path, owner_type, owner_id, created_by, created_at`. Binary lives in the object store; this row is the metadata + link. Used by: design deliverables, survey photos, feasibility docs, quote/BOQ PDFs.

---

## 6. Key JSONB leaf shapes (the flexible bits)

These are stored as JSONB to match the app exactly. **Confirm fields against the named source file.**

- **Scope item** (`quotes.scope_items`, `site_proposal_basis.items`, design `site_basis.areas[].elements`): `{area, itemName, description, unit, rate, qty, amount, days, hsn, gstPercent, materials:[{name,spec,materialId?,rate?,gstPercent?,unit?}], scopeItemId, masterId, recipes?, isCustom?}` — `QuotePresets.js`, `surveyMeasureStorage.js`.
- **Rate recipe** (`item_master.recipes.{grade}`): `{components:[{materialId,name,unit,qty,wastagePct,rate}], labourRate, overheadPct, marginPct}` — `rateBuildup.js`.
- **Design checklist row** (`design_stages.checklist[]`): `{value:'yes'|'no'|null, comment}` — `designFlowStorage.js`.
- **Design deliverable** (`design_stages.deliverables[]`): `{id, type, name, fileId|src, mime}`.
- **Schedule room** (`project_schedules.rooms[]`): `{id, room, description, days, shiftsPerDay, shiftsDone, works:[{name,days,shiftsPerDay}], owner, status, done, note, amount, materials[], quantity, measurement}` — `scheduleStorage.js`. (Parallel model: every room starts Day-0; project end = max room end.)
- **BOQ snapshot** (`design_stages.boq_snapshot`): `{areas:[{area,rows:[{name,unit,rate,quotedQty,measuredQty,quotedAmount,measuredAmount,variance,...}],quotedSubtotal,measuredSubtotal}], quotedTotal, measuredTotal, gst, gstPercent, variance, variancePct, withinTolerance, toleranceAmount}`.

---

## 7. Server-enforced business rules (the important part)

These are currently enforced (loosely) on the client. **Move them server-side** — they're the integrity of the system.

1. **GST.** Default 18%. Totals pipeline (BOQ): `subtotal → minus line discounts → minus BOQ-level discount → plus labour% → plus contingency% → = base; GST applied per-rate on base; grand_total = base + Σ GST`. Intra-state ⇒ CGST+SGST (split 9/9); inter-state ⇒ IGST 18. Decide by `org.state_code` vs `client.state_code`.
2. **Lead → Client conversion** (on `status=Won`): create `clients` row with `source_lead_id`; set `leads.converted_client_id`. Idempotent (one client per won lead).
3. **Survey freeze is immutable.** Writing `site_proposal_basis` + `design_flows.site_basis` is a one-time snapshot. Re-opening (`unfreeze`) must **archive** the current design flow (versioned) and mark the linked BOQ `survey_stale = true` — never silently mutate a frozen basis.
4. **Design pipeline gating.**
   - Stages unlock sequentially: a stage is `LOCKED` until the previous stage is `APPROVED` (client).
   - Submit path: `DRAFTING → INTERNAL_REVIEW` (never straight to client).
   - **Internal chain is ordered & identity-bound:** sign-off for step *n* requires the acting user to hold role `INTERNAL_ROLES[n]`. Each approval advances the step; the **Principal (final) step transitions the stage to `AWAITING_CLIENT`**.
   - **Principal cannot finalise** unless: all 17 checklist items answered **AND** every design comment `status=Closed`.
   - **Closing a comment requires a non-empty `resolution`.**
   - **Return to team** (any reviewer) → stage back to `DRAFTING`, internal step reset to 0 (full re-review on resubmit), record kickback.
   - Revisions beyond `rounds_included` (default 2) are flagged **billable**.
5. **Client side** (portal): only `AWAITING_CLIENT` stages are visible/actionable; approve → next stage unlocks (or pipeline `COMPLETE`); request revision → `round++`, back to `DRAFTING`.
6. **BOQ approval before procurement** (PDF): only `status=approved` BOQs may spawn RFQs/POs. Quantities verified vs approved drawings; rates validated vs vendor quotes; client approval recorded.
7. **Milestones** sum to 100% (40/30/25/5 default). Day-0 of the project schedule = the date milestone #1 (ADVANCE) is marked `paid`.
8. **Variance tolerance.** Survey BOQ flags `within_tolerance` when measured−quoted ≤ tolerance (frontend uses ₹15,000 default) — make it a configurable org setting.
9. **Sequence numbers** (`LD/BL/ST/QT/BOQ/CON/RFQ/PO/CO`) generated atomically server-side (sequence table or DB sequence per prefix+year) to avoid the current client-side race.
10. **Audit.** Every state transition (status change, sign-off, comment close, payment, award) writes `created_by/updated_by` and ideally an append-only `audit_log` row `{entity, entity_id, action, actor, before, after, at}`.

---

## 8. REST API surface (representative)

Mirror the storage-module verbs. All under `/api`, JWT-authenticated, RLS/role-checked. Use `?expand=` to embed relations and kill N+1 round-trips (helps the sync→async migration).

```
# Auth
POST   /auth/login                 POST /auth/refresh        GET /auth/me

# Leads
GET    /leads            ?status=&track=&q=&page=
POST   /leads            GET /leads/:id     PATCH /leads/:id    DELETE /leads/:id
POST   /leads/:id/activities        GET /leads/:id/activities
POST   /leads/:id/convert           -> creates client (rule §7.2)

# Clients
GET/POST /clients   GET/PATCH/DELETE /clients/:id
GET    /clients/:id/milestones      PATCH /milestones/:id   (mark paid)

# Quotes & masters
GET/POST /leads/:id/quotes          POST /quotes/:id/send   GET /quotes/:id
GET/PUT  /masters/quote-presets     GET/PUT /masters/items  GET/PUT /masters/materials
GET/PUT  /masters/terms  /masters/org-profile  /masters/property-types  /masters/schedule-config

# Sites & survey
GET/POST /sites   GET/PATCH /sites/:id
GET/PUT  /sites/:id/measurements    POST /sites/:id/freeze-survey  POST /sites/:id/unfreeze
GET/PUT  /sites/:id/feasibility     POST /sites/:id/feasibility/decision

# Design flow
GET    /sites/:id/design-flow       POST /sites/:id/design-flow (startDesign)
PATCH  /design-stages/:id/deliverables
POST   /design-stages/:id/submit-internal-review
POST   /design-stages/:id/internal-approve      {role,comment}   # role must match step
POST   /design-stages/:id/internal-return       {role,comment}
PUT    /design-stages/:id/checklist/:index      {value,comment}
POST   /design-stages/:id/comments              GET /design-stages/:id/comments
PATCH  /design-comments/:id                     {status,resolution}   # resolution required to Close
POST   /design-stages/:id/generate-boq          # BOQ stage
# client portal:
POST   /portal/stages/:id/approve   POST /portal/stages/:id/request-revision

# BOQ
GET/POST /boqs   GET/PATCH /boqs/:id   POST /boqs/:id/approve
# Procurement (under contract)
GET/POST /contracts/:id/rfqs   POST /rfqs/:id/award   POST /rfqs/:id/convert-to-po
GET/POST /contracts/:id/purchase-orders   POST /purchase-orders/:id/grn
GET/POST /contracts/:id/change-orders      POST /change-orders/:id/approve
GET/POST /contracts/:id/work-packages
# Contracts, schedule, finance
GET/POST /contracts   GET/PATCH /contracts/:id
GET/PUT  /leads/:id/schedule
GET    /contracts/:id/finance      GET /finance/portfolio    # computed P&L

# Files
POST   /files (multipart)   GET /files/:id   DELETE /files/:id

# Vendors
GET/POST /vendors  GET/PATCH/DELETE /vendors/:id
```

---

## 9. Migration plan (localStorage → backend)

1. **Stand up DB + auth + storage** (Supabase project or Node service). Seed master tables (`quote_presets`, `item_master`, `material_master`, `terms`, `org_profile`, `schedule_config`, `property_types`) from the app's current seed data.
2. **Build the API** (§8) and enforce rules (§7) server-side.
3. **Per-module frontend swap.** For each `src/data/*Storage.js`, replace internals with API calls (keep the function names/signatures; make them `async`). Suggested order (low-risk first): masters → leads → clients → quotes → sites → survey → **design flow** → BOQ → contracts → procurement → schedule/finance.
4. **One-time data import.** Provide an importer that reads a user's exported `localStorage`+`IndexedDB` dump and POSTs it through the API (preserving business IDs). Map every key in the table below.
5. **Cut over realtime.** Replace `window.dispatchEvent(...)` change-events with realtime subscriptions so other sessions refresh.

### localStorage key → table map
| localStorage key | Table |
|---|---|
| `newLeadsData`, seed `TableData` | `leads` |
| `leadActivity_<id>` | `lead_activities` |
| `newClientsData`, `deletedClients`, `staticClientStatusOverrides` | `clients` (+ `deleted_at`) |
| `quoteMaster`, `quoteMasterSeedVersion` | `quote_presets` |
| `quotes_<parentId>` | `quotes` |
| `leadDocuments_<leadId>` | `quote_documents` |
| `proposalRooms` | `proposal_rooms` |
| `newSitesData` | `sites` |
| `siteMeasurements_<siteID>` | `site_measurements` |
| `siteProposalBasis_<siteID>` | `site_proposal_basis` |
| `siteCustomItems_<siteID>` | `site_custom_items` |
| `feasibility_<siteID>` | `feasibility` |
| `designFlow_<siteID>`, `designFlowArchive_<siteID>` | `design_flows` + `design_stages` + `design_comments` |
| `boq_index`, `boq_<id>` | `boqs` + `boq_sections` + `boq_items` |
| `item_library` | `item_master` |
| `material_library` | `material_master` |
| `vendor_master` | `vendors` |
| `rfqs_<contractId>` | `rfqs` |
| `purchaseOrders_<contractId>` | `purchase_orders` |
| `changeOrders_<contractId>` | `change_orders` |
| `contract_index`, `contract_<id>` | `contracts` |
| `workPackages_<contractId>` | `work_packages` |
| `projectSchedule_<proposalId>` | `project_schedules` |
| `clientMilestones_<clientID>` | `payment_milestones` |
| `scheduleConfig` | `schedule_config` |
| `globalTerms`, `globalTerms_categories` | `terms` |
| `org_profile` | `org_profile` |
| `globalPropertyTypes` | `property_types` |
| IndexedDB `wipFileStore` | `file_objects` + bucket |

---

## 10. Foreign-key reference (build constraints from this)

| From | Field | → To |
|---|---|---|
| leads | converted_client_id | clients |
| clients | source_lead_id | leads |
| quotes | parent_id | leads (or contracts) |
| quote_documents | quote_id / lead_id | quotes / leads |
| sites | client_id | clients |
| site_measurements / basis / custom / feasibility | site_id | sites |
| design_flows | site_id, boq_id | sites, boqs |
| design_stages | flow_id | design_flows |
| design_comments | stage_id | design_stages |
| boqs | parent_id, site_id | leads/clients/contracts, sites |
| boq_sections | boq_id | boqs |
| boq_items | section_id, master_id | boq_sections, item_master |
| contracts | client_id, lead_id, boq_id | clients, leads, boqs |
| rfqs / purchase_orders / change_orders / work_packages | contract_id | contracts |
| rfqs.awarded_vendor_id, purchase_orders.vendor_id, work_packages.subcontractor_id | vendors |
| payment_milestones | client_id | clients |
| project_schedules | lead_id | leads |
| file_objects | owner_id (polymorphic owner_type) | any |

---

## 11. Build roadmap (phased)

- **Phase 0 — Foundations:** DB schema, Auth (staff + client audiences), file bucket, seed masters, sequence service, audit_log.
- **Phase 1 — Sales core:** leads, activities, clients, conversion, quotes + send, masters API. *(Frontend swaps these modules.)*
- **Phase 2 — Sites → Design:** sites, survey, freeze (immutable), **design flow + internal review + comments** (rules §7.4). This is the verified Lead→Design chain and the just-built review feature — highest value.
- **Phase 3 — Money:** BOQ (+ approval), contracts, milestones, finance/P&L.
- **Phase 4 — Procurement & execution:** vendors, RFQ→PO→GRN, change orders, work packages, schedule, realtime.
- **Phase 5 — Hardening:** RLS audit, audit_log coverage, importer for existing localStorage data, backups.

---

## 12. Open questions to confirm before/while building

1. **Single firm or multi-tenant?** If you'll ever host multiple design firms, add `org_id` to every table now (cheap now, painful later).
2. **DCR vs Change Order** — keep the PDF's Design Change Request as its own record, or fold into `change_orders`? (Affects §5.4.)
3. **Numbering reset** — do `###` sequences reset each calendar year? (Assumed yes.)
4. **Inter-state GST** — confirm org is always Tamil Nadu (state_code 33); needed for CGST/SGST vs IGST split.
5. **Client portal auth** — magic-link/OTP per client, or password? Scope strictly to own `client_id`.
6. **Tolerance & revision policy** — make ₹15,000 survey tolerance and "2 free rounds" org-configurable (currently hardcoded).
7. **Exact leaf shapes** — before finalising JSONB columns, diff against: `QuotePresets.js`, `rateBuildup.js`, `scheduleStorage.js`, `boqStorage.js`, `designFlowStorage.js`.

---

*Generated from the live frontend storage modules in `src/data/`. Treat the field lists as authoritative for intent; verify exact leaf shapes against the cited source files during implementation.*
