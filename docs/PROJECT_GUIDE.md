# Project Guide — Plain English

A simple explanation of this whole project. No jargon.
Last updated 13 August 2026.

---

## 1. What are we building?

A website that opens on a customer's phone when they scan a QR code at a DMV office.

It is **not** an app from the App Store. There is nothing to install. It is just a web page, but it looks and feels like an app. This is called a **PWA** (Progressive Web App).

---

## 2. What problem does it solve?

Today at a DMV office:

1. The customer arrives and takes a paper ticket.
2. They sit and wait, doing nothing, for 20 to 45 minutes.
3. Their number is called.
4. **Only then** does the staff member start typing their details into the computer, while everyone else waits.
5. If the customer forgot a document, they are sent home. They must come back another day.

Two problems here:

- The waiting time is wasted.
- The typing happens at the counter, so the queue moves slowly.

**Our idea:** let the customer fill the form on their phone *while they wait*. When their number is called, the staff member already has everything.

We do not make the wait shorter. We make the wait **useful**.

---

## 3. How does it work? (the flow)

1. Customer scans the QR code at the office. The web page opens on their phone.
2. They see the office name, opening hours, and how long the wait is.
3. They choose: **Vehicle Registration** or **Driver License**.
4. They see a list of documents they need. If something is missing, they find out **now**, not at the counter.
5. They press "Get in line" and receive a number, for example **A-042**.
6. They see their position in the queue and the estimated wait.
7. While waiting, they fill in the form on the phone. It saves automatically as they type.
8. Their number A-042 is called.
9. The staff member types **A-042** into their computer, and the completed form appears.

**The key idea:** the ticket number A-042 is what connects the customer to their form. That is why the customer never needs a username or password.

---

## 4. The two forms — this is important

There are two forms, and they need **different** solutions.

### Vehicle Registration → form REG 343

- DMV publishes this as a PDF that can be filled in.
- We can collect the data in our app and produce the completed PDF for the counter.
- **Nothing like this exists today.** This is where we add real value.
- ✅ Already working in our demo.

### Driver License → form DL 44

- DMV does **not** allow this form to be downloaded. Every printed copy has its own barcode, so a downloaded copy is not valid.
- **But DMV already has an online version** called eDL 44 at `edl.dmv.ca.gov`.
- The customer fills it there, gets a confirmation number by email, and DMV staff can already look that number up.
- So we should **not** rebuild it. We just link to it and save the confirmation number against the ticket.

**Good side effect:** for driver licences we store **no personal data at all**. No social security number, no date of birth, no address. That makes the security approval much easier.

---

## 5. What is already built?

A working application, built with Next.js. Location: the project root.

| Part | Status |
|---|---|
| Customer app — 5 screens | ✅ Done |
| Staff screen (counter view) | ✅ Done |
| All REG 343 fields with the real rules | ✅ Done |
| Filling the real DMV PDF and downloading it | ✅ Done |
| Chatbot | ⚠️ Fake — fixed answers, not real AI |
| Queue numbers | ⚠️ Fake — no connection to DMV yet |
| Spanish | ✅ Done — working draft, needs certified review |
| Server-side saving and daily deletion | ✅ Done |
| Notifications | ❌ Not built |

To run it: `npm install && npm run dev`. See `../README.md`.

---

## 6. What did the boss send back?

On 13 August he sent a requirements document: `../client_docs/PWA_User_Flow.pdf`

**Good news: he agreed with everything we sent him.** The user flow in his document is our 9 steps. The two-forms section is our finding, in almost the same words.

He added 5 new things:

1. **More ways to open the app** — not just QR. Also a short web link, lobby screens, staff pointing, and a link in the appointment email. (The appointment email is the best one, because the customer sees it *before* leaving home.)
2. **Checking records with DMV** — ask DMV if the plate or licence is real and belongs to that person. This is new and big. He put it in Phase 2, which is correct.
3. **Typing rules** — plate = 7 characters, VIN = 17, California licence = 1 letter + 7 numbers.
4. **A barcode on the phone** so staff can scan instead of typing.
5. **Flipkart Lite** as the example to follow.

---

## 7. What is missing from his document?

Four things. We should tell him.

### 7.1 Disability access and Spanish

Not mentioned anywhere.

California law requires both for a government service. A blind person must be able to use it. Spanish is required.

If we build first and add these later, we must rebuild. So it must be decided now.

**This is the most important one.**

### 7.2 The customer must still sign on paper

His document says the customer arrives with a form "ready to process."

But the law says REG 343 must be signed in person, on paper, in front of staff.

So the real steps are: staff opens the form → prints it → customer signs → staff processes.

We still save all the typing, which is most of the time. We only need to change the wording to **"ready for signature."**

### 7.3 The staff screen is a second application

His document says staff type the number into "their own screen."

That screen is a **whole separate application**. It needs staff login and must run on DMV computers. Nobody has counted this work yet. It is not small.

### 7.4 How does the customer know they were called?

His document assumes the app can tell them.

Problem: on iPhone, a website cannot send a notification unless the customer first adds it to their home screen. Most people will not do that.

So the customer must keep the page open. But the whole reason for a phone ticket is to be able to walk away. SMS is probably the answer.

---

## 8. Two things to just confirm

**Saving while typing.** He wants data saved to the server as the customer types, with no "submit" button. That is fine. But it means if someone starts and walks away, their data stays on our server. So we must delete everything every evening.

**"No personal data on our side."** True for driver licence only. For vehicle registration we *will* hold name, address and licence number. We should say this clearly, because the security team will check it.

---

## 9. The plan

| Phase | What | When |
|---|---|---|
| **Phase 0** | Demo | ✅ Done |
| **Phase 1** | Real app, no DMV connection needed. Forms, chatbot, checklists, staff screen, Spanish, disability access | 4–6 weeks |
| **Phase 2** | Connect to DMV. Real queue numbers, record checking, eDL 44 lookup | Waiting on DMV IT |

**Important:** Phase 1 needs **nothing** from DMV. We can start immediately. Only Phase 2 depends on them.

---

## 10. The biggest risk

The **queue system**.

Our app must get real ticket numbers from the machine DMV already uses in their offices. Nobody knows yet which company makes it, or whether it allows other software to connect.

If the answer is no, we cannot issue real tickets.

**But that is not fatal.** The customer can type in the number from their paper ticket instead, and everything else still works. This backup plan is written in `03_Technical_Architecture_and_Data_Model.md` §7.

The one question to ask DMV IT: **which company makes your queue system, and does it have an API?**

---

## 11. All the files

| File | What it is |
|---|---|
| `PROJECT_GUIDE.md` | This file — plain English |
| `00_Scenario_Application_Prefill_Flow.md` | The original idea |
| `01_Product_Requirements_Document.md` | Full requirements |
| `02_Functional_and_Form_Specification.md` | Every screen, every form field |
| `03_Technical_Architecture_and_Data_Model.md` | How it is built, the data, the APIs |
| `04_Client_Requirements_Alignment.md` | Our documents vs the boss's document |
| `../client_docs/PWA_User_Flow.pdf` | The boss's requirements document |
| `../forms/` | The real DMV forms |
| `../README.md` | How to run the app |
| `../app/`, `../components/`, `../lib/` | The application |
| `../legacy-demo/` | The original vanilla build, kept as reference |

---

## 12. Words you may hear

| Word | Meaning |
|---|---|
| **PWA** | A website that behaves like an app. No installation. |
| **REG 343** | The DMV vehicle registration form. |
| **DL 44** | The DMV driver licence form. Cannot be downloaded. |
| **eDL 44** | DMV's online version of DL 44. Already exists. |
| **Token** | The queue number, for example A-042. |
| **API** | A way for two computer systems to talk to each other. |
| **WCAG 2.1 AA** | The standard that makes a website usable by disabled people. |
| **PII** | Personal information — name, address, date of birth, SSN. |
| **AcroForm** | A PDF with fields you can fill in by computer. |
