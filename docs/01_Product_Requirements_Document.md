# Field Office Progressive Web App — Product Requirements Document

| | |
|---|---|
| **Document** | 01 — Product Requirements |
| **Product** | Field Office PWA — Vehicle Registration (VR) & Driver License (DL) |
| **Version** | 1.1 |
| **Date** | 13 August 2026 |
| **Status** | Draft for review |
| **Phase** | Requirements & Design (pre-implementation) |

---

## 1. Purpose

This document defines what the Field Office Progressive Web App is, who it serves, what it must do, and what it explicitly will not do in Phase 1. It is the controlling specification for design and build.

Companion documents:

- `02_Functional_and_Form_Specification.md` — screen-level behaviour and form field inventory
- `03_Technical_Architecture_and_Data_Model.md` — components, APIs, data handling, security
- `04_Client_Requirements_Alignment.md` — how this set maps to the client requirements document
- `PROJECT_GUIDE.md` — plain-English overview

**Version 1.1** incorporates the client requirements document (`../client_docs/PWA_User_Flow.pdf`, Jothi Periasamy, Project Lead): multiple entry points, record validation, format validation rules and the token barcode. Gaps in that document are tracked in document 04.

---

## 2. Background

Customers arriving at a DMV field office take a queue token and wait, typically 20–45 minutes at peak. That waiting time is currently dead time. Two failures follow from it:

1. **Data entry happens at the counter.** The technician keys in the application while the customer stands there and the queue grows behind them.
2. **Customers arrive unprepared.** Missing documents or an incomplete form means the transaction fails and the customer must return — a second visit, a second wait, a second token.

The lobby wait is not itself removable; it is a function of staffing and demand. What *is* removable is the dead time inside it.

---

## 3. Product Thesis

> **Convert waiting time into completed paperwork.**

The customer scans a QR code posted in the office, receives their place in the queue on their own phone, and fills out their application while they wait. By the time their number is called, the application is complete and waiting on the technician's screen.

The product is not primarily a wait-time reducer. It is an **engagement and preparation layer** over an existing queue. Reduced counter handling time is the consequence, not the mechanism.

---

## 4. Users

| User | Role in the system | Primary need |
|---|---|---|
| **Customer** | Scans QR, takes token, completes application, asks questions | Know how long, and not waste the wait |
| **Field Office Technician** | Calls the token, retrieves the submitted application, verifies and processes | The data already entered and legible |
| **Office Manager** | Monitors queue and adoption | Throughput and fewer failed transactions |
| **DMV IT** | Owns queue system, hosting, security posture | Integration that does not expand attack surface |

---

## 5. Scope

### 5.1 In Scope — Phase 1

**Customer-facing PWA**

- Office-aware entry through five routes (§6.5): QR posters, short URL, lobby staff, digital signage, and the link in appointment confirmations
- Welcome screen: office name, address, hours, current wait, office layout
- Service selection: Vehicle Registration or Driver License
- Digital queue token with live position and estimated wait
- **Vehicle Registration:** in-app completion of form REG 343
- **Driver License:** guided hand-off to the existing DMV online application (see §6.2)
- Document and fee checklists per service
- Chatbot answering VR and DL questions, scoped and sourced
- Format validation as the customer types (§8, FR-13a)

**Staff-facing Officer View**

- Look up a token number by typing it, or by scanning the barcode on the customer's screen
- Review, correct, and print or push to the counter system
- Mark transaction complete, which purges the record

### 5.2 Out of Scope — Phase 1

- Payments and any financial transaction
- Customer login, accounts, or saved profiles
- Appointment booking (already exists at dmv.ca.gov)
- Services other than VR and DL
- Any DMV service not tied to a field office visit
- Replacing wet signatures with electronic signatures (see §6.3)
- Record validation against DMV vehicle and driver systems — deferred to Phase 2 (§6.6)

---

## 6. Key Design Decisions

### 6.1 The token number is the identity

The queue token — e.g. `A-042` — is the only identifier linking a customer's phone to their application and to the technician's screen. There is no login, no account, and no email address.

**Consequence:** a personalised handoff with zero authentication on the customer side. This single decision is what keeps the app lightweight and keeps it out of identity-management scope.

### 6.2 Driver License links out; Vehicle Registration is built

The DMV **already operates an online DL application** (eDL 44) at `edl.dmv.ca.gov`. It issues a confirmation number, and field office staff can already look that number up. Average completion is 9 minutes — well within a typical lobby wait.

Rebuilding DL 44 would duplicate a working DMV system and would require this product to hold SSN and full identity data.

**Decision:**

- **DL path** — the PWA hands off to the existing eDL 44 application, then captures only the returned **confirmation number** against the token. This product stores no DL personal data whatsoever.
- **VR path** — REG 343 has no online pre-fill equivalent. This is where the PWA creates genuinely new value, and where the build effort goes.

This also satisfies the architectural principle already stated in the scope deck: *hosted DMV applications are linked, not embedded.*

**Known friction:** eDL 44 requires a DMV account with two-factor authentication. For a customer already standing in the lobby this is real friction and must be measured during the pilot.

### 6.3 Signatures remain wet, at the counter

REG 343 Section 9 requires signature under penalty of perjury (CVC §1808.21). Phase 1 does **not** attempt electronic signature.

**Flow:** the PWA collects the data → the technician retrieves and prints the completed form → the customer signs at the counter.

The saving is data entry and legibility, not the signature step. This is still the majority of the counter handling time.

### 6.4 Stored data is a handoff buffer, not a record

Application data exists only from submission until the transaction closes or end of day, whichever comes first, and is then hard-deleted. The system of record remains the DMV's existing registration systems.

**Consequence:** the security review addresses a transient buffer rather than a new record system, which is a materially shorter conversation.

---

### 6.5 Entry is office-aware, not QR-specific

The QR poster is one of five ways in. What the product actually needs is an **office identifier**, however the customer arrived:

| Route | Notes |
|---|---|
| QR posters — entrance, waiting area, counters | Unique code per office |
| Short URL printed under every QR, e.g. `dmv.ca.gov/go/folsom` | For customers who cannot scan or prefer to type |
| Lobby staff directing walk-ins | Operational |
| Digital signage in the lobby | Content only |
| Link in appointment confirmation emails and texts | Reaches the customer **before** they travel |

The appointment-confirmation route deserves priority. It is the only entry point that can prevent a wasted trip rather than merely improve a wait already under way — a customer who learns at home that they are missing a residency document has been saved a journey.

### 6.6 Record validation is Phase 2, and changes the security posture

Confirming with DMV that a plate or DL number is real, active and belongs to the customer would let the technician process rather than re-check.

It is also the first capability that reads real DMV records, which moves the product from "holds a transient form" to "queries the system of record." That requires security review and access approvals beyond anything in Phase 1.

Phase 1 therefore ships with format validation only. Record validation is committed to Phase 2 **after** feasibility and approval timelines are confirmed with DMV IT.

## 7. User Journeys

### 7.1 Vehicle Registration

1. Customer scans the QR poster in the lobby
2. PWA opens in the phone browser — DMV branding, office name, current wait
3. Customer selects **Vehicle Registration**
4. Customer receives token `A-042`, sees position and estimated wait
5. PWA shows the document checklist for the transaction type
6. Customer completes REG 343 on the phone, autosaved field by field
7. Queue position updates live throughout
8. "Now serving A-042" — customer goes to the counter
9. Technician enters `A-042`, the completed REG 343 appears
10. Technician prints, customer signs, transaction processed
11. Technician marks complete — record purged

### 7.2 Driver License

Steps 1–5 as above, selecting **Driver License**.

6. PWA presents the DL document / REAL ID checklist
7. PWA offers a link to the DMV online application (eDL 44)
8. Customer completes it in a separate tab and returns with a confirmation number
9. Customer enters the confirmation number in the PWA, stored against `A-042`
10. Technician enters `A-042`, sees the confirmation number, and looks it up in the existing DMV system

### 7.3 Chatbot — available throughout

At any point the customer can ask VR/DL questions: required documents, fees, process steps, REAL ID eligibility. Answers are grounded in DMV published content and linked to source (see §9.4).

---

## 8. Functional Requirements

### Entry and Office Context

| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Each field office has a unique QR code resolving to an office identifier | Must |
| FR-1a | A short URL resolves to the same office identifier, for customers who cannot scan | Must |
| FR-1b | The identifier can be reached from a link in an appointment confirmation | Should |
| FR-2 | The PWA displays office name, address, hours, and layout from that identifier | Must |
| FR-3 | The app shell loads from cache and renders within 2 seconds on 4G | Must |
| FR-4 | The app functions without installation; Add to Home Screen is optional | Must |

### Queue and Token

| ID | Requirement | Priority |
|---|---|---|
| FR-5 | Customer can request a token for VR or DL | Must |
| FR-6 | The token is issued by, or synchronised with, the office queue system | Must |
| FR-7 | Position in queue and estimated wait refresh automatically | Must |
| FR-8 | The token persists across browser refresh and accidental tab closure | Must |
| FR-9 | The customer is notified when their turn approaches | Should — see §9.5 |

### Application Completion — VR

| ID | Requirement | Priority |
|---|---|---|
| FR-10 | Customer can complete all customer-completable REG 343 fields on the phone | Must |
| FR-11 | Every field autosaves without an explicit save action | Must |
| FR-12 | Progress and remaining sections are visible at all times | Must |
| FR-13 | Field-level validation with plain-language errors | Must |
| FR-13a | Format validation as the customer types: plate 7 characters, VIN 17 valid characters, CA driver license one letter plus seven digits | Must |
| FR-14 | Conditional sections appear only when triggered | Must |
| FR-15 | Supplementary form triggers (REG 4008, REG 256, REG 5036, REG 5045) are surfaced to the customer | Must |
| FR-16 | Customer may submit a partially complete application | Should |

### Application Completion — DL

| ID | Requirement | Priority |
|---|---|---|
| FR-17 | The PWA presents the DL / REAL ID document checklist | Must |
| FR-18 | The PWA links out to the DMV online DL application | Must |
| FR-19 | Customer can record the returned confirmation number against their token | Must |
| FR-20 | The PWA never collects SSN or DL identity data directly | Must |

### Officer View

| ID | Requirement | Priority |
|---|---|---|
| FR-21 | Authenticated staff can retrieve a submission by token number | Must |
| FR-21a | Staff can retrieve a submission by scanning a barcode shown on the customer's screen; typing remains available | Should |
| FR-22 | Staff can view, correct, and print the completed REG 343 | Must |
| FR-23 | Staff can see the DL confirmation number for DL tokens | Must |
| FR-24 | Marking a transaction complete purges the stored application | Must |
| FR-25 | All staff access to application data is audit-logged | Must |

### Chatbot

| ID | Requirement | Priority |
|---|---|---|
| FR-26 | Answers VR and DL questions grounded in DMV published content | Must |
| FR-27 | Every substantive answer links to its DMV source page | Must |
| FR-28 | Declines and redirects questions outside VR/DL scope | Must |
| FR-29 | Never states a fee amount not present in the grounded content | Must |
| FR-30 | Never gives a definitive REAL ID eligibility determination | Must |

---

## 9. Non-Functional Requirements

### 9.1 Performance

- Cached shell renders in under 2 seconds on 4G
- Total initial payload under 300 KB
- Queue status updates at least every 30 seconds
- Usable on lobby Wi-Fi and cellular, including congested conditions

### 9.2 Accessibility — mandatory

- **WCAG 2.1 Level AA**, per Section 508 and California state policy
- Full keyboard and screen-reader operation
- Minimum 44×44 px touch targets
- Text resizable to 200% without loss of function
- No colour-only information encoding

Accessibility is a legal requirement for a state agency, not a refinement. It is in scope for Phase 1.

### 9.3 Language

- English and Spanish at launch — non-negotiable under California language access obligations
- Architecture must not preclude the additional languages DMV publishes

### 9.4 Chatbot Safety

A wrong answer about REAL ID documents sends a customer home for a second trip — precisely the failure this product exists to prevent, with DMV's name on it.

- Answers are generated only from a curated DMV content set
- Out-of-scope questions are declined, not attempted
- Fees and eligibility determinations are deferred to source pages or staff
- All conversations are logged and reviewed during the pilot

### 9.5 Notification Constraint — open design issue

The value of a digital token is being free to leave the lobby. That requires an alert when the turn approaches.

Web push on iOS requires the user to Add to Home Screen first, which most will not do. A browser-only notification is therefore unreliable on roughly half the customer base.

**Options:** (a) SMS alert — reliable, but collects a phone number and reintroduces PII; (b) on-screen only, customer must keep the tab open; (c) A2HS prompt with SMS fallback.

**This must be decided before build.** It materially affects both scope and privacy posture.

### 9.6 Privacy and Security

See `03_Technical_Architecture_and_Data_Model.md` §5 for the controls. Governing principles:

- No customer authentication and no customer accounts
- No SSN collected or stored by this product
- Application data is transient and purged on completion or end of day
- Data encrypted in transit and at rest
- Staff access authenticated, authorised, and audit-logged

### 9.7 Equity and Fallback

The existing paper and physical-ticket process must remain fully available and unimpaired. The PWA is strictly additive.

Customers without a smartphone, without data, or unable to use the app must experience no disadvantage in queue position or service.

---

## 10. Success Metrics

Measured at the pilot office against a matched baseline period.

| Metric | Why this one |
|---|---|
| Average counter handling time, VR transactions | The mechanism the product actually operates on |
| Second-visit rate from incomplete forms or missing documents | The most costly failure for the customer |
| QR scan → token issued conversion | Whether the entry point works |
| Application completion rate among those who start | Whether the form is usable on a phone while waiting |
| Chatbot deflection of counter questions | Load removed from staff |
| Customer satisfaction at the pilot office | The experience outcome |

**Deliberately excluded:** average lobby wait time. It is driven by staffing and demand, neither of which this product controls, and adopting it invites blame for a number the team cannot move.

---

## 11. Assumptions

1. The office queue system exposes an API permitting token issue and status read
2. DMV IT can host a static PWA and a lightweight backend on shared infrastructure
3. Technicians have a workstation capable of running the officer view during a transaction
4. The existing eDL 44 confirmation number is retrievable by field office staff
5. DMV will supply approved content for the chatbot knowledge base

---

## 12. Dependencies

| Dependency | Owner | Criticality |
|---|---|---|
| Queue / ticketing API specification and access | DMV IT | **Blocking for live queue** |
| Queue system vendor identification and licence terms | DMV IT | **Blocking** |
| Officer workstation integration approach | DMV IT / Field Ops | High |
| Approved VR/DL chatbot content set | DMV Program | High |
| Security review and infrastructure onboarding | DMV IT Security | High — historically the long pole |
| Spanish translation and review | DMV Program | Medium |

---

## 13. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Queue API is vendor-locked, read-only, or unavailable | Digital ticketing cannot be built | Design a fallback Phase 1 of checklist + form pre-fill + chatbot with no ticketing; confirm vendor immediately |
| R2 | Security review extends beyond the build timeline | Pilot slips | Transient-data design; engage IT Security during design, not after build |
| R3 | eDL 44 account and 2FA friction defeats in-lobby completion | DL path adds little value | Measure in pilot; consider DL as checklist and chatbot only |
| R4 | Chatbot gives an incorrect documents answer | Customer turned away; reputational harm to DMV | Grounded answers only, sourced links, scope refusal, pilot log review |
| R5 | Officer view cannot integrate with counter software | Manual re-keying, benefit lost | Establish integration approach before build; print-based fallback |
| R6 | iOS notification limitation not resolved | Customers cannot leave the lobby; core value weakened | Decide §9.5 before build |
| R7 | Low adoption among older or non-English-speaking customers | Benefit concentrated in one demographic | Spanish at launch, staff-assisted onboarding at pilot, paper path preserved |

---

## 14. Open Questions

1. Which vendor supplies the field office queue system, and what does the API permit?
2. Is the officer view a standalone web app, or must it embed in existing counter software?
3. Notification mechanism — SMS, A2HS push, or on-screen only? (§9.5)
4. Will DMV accept a printed pre-filled REG 343 as the counter document of record?
5. Which office hosts the pilot? Folsom is proposed but unconfirmed.
6. Is the target DMV specifically, or is this a template for other queue-based public services?
7. Is server-side autosave from the first keystroke confirmed, in place of an explicit submit? (client §4; see 04 §5.1)
8. Is the appointment-confirmation entry point in Phase 1 scope, and who owns that email template?
9. Does the counter have barcode scanning hardware, or is typing the token the only retrieval method?

---

## 15. Delivery Phases

Aligned to the phasing in the client requirements document (§8).

| Phase | Contents | Duration |
|---|---|---|
| **0 — Demo** | ✅ Built. Customer app, counter view, real REG 343 fields and conditional logic, filled-PDF output, app-issued tokens, mocked queue | done |
| **1 — Core application, no external APIs** | Entry routes, welcome and office data, chatbot, checklists, forms with autosave, token access without login, format validation, REG 343 filled PDF, app-issued tokens, technician screen, **WCAG 2.1 AA, Spanish** | 4–6 weeks |
| **2 — API integrations** | Queue system (real tokens, live position, number-called alert), record validation against DMV vehicle and driver systems, eDL 44 confirmation lookup | Scoped once DMV IT confirms access |

Phase 1 has **no DMV system dependencies** and can proceed immediately. Phase 2 is gated on DMV IT.

Both estimates exclude DMV security review and infrastructure onboarding, which are agency-controlled and historically exceed the build duration.

---

## 16. Sources

- `../client_docs/PWA_User_Flow.pdf` — DMV Field Office Progressive Web App, High-Level Requirements Document, Jothi Periasamy, Project Lead
- [Application for Title or Registration (REG 343), CA DMV](https://www.dmv.ca.gov/portal/uploads/2022/01/REG-343-R4-2021.pdf)
- [Apply Online for a Driver License or ID Card (eDL 44), CA DMV](https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/)
- [Driver's License and ID Application portal](https://www.edl.dmv.ca.gov/)
