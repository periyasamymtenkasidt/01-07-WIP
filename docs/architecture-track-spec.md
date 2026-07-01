# Architecture Track — Specification

> The second delivery pipeline, selected by the lead's `serviceTrack === "Architecture"`.
> Interiors fits out an existing space; Architecture **builds** one — so it diverges at
> the lead, adds a feasibility front-end, prices by fee, has a statutory-approval gate,
> and supervises a contractor instead of self-executing.

Status: spec for review. Engine (lead → portal → stage-gate → approval/revision) is shared
and already built; this defines what is **different** for Architecture.

---

## 1. Lead intake — track-aware fields

When `serviceTrack === "Architecture"`, the lead form swaps the interiors fields:

| Interiors field | Architecture replacement |
|---|---|
| Property preset (2BHK…) | **Project intent** (Residential building / Commercial / Mixed-use / Institutional / Industrial) |
| Possession date | **Target completion** (indicative; approval-dependent) |
| Package budget band | **Indicative project budget** (free text / range — *not* a package quote) |
| — | **Plot area** (sq ft / sq m / cents / acres) |
| — | **Plot / survey number, location** |
| — | **Land ownership status** (Owned / Under purchase / Disputed-unknown) |

Rule: **no package quote is offered at the lead for Architecture.** Pricing is a design
fee, set only after feasibility (section 4).

Shared fields (both tracks): client name, phone, email, inquiry source, location, segment,
serviceTrack, notes.

---

## 2. Phase 0 — Feasibility & Due Diligence  *(architecture-only front-end)*

Nothing is designed or priced until this clears. Three parallel work-streams, then a report.

### 2a. Land Legal / Title due diligence
- Title verification, ownership chain
- Encumbrance Certificate (EC), Patta / land records
- Litigation / dispute check
- Conversion status (agricultural → residential, if applicable)
- **Output:** legal clearance (Clear / Conditional / Blocked)

### 2b. Statutory / Planning check
- Zoning & land-use (is the intent permitted on this plot?)
- **FSI / FAR** (how much built-up area is allowed), ground coverage
- Setbacks, building height limit, road-width rules (DCR)
- Authority jurisdiction (Corporation / DTCP / CMDA / panchayat …)
- Required NOCs (fire, airport, environment, coastal — as applicable)
- **Output:** buildable envelope (max built-up area, height, footprint)

### 2c. Site / Land survey  *(different from interiors' measured survey)*
- Topographic / contour survey, plot dimensions, levels
- Soil test / geotechnical (Safe Bearing Capacity) — drives structure
- Orientation, access, existing features, utilities at site
- **Output:** survey drawings + soil report

### 2d. Feasibility Report (the gate)
- Synthesizes 2a–2c: what can be built, rough built-up area, indicative cost range
- **Go / No-Go decision** + recommended approach
- **Gate:** client accepts feasibility → proceed to Appointment. (Feasibility is often a
  small **paid** pre-service.)

---

## 3. The Architecture pipeline (stages, each a client gate)

Runs on the **same stage-gate engine** as interiors — different stage list:

| # | Stage | Client signs off | Key deliverables |
|---|---|---|---|
| 1 | **Concept / Schematic** | the direction & massing | site plan, massing, zoning, form options |
| 2 | **Design Development** | the developed design | detailed plans, sections, elevations; structural & MEP coordination |
| 3 | **Statutory Approvals** ★ | submission package (then *authority* approves) | sanction drawings, forms, NOCs → municipal **building permit** |
| 4 | **Construction Documents (GFC)** | buildable drawing set | working drawings, details, schedules, specs |
| 5 | **Tender** | contractor & price | tender BOQ, bid evaluation, contractor appointment |
| 6 | **Construction Administration** | progress + payment certs | site supervision, RFIs, quality, stage certificates |
| 7 | **Completion** | handover | snag list, **Occupancy Certificate (OC)**, as-builts |

★ **Statutory Approvals is unlike any interiors stage**: the gate is an *external authority*,
not the client. Model it as a stage whose "approval" is the **permit received** (with
status: Submitted / Queries / Sanctioned), and expect long, variable waits.

---

## 4. Fee model — staged design fee (not a BOQ)

Architecture is sold as a **design fee**, billed by stage (COA-style):

- Basis: **% of estimated project cost** OR **₹ per built-up sq ft** (set after feasibility).
- **Stage-weighted invoicing**, e.g.:
  - Concept/Schematic ~20% · Design Dev ~20% · Approvals ~15% · GFC ~20% · Tender ~5% · Construction Admin ~20%
- The **tender BOQ** (stage 5) is the *construction* cost the contractor bids — separate from
  the architect's fee.

Contrast: interiors BOQ = the price the firm itself executes for. Architecture has **two
numbers**: the firm's **fee** and the contractor's **construction cost**.

---

## 5. Execution model

| | Interiors | Architecture |
|---|---|---|
| Who builds | The firm (procurement + fit-out) | A **contractor** (architect supervises) |
| The firm's role in build | Executor | **Construction Administrator** — inspect, certify, instruct |
| Money in build | Material + labour BOQ | Certify contractor's running bills against tender |

---

## 6. Data-model implications

- `lead.serviceTrack` (done) drives intake + pipeline + pricing + execution.
- New **Architecture intake fields** on lead: `projectIntent`, `plotArea`, `plotNumber`,
  `landOwnership`, `targetCompletion`, `indicativeBudget` (replace preset/possession/quote).
- New **Feasibility record** (per project): legal status, buildable envelope (FSI, max area,
  height), survey/soil outputs, feasibility decision.
- **Pipeline config is data**: `INTERIORS_PIPELINE` (today's stages) and
  `ARCHITECTURE_PIPELINE` (section 3) — same engine reads the list for the project's track.
- **Fee schedule** record (architecture) vs **BOQ** (interiors).
- Statutory stage carries an **external-approval status** (not a client approval).

---

## 7. What's reused vs new

**Reuse as-is:** lead → proposal → won shell, client portal, stage-gate submit/approve/revise
loop, file deliverables, activity/audit, payment milestones, the generic stage engine.

**Generalize:** pipeline becomes a per-track **config** (not hardcoded 4 stages); lead intake
becomes track-aware.

**New for Architecture:** track-aware intake, the **Feasibility/Due-Diligence front-end**
(legal + planning + topo/soil + report), the architecture **stage list** incl. the
**statutory-approval gate**, **fee-based pricing**, and **construction administration**.

---

## 8. Build order

1. **Step 1 — Lead track switch.** ✅ done (segment → serviceTrack, defaulted & overridable).
2. **Step 1.5 — Track-aware lead intake.** Architecture leads show plot/land/intent; hide
   preset/possession; drop package-quote framing.
3. **Step 2 — Data-driven pipeline.** Turn the hardcoded stages into per-track config;
   interiors keeps today's stages, architecture gets section 3.
4. **Step 3 — Feasibility front-end.** The Phase-0 module (legal + planning + topo/soil +
   feasibility gate) for architecture projects.
5. **Step 4 — Fee model + Tender + Construction Admin.** Architecture pricing and the
   build-supervision stages.

Each step is independently shippable on the shared engine.
