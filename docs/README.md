# Field Office Progressive Web App — Documentation

Vehicle Registration (VR) and Driver License (DL) services.
Stage: **Requirements & Design** — pre-implementation. August 2026.

---

## Documents

**New here?** Start with [PROJECT_GUIDE.md](PROJECT_GUIDE.md) — the whole project in plain English.

| # | Document | Purpose |
|---|---|---|
| — | [PROJECT_GUIDE.md](PROJECT_GUIDE.md) | Plain-English overview of the entire project |
| 00 | [Scenario — Application Pre-Fill Flow](00_Scenario_Application_Prefill_Flow.md) | The originating scenario: scan, fill while waiting, technician retrieves at the counter |
| 01 | [Product Requirements Document](01_Product_Requirements_Document.md) | Scope, users, journeys, functional and non-functional requirements, risks, delivery phases |
| 02 | [Functional and Form Specification](02_Functional_and_Form_Specification.md) | Screen-by-screen behaviour and the complete REG 343 field inventory |
| 03 | [Technical Architecture and Data Model](03_Technical_Architecture_and_Data_Model.md) | Components, data model, API contracts, security controls, fallback design |
| 04 | [Client Requirements Alignment](04_Client_Requirements_Alignment.md) | Our documents vs the client requirements document: agreed, new scope, gaps, decisions needed |

Source forms live outside this folder in [`../forms/`](../forms/README.md).
The application is in the project root — see [`../README.md`](../README.md).
The original vanilla build is kept as reference in `../legacy-demo/`.

Client requirements document: [`../client_docs/PWA_User_Flow.pdf`](../client_docs/PWA_User_Flow.pdf) — *Jothi Periasamy, Project Lead, 13 August 2026*
Original stakeholder deck: `../client_docs/Field_Office_PWA_Scope_and_Design (4).pptx`

---

## The product in one paragraph

A customer arriving at a DMV field office scans a QR poster. The app opens in their phone browser — no install, no login. They take a queue token, see their position, and complete their application while they wait. When their number is called, the technician retrieves the completed application by that token number and processes it. The queue token is the only identifier; there is no account and no authentication on the customer side.

---

## Four decisions that shape everything else

| Decision | Consequence | Detail |
|---|---|---|
| **The token number is the identity** | A personalised handoff with zero authentication | PRD §6.1 |
| **DL links out, VR is built** | DMV already runs eDL 44; rebuilding it would duplicate a working system and force this product to hold SSN | PRD §6.2 |
| **Signatures stay wet, at the counter** | REG 343 requires signature under penalty of perjury; the saving is data entry, not the signature | PRD §6.3 |
| **Stored data is a handoff buffer** | Purged on completion or end of day; the security review addresses a buffer, not a record system | PRD §6.4 |

---

## Decisions needed before Phase 1

Raised against the client requirements document. Full detail in [document 04](04_Client_Requirements_Alignment.md) §6.

1. **Accessibility (WCAG 2.1 AA) and Spanish** — absent from the client document, legally required for a state agency, and not addable after the fact.
2. **Notification channel** — iOS web push needs Add to Home Screen, which most customers will not do. Unresolved, the customer cannot leave the waiting area, which is the point of a digital token.
3. **The technician screen** — a second application with its own authentication, still uncosted.

## Blocking Phase 2 only

4. **Queue / ticketing API** — vendor unidentified. A fallback that survives a "no" is in Architecture §7, so this does not block Phase 1.
5. **Record validation** — feasibility and DMV access approval unconfirmed.

---

## Delivery

| Phase | Contents | Duration |
|---|---|---|
| **0 — Demo** | ✅ **Built** — customer app, counter view, real REG 343 fields and conditional logic, filled-PDF output | done |
| **1 — Core application, no external APIs** | Entry routes, chatbot, checklists, forms with autosave, token access without login, format validation, REG 343 PDF, technician screen, WCAG 2.1 AA, Spanish | 4–6 weeks |
| **2 — API integrations** | Queue system, record validation, eDL 44 lookup | Gated on DMV IT |

**Phase 1 has no DMV system dependencies and can start immediately.** Both estimates exclude DMV security review and infrastructure onboarding, which are agency-controlled and historically longer than the build.
