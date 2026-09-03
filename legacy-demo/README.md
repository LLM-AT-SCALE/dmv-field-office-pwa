# Field Office PWA — Demo

Working prototype of the customer app and the counter view. Mocked data, no backend.

---

## Run it

From the **project root** (not from `app/`) — the app reads the REG 343 template from `../forms/`:

```bash
cd Progressive_Web_Application
python3 -m http.server 8733
```

| | |
|---|---|
| **Customer app** | http://localhost:8733/app/index.html |
| **Counter view** | http://localhost:8733/app/officer.html |

Open the customer app on a phone (same Wi-Fi, use your machine's LAN address) and the counter view on a laptop. Both read the same browser storage, so **run them in the same browser** for the handoff to work — in production this is a shared backend.

### Choosing an office

Append `?office=` to either URL: `folsom` (default), `sacramento-south`, or
`roseville`. An unrecognised code falls back to the default and says so, rather
than silently showing the wrong office. In production the short URL
`dmv.ca.gov/go/folsom` rewrites to the same identifier.

### Demo pacing

The queue advances on a timer. Append a parameter to control it:

| URL | Seconds per customer served |
|---|---|
| `?fast` | 4 — the queue visibly moves during a short demo |
| *(none)* | 12 — default |
| `?slow` | 60 — realistic |

The rate is fixed when the queue is first created. **Reset demo data** in the counter view clears it.

---

## The demo, in order

1. Open the customer app. Office name, hours and live waits for both services.
2. **Get in line** → Vehicle Registration → *Title transfer*.
3. Document checklist — shown *before* the ticket, so a missing document is discovered now rather than at the counter.
4. **Get my ticket** → token `A-042`, live position and estimated wait.
5. **Start application** → REG 343, one section at a time, saving as you type.
   Try selecting *Motorcycle* or answering **Yes** to the commercial-weight question and watch fields and supplementary-form prompts appear.
6. Review → **Submit to the counter**.
7. Switch to the counter view. Enter `A-042`. The completed application is there.
8. **Download filled REG 343** — produces the real DMV PDF, filled.

For the Driver License path, the app hands off to the DMV's own online application and captures only the confirmation number.

---

## What is real and what is mocked

| Real | Mocked |
|---|---|
| Every REG 343 field, section and conditional rule | Queue positions and wait times |
| Format validation (VIN, plate, CA licence, ZIP, phone) | Office details and checklists |
| Supplementary form triggers (REG 4008, 256, 5036, 5045) | Chatbot answers (scripted, not a model) |
| The DMV PDF, filled and downloadable | Staff authentication |
| Code 39 token barcode, scanner-readable | Storage (browser only, no backend) |
| Office resolution from the URL | |
| End-of-day expiry and purge | |
| WCAG AA contrast | |

### Where the data lives

**There is no database and no server-side storage.** Everything is held in the
browser's own `localStorage` on that one device:

| Key | Holds |
|---|---|
| `fopwa.sessions` | Tickets and form answers |
| `fopwa.current` | Which ticket this browser holds |
| `fopwa.queue.<office>` | Queue counters, per office |

`python3 -m http.server` is a static file server: it sends files out and never
receives anything. The filled PDF is generated in the browser. No customer data
crosses the network.

This is also why the customer app and the counter view must run in the **same
browser** — they share storage rather than a backend. Client requirements §4
specifies server-side autosave against the token, which is Phase 1 work.

---

## Files

```
app/
├── index.html              customer app
├── officer.html            counter view
├── css/
│   ├── app.css             design tokens and components
│   └── officer.css         counter-view layout
├── js/
│   ├── i18n.js             language switching and interface strings
│   ├── i18n-content.js     Spanish services, checklists and REG 343 labels
│   ├── barcode.js          Code 39 token barcode
│   ├── store.js            mocked queue + session storage
│   ├── form-reg343.js      REG 343 field schema and conditional logic
│   ├── app.js              customer app controller
│   ├── officer.js          counter view
│   ├── pdf-fill.js         fills the real DMV PDF
│   └── chat.js             scripted assistant
├── assets/dmv-logo.png     official DMV logo, as issued
├── vendor/pdf-lib.min.js   vendored, so the demo works offline
├── manifest.webmanifest
└── sw.js                   caches the shell only, never queue data
```

---

## PDF fill

`js/pdf-fill.js` writes into the actual DMV AcroForm — 363 fields — rather than drawing a lookalike.

Two things about that form shaped the implementation:

- **Field names are generic.** `Text62` is the owner's name; `Text10` the vehicle make. They were identified by stamping every field with its own name, rendering the result, and reading it off the page.
- **The option controls are not radio groups.** They are checkbox fields sharing one name across several widgets, each with a long accessibility sentence as its export value. Standard radio-group APIs reject them, so widgets are driven directly and options are chosen by **position** on the page, top-to-bottom then left-to-right.

Section 9 signature and date are deliberately left blank — signed on paper at the counter under penalty of perjury (CVC §1808.21). Printed name and telephone are pre-filled.

The form is left editable so the technician can correct at the counter.

---

## Responsive architecture

One codebase, four intents. No separate mobile build.

| Width | Layout |
|---|---|
| **< 600px** | Single column. Form fields full width. The assistant is a floating control; on the form it moves into the sticky progress bar so it cannot cover **Next**. |
| **600–1023px** | Two-column form grid — fields marked half-width pair up, and their controls are baseline-aligned even when only one carries a hint. |
| **≥ 1024px** | The ticket becomes a **persistent rail**: token, queue position and now-serving stay in view while the customer works through the form. The assistant docks to the lower right as a panel rather than a sheet. |
| **≥ 1440px** | Content and rail widen and centre as a pair rather than drifting apart. |

The counter view runs the same range: at ≥900px the queue is a sticky left rail and record actions stack to the right of the header; below that the queue becomes a horizontal shelf so it never pushes the record off screen, and the data grid collapses from three columns to two to one.

Also handled: landscape phones (the token hero shrinks so it does not eat the viewport), and print (chrome removed, record laid out for paper).

Type is fluid throughout — `clamp()` on every step, so nothing snaps at a breakpoint.

---

## Motion

Composited properties only (`transform`, `opacity`) — nothing that triggers layout. Staggered entrances on view children, 40ms apart. Hover lifts are wrapped in `@media (hover: hover) and (pointer: fine)` so touch devices never pay for them. Everything decorative sits behind `prefers-reduced-motion`, including the grain overlay.

Deliberately **not** included, despite being common in premium UI work: scroll hijacking, custom cursors, preloaders, and magnetic buttons. This is a service used standing in a queue on a borrowed phone, and by staff under time pressure. Those patterns would cost accessibility and speed for decoration.

---

## Branding

The header carries the **official California DMV logo**, taken from the asset already used in the scope deck (`docs/Field_Office_PWA_Scope_and_Design (4).pptx`). It is reproduced as issued — never recoloured, never distorted, never used as a background fill.

A hairline rule separates the agency mark from the product name, so the product reads as a service *of* the agency rather than as part of the logo. The lockup carries two lines of microtype that stop being legible below about 40px tall, so the logo holds its height on small screens and the product subtitle yields the space instead.

Every screen carries a **PROTOTYPE** badge. Keep it until this is something DMV has actually approved for public use.

---

## Language

English and Spanish, switchable from the header. The choice is remembered, and
the operating-system language wins until one is made. Switching sets the `lang`
attribute so a screen reader picks the right voice.

Spanish is a **legal requirement** under California language access obligations
(PRD §9.3) and is absent from the client requirements document.

Translated: all interface copy, service names, document checklists, the
assistant's opening line, and every REG 343 section title, field label, hint and
option.

**One thing to understand about the form.** Labels are translated for
comprehension; the stored values stay English. A customer picking *Automóvil*
stores `Auto`, and *Gasolina* stores `Gasoline`, so the completed PDF is still
the English legal document DMV expects. This is verified in testing, because
translating the values instead of the labels would silently break the PDF
mapping.

> **These translations are working drafts.** They were written to build and
> test the mechanism. A certified translator must review them before any pilot:
> DMV publishes its own Spanish terminology, and a form is a legal document.

---

## Accessibility

Targeting WCAG 2.1 Level AA, required under Section 508 and California state
policy, and also absent from the client requirements document.

In place and verified:

- `lang` attribute, switching with the language
- Skip link to the main content
- Landmarks: header, main, aside
- Every input has an accessible name; hints are wired with `aria-describedby`
- Validation errors set `aria-invalid` and are announced
- Focus moves to the heading of each new view — a single-page app otherwise
  leaves focus on a button that no longer exists and tells a screen reader
  nothing has changed
- Views without a visible heading (the ticket screens) carry a screen-reader
  one, so focus always lands somewhere meaningful
- Assistant panel traps Tab while open, closes on Escape, and returns focus to
  whatever opened it
- Live region announces tickets issued, submissions and validation results
- Every colour pair clears AA; no touch target under 34px
- All motion behind `prefers-reduced-motion`

Not yet done: testing with a real screen reader (VoiceOver, NVDA) and a
keyboard-only pass by someone who was not the author. Both should happen before
pilot — an automated check cannot tell you whether the experience makes sense.

---

## Palette

Single light palette — there is no dark mode and no theme switching. One appearance means one thing to test, one set of contrast numbers to hold, and no chance of a customer landing on a half-styled variant.

Two token pairs exist because a single value could not serve both roles: gold works as a **background** but fails AA as text on white, and the accent as text needs a darker ink. Hence `--c-accent` / `--c-accent-ink`.

Every measured colour pair clears WCAG AA.

---

## Retention

A ticket and everything typed into it live for one visit only. They are deleted
on whichever comes first:

- the technician marking the transaction complete, or
- close of business on the day the ticket was issued.

Purging runs when the app loads, on a timer while it is open, and whenever
sessions are read. A customer returning the next day sees a plain message
saying the ticket has expired and their details were deleted.

This matters more than it looks. Once autosave writes from the first keystroke
(client §4), every abandoned form leaves personal data behind, so the purge is
the control that keeps this a handoff buffer rather than a record system — and
it is the claim a security review will test first.

---

## Known gaps

- **No notifications.** The customer must keep the page open; the mechanism is still an open decision.
- **Same-browser only.** Customer and counter views share browser storage rather than a server.
- **Chatbot is scripted**, not a model, and covers a limited set of questions.
- **No backend.** Storage is per-browser, so the customer and counter views must run in the same browser.
- **Record validation** (is the plate real, is it theirs) is Phase 2 and needs DMV API access.
- **Spanish needs certified review** before pilot; the current text is a working draft.
- **The counter view is English only.** Staff-facing, so this is a deliberate deferral, not an oversight.
