/* ==========================================================================
   Assistant matcher regression check

   Run: npm run check:assistant

   Why this exists as a committed script rather than a throwaway.

   The assistant is the one component where a silent failure looks exactly like
   a working one. It always returns prose, so a broken matcher does not throw,
   does not fail a type check, and does not look wrong on screen — it just
   answers the wrong question, or refuses one it can answer. Two real bugs of
   that shape shipped and survived review:

     'point' in the out-of-scope list matched 'appointment' by substring, so
     "Do I need an appointment?" was DECLINED — the assistant refusing a common
     question it had a good answer for, and sending the customer back to queue.

     'need' behaved as a stopword in the documents entry and outscored 'smog'
     and 'lien' on a tie, so specific questions got the generic checklist.

   Both were invisible to tsc, eslint and a demo. Hence the cases below.

   Deliberately zero-dependency: no test framework, no config, nothing to keep
   current. When a real model replaces the script, this file goes with it — but
   the out-of-scope guard will likely survive as a rail, and these cases should
   move with it.
   ========================================================================== */

import { readFileSync } from 'node:fs';

const SOURCE = 'components/customer/assistant-kb.ts';
const src = readFileSync(new URL(`../${SOURCE}`, import.meta.url), 'utf8');

/* The matcher is pulled out of the TypeScript source rather than imported, so
   this runs with plain node and cannot drift from what actually ships: if the
   helpers are renamed or removed, this fails loudly instead of testing a copy. */
function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${SOURCE} no longer defines ${name}() — matcher was changed, update this check`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) {
      return src.slice(start, i + 1).replace(/:\s*string/g, '').replace(/:\s*boolean/g, '');
    }
  }
  throw new Error(`could not read ${name}()`);
}

const { words, hasPhrase } = new Function(
  `${extract('words')}\n${extract('hasPhrase')}\nreturn { words, hasPhrase };`,
)();

/* The out-of-scope list, read from source so it cannot drift. */
const OUT_OF_SCOPE = JSON.parse(
  '[' + src.match(/const OUT_OF_SCOPE = \[([\s\S]*?)\];/)[1].replace(/'/g, '"').replace(/,\s*$/, '') + ']',
);

const declined = (q) => OUT_OF_SCOPE.some((w) => hasPhrase(words(q), w));

const CASES = [
  /* [question, keyword or null, expectation] */
  ['Do I need an appointment?',        null,            { declined: false }],
  ['When is my appointment?',          null,            { declined: false }],
  ['Can I make an appointment?',       null,            { declined: false }],
  ['I got a parking citation',         null,            { declined: true  }],
  ['My licence was suspended',         null,            { declined: true  }],
  ['I want to sell my car',            null,            { declined: true  }],

  ['Do I need a smog check?',          'smog',          { matches: true }],
  ['Do I need a lien release?',        'lien',          { matches: true }],
  /* Whole-word matching means singular and plural are DIFFERENT keywords. The
     entry lists both; this pins that, because dropping one is a silent
     regression — the customer just quietly gets the wrong answer. */
  ['What documents do I need?',        'documents',     { matches: true }],
  ['What document do I need?',         'document',      { matches: true }],
  ["What's the VIN?",                  'vin',           { matches: true }],
  ['fees — how much?',                 'fees',          { matches: true }],

  /* Spanish: accents and inverted punctuation must not break word boundaries. */
  ['¿Dónde está el VIN?',              'vin',           { matches: true }],
  ['¿Se requiere certificación smog?', 'certificación', { matches: true }],
  ['¿Necesito una cita?',              'cita',          { matches: true }],

  /* Substring must never match: this is the bug that shipped. */
  ['appointment',                      'point',         { matches: false }],
  ['documentation',                    'document',      { matches: false }],
];

let failed = 0;
for (const [question, keyword, expect] of CASES) {
  let actual, label;
  if ('declined' in expect) {
    actual = declined(question);
    label = expect.declined ? 'declined' : 'answered';
  } else {
    actual = hasPhrase(words(question), keyword);
    label = `${expect.matches ? 'matches' : 'ignores'} "${keyword}"`;
  }
  const want = 'declined' in expect ? expect.declined : expect.matches;
  const ok = actual === want;
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label.padEnd(22)} ${JSON.stringify(question)}`);
}

/* The plural rule above only holds if the entry actually lists both forms.
   Check the source rather than trusting the cases. */
const documentsKeywords = src.match(/id: 'documents',[\s\S]*?keywords: \[(.*?)\]/)?.[1] ?? '';
for (const form of ["'document'", "'documents'"]) {
  const present = documentsKeywords.includes(form);
  if (!present) failed++;
  console.log(`${present ? '  ok  ' : '  FAIL'} ${'keyword listed'.padEnd(22)} ${form} in the documents entry`);
}

console.log(`\n${CASES.length + 2 - failed}/${CASES.length + 2} passed`);
process.exit(failed ? 1 : 0);
