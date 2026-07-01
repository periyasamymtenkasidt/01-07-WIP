# CRM Sales Pipeline — Industry Standard Workflow

A reference for how B2B CRMs (Salesforce, HubSpot, Pipedrive, Zoho) model the journey from a raw inbound inquiry to a paying, delivered client. Vendor-neutral.

---

## 1. The Full Pipeline

```
LEAD ─► QUALIFICATION ─► OPPORTUNITY ─► PROPOSAL ─► NEGOTIATION ─► WON/LOST ─► CLIENT ─► PROJECT/DELIVERY ─► INVOICE
```

Two halves:

- **Pre-sale (Lead → Won/Lost)** — owned by Sales. Goal: convert a stranger into a signed deal.
- **Post-sale (Client → Invoice)** — owned by Delivery / Account Management / Finance. Goal: deliver, retain, bill.

---

## 2. Stage by Stage

| # | Stage | What happens | Typical sub-statuses |
|---|---|---|---|
| 1 | **Lead** | Raw inquiry captured (form, referral, ad, cold outreach) | `New`, `Contacted` |
| 2 | **Qualification** | BANT/MEDDIC check — does Budget, Authority, Need, Timeline exist? | `Qualified`, `Unqualified`, `Nurture` |
| 3 | **Opportunity** | Qualified lead becomes a deal with a $ value + close date | `Discovery`, `Demo`, `Solutioning` |
| 4 | **Proposal** | Quote / SOW / proposal sent (usually emailed) | `Proposal Sent`, `Under Review` |
| 5 | **Negotiation** | Price, scope, terms back-and-forth | `Negotiating`, `Verbal Yes` |
| 6 | **Closed** | Final outcome | `Won` or `Lost` (with reason) |
| 7 | **Client** | Won deals convert — lead/opportunity links to a client account | `Active Client` |
| 8 | **Delivery** | Project milestones, kickoff, deliverables | `In Progress`, `On Hold`, `Delivered` |
| 9 | **Invoice** | Billing tied to milestones or retainer | `Draft`, `Sent`, `Paid`, `Overdue` |

---

## 3. Why Each Stage Exists

- **Lead** — every inbound deserves a record. Without it, you can't measure source ROI.
- **Qualification** — the most-skipped stage and the one that protects rep time. Don't send proposals to unqualified leads.
- **Opportunity** — separates the *person/company* from the *deal*. One client can have many opportunities over time. Skipping this loses deal history.
- **Proposal** — standardizes what was sent and when, so revisions are tracked.
- **Negotiation** — visibility into deals that are stuck. Without this stage, "Proposal Sent" deals look the same on day 1 and day 60.
- **Closed (Won/Lost)** — terminal. Lost must always have a *reason* — that's where pipeline analytics value comes from.
- **Client** — a different kind of record. Has billing, milestones, retention metrics — none of which apply to leads.
- **Delivery** — operational, not sales. But linked back to the deal so revenue recognition matches scope.
- **Invoice** — closes the financial loop.

---

## 4. The BANT Qualification Gate

Most-cited qualification framework. A lead is **Qualified** only if it passes all four:

| Letter | Question |
|---|---|
| **B**udget | Can they afford it? |
| **A**uthority | Are we talking to a decision-maker (or a path to one)? |
| **N**eed | Is the pain real and current? |
| **T**iming | Are they buying soon, or "someday"? |

Variations: **MEDDIC** (enterprise sales), **CHAMP** (modern), **GPCT** (HubSpot). All do the same job.

---

## 5. Lost Reasons (Always Required)

A `Lost` status without a reason is dead data. Standard reasons:

- Price / Budget
- Chose Competitor (which one?)
- Timing — Postponed
- No Decision (deal stalled)
- Scope Mismatch
- Unresponsive
- Other (free text required)

This is what powers win/loss reports, competitor analysis, and pricing decisions.

---

## 6. Lead Source (Always Captured)

Where did this lead come from? Common values:

- Referral
- Website (organic / paid)
- Social Media (LinkedIn, Instagram, etc.)
- Cold Outreach
- Event / Trade Show
- Walk-in
- Partner

This drives marketing ROI: cost-per-lead × win-rate-by-source = which channels actually pay.

---

## 7. The Activity Timeline

Every CRM has one. It's a chronological log per lead/opportunity:

- Status changes (`Inquiry → Qualified`)
- Emails sent / received
- Calls logged
- Meetings held
- Notes added
- Documents shared

Replaces "ask the rep what's going on with this deal."

---

## 8. Lead vs Opportunity — The Most Misunderstood Distinction

| | **Lead** | **Opportunity** |
|---|---|---|
| Represents | A person / company | A specific deal |
| Lifetime | Until qualified or disqualified | Until Won or Lost |
| Has $ value? | No | Yes |
| Has close date? | No | Yes |
| Cardinality | 1 person can become 1 lead | 1 client can have many opportunities over years |

**Why it matters:** if you skip the Opportunity layer and a repeat client buys from you again, you either overwrite the old record (lose history) or create a duplicate person (mess your data).

For SMBs with rare repeat business, you can collapse Lead + Opportunity into one record (HubSpot's simpler model). For agencies / studios with recurring clients, keep them separate.

---

## 9. The Off-Ramps

Not every deal moves forward. The two universal off-ramps:

| Off-ramp | Meaning | Resumable? |
|---|---|---|
| **On Hold / Nurture** | Client paused. Re-engage in 30/60/90 days. | Yes |
| **Lost** | Closed-lost with reason. | No (open a new opp if they come back) |

These are *not* steps on the pipeline — they're terminal/parallel states. UI should render them as callouts, not progress indicators.

---

## 10. How Major CRMs Model This

| CRM | Model |
|---|---|
| **Salesforce** | `Lead → Opportunity (with stages) → Account/Contact` — full enterprise split |
| **HubSpot** | `Lead → Deal (pipeline stages) → Customer` — simpler, SMB-friendly |
| **Pipedrive** | `Lead → Deal (custom pipeline) → Won/Lost` — pipeline-first UX |
| **Zoho CRM** | `Lead → Deal → Account/Contact` — Salesforce-style |

All four use the **same underlying stages** — they differ in how strictly they separate Lead vs Opportunity vs Account.

---

## 11. Pipeline Metrics You Can Now Measure

Once stages are correctly modeled, these reports become trivial:

| Metric | Why it matters |
|---|---|
| **Conversion rate by stage** | Where deals leak (e.g. Qualified → Proposal drops 70%? rep can't write proposals fast enough) |
| **Average sales cycle** | Time from Lead → Won. Trend it over time. |
| **Win rate** | Won ÷ (Won + Lost). By rep, by source, by deal size. |
| **Pipeline coverage** | Open opportunity value ÷ quarterly target. Healthy = 3–5×. |
| **Lost reasons distribution** | "We lost 40% on price" → revisit pricing or positioning |
| **Source ROI** | Revenue won ÷ marketing spend by source |
| **Stage velocity** | Avg days a deal spends in each stage. Long stalls = unqualified or ghosted. |

---

## 12. Common Mistakes to Avoid

1. **Skipping qualification.** Sending proposals to everyone tanks win rate and burns rep time.
2. **Lost without reason.** Loses 100% of analytical value.
3. **Treating "Lost" as a pipeline step.** It's a terminal state, not a stage on the line. Don't render it on a horizontal stepper between Won and Converted.
4. **No Activity Timeline.** When the rep quits, the deal context dies with them.
5. **Free-text status fields.** "qualified", "Qualified ", "QUALIFIED", "qualifid" — analytics break instantly. Use enums.
6. **Auto-progressing stages.** Stage changes should be deliberate human decisions, not "if email sent then status = Proposal." Side effects yes, auto-stage no.
7. **No Lead Source.** Marketing can't measure ROI; sales can't tell which channels send qualified leads.
8. **Merging Lead + Client into one record.** Lead has different fields (source, qualification) than Client (billing, contracts).

---

## 13. Minimal Viable CRM Schema

If you're building from scratch, these are the must-have fields:

**Lead / Opportunity:**
- `id`, `created_at`, `owner_id`
- `contact_name`, `contact_email`, `contact_phone`
- `company_name` (if B2B)
- `source` (enum)
- `stage` (enum — Inquiry, Qualified, Proposal, Negotiation, Won, Lost, On Hold)
- `value` (money), `close_date_expected`
- `lost_reason` (enum, required when stage=Lost)
- `lost_note` (text, optional)

**Activity:**
- `lead_id`, `type` (status_change | email | call | note | meeting), `at`, `actor_id`, `payload` (json)

**Client (created on Won):**
- `id`, `lead_id` (FK), `joined_at`
- billing fields, account manager, status (Active / Churned)

**Invoice:**
- `client_id`, `amount`, `due_date`, `status` (Draft / Sent / Paid / Overdue), `paid_at`

That's the spine. Everything else (custom fields, tags, scoring, automations) sits on top.

---

## 14. TL;DR

A standard CRM is **three things**:

1. A **stage-tracked pipeline** with a Qualification gate, Negotiation visibility, and Lost-reason capture.
2. An **activity timeline** per record so context survives people leaving.
3. A clean **Lead → Opportunity → Client** separation so repeat business doesn't corrupt history.

Get those three right and every analytics question — win rate, source ROI, sales cycle, pipeline coverage — falls out for free.
