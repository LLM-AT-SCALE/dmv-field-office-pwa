# Field Office PWA — Technical Architecture and Data Model

| | |
|---|---|
| **Document** | 03 — Technical Architecture & Data Model |
| **Version** | 1.1 |
| **Date** | 13 August 2026 |
| **Status** | Draft for review |
| **Parent** | `01_Product_Requirements_Document.md` |

---

## 1. Architecture Overview

```
   ┌──────────────┐         scans QR poster
   │  Customer    │ ──────────────────────────┐
   │  Phone       │                           │
   └──────┬───────┘                           ▼
          │                         ┌──────────────────┐
          │  HTTPS                  │  Static CDN /    │
          ├────────────────────────▶│  PWA Shell       │  cached, ~300 KB
          │                         └──────────────────┘
          │
          │  JSON over HTTPS
          ▼
   ┌─────────────────────────────────────────────────┐
   │  Field Office PWA Backend                       │
   │  ┌───────────┐ ┌────────────┐ ┌──────────────┐  │
   │  │ Office    │ │ Session &  │ │ Chatbot      │  │
   │  │ Registry  │ │ Draft Store│ │ Gateway      │  │
   │  └───────────┘ └─────┬──────┘ └──────┬───────┘  │
   └────────┬─────────────┼───────────────┼──────────┘
            │             │               │
            ▼             ▼               ▼
   ┌────────────────┐  ┌──────────┐  ┌──────────────┐
   │ Queue /        │  │ Officer  │  │ Claude API   │
   │ Ticketing API  │  │ View     │  │ (grounded)   │
   │ (DMV vendor)   │  │ (staff)  │  └──────────────┘
   └────────────────┘  └──────────┘

   External, linked not embedded:  edl.dmv.ca.gov  (DL application)

   All components hosted on DMV shared infrastructure.
```

---

## 2. Components

### 2.1 PWA Shell — customer-facing

| | |
|---|---|
| **Type** | Static single-page application |
| **Stack** | HTML / CSS / vanilla JS or a lightweight framework; no heavy SDKs |
| **Budget** | Under 300 KB initial payload; renders in under 2 s on 4G |
| **Caching** | Service worker caches the shell; live data always from network |
| **Install** | None required; Add to Home Screen optional |

The service worker caches the application shell only. Queue positions, wait times and application data are never served from cache — a stale queue position is worse than no queue position.

### 2.2 Backend Service

Three responsibilities, deliberately small:

| Module | Responsibility |
|---|---|
| **Office Registry** | Resolves an office identifier to name, address, hours, layout, and service configuration. The identifier may arrive from a QR code, a short URL, an appointment-confirmation link or signage — resolution is identical in every case. Read-only, cacheable. |
| **Session & Draft Store** | Holds the token-to-application association for the life of a visit. The only component that touches personal data. |
| **Chatbot Gateway** | Proxies to the Claude API with grounding content and scope enforcement. Holds no customer data. |

### 2.3 Officer View — staff-facing

A separate application with its own authentication, served on a distinct host or path. It shares the Session & Draft Store and nothing else.

Whether it runs standalone in a browser or must embed within existing counter software is an **open question** (PRD §14) and materially affects effort.

### 2.3a Record Validation Gateway *(Phase 2)*

Backend-only module that asks DMV vehicle and driver systems whether an identifier is real, active and owned by the customer. It stores nothing, returns status flags rather than record contents, and is never reachable from the phone.

This is the only component that touches the DMV system of record, and it is what moves the product into a heavier security review. It is deliberately isolated so that Phase 1 can ship without it.

### 2.4 Queue / Ticketing Integration

The single blocking dependency. The vendor is not yet identified.

Required capabilities, in priority order:

1. **Read** — current serving number, queue depth, estimated wait, per service
2. **Write** — issue a token for a named service
3. **Subscribe** — push or poll notification of state change

If only capability 1 is available, the product degrades to the fallback in §7.

### 2.5 Chatbot Service

- Claude API over HTTPS; no client-side SDK
- Answers generated only from a curated DMV content set supplied by DMV Program
- System prompt enforces scope refusal outside VR and DL
- No customer application data is ever passed into the prompt
- All exchanges logged for pilot review

---

## 3. Data Model

### 3.1 Session

Created when a token is issued. This is the only durable record the product creates.

| Field | Type | Notes |
|---|---|---|
| `session_id` | UUID | Internal key |
| `office_id` | String | From the QR code |
| `token_number` | String | e.g. `A-042` — the customer-facing identity |
| `service` | Enum | `VR` \| `DL` |
| `sub_transaction` | Enum | Renewal, transfer, REAL ID, etc. |
| `issued_at` | Timestamp | |
| `status` | Enum | `waiting` \| `submitted` \| `serving` \| `complete` \| `abandoned` |
| `expires_at` | Timestamp | End of business day, hard limit |

### 3.2 VR Application Draft

| Field | Type | Notes |
|---|---|---|
| `session_id` | UUID | Foreign key |
| `form_type` | Const | `REG_343` |
| `form_data` | Encrypted JSON | Field values keyed to §3 of document 02 |
| `completeness` | Percentage | Derived, for the officer view |
| `updated_at` | Timestamp | |
| `submitted_at` | Timestamp | Null until submitted |

`form_data` is encrypted at rest as a single blob. It is never indexed, never queried by content, and never aggregated.

### 3.3 DL Reference

| Field | Type | Notes |
|---|---|---|
| `session_id` | UUID | Foreign key |
| `edl_confirmation_number` | String | The **only** DL field stored |
| `recorded_at` | Timestamp | |

No SSN. No name. No date of birth. No address. No documents. This is a product requirement, not a schema convenience.

### 3.4 Audit Log

Retained independently of session data, under DMV's standard log retention policy.

| Field | Type |
|---|---|
| `event_id` | UUID |
| `session_id` | UUID |
| `staff_id` | String |
| `action` | Enum — `view` \| `edit` \| `print` \| `complete` \| `purge` |
| `field_changed` | String, nullable |
| `timestamp` | Timestamp |

The audit log records that an access occurred and by whom. It never contains application field values.

### 3.5 Retention and Purge

| Trigger | Action |
|---|---|
| Technician marks transaction complete | Immediate hard delete of session, draft and DL reference |
| Technician flags abandoned | Immediate hard delete |
| End of business day | Scheduled hard delete of all remaining sessions for that office |
| Customer requests deletion in-app | Immediate hard delete |

Nothing persists overnight. There is no soft delete, no archive, and no backup of application content.

This is what makes the system a **handoff buffer rather than a record system**, and it is the single most important argument in the security review.

---

## 4. API Contracts

Illustrative shapes for review; not final.

### 4.1 Office context

```
GET /api/v1/office/{office_id}
→ 200
{
  "office_id": "folsom",
  "name": "Folsom Field Office",
  "address": { ... },
  "hours": { "today": { "open": "08:00", "close": "17:00" }, "is_open": true },
  "services": [
    { "code": "VR", "wait_minutes": 24, "queue_depth": 11 },
    { "code": "DL", "wait_minutes": 38, "queue_depth": 19 }
  ]
}
```

### 4.2 Issue token

```
POST /api/v1/office/{office_id}/token
{ "service": "VR", "sub_transaction": "out_of_state" }
→ 201
{
  "session_id": "…",
  "token_number": "A-042",
  "position": 11,
  "estimated_wait_minutes": 24
}
```

### 4.3 Queue status

```
GET /api/v1/session/{session_id}/status
→ 200
{
  "token_number": "A-042",
  "position": 4,
  "now_serving": "A-038",
  "estimated_wait_minutes": 9,
  "status": "waiting"
}
```

### 4.4 Autosave

```
PATCH /api/v1/session/{session_id}/application
{ "field": "vehicle.vin", "value": "1HGCM82633A004352" }
→ 204
```

Field-level patch, not whole-document put. A dropped connection loses one field, never the form.

**Autosave is server-side from the first keystroke** (client §4). Nothing is held only on the phone, so a customer who never presses submit still arrives at the counter with their data present.

Two consequences follow, and both are design obligations rather than details:

1. Personal data reaches the server for **every** started form, including abandoned ones. The end-of-day purge in §3.5 is therefore load-bearing, not housekeeping.
2. The technician must be able to tell a finished application from an abandoned draft, which is why the explicit submit action and the completeness figure are both retained.

### 4.5 Submit

```
POST /api/v1/session/{session_id}/application/submit
→ 200
{ "submitted_at": "…", "completeness": 0.92, "missing_required": ["odometer.reading"] }
```

Submission with missing fields is permitted and reported, not rejected.

### 4.6 Record DL confirmation

```
POST /api/v1/session/{session_id}/dl-reference
{ "confirmation_number": "…" }
→ 204
```

### 4.6a Record validation *(Phase 2, authenticated backend only)*

```
POST /api/v1/validate/vehicle
{ "plate": "8XYZ123", "vin": "1HGCM82633A004352" }
→ 200
{ "found": true, "active": true, "matches_owner": true }

POST /api/v1/validate/driver
{ "dl_number": "D8842197", "state": "CA" }
→ 200
{ "found": true, "active": true }
```

Called only by the backend, never by the phone. Responses carry **status flags, not record contents** — the app learns whether a record is valid, never what it says. This keeps DMV record data inside DMV systems and keeps the product out of scope for holding it.

Gated on DMV IT feasibility and access approval; see `04_Client_Requirements_Alignment.md` §3.2.

### 4.7 Officer retrieval *(authenticated)*

```
GET /api/v1/staff/token/{token_number}?office_id=folsom
→ 200
{
  "token_number": "A-042",
  "service": "VR",
  "status": "submitted",
  "form_type": "REG_343",
  "form_data": { ... },
  "completeness": 0.92,
  "missing_required": ["odometer.reading"]
}
```

### 4.8 Complete and purge *(authenticated)*

```
POST /api/v1/staff/token/{token_number}/complete
→ 204   // session, draft and DL reference hard-deleted
```

---

## 5. Security and Privacy Controls

| Control | Implementation |
|---|---|
| Transport | TLS 1.2 minimum, HSTS enforced |
| At rest | `form_data` encrypted; keys managed by DMV KMS |
| Customer authentication | None — by design; the token is a short-lived, office-scoped, non-guessable reference |
| Session scoping | A session is valid only for its issuing office and only until end of day |
| Staff authentication | DMV single sign-on; no local accounts |
| Staff authorisation | Lookup by token only; no listing, no search by name, no bulk export |
| Audit | Every staff view, edit, print and purge logged with identity |
| Retention | Hard delete on completion or end of day (§3.5) |
| SSN | Never collected by this product under any path |
| Rate limiting | Per office and per IP on token issue and status endpoints |
| Content Security Policy | Strict; no third-party scripts, no external fonts, no analytics beacons |
| Chatbot isolation | No application data enters chatbot prompts |

### 5.1 Token guessability

The customer-facing token (`A-042`) is short and sequential by nature — it must be, because it is read aloud in the lobby. It is therefore **not** a security credential.

The API uses `session_id` (UUID) for all customer-side calls. The short token is usable only through the authenticated staff endpoint, scoped to the office and the current business day.

### 5.2 Threat notes

| Threat | Mitigation |
|---|---|
| Enumeration of tokens by a customer | Customer endpoints require `session_id`, never the token |
| Someone typing another customer's token to view their form | Retrieval by token exists only on the authenticated staff endpoint; the customer's own session is bound to their browser session |
| A customer seeing another's application | No customer-side retrieval by token exists |
| Data persisting after the visit | End-of-day purge; no backups of application content |
| QR code substitution in the lobby | Office identifier resolves server-side; tamper-evident poster placement is an operational control |
| Chatbot prompt injection via customer input | Chatbot has no data access and no tools; worst case is a bad answer, mitigated by grounding and source links |

---

## 6. Offline and Caching Strategy

| Asset | Strategy |
|---|---|
| Application shell, CSS, JS | Cache-first via service worker |
| Office data | Network-first, 5-minute cache fallback |
| Queue position | **Network only** — never cached |
| Form draft | Written to local storage on every change, synced to server on reconnect |
| Chatbot | Network only; unavailable offline, stated plainly |

If the device drops connection mid-form, entry continues against local storage and syncs on reconnect. The customer is shown an unobtrusive "not saved to DMV yet" state so they do not walk to the counter believing a form was submitted when it was not.

---

## 7. Fallback Architecture — no queue API

If the queue vendor exposes no usable API (risk R1), the following remains buildable and still delivers most of the value:

| Retained | Removed |
|---|---|
| QR entry and office context | Digital token issue |
| Document checklists | Live queue position |
| Full REG 343 completion | Estimated wait |
| DL hand-off and confirmation capture | "Your turn is near" alert |
| Chatbot | |
| Officer retrieval | |

**Substitute identity:** the customer keeps their existing paper ticket and types that number into the PWA, which becomes the lookup key for the technician. The handoff still works. The customer simply does not get live position on their phone.

This fallback should be costed and agreed **before** the API answer arrives, so the schedule does not depend on it.

---

## 8. Environments

| Environment | Purpose | Data |
|---|---|---|
| Demo | Stakeholder demonstration | Fully mocked; no backend, no real data |
| Development | Build | Synthetic only |
| Staging | DMV integration testing | Synthetic; queue API sandbox if available |
| Pilot | One field office, live | Real, under §5 controls |

No production data is ever copied to a lower environment.

---

## 9. Open Technical Questions

1. **Queue vendor and API surface** — read-only, or read plus write? Licence terms for API access?
2. **Officer view integration** — standalone web application, or embedded in existing counter software?
3. **Printing** — can the officer view drive a counter printer directly, or does it produce a PDF for manual printing?
4. **Notification transport** — SMS gateway available on DMV infrastructure, or on-screen only? (PRD §9.5)
5. **Hosting** — what does DMV shared infrastructure provide: static CDN, container platform, managed database?
6. **Claude API egress** — is outbound API traffic to Anthropic permitted from DMV infrastructure, and under what data-handling agreement?
7. **Fee data** — static schedule maintained in the content set, or a live DMV fee lookup?
8. **Session store** — managed database, or is an in-memory store with end-of-day expiry acceptable and preferable given the retention model?

Question 8 is worth deciding early: an in-memory or TTL-native store makes the "nothing persists" claim architecturally true rather than procedurally enforced, which is a materially stronger position in the security review.

---

## 10. Related Documents

- `01_Product_Requirements_Document.md` — scope, requirements, risks
- `02_Functional_and_Form_Specification.md` — screens and REG 343 field inventory
- `04_Client_Requirements_Alignment.md` — mapping to the client requirements document
- `../forms/README.md` — source forms and the DL 44 constraint
- `../client_docs/PWA_User_Flow.pdf` — client requirements document
