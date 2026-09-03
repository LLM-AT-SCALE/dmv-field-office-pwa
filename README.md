# Field Office PWA

A Progressive Web App for DMV field offices. A customer scans a QR code, takes a
place in the queue, and completes their application on their own phone while
they wait. When their number is called, the technician already has it on screen.

Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui

---

## Live

**https://rfdbdxz8mh.us-west-2.awsapprunner.com**

| | |
|---|---|
| Folsom | [/o/folsom](https://rfdbdxz8mh.us-west-2.awsapprunner.com/o/folsom) |
| Sacramento South | [/o/sacramento-south](https://rfdbdxz8mh.us-west-2.awsapprunner.com/o/sacramento-south) |
| Roseville | [/o/roseville](https://rfdbdxz8mh.us-west-2.awsapprunner.com/o/roseville) |
| Counter (staff) | [/counter](https://rfdbdxz8mh.us-west-2.awsapprunner.com/counter) |

**Synthetic data only.** This is a prototype on an AWS account DMV has not
reviewed, and the counter currently has no staff sign-in — anyone with that URL
can read every application. Do not enter real customer details.

Deployment, and the failures already encountered: **[DEPLOYMENT.md](DEPLOYMENT.md)**

---

## QR codes

`QR_code/` — one PNG per office, A4 at 150dpi (1240 × 1754), ready to print or
drop into a slide.

```
QR_code/folsom.png
QR_code/sacramento-south.png
QR_code/roseville.png
QR_code/index.html           all three, printable in one pass
QR_code/counter-url.txt      the staff counter URL, in plain text
```

Regenerate with `npm run poster`. They point at the deployed app, so they work
from any network — a phone on cellular can scan one and get in.

**There is deliberately no QR code for the counter.** It is a staff URL, and a
QR with no context ends up taped to the lobby wall beside the customer posters.
While the demo auth flag is set, anyone who scans it can read every application
at that office. The URL lives in `counter-url.txt` instead, with that warning
next to it.

---

## Run it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

| Route | |
|---|---|
| `/o/folsom` | Customer app. Also `sacramento-south`, `roseville` |
| `/counter` | Staff counter view |
| `/` | Redirects to the default office |

Open the customer app on a phone and the counter on a laptop — unlike the earlier
prototype they now share a real server, so they no longer need to be the same
browser.

### Use `npm run dev` for demos

`npm run build && npm start` works, but **staff endpoints return 401 in a
production build**. That is deliberate: the staff auth stub fails closed, so it
cannot reach pilot by accident (`lib/server/auth.ts`). Until DMV single sign-on
is wired up, the counter view needs dev mode.

---

## Layout

```
app/
├── globals.css              ← every design token. Single source of truth.
├── layout.tsx               fonts, metadata
├── page.tsx                 → /o/{default}
├── o/[office]/page.tsx      customer app entry
├── counter/page.tsx         staff counter view
└── api/                     session store, queue, staff endpoints

components/
├── ui/                      shadcn primitives, customized to the design system
├── chrome/                  header, shell, skip link, grain, language toggle
├── patterns/                stat tile, notice, service tile, token display, barcode
├── customer/                the customer flow and its screens
└── counter/                 the staff screens

lib/
├── reg343/                  form schema, validators, PDF fill
├── i18n/                    typed EN/ES dictionaries and content
├── server/                  session store, retention, auth stub
├── office.ts, queue.ts      pure functions, shared by server and client
└── barcode.ts               Code 39 encoder

forms/                       the real DMV PDFs
docs/                        requirements, spec, architecture
deploy/                      build and deploy scripts (see DEPLOYMENT.md)
scripts/                     QR generation, assistant regression check
public/qr/                   generated QR codes, one per office plus counter
legacy-demo/                 the original vanilla build, kept as reference
```

---

## Design tokens

**`app/globals.css` is the only place a design value may be written.** Every
colour, radius, spacing step, type size and duration lives there, and shadcn's
semantic names are mapped onto the palette so the stock components inherit it
rather than being rewritten.

Components reference tokens only — `bg-primary`, `rounded-pill`, `text-token`,
`min-h-13`. No hex, no `p-[13px]`, no inline durations. The rule is enforced by
review, and it held across four agents building in parallel.

Two token pairs exist because one value could not serve both roles: gold works
as a **background** but fails AA as text on white, so `--gold-ink` is the darker
text form; the same applies to primary on dark grounds.

Light only. There is no dark mode — one appearance means one set of contrast
numbers to hold and no chance of a customer landing on a half-styled variant.

---

## Checks

```bash
npm run check:assistant     # 19 cases, zero dependencies
npm run build               # types + lint + production build
npm run poster              # regenerate the QR codes
```

The assistant is the one component where a silent failure looks exactly like a
working one: it always returns prose, so a broken matcher does not throw, does
not fail a type check, and does not look wrong on screen. It just answers the
wrong question — or refuses one it can answer.

Two bugs of that shape shipped and survived review. `'point'` in the
out-of-scope list matched `'appointment'` by substring, so the assistant
DECLINED "Do I need an appointment?" and sent the customer back to queue for a
question it had a good answer for. And `'need'` acted as a stopword, outscoring
`'smog'` and `'lien'` on a tie, so specific questions got the generic checklist.

Both were invisible to tsc, eslint and a demo. The script pins them, along with
the Spanish accent and punctuation cases that a `\b`-based matcher would fail
silently.

---

## Things that are easy to break

**Option values stay English.** A customer choosing *Automóvil* stores `Auto`;
*Gasolina* stores `Gasoline`. The completed PDF is an English legal document
filed with the State, and the PDF field mapping keys off those English strings.
Translating the value instead of the label produces a wrong form while the
interface looks perfectly correct. The Spanish option maps assert against
TypeScript literal unions, so a mistyped key is now a compile error rather than
a silent fallback.

**Validation is advisory.** It runs on blur, never while typing, and never
blocks moving to the next section. Someone standing in a queue on a borrowed
phone, blocked by a form, abandons it — which is worse than a field the
technician corrects at the counter.

**Retention is load-bearing.** Autosave writes from the first keystroke, so
every abandoned form leaves personal data behind. Tickets and their data are
deleted on whichever comes first: the technician marking the transaction
complete, or close of business. No soft delete, no archive, no backup of
application content. This is the first claim a security review will test.

**The signature is wet.** REG 343 Section 9 must be signed in person under
penalty of perjury (CVC §1808.21). The app saves the data entry, not the
signature — the technician prints and takes a signature at the counter.

---

## Accessibility

WCAG 2.1 AA, required under Section 508 and California state policy.

Focus moves to the heading of each view; a single-page app otherwise leaves the
keyboard on a control that no longer exists and never tells a screen reader
anything changed. Views without a visible heading carry a screen-reader one.
`lang` switches with the language so a screen reader picks the right voice.
Errors set `aria-invalid` and are announced. Nothing interactive is under 44px.
All motion sits behind `prefers-reduced-motion`.

**Not yet done:** testing with a real screen reader and a keyboard-only pass by
someone who did not write the code. Automated checks prove the markup; they
cannot tell you the experience makes sense.

---

## Language

English and Spanish. Spanish is a legal requirement under California language
access obligations, and it is absent from the client requirements document.

> **The Spanish is a working draft.** It was written to build and test the
> mechanism. A certified translator must review it before pilot — DMV publishes
> its own Spanish terminology, and a form is a legal document.

The counter view is English only. Staff-facing, and a deliberate deferral.

The assistant matches Spanish keywords against a merged keyword set rather than a
swapped one, and its suggestion chips are rendered from translation keys — so a
chip is asked in the language it is shown in. Before that, every Spanish question
fell through to "I am not confident enough to answer": the assistant answered
nothing for exactly the users the translation existed to serve, and it would have
demoed perfectly, because demos are given in English.

---

## What is real and what is not

| Real | Not real |
|---|---|
| Every REG 343 field, section and conditional rule | Queue positions and wait times (simulated) |
| Format validation (VIN, plate, CA licence, ZIP, phone) | Chatbot answers (scripted, not a model) |
| Filling and downloading the actual DMV PDF | Office details and checklists (static) |
| Code 39 token barcode, scanner-readable | Staff authentication (stub, fails closed) |
| Server-side autosave and enforced retention | |
| DynamoDB store — tickets survive restarts | |
| Office resolution and per-office queues | |

---

## Phase 2 — blocked on DMV IT

- **Queue system API** — vendor unidentified. A fallback that works without it
  is in `docs/03` §7, so this does not block Phase 1.
- **Record validation** — confirming a plate or licence is real and belongs to
  the customer. Needs security review and access approval.
- **eDL 44 confirmation lookup.**

Also open, and decisions rather than code: the notification channel (SMS versus
on-screen), and whether the counter screen stands alone or embeds in existing
counter software. See `docs/04_Client_Requirements_Alignment.md` §6.
