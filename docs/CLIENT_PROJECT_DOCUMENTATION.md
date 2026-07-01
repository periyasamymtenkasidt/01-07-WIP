# WIP — Design & Build Management Platform

## Client Project and Process Documentation

| Document control | Details |
|---|---|
| Document title | WIP Design & Build Management Platform — Client Documentation |
| Prepared for | Client stakeholders, operations teams, project managers, and administrators |
| Prepared by | Project Delivery Team |
| Version | 1.0 |
| Date | 22 June 2026 |
| Classification | Client-facing project handover document |

---

## 1. Executive summary

WIP is an integrated business management platform for architecture and interior
design practices. It connects the complete customer and project lifecycle—from
the first inquiry through proposal, site survey, design approval, BOQ,
procurement, execution, billing, and management reporting.

The platform is designed to reduce repeated data entry and preserve continuity
across four critical areas:

- **Scope:** the approved rooms and work items remain traceable throughout delivery.
- **Cost:** proposal values, measured quantities, BOQ costs, procurement, and billing remain connected.
- **Materials:** selected specifications flow from master data into survey, BOQ, and procurement.
- **Time:** planned durations flow into project schedules and operational tracking.

The result is a single operational workspace for sales, design, project delivery,
procurement, accounts, management, and the client.

---

## 2. Project objectives

The solution has been created to:

1. Standardize the lead-to-project conversion process.
2. Create proposals from controlled master templates.
3. Capture site measurements and evidence against approved scope.
4. Prevent unapproved cost drift before design begins.
5. Generate measurement-based BOQs without re-entering project data.
6. Formalize design submissions, revisions, and client approvals.
7. Connect BOQ materials to procurement and vendor workflows.
8. Give clients structured access to quotes, designs, milestones, invoices, and support.
9. Provide management visibility through pipeline, analytics, and reports.

---

## 3. Solution coverage

### 3.1 Internal business platform

| Module | Business purpose |
|---|---|
| Dashboard | High-level operational and commercial overview |
| Leads | Inquiry capture, qualification, proposal preparation, and conversion |
| Deals | Commercial pipeline and negotiation tracking |
| Clients | Permanent client record, project information, documents, and financial context |
| Projects | Active project delivery and schedule visibility |
| Site Visit | Survey assignment, measurements, photographs, feasibility, and design handoff |
| Design Pipeline | Stage-based deliverable submission, revision, and approval |
| BOQ | Detailed quantity, rate, taxation, discount, and cost preparation |
| Procurement | Material take-off, RFQ, vendor comparison, purchase order, and receipt workflow |
| Accounts | Billing and financial operations |
| Master | Proposal presets, work items, materials, schedules, and standard terms |
| Pipeline | Cross-business stage visibility |
| Analytics | Performance and trend monitoring |
| Reports | Structured operational and management outputs |
| Settings and Support | Platform configuration and assistance |

### 3.2 Client portal

The client portal provides controlled access to:

- Project dashboard
- Quotes and commercial documents
- Site visit calendar
- Design and render approvals
- Payment milestones
- GST invoices
- Support communication

### 3.3 External vendor interaction

Vendors can receive a controlled RFQ link and submit quotations without access
to the internal administration platform.

---

## 4. End-to-end business process

```text
Inquiry
   ↓
Lead Qualification
   ↓
Property Preset + Project Type Selection
   ↓
Proposal / Quote
   ↓
Negotiation and Approval
   ↓
Client Conversion
   ↓
Site Assignment and Survey
   ↓
Survey Freeze / Feasibility Approval
   ↓
Design Stages and Client Approvals
   ↓
Measurement-Based BOQ
   ↓
Procurement and Vendor Award
   ↓
Execution and Progress Tracking
   ↓
Milestone Billing, Reporting, and Handover
```

### 4.1 Lead and proposal

1. The sales team records the inquiry, source, contact information, location,
   budget range, expected timeline, and service track.
2. For an interiors project, the appropriate property preset and property type
   are selected.
3. The proposal is populated from Proposal Master using standardized rooms,
   work descriptions, rates, quantities, durations, materials, inclusions,
   exclusions, and terms.
4. The proposal may be reviewed and revised before being sent.
5. Once commercially agreed, the lead is converted into a client and project.

### 4.2 Site assignment

1. The project site is created from the converted client.
2. A surveyor or site supervisor is assigned.
3. Assignment changes the site to **Survey** status.
4. The approved proposal scope is snapshotted for the site. Later changes to a
   master template do not silently alter the active site survey.

### 4.3 Interiors survey

For each approved room and work item, the surveyor can record:

- Length, breadth or height, as applicable
- Number of repeated units
- Calculated measured quantity
- Work specification or quality grade
- Supporting photographs
- Additional on-site draft items

Every work item must have a valid measurement and supporting photograph before
the project can move into Design.

#### Quantity rules

| Unit type | Calculation |
|---|---|
| Area | Length × Breadth (or Height) × Number |
| Running length | Length × Number |
| Count / lump sum | Entered quantity |

#### Proposal control

The measured total may proceed when it is:

- Below the approved proposal total; or
- Up to **₹15,000 above** the approved proposal total.

If the measured value exceeds `Proposal Total + ₹15,000`, Design is blocked
until the commercial difference is reviewed.

### 4.4 Architecture feasibility

Architecture projects follow a feasibility gate instead of the interiors
measurement survey. Legal, planning, and land-survey streams are reviewed,
including ownership, zoning, FSI, setbacks, authority requirements, plot
dimensions, soil information, and supporting documents.

Design can start only after the required streams are cleared and a **Go**
decision is recorded.

### 4.5 Survey freeze and design handoff

When the survey is complete:

1. Measurements, proposal basis, specifications, and photographs are frozen.
2. The site changes from **Survey** to **Design**.
3. A versioned Design Pipeline is created.
4. The frozen survey becomes the design team's read-only Site Basis.

If re-measurement is required, an authorized operational user can unlock the
survey. The current design flow is archived, the site returns to Survey, and any
generated BOQ is marked stale until a revised survey is frozen and regenerated.

### 4.6 Design approval stages

#### Interiors

1. Concept Design
2. Design Development
3. Working Drawings
4. BOQ & Costing

#### Architecture

1. Schematic Design
2. Design Development
3. Statutory Approvals
4. Construction Documents
5. Tender
6. Construction Administration

Each stage follows a controlled cycle:

```text
Drafting → Submit to Client → Approve
                         ↘ Request Revision → Revised Submission
```

Revision rounds are recorded. Revisions beyond the included allowance can be
identified as billable.

### 4.7 BOQ and costing

The BOQ stage separates two commercial views:

- **Quoted:** the original Proposal Master line amounts, including GST in the total.
- **Measured:** frozen site quantities priced using the approved work rate or selected composite specification rate.

The BOQ is registered in the main BOQ module and remains linked to its site and
scope items. It supports:

- Sections by room/category
- Stable scope references
- Dimensions and quantities
- Units and HSN codes
- Material specifications
- GST and discounts
- Labour and contingency allowances
- Payment terms
- Notes, inclusions, exclusions, validity, and warranty
- Revisions, preview, sending, and approval

Manual quantity changes remain possible, but the editor displays a survey-drift
warning when the quantity no longer matches the frozen site measurement.

### 4.8 Procurement

The approved BOQ supports the following procurement cycle:

```text
BOQ Material Take-off
        ↓
Request for Quotation
        ↓
Vendor Quotations and Comparison
        ↓
Vendor Award
        ↓
Purchase Order
        ↓
Goods Receipt / Delivery Tracking
```

This maintains traceability between the specified work, required material,
selected vendor, committed cost, and delivered goods.

### 4.9 Execution, billing, and reporting

Project progress is derived from the delivery schedule. Sites move into
**In Progress** when execution starts and **Completed** when scheduled work is
finished. Payment milestones, GST invoices, procurement commitments, and
project reporting provide the commercial closeout path.

---

## 5. Master-data structure

Master data should be maintained by nominated administrators.

| Master | Controls |
|---|---|
| Proposal Master | Property presets, property types, rooms, scope, quantities, amounts, and durations |
| Item Master | Reusable work descriptions, units, rates, recipes, materials, and taxation |
| Material Master | Material names, specifications, units, base rates, HSN, and GST |
| Rate Build-up | Economy, Premium, and Luxury composite rates including material, labour, wastage, overhead, and margin |
| Schedule Master | Standard room/work durations and execution planning defaults |
| Terms Master | Inclusions, exclusions, commercial terms, warranty, and validity |

### Governance recommendation

- Restrict master editing to nominated administrators.
- Review rates on an agreed monthly or quarterly cycle.
- Do not edit a master to alter an already approved client commitment.
- Create revisions or new presets when the commercial offer changes materially.
- Preserve stable scope and material identifiers during updates.

---

## 6. User roles and responsibilities

| Role | Primary responsibilities |
|---|---|
| Sales / CRM Executive | Lead capture, qualification, proposal coordination, follow-up |
| Design Coordinator | Proposal configuration, design stage management, deliverable submission |
| Surveyor / Site Supervisor | Site measurements, photographs, specifications, site notes |
| Project Manager | Survey review, design gates, schedule, execution, change control |
| Estimator / Quantity Surveyor | BOQ review, rates, quantities, taxation, commercial validation |
| Procurement Team | Take-off, RFQ, vendor comparison, PO, delivery coordination |
| Accounts Team | Milestones, invoices, receipts, taxation, financial reporting |
| Administrator | Users, master data, configuration, governance, audit support |
| Client | Quote review, design approval, milestone visibility, invoices, support |
| Vendor | RFQ response and commercial submission through shared vendor access |

Final role-based permissions must be enforced by the production identity and
backend service. Unlocking surveys, approving BOQs, changing master rates, and
issuing purchase orders should be restricted actions.

---

## 7. Information and document controls

### 7.1 Controlled records

The following records should be treated as controlled project documents:

- Sent proposals and revisions
- Frozen site survey basis
- Design submissions and client decisions
- BOQ revisions and approvals
- Vendor quotations and comparisons
- Purchase orders and receipts
- GST invoices and payment records
- Approved changes and variations

### 7.2 Audit expectations

Every production transaction should record:

- Record ID and revision
- User or actor
- Date and time
- Previous and new state
- Approval or rejection decision
- Comment or reason
- Related client, project, site, and contract IDs

### 7.3 File handling

Survey photographs and design files are stored separately from lightweight
business records. This avoids browser storage limits and supports reliable
preview and retrieval.

---

## 8. Professional operating procedure

### Before creating a proposal

- Confirm the correct property preset and type.
- Confirm that master rates and taxes are current.
- Review scope, quantities, inclusions, exclusions, and delivery duration.

### Before freezing a survey

- Verify every work has a measurement.
- Verify every work has photographic evidence.
- Confirm the selected specification/grade.
- Review custom on-site items.
- Confirm the measured value is within the approved commercial limit.

### Before submitting a design stage

- Verify file names and revision numbers.
- Confirm all deliverables required for the stage are attached.
- Record internal review before client submission.

### Before issuing a BOQ

- Reconcile quoted and measured totals.
- Investigate survey-drift warnings.
- Confirm HSN, GST, discounts, labour, and contingency.
- Confirm payment terms, validity, warranty, inclusions, and exclusions.
- Ensure the linked survey is not marked stale.

### Before issuing a purchase order

- Use the latest approved BOQ revision.
- Compare vendor quotations on equivalent scope.
- Verify quantities, rates, tax, delivery address, and delivery date.
- Record approval before award.

---

## 9. Exception handling

| Exception | Required response |
|---|---|
| Survey exceeds proposal by more than ₹15,000 | Stop Design handoff and obtain commercial review |
| Site must be re-measured | Unlock survey, archive design history, revise and re-freeze |
| BOQ marked stale | Do not issue; regenerate after the revised survey is frozen |
| Quantity differs from site measurement | Review survey-drift warning and record justification |
| Client requests design changes | Record revision request and submit a new round |
| Revision exceeds included rounds | Mark as billable and obtain commercial approval |
| Vendor scope differs | Normalize scope before comparison or issue clarification |
| Storage/save error appears | Stop the transaction, retain source documents, and contact support |

---

## 10. Application structure and technical handover

The application uses a modular front-end architecture.

```text
src/
├── assets/              Brand and static visual assets
├── components/          Shared user-interface components
├── data/                Business rules and current persistence services
├── helperConfigData/    Navigation and shared configuration
├── layouts/             Internal and client portal layouts
├── pages/               Business modules and screens
│   ├── leads/
│   ├── clients/
│   ├── projects/
│   ├── sites/
│   ├── boq/
│   ├── procurement/
│   └── master/
├── routes/              Protected internal, client, and public routes
├── utils/               Formatting, file storage, and shared helpers
└── index.css             Global styling system
```

### Technology profile

| Area | Technology |
|---|---|
| User interface | React |
| Build system | Vite |
| Navigation | React Router |
| Styling | Tailwind CSS |
| Form handling | React Hook Form and Yup |
| Icons | Lucide React and React Icons |
| Current structured persistence | Browser localStorage |
| Current file persistence | IndexedDB |

### Current release boundary

The current repository is a front-end functional implementation. Structured
business data is presently stored in the browser, while uploaded files use
IndexedDB. This is suitable for demonstration, workflow validation, and
single-browser controlled use.

For production multi-user operation, the platform requires the planned backend,
database, authentication, role-based authorization, server-side file storage,
audit logging, backups, and deployment monitoring. The backend blueprint is
maintained separately in `docs/BACKEND.md`.

---

## 11. Security and production readiness

Before production launch, the following controls are recommended:

1. Central user authentication and secure session management.
2. Role-based permissions for every sensitive action.
3. Encrypted network communication and secure server-side storage.
4. Immutable approval and financial audit logs.
5. Automated database and document backups.
6. Recovery procedures with tested restore points.
7. Environment separation for development, testing, and production.
8. Input validation and server-side authorization.
9. Monitoring for application errors, failed jobs, and storage capacity.
10. Data retention and privacy policies appropriate to the client's jurisdiction.

---

## 12. Client acceptance checklist

### Business validation

- [ ] Lead and proposal workflow matches the agreed sales process.
- [ ] Property presets and types are correctly configured.
- [ ] Proposal totals and taxes are approved.
- [ ] Survey calculation rules are accepted.
- [ ] The ₹15,000 Design handoff control is accepted.
- [ ] Design stages and revision allowances are accepted.
- [ ] BOQ format, taxes, discounts, and payment terms are accepted.
- [ ] Procurement approval flow is accepted.
- [ ] Client portal content and permissions are accepted.

### Technical validation

- [ ] Supported browsers and devices are agreed.
- [ ] Production hosting and domain are agreed.
- [ ] User roles and access matrix are approved.
- [ ] Backend and database deployment are completed.
- [ ] Backup and recovery tests are completed.
- [ ] Security and privacy review is completed.
- [ ] User acceptance testing is signed off.
- [ ] Administrator and end-user training is completed.

---

## 13. Recommended implementation phases

| Phase | Outcome |
|---|---|
| 1. Workflow validation | Client confirms process, terminology, masters, and documents |
| 2. Backend integration | Central APIs, database, file storage, audit, and permissions |
| 3. Data preparation | Client, master, vendor, opening project, and financial data migration |
| 4. User acceptance testing | Role-based scenarios tested with client representatives |
| 5. Training and pilot | Controlled rollout to nominated users and projects |
| 6. Production launch | Approved deployment, monitoring, support, and backups |
| 7. Stabilization | Issue resolution, adoption review, and improvement backlog |

---

## 14. Support and change management

All requested changes should be documented with:

- Business reason
- Requested outcome
- Affected roles and modules
- Priority
- Acceptance criteria
- Approval owner
- Target release

Changes affecting pricing, taxation, approvals, contracts, procurement, or
financial reporting should receive business-owner approval before release.

---

## 15. Conclusion

WIP provides a professional foundation for managing an architecture and
interiors business as one connected operating system. Its primary strength is
continuity: the project scope established during proposal preparation remains
connected to site truth, design approvals, costing, procurement, execution,
billing, and reporting.

Successful production adoption depends on three disciplines: controlled master
data, stage-gate approvals, and a secure centralized backend. With these in
place, the platform can serve as the client's operational source of truth from
inquiry through project handover.

