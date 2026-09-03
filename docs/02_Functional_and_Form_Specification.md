# Field Office PWA — Functional and Form Specification

| | |
|---|---|
| **Document** | 02 — Functional & Form Specification |
| **Version** | 1.1 |
| **Date** | 13 August 2026 |
| **Status** | Draft for review |
| **Parent** | `01_Product_Requirements_Document.md` |

---

## 1. Purpose

Screen-by-screen behaviour and the complete field inventory for the forms the product handles. This is the document a developer builds from and a reviewer checks against.

---

## 2. Screen Specifications

### S1 — Entry / Welcome

**Reached by** any of five routes, all resolving to the same office identifier carried in the URL, e.g. `/o/folsom`:

| Route | Form |
|---|---|
| QR poster — entrance, waiting area, counters | Unique code per office |
| Short URL printed beneath every QR | `dmv.ca.gov/go/folsom` |
| Lobby staff directing a walk-in | Verbal, points at the poster |
| Digital signage | Displays the QR |
| Appointment confirmation email or text | Deep link, reaches the customer before they travel |

The screen behaves identically whichever route was used. Nothing in the interface should assume a QR scan.

**Displays**

- DMV branding and office name
- Address, today's hours, and open/closed state
- Current wait estimate per service
- Office layout or floor guidance
- Two primary actions: **Vehicle Registration** and **Driver License**
- Language toggle: English / Español

**Behaviour**

- Shell renders from cache; live figures populate on arrival and degrade to "checking…" if the API is unreachable
- If the office is closed, take-a-ticket is disabled and next opening time is shown
- No token is issued at this screen

---

### S2 — Service Selection

**Displays**

- Vehicle Registration and Driver License, each with current wait and queue length
- Beneath each, the sub-transaction the customer is here for:
  - **VR:** renewal · title transfer · out-of-state vehicle · duplicate
  - **DL:** renewal · replacement · first-time · REAL ID upgrade
- "Not sure?" opens the chatbot pre-seeded with a routing question

**Behaviour**

- Sub-transaction determines the checklist in S3 and which REG 343 sections are surfaced
- Selection is stored locally before the token is requested, so it survives a failed token call

---

### S3 — Document Checklist

Presented **before** the token so a customer missing documents learns it now rather than at the counter.

**Displays**

- Required documents for the selected sub-transaction
- Applicable fees, with a link to the DMV fee page
- Each item individually checkable
- "I don't have everything" → chatbot, with guidance on whether to proceed

**Behaviour**

- Checklist state is local only and never transmitted
- Proceeding is never blocked; the customer may continue regardless

---

### S4 — Token Issued

**Displays**

- Token number, large and high contrast, e.g. **A-042**
- A barcode or QR encoding the same token, for the technician to scan
- Position in queue and estimated wait
- "Now serving" figure for the office
- Primary call to action: **Complete your application while you wait**
- Time issued

**Behaviour**

- Token is written to local storage immediately; a refresh or accidental close restores it
- Position refreshes at least every 30 seconds
- The screen warns explicitly against leaving the building until the notification mechanism is settled (PRD §9.5)
- At two positions away, the display changes state and alerts the customer

---

### S5 — Application

Branches by service.

#### S5-VR — REG 343

- Sectioned, one section per screen — never the whole form at once
- Progress indicator: section *n* of *m*
- Every field autosaves on blur; no save button anywhere
- Conditional sections appear only when triggered (§3.10)
- Supplementary form triggers surface as an inline notice
- Review screen before submission
- Submitted state shows: "Your application is ready. The technician will have it when your number is called."

#### S5-DL — eDL 44 hand-off

- Explains that the DL application is completed on the DMV site
- States plainly that a DMV account with two-factor authentication is required
- Warns the session times out after 15 minutes
- Button opens `edl.dmv.ca.gov` in a new tab
- On return, a single field captures the confirmation number
- Confirmation number is stored against the token; nothing else is collected

---

### S6 — Chatbot

- Persistent, collapsed, reachable from every screen
- Opens with suggested questions for the selected service
- Every substantive answer carries a link to its DMV source
- Out-of-scope questions are declined with a redirect to staff or dmv.ca.gov
- Never states a fee amount absent from the grounded content
- Never issues a definitive REAL ID eligibility determination

---

### S7 — Officer View *(staff-facing, separate application)*

**Access:** authenticated DMV staff on an office workstation.

**Displays**

- Token lookup by typing the number, by scanning the barcode shown on the customer's screen, or auto-load of the currently called token
- For VR: the completed REG 343, laid out in the paper form's section order
- For DL: the eDL 44 confirmation number only
- Submission timestamp and completeness state
- Fields left blank flagged for counter follow-up

**Actions**

- Edit any field, with the correction audit-logged
- Generate the completed REG 343 as a filled PDF for signature — written into the
  official DMV AcroForm, not a reproduction. Section 9 signature and date are left
  blank; printed name and telephone are pre-filled. See `../README.md`.
- Mark the transaction complete → record purged
- Flag a submission as abandoned → record purged

**Constraints**

- Every access and every edit is audit-logged with staff identity and timestamp
- No bulk export, no search across submissions — token lookup only
- Barcode scanning is a convenience only; typing the token must always remain available, as scanning hardware may not be present at every counter

---

## 3. REG 343 Field Inventory

Taken field by field from REG 343 (REV. 4/2021 CORRECTED). Source PDF in `../forms/`.

**Legend — Collected by**
`PWA` customer completes on phone · `Counter` staff or paper only · `Derived` system-populated

### 3.1 Section 1 — Vehicle Information

| Field | Type | Required | Collected by |
|---|---|---|---|
| Vehicle Identification Number | Text, 17 | Yes | PWA |
| Vehicle Make | Text | Yes | PWA |
| Year Model | Numeric, 4 | Yes | PWA |
| Fuel Type | Select | Yes | PWA |
| California License Plate Number | Text | Conditional | PWA |
| Model or Series | Text | No | PWA |
| Body Type Model | Text | No | PWA |
| Motorcycle Engine Number | Text | Conditional | PWA |
| Type of Vehicle | Radio — Auto / Commercial / Motorcycle / Off Highway / Trailer Coach | Yes | PWA |
| Trailer coach length (in.) | Numeric | Conditional | PWA |
| Trailer coach width (in.) | Numeric | Conditional | PWA |
| Used for transportation of persons for hire? | Yes / No | Yes | PWA |
| Commercial vehicle at 10,001 lbs or more? | Yes / No | Yes | PWA |
| Number of axles | Numeric | Conditional | PWA |
| Unladen weight | Numeric + Actual/Estimated | Conditional | PWA |

### 3.2 Section 2 — Owner Information

| Field | Type | Required | Collected by |
|---|---|---|---|
| True full name of owner (last, first, middle, suffix) / business / lessor | Text | Yes | PWA |
| Driver license / ID card number | Text | Yes | PWA |
| State of issue | Select | Yes | PWA |
| Co-owner 1 — joining word | Radio — AND / OR | Conditional | PWA |
| Co-owner 1 — true full name | Text | Conditional | PWA |
| Co-owner 1 — DL/ID number and state | Text + Select | Conditional | PWA |
| Co-owner 2 — joining word, name, DL/ID, state | As above | Conditional | PWA |
| Physical residence or business address | Text | Yes | PWA |
| Apt / space / suite number | Text | No | PWA |
| City · State · ZIP | Text · Select · Text | Yes | PWA |
| County of residence or where principally garaged | Select | Yes | PWA |
| Equipment number | Text | No | PWA |
| Mailing address (if different) + apt, city, state, ZIP | Text group | Conditional | PWA |
| Lessee address (if different) + apt, city, state, ZIP | Text group | Conditional | PWA |
| Trailer coach — address where located | Text group | Conditional | PWA |

> **Note.** "AND" versus "OR" between co-owners determines whether all owners or only one must sign on future transfer. The PWA must explain this in plain language at the point of choice.

### 3.3 Section 3 — Legal Owner (Lienholder / Titleholder)

| Field | Type | Required | Collected by |
|---|---|---|---|
| True full name of bank / finance company / individual | Text | Yes — enter "NONE" if none | PWA |
| Electronic Lienholder ID number (ELT) | Text | Conditional | PWA |
| Physical address + apt, city, state, ZIP | Text group | Conditional | PWA |
| Mailing address (if different) | Text group | Conditional | PWA |

> The form requires "NONE" to be written explicitly. The PWA presents this as an explicit choice — *No lienholder* or *Enter lienholder* — never as a field the customer can silently skip.
>
> ELT name, address and number must match the ELT listing exactly.

### 3.4 Section 4 — Odometer Information

| Field | Type | Required | Collected by |
|---|---|---|---|
| Odometer reading | Numeric, no tenths | Yes | PWA |
| Reading basis | Radio — upon date of purchase in CA / as of this date | Yes | PWA |
| Kilometers rather than miles | Checkbox | No | PWA |
| Reading is NOT actual mileage | Checkbox | No | PWA |
| Mileage EXCEEDS mechanical limits | Checkbox | No | PWA |
| Explanation of discrepancy | Text | Conditional | PWA |

### 3.5 Section 5 — Date Information

| Field | Type | Required | Collected by |
|---|---|---|---|
| Date vehicle entered or will enter California | Month / Day / Year | Conditional | PWA |
| Did not own vehicle at time of entry | Checkbox | No | PWA |
| Date vehicle first operated in California | Month / Day / Year | Conditional | PWA |
| Date went to work in CA, obtained CA DL, or became resident | Month / Day / Year | Conditional | PWA |
| Not a California resident | Checkbox | No | PWA |
| Date vehicle purchased or acquired | Month / Day / Year | Yes | PWA |
| Vehicle condition at acquisition | Radio — New / Used | Yes | PWA |
| Place of purchase | Radio — Inside CA / Outside CA | Yes | PWA |

### 3.6 Section 6 — Cost Information

Exactly one of the three acquisition rows must be selected.

| Field | Type | Required | Collected by |
|---|---|---|---|
| Acquisition method | Radio — Purchase / Gift / Trade | Yes | PWA |
| Purchase price | Currency | Conditional | PWA |
| Gift — current market value | Currency | Conditional | PWA |
| Trade — value when acquired | Currency | Conditional | PWA |
| Acquired from | Radio — Dealer / Private Party / Dismantler / Immediate Family Member | Yes | PWA |
| Family relationship | Text | Conditional | PWA |
| Body type modifications, additions or alterations made? | Yes / No | Yes | PWA |
| Revived junk or salvage — total cost including labour | Currency | Conditional | PWA |

> Cost must include basic vehicle, trade-in value, and permanently attached accessories and leased equipment. It excludes sales tax, insurance, finance charges and warranty. The PWA states this inline, above the amount field.

### 3.7 Section 7 — Out-of-State or Out-of-Country Vehicles

Entire section conditional on Section 5 indicating out-of-state origin.

| Field | Type | Required | Collected by |
|---|---|---|---|
| Sales tax paid to another state? | Radio — N/A / Yes / No | Conditional | PWA |
| Amount of tax paid | Currency | Conditional | PWA |
| Commercial vehicle last registered as | Radio — Commercial / Non-commercial | Conditional | PWA |
| Disposition of out-of-state plates | Radio — Expired / Surrendered to CA DMV / Destroyed / Retained / Returned to issuing state | Conditional | PWA |

### 3.8 Section 8 — Military Service Information

| Field | Type | Required | Collected by |
|---|---|---|---|
| You or spouse on active duty, US Uniformed Services? | Yes / No | Yes | PWA |
| On active duty when vehicle was last licensed? | Yes / No | Conditional | PWA |
| State or country stationed | Text | Conditional | PWA |

### 3.9 Section 9 — Certifications

**Not collected by the PWA.** Signature under penalty of perjury per CVC §1808.21 is executed on paper at the counter.

| Field | Type | Collected by |
|---|---|---|
| Printed name — owner | Text | Derived from Section 2 on the printed form |
| Owner's signature | Wet signature | **Counter** |
| Date | Date | **Counter** |
| Daytime telephone number | Phone | PWA — pre-printed |
| Printed name, signature, date, telephone — co-owners 1 and 2 | As above | **Counter** (telephone via PWA) |

Page 2 additionally repeats VIN, Vehicle Make and Year Model as a carry-forward header. These are `Derived` — populated from Section 1, never re-asked.

### 3.10 Conditional Logic Summary

| Condition | Effect |
|---|---|
| Type of Vehicle = Trailer Coach | Show length/width and address-where-located |
| Type of Vehicle = Motorcycle | Show motorcycle engine number |
| Commercial at 10,001 lbs = Yes | Show axles and unladen weight; **prompt REG 4008** |
| Vehicle used for hire = Yes | Notice: Motor Carrier Permit may be required |
| Acquisition = Gift | Show market value; **prompt REG 256** |
| Acquisition = Trade | Show trade value |
| Acquired from = Immediate Family Member | Show relationship field |
| Body modifications = Yes | **Prompt REG 5036** |
| Active duty = Yes | Show follow-up questions; **prompt REG 5045** |
| Purchased Outside CA | Show entire Section 7 |
| Odometer discrepancy checked | Show explanation field |
| Lienholder = none | Print "NONE" into the name field |

---

## 4. DL 44 Handling

The PWA does not implement DL 44. See `../forms/README.md` for why — the paper form carries a per-copy barcode and is not reproducible, and DMV already operates the electronic equivalent.

### 4.1 What the PWA does provide

| Element | Behaviour |
|---|---|
| Document checklist | DL and REAL ID requirements for the selected sub-transaction |
| Hand-off notice | States the DMV account and 2FA requirement, and the 15-minute timeout, before the customer starts |
| Outbound link | Opens `edl.dmv.ca.gov` in a new tab |
| Confirmation capture | Single field storing the returned confirmation number against the token |
| Chatbot | DL and REAL ID questions throughout |

### 4.2 Data boundary

The PWA collects, for the DL path, **only the confirmation number**. No SSN. No name. No date of birth. No address. No uploaded documents.

This boundary is a requirement, not an implementation detail, and must survive any future scope change.

---

## 5. Validation Rules

Two distinct layers. Only the first is in Phase 1.

**Format validation — in the form, no API** (client §6)

| Field | Rule |
|---|---|
| VIN | 17 alphanumeric characters; excludes I, O, Q; check-digit validated where applicable |
| California license plate | 7 characters |
| Driver license / ID number, California | One letter followed by seven digits |
| Driver license / ID number, other states | Format validated where a known pattern exists |
| Year Model | Four digits, 1900 to current year + 1 |
| ZIP | Five digits, or ZIP+4 |
| Currency | Non-negative; two decimal places |
| Odometer | Non-negative integer; no tenths |
| Dates | Valid calendar date; acquisition date not in the future |
| Telephone | Ten digits, North American format |
| Required fields | Flagged on the review screen, not blocking mid-form entry |

This catches typing errors at the point of entry and needs no connection to any DMV system.

**Record validation — requires a DMV API** *(Phase 2, client §6 and §7.4)*

Confirms that the plate or DL number is real, active, and belongs to the customer, so the technician processes an already-validated record. Out of scope for Phase 1; see `01_Product_Requirements_Document.md` §6.6 and `04_Client_Requirements_Alignment.md` §3.2.

Validation is advisory throughout. A customer may submit an incomplete application; gaps are flagged to the technician rather than blocking submission. A blocked form on a phone in a queue produces abandonment, which is a worse outcome than a partial form.

---

## 6. Content Requirements

| Content | Owner | Needed by |
|---|---|---|
| Document checklists, all VR and DL sub-transactions | DMV Program | Design approval |
| Current fee schedule or live fee lookup | DMV Program | Build start |
| Chatbot knowledge base, VR and DL | DMV Program | Chatbot build |
| Office data — names, addresses, hours, layouts | DMV Field Ops | Pilot |
| Spanish translation of all interface copy and checklists | DMV Program | Pilot |
| Plain-language explanation of AND / OR co-ownership | DMV Program + Legal | Build start |

---

## 7. Sources

- `../client_docs/PWA_User_Flow.pdf` — client requirements document
- [REG 343, Application for Title or Registration (REV. 4/2021)](https://www.dmv.ca.gov/portal/uploads/2022/01/REG-343-R4-2021.pdf)
- [Apply Online for a Driver License or ID Card (eDL 44)](https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/)
- [Driver's License and ID Application portal](https://www.edl.dmv.ca.gov/)
