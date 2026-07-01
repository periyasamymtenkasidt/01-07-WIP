# Lead Pipeline Workflow

Standard CRM lead-to-client pipeline used by this app. Mirrors the model used by HubSpot / Pipedrive / Salesforce, scaled down for an SMB design studio.

---

## 1. Pipeline at a Glance

```
                ┌─────────────── Linear (happy) path ───────────────┐
                │                                                   │
   Inquiry ──► Qualified ──► Proposal ──► Negotiation ──► Won ──► Converted
                │              │              │            │
                └──────────────┴──────────────┘            │
                               │                           │
                               ▼                           ▼
                          On Hold (paused)            Client record
                               │
                               ▼
                          Lost (with reason)
```

- **Linear path** = `Inquiry → Qualified → Proposal → Negotiation → Won → Converted`
- **Off-ramps** = `On Hold`, `Lost (with reason)` — terminal or paused, not steps on the line.

---

## 2. Stages

| # | Stage | What it means | Who/what advances it |
|---|---|---|---|
| 1 | **Inquiry** | Raw inbound. Form submitted, walk-in, referral, etc. | Auto on lead creation |
| 2 | **Qualified** | BANT/MEDDIC check passed — Budget, Authority, Need, Timeline | Sales rep clicks **Mark Qualified** |
| 3 | **Proposal** | Proposal/SOW emailed to client | Clicking **Send Proposal** sends email + advances stage |
| 4 | **Negotiation** | Active back-and-forth on price, scope, terms | Click **Move to Negotiation** |
| 5 | **Won** | Client verbally / contractually agreed | Click **Mark Won** |
| 6 | **Converted** | Lead becomes a Client record (with milestones) | Click **Convert to Client** |
| — | **On Hold** | Paused — client not ready | Click **Put on Hold** (resumable) |
| — | **Lost** | Closed-lost. Always captured with a **reason** | Click **Mark Lost** → reason modal |

---

## 3. Allowed Transitions

| From | Allowed targets |
|---|---|
| Inquiry | Qualified, On Hold, Lost |
| Qualified | Proposal (via Send Proposal), On Hold, Lost |
| Proposal | Negotiation, Won, On Hold, Lost (resend Proposal stays in Proposal) |
| Negotiation | Won, On Hold, Lost |
| Won | Converted (one-way) |
| Converted | — (terminal — work continues on the Client record) |
| On Hold | Qualified (resume) |
| Lost | — (terminal; deletion only) |

---

## 4. Lost Reasons (analytics)

Win/loss reporting is only useful if every Lost is tagged. Reasons:

- Price / Budget
- Chose Competitor
- Timing — Postponed
- No Decision
- Scope Mismatch
- Unresponsive
- Other

Optional free-text note for context.

---

## 5. Activity Timeline

Every status change and proposal email is logged automatically per-lead. Visible in the LeadEdit page **Activity Timeline** card. Entries:

- `status` events: `from → to` transitions, with lost reason / converted-client ID where applicable
- `email` events: recipient, subject, timestamp

Stored in `localStorage` under `leadActivity_<proposalId>` until a backend is wired in.

---

## 6. Action Buttons by Stage

Header actions on the LeadEdit page change with status:

| Status | Primary | Secondary | Always |
|---|---|---|---|
| Inquiry | Mark Qualified | Mark Lost | Put on Hold • Edit • Delete |
| Qualified | Send Proposal | Mark Lost | Put on Hold • Edit • Delete |
| Proposal | Mark Won | Move to Negotiation • Resend Proposal • Mark Lost | Put on Hold • Edit • Delete |
| Negotiation | Mark Won | Mark Lost | Put on Hold • Edit • Delete |
| Won | Convert to Client | — | Edit • Delete |
| Converted | View Client | — | Edit • Delete |
| On Hold | Resume | Mark Lost | Edit • Delete |
| Lost | — | — | Edit • Delete |

---

## 7. UI Mapping (Leads list)

The Leads page sub-tabs map to these statuses:

| Sub-tab | Statuses included |
|---|---|
| New Inquiries | Inquiry |
| Nurturing Inquiries | Qualified, Proposal, Negotiation, On Hold |
| Won Deals | Won, Converted |
| Dropped Inquiries | Lost |

Filter dropdown exposes every status individually for ad-hoc filtering.

---

## 8. Status Badge Colors

| Status | Badge |
|---|---|
| Inquiry | purple |
| Qualified | green |
| Proposal | blue |
| Negotiation | amber |
| Won | emerald |
| Converted | teal |
| On Hold | gray |
| Lost | red |

Defined once in `src/data/LeadStatusConfig.js` — used by Leads list, LeadEdit header badge, and the timeline icon backgrounds.

---

## 9. Code Map

| File | Role |
|---|---|
| `src/data/LeadStatusConfig.js` | Single source of truth: pipeline order, off-ramps, lost reasons, badge classes, activity log helpers |
| `src/pages/leads/Leads.jsx` | List view — sub-tab → status mapping, filter options, badge rendering |
| `src/pages/leads/LeadEdit.jsx` | Detail view — stepper, action buttons, off-ramp callouts, Lost reason modal, Email Proposal modal, activity timeline |
| `src/pages/leads/NewInquiriesform.jsx` | Create form — status pills sourced from config |
| `src/pages/leads/EditInquiryform.jsx` | Edit form — status pills sourced from config |
| `src/pages/leads/ConvertToClientForm.jsx` | Won → Client conversion (existing) |
| `src/data/TableData.jsx` | Mock data — uses standard statuses only |

---

## 10. What's Industry-Standard vs. What's Simplified

**Standard (we do):**
- Distinct Qualification gate before Proposal
- Negotiation as a separate stage
- Lost reason capture
- Stage-aware action buttons
- Per-lead activity timeline
- Linear stepper + off-ramp callouts

**Simplified (vs. enterprise CRMs):**
- One Lead == one Opportunity (no separate Account/Opportunity split). Fine for SMB; if a single client will run multiple deals over time, split into Accounts later.
- Email send is mocked — no real SMTP yet. Hook into your provider in `EmailProposalModal.handleSend`.
- Activity log lives in `localStorage`. Move to a backend table when API is ready.
- No assigned-rep / ownership field yet.
- No "next action" / "next follow-up date" field.

---

## 11. When Wiring a Real Backend

Replace these touchpoints — everything else can stay:

1. `localStorage` reads/writes in `Leads.jsx`, `LeadEdit.jsx`, and `LeadStatusConfig.js#getActivity/appendActivity` → real API calls.
2. `EmailProposalModal.handleSend` → real email provider (SendGrid / SES / Postmark).
3. `transitionStatus` in `LeadEdit.jsx` → POST `/api/leads/:id/status` instead of localStorage write.
4. `MOCK_STATUSES` in `Leads.jsx` → server-side filtering with the same status sets.
