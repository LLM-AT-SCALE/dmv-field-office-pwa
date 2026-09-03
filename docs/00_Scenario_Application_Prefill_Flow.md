# Field Office PWA — Application Pre-Fill Scenario

**Date:** 12 August 2026
**Context:** Clarifying the "fill the application while waiting in line" scenario for the Field Office Progressive Web App (VR / DL services).

---

## Summary

The working understanding is correct in essence: the customer scans a QR code in the field office, fills out the application on their phone while waiting, the data is stored, and the field officer retrieves it pre-filled at the counter for further processing.

Two things need to be made explicit — the mechanism that makes it work without a login, and a cost that has not yet been accounted for.

---

## The Exact Flow

1. Customer scans the office QR code → PWA opens, already knows which office from the code
2. Customer picks **Vehicle Registration** or **Driver License**
3. Customer receives a token — e.g. **A-042** — from the queue system
4. Customer fills the application on their phone, autosaved field by field against A-042
5. Queue position updates live while they fill it in
6. "Now serving A-042" → customer walks to the counter
7. Officer enters or scans **A-042** → the submitted form appears pre-filled on their screen
8. Officer checks the physical documents against what is on screen, corrects anything, processes the transaction
9. Record is deleted once the transaction closes

### The token number is the identity

This is the key design point. No login, no account, no email address — the token is what ties an anonymous phone to a specific person standing at a specific counter.

It is what allows a personalised handoff with zero authentication, and it is what keeps the app lightweight. This should be stated plainly in the scope and design deck.

---

## Not Yet Costed: The Officer-Side Application

Steps 7 and 8 constitute a **second application**:

- Staff-facing
- Requires real authentication
- Runs on DMV workstations
- Ideally sits next to, or inside, whatever counter software already exists

This is not a small addition. It roughly doubles the build surface, and it is the piece that forces DMV IT to actively engage rather than simply hand over an API specification.

**Action:** add it to the scope as its own line item before it gets absorbed silently into the PWA estimate.

---

## The Decision That Sets the Difficulty: Do We Store the PII?

The moment a DL application is saved, the system holds **name, date of birth, address, and very likely SSN**. That erases the "no login, no personal data, light security review" advantage that made this project attractive in the first place.

### Two paths

| Path | What it means | Trade-off |
|------|---------------|-----------|
| **Store it** | Encryption at rest, officer access control, audit logging, retention policy, full DMV security review | Workable, but becomes the long pole — longer than the build itself |
| **Do not store it** | Form stays in the phone's local storage; on submit it renders a QR or barcode the officer scans at the counter | Data goes phone → officer screen with nothing at rest; far faster to approve |

### Recommendation

Design for storage, but make it **aggressively transient**:

- The record exists only from submit until the transaction closes, or end of day — whichever comes first
- Then hard delete

This makes it a **handoff buffer, not a system of record**, which shortens the security conversation considerably.

Additionally: if the form requires SSN, consider leaving that single field to be spoken at the counter. Keeping SSN out of the database entirely is worth the small friction.

---

## For the Demo

None of the above blocks the demo. Mock the storage and show the flow end to end — **including the officer screen**.

That officer screen is what will sell the concept, because it is the moment the whole idea pays off.

---

## Open Question

Which form should the demo use?

- A **real DMV form** — REG 343 (vehicle registration) or DL 44 (driver license)
- A **simplified stand-in**

Real forms make the demo land considerably harder.
