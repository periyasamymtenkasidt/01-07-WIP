# Digital Atelier — Backend Blueprint

> Spec for the backend that replaces the current `localStorage`-only persistence.
> The frontend already models the full design‑build workflow; this document defines
> the **entities, schema, API, state machines, and the four continuity rails** the
> backend must enforce so that **value flows unbroken from the sample quote to the
> project P&L** — nothing is re‑keyed, nothing is lost.

---

## 1. Design principles

1. **Value continuity (the four rails).** Every downstream record *references* an
   upstream one by stable id — it never copies values that should be inherited.
   The four rails that must thread end‑to‑end:

   | Rail | Carrier key | Threads through |
   |---|---|---|
   | 🟦 Room / Scope identity | `scopeItemId` | preset scope → survey room → design room → BOQ section → work package → schedule room |
   | 💰 Money | `contractId` | BOQ cost → +margin → quote → contract value → milestone billing → actuals → margin |
   | 🧱 Material | `materialId` | material master → design finish → BOQ line → take‑off → PO → GRN → issue |
   | ⏱ Time | `days` / `scheduleId` | preset duration → schedule days → milestone timing |

2. **BOQ is cost; Quote is price; the spread is margin.** The backend stores the
   BOQ (internal cost build‑up) and derives the client Quote as `cost × (1 + margin)`.
   Both are persisted; the margin is never thrown away.

3. **Contract is the anchor.** At "Won", a `Contract` is created. Every execution,
   procurement, billing, and finance record carries `contractId`. The contract
   value (plus approved variations) is the single base for all `%` billing and the
   numerator of project margin.

4. **Actuals make it an ERP.** Every PO and subcontractor work order carries an
   `actualCost`. Project margin = `contractValue (+variations) − Σ actuals`.

5. **Append‑only audit.** Status changes, approvals, notifications, payments — all
   recorded as immutable `activity`/`ledger` rows stamped with `actorId` and time.
   (The current frontend logs activity but cannot record *who*; the backend fixes this.)

6. **Snapshots vs references.** Sent documents (quotes, invoices, signed BOQs) store
   an immutable JSON `snapshot` so the client always sees what they agreed to, even
   after masters change. Live working records use references so master edits flow in.

---

## 2. Entity‑relationship model

```
LeadSource ─┐
            ▼
          Lead ──converts──▶ Client ──┐
            │                          │
            │ (preset snapshot)        ├──▶ Site ──▶ Design (versioned, gated approval)
            ▼                          │              │
        Quote (sample/indicative)      │        BOQ (sections→items, from approved design)
                                       │              │  + marginPercent
                                       │        Quotation (client‑facing price)
                                       │              │  accepted
                                       └────────▶ Contract ◀── the anchor
                                                      │
        ┌──────────────┬──────────────┬──────────────┼───────────────┬──────────────┐
        ▼              ▼              ▼              ▼               ▼              ▼
   WorkPackage    Procurement     Schedule      PaymentSchedule  ChangeOrder    Documents
   + SubconWO     (PO→GRN→Issue)  (rooms/phases) →Invoice→Receipt (variation)   (snapshots)
        │              │                                              │
        └── actualCost ┴── actualCost ─────────────────────────▶ Project P&L
                                                           = ContractValue(+CO) − Σactuals
```

### Core entities & key fields

**LeadSource** — `id`, `name`, `channel` (referral/ads/web/walk‑in), `costPerLead?`

**Lead** — `id` (`proposalId`), `clientName`, `phone`, `scope`, `location`,
`status` (`Inquiry|Qualified|Proposal|Negotiation|Won|On Hold|Lost`),
`lostReason?`, `investment` (budget band), `possessionDate`, `sourceId`,
`presetKey?`, `propertyType?`, `assignedTo`, `createdAt`.

**Client** — `id` (`clientID`), `clientName`, `clientPhone`, `clientEmail`,
`location` (property type), `locationSecondary` (address), `gstin`, `sizeRange`,
`paymentStatus` (`completed|pending|unfulfilled|failed`), `sourceLeadId`, `createdAt`.

**Quote** (sample / indicative & later the priced quotation) — `quoteId`
(`QT-YYYY-###`), `parentType` (`lead|client|contract`), `parentId`, `presetKey`,
`propertyType`, `scopeItems[]` (`{ scopeItemId, area, description, amount, days, materials[] }`),
`marginPercent`, `subtotal`, `gst`, `grandTotal`, `status`
(`draft|sent|accepted|rejected`), `snapshot`, `sentTo`, `sentAt`, `createdAt`.

**Site** — `id`, `clientId`, `leadId?`, `clientName`, `propertyPreset`, `siteType`,
`address`, `supervisorId`, `status` (`survey|design|in progress|completed`),
`progress`, `targetDate`, `checklist[]`, `surveyMedia[]`, `rooms[]`
(`{ scopeItemId, name, measuredArea, dimensions }`), `notes`.

**Design** — `id`, `siteId`, `version`, `stage`
(`concept|development|client_review|redesign|approved`), `deliverables[]` (2D/3D urls),
`finishesByRoom[]` (`{ scopeItemId, materials[] }`), `approvedBy?`, `approvedAt?`.
*Gate: a BOQ can only be created from a Design in `approved` stage.*

**BOQ** — `id` (`BOQ-YYYY-###`), `parentType`, `parentId`, `contractId?`,
`basedOnPreset`, `designId?`, `status` (`draft|sent|approved|revised|signed`),
`revision`, `client{}`, `project{}`, `marginPercent`, `sections[]`
(`{ id, name, category, scopeItemId, items[] }`), each item
(`{ id, description, hsn, qty, unit, rate, gstPercent, discount, dimensions, materials[] }`),
`discount`, `paymentTerms[]`, computed totals.

**Contract** — `id` (`CON-YYYY-###`), `clientId`, `boqId`, `quoteId`,
`scopeSnapshot[]` (frozen scope items w/ `scopeItemId`), `baseValue` (accepted quote
grand total), `variationsValue` (Σ approved change orders), `contractValue`
(`baseValue + variationsValue`), `status`
(`draft|signed|in_progress|handover|closed`), `signedAt`, `timelineDays`,
`paymentSchedule[]` (`{ milestoneId, name, percent, amount, dueOn, status, invoiceId? }`),
`termsId`, `createdAt`.

**WorkPackage** — `id`, `contractId`, `scopeItemId`, `trade`
(`carpentry|electrical|plumbing|false_ceiling|painting|civil|furniture|...`),
`title`, `subcontractorId?`, `workOrderValue`, `actualCost`, `status`, `scheduleRoomId`.

**Subcontractor / Vendor** — `id`, `name`, `type` (`vendor|subcontractor`), `trade?`,
`gstin`, `contact`, `outstanding` (payable).

**Procurement — Indent** — `id`, `contractId`, `items[]`
(`{ materialId, qty, unit, scopeItemId? }`), derived take‑off from BOQ.

**Procurement — PurchaseOrder (PO)** — `id` (`PO-YYYY-###`), `contractId`, `vendorId`,
`items[]` (`{ materialId, qty, unit, rate, amount }`), `total`, `actualCost`,
`status` (`draft|ordered|partially_received|received`), `expectedOn`, `createdAt`.

**Procurement — GRN (goods received)** — `id`, `poId`, `receivedItems[]`
(`{ materialId, qtyReceived }`), `receivedOn`, `receivedBy`.

**Procurement — Issue (to site)** — `id`, `contractId`, `materialId`, `qty`,
`scopeItemId?`, `issuedOn`, `issuedBy`.

**Material (master)** — `id`, `name`, `category`, `specifications`, `brand`,
`vendor`, `unit`, `rate`, `hsn`.

**Item (BOQ line master / library)** — `id`, `description`, `category`, `hsn`,
`unit`, `rate`, `gstPercent`, `materials[]`, `tags`, `usageCount`.

**Schedule** — `id`, `contractId`/`projectId`, `siteId?`, `workStartDate`,
`rooms[]` (`{ scheduleRoomId, scopeItemId, name, description, days, ownerId, status, notes, materials, startDate?, endDate?, health }`).

**ChangeOrder (Variation)** — `id` (`CO-YYYY-###`), `contractId`, `description`,
`scopeItemId?`, `items[]` (mini‑BOQ), `value`, `status`
(`proposed|client_approved|rejected`), `approvedAt?`, `addsMilestone?`.

**PaymentSchedule / Invoice / Receipt** — invoice `id` (`INV-YYYY-###`),
`contractId`, `milestoneId`, `amount`, `gst`, `total`, `status`
(`pending|paid|overdue`), `dueOn`, `paidOn?`, `receiptRef?`, `snapshot`.

**ActivityLog** (append‑only) — `id`, `entityType`, `entityId`, `type`
(`email|call|note|status_change|milestone|quote_sent|approval|notification`),
`payload`, `actorId`, `createdAt`.

**User / Role** — `id`, `name`, `email`, `role`
(`admin|studio_head|pm|designer|supervisor|accounts|client`), `passwordHash`,
`clientId?` (for portal users).

---

## 3. Workflow state machines

```
Lead:       Inquiry → Qualified → Proposal → Negotiation → Won
                          └────────────▶ On Hold / Lost (with reason)

Design:     concept → development → client_review → (redesign ⇄) → approved
                                                              │ gate
BOQ:        draft → sent → approved → (revised ⇄) → signed ───┘ unlocks Contract

Contract:   draft → signed → in_progress → handover → closed

Site:       survey → design → in progress → completed

ScheduleRoom: Not Started → In Progress → Done | Blocked   (health: R/A/G)

PO:         draft → ordered → partially_received → received

Invoice:    pending → paid | overdue

ChangeOrder: proposed → client_approved | rejected
```

**Gate rules the backend enforces**
- BOQ creation requires `designId.stage == approved`.
- Contract creation requires a BOQ in `signed` (or an `accepted` quote).
- A milestone invoice for `STAGEWISE A/B` requires the linked schedule phase to be `Done`
  (configurable: stage‑completion‑triggered billing).
- A ChangeOrder only adds to `contractValue` once `client_approved`.

---

## 4. REST API surface

Base: `/api/v1`. All authenticated except portal share‑links. JSON. Standard CRUD
(`GET list`, `GET /:id`, `POST`, `PATCH /:id`, `DELETE /:id`) for each resource below,
plus the workflow actions called out.

```
/leads                          + POST /leads/:id/convert        → creates Client (+ scope snapshot)
/clients
/lead-sources
/quotes                         + POST /quotes/:id/send  + /quotes/:id/accept
/sites                          + POST /sites/:id/rooms (measured area per scopeItemId)
/designs                        + POST /designs/:id/submit  + /designs/:id/approve   (gate)
/boqs                           + POST /boqs/from-design/:designId   + /boqs/:id/sign
                                + GET  /boqs/:id/quote     (derive priced quote = cost×(1+margin))
                                + GET  /boqs/:id/takeoff   (roll‑up materials → indent)
/contracts                      + POST /contracts/from-boq/:boqId    (the anchor; builds paymentSchedule)
/contracts/:id/work-packages    (split by trade; assign subcontractor)
/contracts/:id/schedule         (rooms seeded from scopeSnapshot + days)
/contracts/:id/change-orders    + POST /:coId/approve   (adds to contractValue + milestone)
/contracts/:id/finance          → GET project P&L { contractValue, actuals, margin, marginPct }
/procurement/indents            (from /boqs/:id/takeoff)
/procurement/purchase-orders    + POST /po/:id/receive (GRN)  + /po/:id/issue
/vendors
/invoices                       + POST /invoices/:id/pay (records receipt)
/materials   /items             (masters)
/property-types  /terms  /schedule-config   (masters)
/activity?entityType=&entityId=
/notifications/send             (single send point — mail/SMS)
/auth/login  /auth/client-login  /me
```

**Continuity‑critical endpoints** (these are what stop the leaks):
- `POST /leads/:id/convert` — snapshots the chosen preset's scope items (each with a
  generated `scopeItemId`) onto the new Client so rooms/materials/days survive. *(Leak‑1)*
- `POST /boqs/from-design/:designId` — seeds BOQ sections from the approved design's
  rooms, carrying `scopeItemId` and survey `measuredArea`. *(Leak‑2,3,4)*
- `GET /boqs/:id/quote` — returns `cost × (1+marginPercent)`; margin persisted. *(Leak‑5)*
- `POST /contracts/from-boq/:boqId` — creates the anchor + payment schedule from
  `MilestoneConfig × contractValue`. *(Leak‑6)*
- `GET /boqs/:id/takeoff` → `POST /procurement/indents` → PO → GRN captures
  `actualCost`. *(Leak‑5 material)*
- `GET /contracts/:id/finance` — budget vs actual → margin. *(Leak‑7)*

---

## 5. Database schema (relational sketch)

Postgres recommended (JSONB for `sections`/`scopeItems`/`snapshot`/`checklist`).

```sql
lead_sources(id pk, name, channel, cost_per_lead)
users(id pk, name, email uniq, password_hash, role, client_id fk null)
leads(id pk, client_name, phone, scope, location, status, lost_reason,
      investment, possession_date, source_id fk, preset_key, property_type,
      assigned_to fk, created_at)
clients(id pk, name, phone, email, location, address, gstin, size_range,
        payment_status, source_lead_id fk, created_at)

quotes(id pk, parent_type, parent_id, preset_key, property_type,
       scope_items jsonb, margin_percent, subtotal, gst, grand_total,
       status, snapshot jsonb, sent_to, sent_at, created_at)

sites(id pk, client_id fk, lead_id fk, property_preset, site_type, address,
      supervisor_id fk, status, progress, target_date, checklist jsonb,
      survey_media jsonb, rooms jsonb, notes)
designs(id pk, site_id fk, version, stage, deliverables jsonb,
        finishes_by_room jsonb, approved_by fk, approved_at)

boqs(id pk, parent_type, parent_id, contract_id fk null, based_on_preset,
     design_id fk null, status, revision, client jsonb, project jsonb,
     margin_percent, sections jsonb, discount jsonb, payment_terms jsonb,
     created_at, updated_at)

contracts(id pk, client_id fk, boq_id fk, quote_id fk, scope_snapshot jsonb,
          base_value, variations_value, contract_value, status, signed_at,
          timeline_days, payment_schedule jsonb, terms_id fk, created_at)

work_packages(id pk, contract_id fk, scope_item_id, trade, title,
              subcontractor_id fk, work_order_value, actual_cost, status,
              schedule_room_id)
vendors(id pk, name, type, trade, gstin, contact, outstanding)

indents(id pk, contract_id fk, items jsonb, created_at)
purchase_orders(id pk, contract_id fk, vendor_id fk, items jsonb, total,
                actual_cost, status, expected_on, created_at)
grns(id pk, po_id fk, received_items jsonb, received_on, received_by fk)
issues(id pk, contract_id fk, material_id fk, qty, scope_item_id,
       issued_on, issued_by fk)

schedules(id pk, contract_id fk, site_id fk, work_start_date, rooms jsonb)
change_orders(id pk, contract_id fk, description, scope_item_id, items jsonb,
              value, status, approved_at, adds_milestone)
invoices(id pk, contract_id fk, milestone_id, amount, gst, total, status,
         due_on, paid_on, receipt_ref, snapshot jsonb)

materials(id pk, name, category, specifications, brand, vendor, unit, rate, hsn)
items(id pk, description, category, hsn, unit, rate, gst_percent,
      materials jsonb, tags, usage_count)
property_types(id pk, name)
terms(id pk, preset, title, body)
schedule_config(id pk, room_presets jsonb, statuses jsonb, escalation jsonb)

activity_log(id pk, entity_type, entity_id, type, payload jsonb,
             actor_id fk, created_at)
```

Indexes: every `*_id fk`, `leads.status`, `boqs.parent_id`, `contracts.client_id`,
`invoices.contract_id`, `activity_log(entity_type, entity_id)`.

---

## 6. localStorage → API migration map

Current frontend keys (keep the same `*Storage.js` function *names* — swap the body
from `localStorage` to `fetch`):

| Current localStorage key | Module | Becomes endpoint |
|---|---|---|
| `boq_index`, `boq_<id>` | `boqStorage.js` | `/boqs` |
| `quoteMaster` | `QuotePresets.js` | `/presets` (or `/schedule-config` masters) |
| `quotes_<parentId>`, `leadDocuments_<id>` | `QuotePresets.js` | `/quotes?parentId=` |
| `newClientsData`, `deletedClients` | `clientStorage.js` | `/clients` |
| `TableData` seed + adds | leads | `/leads` |
| site keys | `siteStorage.js` | `/sites` |
| schedule keys | `scheduleStorage.js` | `/schedules` |
| material/item/property/terms | masters | `/materials` `/items` `/property-types` `/terms` |
| *(new)* contract | `contractStorage.js` | `/contracts` |
| *(new)* procurement | `procurementStorage.js` | `/procurement/*` |
| *(new)* variations | `changeOrderStorage.js` | `/change-orders` |

Migration strategy: keep the storage modules as the single data‑access seam (they
already are). Phase 1 ships the new entities client‑side (localStorage) so the flow
works end‑to‑end now. Phase 2 replaces each module's internals with `fetch` to the
endpoints above — **no screen changes required** because screens only call the module
functions.

---

## 7. Auth, RBAC, audit, notifications

- **Auth**: JWT (access + refresh). Two realms: staff (`/auth/login`) and client
  portal (`/auth/client-login`, scoped to one `clientId`).
- **RBAC**: role on `users`. Examples — designer: read/write Design+BOQ; accounts:
  invoices+finance; supervisor: schedule+GRN; client: portal read + approvals only.
- **Audit**: every mutating route appends an `activity_log` row with `actorId`.
  This closes the CLAUDE.md gap "schedule activity log has no user identity."
- **Notifications**: single `POST /notifications/send` endpoint wraps mail/SMS
  (SES/Twilio). The frontend's `sendNotification` in `ProjectSchedule.jsx` (currently
  log‑only) calls this. All sends are also written to `activity_log`.

---

## 8. Recommended stack

- **Runtime**: Node + Fastify/NestJS (TypeScript) — mirrors the JS frontend.
- **DB**: Postgres + Prisma (JSONB for the document‑ish fields above).
- **Files**: S3‑compatible store; `fileStorage.js` already abstracts URL resolution.
- **Auth**: JWT + bcrypt/argon2.
- **Jobs**: a queue (BullMQ) for notifications, overdue‑invoice sweeps, schedule
  health/escalation recompute.
- **Validation**: shared Zod schemas mirroring the entity shapes in §2 so frontend
  and backend agree on the rails.

---

## 9. Build order (backend)

1. Auth + Users/Roles + activity_log (foundation).
2. Masters: materials, items, presets, property‑types, terms, schedule‑config.
3. Leads → Clients (+ convert with scope snapshot — **Rail 🟦 starts here**).
4. Sites → Designs (+ approval gate).
5. BOQ (+ from‑design seeding, margin, takeoff).
6. **Contract** (from‑BOQ, payment schedule — **Rail 💰 anchor**).
7. Procurement (indent→PO→GRN→issue — **Rail 🧱 + actuals**).
8. Work packages + subcontractors.
9. Schedule (seeded from scope snapshot).
10. Invoices + receipts; ChangeOrders.
11. **Finance/P&L** (budget vs actual — the executive payoff).
12. Portal endpoints + notifications.
13. Analytics/reports read models.
```
