/* ==========================================================================
   Assistant knowledge base — scripted stand-in for the grounded, Claude-backed
   chatbot. Ported unchanged from legacy-demo/js/chat.js.

   It demonstrates the safety rules from PRD §9.4 rather than the answers:
     · answers only from DMV-published content
     · every substantive answer carries a source link
     · out-of-scope questions are DECLINED, not attempted
     · no fee figures beyond the grounded set, no eligibility determinations

   The two failure modes are deliberate and must survive the port. An
   out-of-scope question gets a refusal with a pointer to a human; a question
   inside scope that matches nothing gets "I am not confident enough", not a
   guess. In this product a confident wrong answer costs someone a second trip
   across town.

   Answers carry **bold** markers rather than HTML. The renderer splits on
   them, so no assistant text is ever injected as markup. The Spanish answers
   in lib/i18n use <b> for the same emphasis; the renderer normalises one to
   the other rather than either being parsed as markup.

   EVERY ENTRY HAS A STABLE `id`. That id — not the English text — is what the
   Spanish answers, source labels and match keywords in lib/i18n are keyed by,
   so rewording an English answer never silently drops its translation.

   Matching is language-aware, and this is not cosmetic. Spanish keywords are
   ADDITIVE: chatKeywords() returns the English list plus the Spanish one, so
   "smog" and "real id" keep matching for a Spanish speaker while "millaje"
   and "gravamen" start to. Reading the English list directly would send every
   Spanish question to the low-confidence reply — the assistant answering
   nothing at all for exactly the users it was translated for.
   ========================================================================== */

import {
  chatAnswer,
  chatKeywords,
  chatSourceLabel,
  outOfScopeKeywords,
  type Lang,
  type TranslationKey,
} from '@/lib/i18n';

const DMV = 'https://www.dmv.ca.gov';

export interface AnswerSource {
  title: string;
  href: string;
}

export interface Answer {
  text: string;
  source: AnswerSource | null;
}

interface KnowledgeEntry extends Answer {
  /** Shared with lib/i18n. Changing one of these orphans a translation. */
  id: string;
  /** Lower-case ENGLISH substrings. Spanish ones are merged in at match time.
      The longest total match wins. */
  keywords: string[];
}

const KB: KnowledgeEntry[] = [
  {
    id: 'realid',
    keywords: ['real id', 'realid'],
    text: 'For a REAL ID you need one proof of identity, proof of your social security number, and **two** different proofs of California residency. Both residency documents must show your name and the same address.',
    source: { title: 'REAL ID checklist', href: `${DMV}/portal/driver-licenses-identification-cards/real-id/` },
  },
  {
    id: 'documents',
    /* 'need' was here and behaved as a stopword: it appears in "do I need a
       smog check?" and scores the same as 'smog', and the earlier entry wins a
       tie — so specific questions were answered with the generic checklist. */
    keywords: ['document', 'documents', 'bring', 'checklist'],
    text: 'It depends on your transaction. For a registration renewal: your renewal notice, proof of insurance, a smog certificate if required, and payment. For a title transfer you also need the signed title and a bill of sale.',
    source: { title: 'What to bring', href: `${DMV}/portal/vehicle-registration/` },
  },
  {
    id: 'smog',
    keywords: ['smog'],
    text: 'A smog certificate is required for most vehicles at renewal, but not for vehicles under four model years old, and not for electric vehicles. Vehicles entering California from another state almost always need one.',
    source: { title: 'Smog inspections', href: `${DMV}/portal/vehicle-registration/smog-inspections/` },
  },
  {
    id: 'fees',
    keywords: ['fee', 'cost', 'price', 'how much', 'pay'],
    text: 'Registration fees depend on the vehicle value, its weight, and your county — so I cannot quote you a figure I would trust. The DMV fee calculator gives an exact amount for your vehicle, and the technician can confirm it at the counter.',
    source: { title: 'Fee calculator', href: `${DMV}/portal/vehicle-registration/registration-fees/` },
  },
  {
    id: 'vin',
    keywords: ['vin', 'identification number'],
    text: 'The VIN is 17 characters. Look at the base of the windshield on the driver side, or on the sticker inside the driver door frame. It is also printed on your insurance card and your current registration.',
    source: { title: 'Vehicle verification', href: `${DMV}/portal/vehicle-registration/` },
  },
  {
    id: 'odometer',
    keywords: ['odometer', 'mileage'],
    text: 'Enter the whole number shown on the odometer, without tenths. An odometer reading is required for vehicles under ten model years old. If the reading is not the true mileage, say so on the form — that is a legal declaration.',
    source: { title: 'Odometer disclosure', href: `${DMV}/portal/vehicle-registration/titles/` },
  },
  {
    id: 'lien',
    keywords: ['lien', 'lienholder', 'finance', 'loan'],
    text: 'If a bank or finance company holds a loan on the vehicle, they are the legal owner and must be listed. If the vehicle is paid off outright, the form records "NONE" — this app handles that for you.',
    source: { title: 'Titles and liens', href: `${DMV}/portal/vehicle-registration/titles/` },
  },
  {
    id: 'coowner',
    keywords: ['and', 'or', 'co-owner', 'coowner', 'joint'],
    text: 'Joining co-owners with **AND** means every owner must sign to sell or transfer the vehicle later. **OR** means any single owner can sign alone. It is difficult to change afterwards, so choose deliberately.',
    source: { title: 'Co-ownership', href: `${DMV}/portal/vehicle-registration/titles/` },
  },
  {
    id: 'whichService',
    keywords: ['which service', 'not sure', 'dl or vr', 'right queue', 'right line'],
    text: 'If it concerns a vehicle — registration, title, plates — choose Vehicle Registration. If it concerns you as a driver — your license, a REAL ID, an identification card — choose Driver License. If you need both, take a Driver License ticket first; that line is usually longer.',
    source: { title: 'Field office services', href: `${DMV}/portal/field-office/` },
  },
  {
    id: 'missing',
    keywords: ['missing', 'do not have', "don't have", 'forgot'],
    text: 'You can still get in line, and the technician will tell you exactly what is outstanding. But if a required document is missing, the transaction usually cannot be completed today. It may be worth checking the list before you wait.',
    source: { title: 'What to bring', href: `${DMV}/portal/field-office/` },
  },
  {
    id: 'appointment',
    keywords: ['appointment', 'book'],
    text: 'Appointments are booked on the DMV website rather than here. If you already have one, you still check in at the front desk when you arrive.',
    source: { title: 'Appointments', href: `${DMV}/portal/appointments/` },
  },
  {
    id: 'wait',
    keywords: ['how long', 'wait', 'queue', 'line', 'busy'],
    text: 'Your live position and estimated wait are shown on your ticket screen. The estimate updates as the counters move.',
    source: null,
  },
  {
    id: 'signature',
    keywords: ['sign', 'signature'],
    text: 'You sign at the counter, on paper. California law requires this form to be signed in person under penalty of perjury, so a digital signature is not accepted. Filling it in here still saves the technician keying it all in.',
    source: { title: 'Vehicle Code §1808.21', href: `${DMV}/portal/vehicle-registration/` },
  },
];

/* Matched as whole words (see hasPhrase), so 'point' no longer fires inside
   'appointment' and 'fine' no longer fires inside 'defined'. The plural is
   listed explicitly for the same reason: whole-word matching means 'point'
   does not cover 'points'.

   'ticket' was in this list in the legacy demo and has been REMOVED. In this
   product "ticket" is the customer's queue token — it is the label on their
   own screen, t('ticket.label') is literally "Your ticket" — so "how long
   until my ticket is called" was being refused as if it were a traffic
   citation. Traffic tickets are still declined via citation / fine / court /
   dui. This is the one judgement call in the port rather than a straight
   defect fix; restoring the old behaviour is putting 'ticket' back below. */
const OUT_OF_SCOPE = [
  'citation', 'fine', 'court', 'dui', 'suspend', 'suspended', 'point', 'points',
  'insurance claim', 'accident', 'crash', 'sell my', 'buy a car', 'weather', 'joke',
];

const DECLINED: Answer = {
  text: 'That falls outside what I can help with — I only cover vehicle registration and driver license questions for this office. The technician at the counter can point you to the right place, or dmv.ca.gov has the full range of services.',
  source: null,
};

const UNCERTAIN: Answer = {
  text: 'I am not confident enough to answer that one, and a wrong answer here could cost you a second trip. Please ask the technician when your number is called.',
  source: null,
};

/* Match whole words, not substrings.

   `includes()` made the out-of-scope word 'point' match 'appointment', so the
   assistant DECLINED "Do I need an appointment?" — refusing a common, in-scope
   question it had a good answer for, and sending the customer to queue again to
   ask a human. A decline is a dead end, which makes it worse than a merely
   imprecise answer.

   Padding both sides and reducing punctuation to spaces is used instead of \b
   because \b is ASCII-only: it treats the 'é' in 'certificación' as a word
   boundary, which would quietly break the Spanish matcher. */
function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
}

function hasPhrase(haystack: string, phrase: string): boolean {
  const needle = words(phrase).trim();
  return needle ? haystack.includes(` ${needle} `) : false;
}

/** The scripted answer for a question in the language it was asked in, or null
    for an empty one. */
export function answerFor(question: string, lang: Lang): Answer | null {
  const raw = question.trim();
  if (!raw) return null;
  const q = words(raw);

  /* Declined BEFORE any knowledge match, so a question about a citation is
     refused rather than half-answered from the nearest registration entry. */
  if (outOfScopeKeywords(OUT_OF_SCOPE, lang).some((word) => hasPhrase(q, word))) {
    return { text: chatAnswer('outOfScope', DECLINED.text, lang), source: null };
  }

  let best: KnowledgeEntry | null = null;
  let bestScore = 0;
  KB.forEach((entry) => {
    const keywords = chatKeywords(entry.id, entry.keywords, lang);
    const score = keywords.reduce((n, k) => (hasPhrase(q, k) ? n + k.length : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  });

  /* No guess. In this product a confident wrong answer costs someone a second
     trip across town, so "I do not know, ask the technician" is the correct
     output rather than a fallback. */
  if (!best) return { text: chatAnswer('lowConfidence', UNCERTAIN.text, lang), source: null };

  const matched: KnowledgeEntry = best;
  return {
    text: chatAnswer(matched.id, matched.text, lang),
    source: matched.source
      ? {
          /* The LABEL translates; the URL does not. Splicing /es/ into a DMV
             path would fabricate a link that may 404, and a broken citation is
             worse than an English one. */
          title: chatSourceLabel(matched.source.title, lang),
          href: matched.source.href,
        }
      : null,
  };
}

/* The chips offered before the customer has typed anything.

   Translation keys rather than literals: the chip text is what gets ASKED, so
   in Spanish the question that reaches the matcher is Spanish and hits the
   Spanish keywords. Reviewed copy for all four is in the dictionary. */
export const SUGGESTED_QUESTION_KEYS: TranslationKey[] = [
  'chat.chipDocuments',
  'chat.chipSmog',
  'chat.chipFees',
  'chat.chipVin',
];
