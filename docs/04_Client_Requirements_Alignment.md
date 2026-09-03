# Alignment with the Client Requirements Document

| | |
|---|---|
| **Document** | 04 — Client Requirements Alignment |
| **Version** | 1.0 |
| **Date** | 13 August 2026 |
| **Status** | For discussion with the Project Lead |
| **Client source** | `client_docs/PWA_User_Flow.pdf` — *DMV Field Office Progressive Web App, High-Level Requirements Document*, Jothi Periasamy, Project Lead |

---

## 1. Summary

The client requirements document adopts the user flow and the two-forms approach set out in documents 01–03 of this set, in most places verbatim. There is no conflict on the core design.

The document adds five items of new scope, and omits four items that materially affect the build. Both are set out below, followed by the points that need a decision before Phase 1 starts.

---

## 2. Agreed — no further discussion required

These are identical across both sets of documents and can be treated as settled.

| Item | Client doc | This set |
|---|---|---|
| QR entry, no install, no login | §1 | 01 §6.1 |
| Document checklist shown before the queue | §1.5 | 02 §2 (S3) |
| Token number is the customer's identity | §4 | 01 §6.1 |
| Application completed on the phone while waiting | §1.8 | 01 §7.1 |
| Technician retrieves by token | §4 | 02 §2 (S7) |
| REG 343 — collect data, generate the filled PDF | §5.1 | 02 §3, `app/js/pdf-fill.js` |
| DL 44 — link to eDL 44, store only the confirmation number | §5.2 | 01 §6.2 |
| No SSN or DL identity data held by this product | §5.2 | 01 §6.2 |
| Chatbot scope limits — no transactions, no records access | §3 | 01 §9.4 |
| Phase 1 without external APIs, Phase 2 with them | §8 | 03 §7 |
| Token expiry, end of business day | §10.1 | 03 §3.5 |

---

## 3. New scope introduced by the client document

### 3.1 Multiple entry points *(client §2)*

The QR poster is now one of five entry points:

| Entry point | Note |
|---|---|
| QR posters at entrance, waiting area, counters | Already built |
| Short URL under every QR, e.g. `dmv.ca.gov/go/folsom` | New — needs a URL scheme and DMV domain routing |
| Lobby staff directing walk-ins | Operational, no build |
| Digital signage displaying the QR | Content only |
| Link in appointment confirmation emails and texts | New — and the most valuable |

The appointment-email entry point is the only one that reaches the customer **before** they travel. It is therefore the only one that can prevent a wasted trip rather than merely shorten a wait. It should be treated as a priority rather than a variant of the QR.

**Impact:** small build, high value. Office resolution must move from "QR code" to "office identifier, however it was reached."

### 3.2 Record validation against DMV systems *(client §6, §7.4)*

New capability. The app calls DMV systems to confirm that a plate or DL number is real, active, and belongs to the customer, so the technician processes a pre-validated record instead of re-checking it.

Correctly placed in Phase 2 by the client document, which also identifies the trade-off: touching DMV vehicle and driver records requires a heavier security review and access approvals.

**Impact:** significant. This is the first capability that reads real DMV records, and it changes the security posture of the whole product. Feasibility and approval timeline must be confirmed before it is committed to Phase 2.

### 3.3 Format validation rules *(client §6)*

Specific rules now stated:

| Field | Rule |
|---|---|
| License plate | 7 characters |
| VIN | 17 valid characters |
| CA driver license | One letter followed by seven digits |

**Impact:** small. VIN is already implemented; the other two are additions to `app/js/form-reg343.js`. See 02 §5.

### 3.4 Token barcode or QR on the customer's screen *(client §4)*

The technician may scan the customer's token rather than typing it.

**Impact:** small on the customer side, but it requires barcode scanning hardware or a camera at the counter. Manual entry must remain as the fallback.

### 3.5 Flipkart Lite as the reference model *(client §9)*

Framing rather than requirement. Consistent with the lightweight principles already documented.

---

## 4. Gaps in the client document

Four items are absent and affect the build if they are not settled early.

### 4.1 Accessibility and language — legal, not optional

The client document does not mention accessibility or Spanish anywhere.

- **WCAG 2.1 Level AA / Section 508** conformance is a legal requirement for a California state agency.
- **Spanish** is required under California language access obligations.

Neither can be added convincingly after the fact; both shape markup, navigation, colour and content from the first screen. Requirements are already specified in 01 §9.2 and §9.3, and the prototype meets AA contrast today.

**Action:** add both to the requirements document as Phase 1 scope.

### 4.2 The signature is not captured by the app

The client document states the customer arrives with a form that is *"completed, ready-to-process"* (Objective) and that the system generates the filled PDF *"right there for processing"* (§4.4).

REG 343 Section 9 requires signature in person under penalty of perjury (CVC §1808.21). The real sequence is: technician retrieves → prints → customer signs → technician processes.

This does not reduce the value. The saving is data entry and legibility, which is the majority of counter handling time. It is the wording that needs correcting, so the expectation set with stakeholders is accurate.

**Action:** change "ready to process" to "ready for signature and processing" in the requirements document.

### 4.3 The technician's screen is a second application

The client document refers to the technician typing the token into *"their own screen"* (§4) without scoping it.

That screen is a separate application requiring its own authentication against DMV single sign-on, deployment to DMV workstations, and a decision on whether it stands alone or embeds in existing counter software. It roughly doubles the build surface and is the point at which DMV IT must engage.

**Action:** add it to the requirements document as its own deliverable with its own estimate. See 01 §5.1 and 02 §2 (S7).

### 4.4 Notification when the number is called

The client document assumes the app can alert the customer (§7.3).

Web push on iOS requires the customer to Add to Home Screen first, which most will not do. Without another channel the customer must keep the page open, which defeats the reason to hold a digital token — being free to leave the waiting area.

Options and trade-offs are set out in 01 §9.5. SMS is the most reliable, and it reintroduces a phone number as stored personal data.

**Action:** decide the notification channel before Phase 1 build.

---

## 5. Points to confirm

### 5.1 Server autosave with no submit step *(client §4)*

The client document specifies that data saves to the server against the token as the customer types, and that *"nothing is stored only on the phone."*

This is workable and removes a failure mode (a customer who fills the form but never presses submit). Two consequences follow:

1. Personal data reaches the server from the first keystroke, including for customers who abandon the form. The end-of-day purge in client §10.1 therefore becomes load-bearing rather than housekeeping.
2. The technician needs to distinguish a finished application from an abandoned draft. A completeness indicator already exists in the prototype; an explicit "I have finished" action is still worth keeping for that reason.

The current prototype autosaves locally and has an explicit submit. Moving to server autosave is a small change, but it should be a conscious decision rather than a silent one.

### 5.2 "No personal data held outside DMV systems" *(client Objective)*

Accurate for the Driver License path, where only a confirmation number is stored.

Not accurate for Vehicle Registration, where the product necessarily holds the owner's name, address, driver license number, lienholder details and vehicle information for the duration of the visit.

The precise claim is: *no SSN is ever collected; driver licence data stays entirely within DMV systems; vehicle registration data is held transiently and purged on completion or at end of day.*

**Action:** correct the wording. The security review will test this claim directly.

---

## 6. Consolidated decisions needed before Phase 1

| # | Decision | Owner | Blocking |
|---|---|---|---|
| 1 | Accessibility (WCAG 2.1 AA) and Spanish confirmed as Phase 1 scope | Project Lead | Yes — affects all markup and content |
| 2 | Notification channel: SMS, Add to Home Screen push, or on-screen only | Project Lead + DMV | Yes — affects scope and privacy posture |
| 3 | Technician screen scoped and estimated as a separate application | Project Lead | Yes — affects estimate |
| 4 | Server autosave with no submit step, confirmed with retention rule | Project Lead | No — small change either way |
| 5 | Objective wording corrected on personal data | Project Lead | No — but before any security review |
| 6 | Signature wording corrected to "ready for signature" | Project Lead | No |
| 7 | Queue vendor identified and API access confirmed | DMV IT | Phase 2 only — Phase 1 uses app-issued tokens |
| 8 | Record validation feasibility and approval timeline | DMV IT | Phase 2 only |

Items 7 and 8 are already listed as open items in the client document (§10.2, §10.3).

---

## 7. Related documents

- `01_Product_Requirements_Document.md` — scope, requirements, risks
- `02_Functional_and_Form_Specification.md` — screens and REG 343 field inventory
- `03_Technical_Architecture_and_Data_Model.md` — components, APIs, data handling
- `PROJECT_GUIDE.md` — plain-English overview of the whole project
- `../client_docs/PWA_User_Flow.pdf` — the client requirements document
