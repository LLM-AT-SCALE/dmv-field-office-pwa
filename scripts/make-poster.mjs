/* ==========================================================================
   Office QR posters — one printable page and one PNG per office

   Run:  npm run poster                            # the deployed app
         npm run poster -- --base http://192.168.1.14:3000/o   # a laptop on the LAN
         POSTER_BASE_URL=https://dmv.ca.gov/go npm run poster

   The QR code is the product's front door, not a debugging aid: a customer
   arrives, scans the poster, and the app opens on their own phone. These are
   meant to be printed and taped to a wall, or dropped into a slide.

   The short URL is printed beneath every code because a QR is useless to
   someone whose camera will not focus, whose lens is cracked, or who does not
   know that pointing a camera at a square does anything.

   PNGs are rendered with headless Chrome rather than a rasteriser library, so
   this needs no native dependency — the posters are just HTML.
   ========================================================================== */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import QRCode from 'qrcode';

const OFFICES = [
  { id: 'folsom', name: 'Folsom Field Office', city: 'Folsom' },
  { id: 'sacramento-south', name: 'Sacramento South Field Office', city: 'Sacramento' },
  { id: 'roseville', name: 'Roseville Field Office', city: 'Roseville' },
];

/* The deployed service. A code carrying a localhost or LAN address is worse
   than no code: it scans, it looks like it worked, and it fails on every phone
   that is not on that one network. */
const DEPLOYED = 'https://rfdbdxz8mh.us-west-2.awsapprunner.com/o';

function lanAddress() {
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return 'localhost';
}

const argIndex = process.argv.indexOf('--base');
const base =
  (argIndex > -1 ? process.argv[argIndex + 1] : null) ??
  process.env.POSTER_BASE_URL ??
  DEPLOYED;

const OUT = 'QR_code';
mkdirSync(OUT, { recursive: true });

/* Embedded so a poster file is self-contained: it can be emailed, opened from
   anywhere, and rendered without the app running. */
const logo = existsSync('public/dmv-logo.png')
  ? `data:image/png;base64,${readFileSync('public/dmv-logo.png').toString('base64')}`
  : null;

const STYLE = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, sans-serif; color: #101010; background: #fff; }
  .poster {
    width: 1240px; height: 1754px;           /* A4 at 150dpi */
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 96px 80px; page-break-after: always;
  }
  .logo { height: 96px; width: auto; margin-bottom: 56px; }
  .agency { font-size: 22px; letter-spacing: .2em; text-transform: uppercase; color: #5C6470; margin: 0 0 16px; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 76px; line-height: 1.05; margin: 0 0 24px; }
  .lede { font-size: 40px; line-height: 1.25; margin: 0 0 56px; max-width: 20ch; font-weight: 600; }
  .qr { width: 560px; height: 560px; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .url { margin: 40px 0 0; font-size: 30px; }
  .url b { font-weight: 700; }
  .foot { margin: 40px 0 0; font-size: 26px; line-height: 1.45; color: #5C6470; max-width: 30ch; }
  .badge {
    margin-top: 48px; font-size: 18px; letter-spacing: .16em; text-transform: uppercase;
    color: #7A5200; border: 2px solid currentColor; border-radius: 3px; padding: 8px 16px;
  }

  /* Staff card: unmistakably not a customer poster. */
  .poster.staff { background: #F4F5F7; }
  .poster.staff h1 { color: #163159; }
  .poster.staff .warn {
    margin: 40px 0 0; max-width: 32ch; font-size: 24px; line-height: 1.45;
    color: #C02718; border: 2px solid currentColor; border-radius: 4px; padding: 20px 24px;
  }
`;

function cardBody({ name, url, svg }) {
  const plain = url.replace(/^https?:\/\//, '');
  return `<section class="poster">
  ${logo ? `<img class="logo" src="${logo}" alt="State of California Department of Motor Vehicles">` : ''}
  <p class="agency">California Department of Motor Vehicles</p>
  <h1>${name}</h1>
  <p class="lede">Skip the wait.<br>Start on your phone.</p>
  <div class="qr">${svg}</div>
  <p class="url">or go to <b>${plain}</b></p>
  <p class="foot">Take your place in the queue and fill in your form while you wait. No app to install, no account needed.</p>
  <p class="badge">Prototype</p>
</section>`;
}

function posterHtml(card, standalone) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${card.name} — QR</title>
<style>${STYLE}${standalone ? '' : '\n  @media print { .poster { height: 100vh; } }'}</style>
</head><body>
${cardBody(card)}
</body></html>`;
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function renderPng(htmlPath, pngPath) {
  if (!existsSync(CHROME)) return false;
  try {
    execFileSync(
      CHROME,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--default-background-color=ffffffff',
        '--window-size=1240,1754',
        `--screenshot=${resolve(pngPath)}`,
        `file://${resolve(htmlPath)}`,
      ],
      { stdio: 'ignore', timeout: 60_000 },
    );
    return existsSync(pngPath);
  } catch {
    return false;
  }
}

const origin = base.replace(/\/o\/?$/, '').replace(/\/$/, '');

async function qr(value) {
  return QRCode.toString(value, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#101010', light: '#FFFFFF' },
  });
}

const cards = await Promise.all(
  OFFICES.map(async (office) => {
    const url = `${base.replace(/\/$/, '')}/${office.id}`;
    return { ...office, url, svg: await qr(url) };
  }),
);

console.log(`Base: ${base}\n`);

for (const card of cards) {
  const htmlPath = `${OUT}/${card.id}.html`;
  const pngPath = `${OUT}/${card.id}.png`;
  writeFileSync(htmlPath, posterHtml(card, true));
  const ok = renderPng(htmlPath, pngPath);
  console.log(`  ${card.city.padEnd(12)} ${ok ? pngPath : `${htmlPath} (PNG render unavailable)`}`);
  console.log(`  ${''.padEnd(12)} ${card.url}\n`);
}

/* One page carrying every card, for printing in a single pass. */
writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Field Office QR posters</title><style>${STYLE}</style></head><body>
${cards.map((c) => cardBody(c)).join('\n')}
</body></html>`,
);

/* The counter is staff-facing. It gets a plain text file rather than a QR
   deliberately: a QR code with no context ends up taped to the lobby wall
   beside the customer posters, and while the demo auth flag is set anyone who
   scans it can read every application at that office. */
writeFileSync(
  `${OUT}/counter-url.txt`,
  [
    'Counter view — STAFF ONLY',
    '',
    `${origin}/counter`,
    '',
    'Do not print this as a poster and do not display it in a lobby.',
    'This prototype has no staff sign-in: anyone with this URL can read',
    'every application at the office. Use with test data only.',
    '',
    'To use it: take a ticket in the customer app, fill in some fields,',
    'then type the token number (for example A-042) into the counter.',
    '',
  ].join('\n'),
);

console.log(`  ${'Counter'.padEnd(12)} ${OUT}/counter-url.txt`);
console.log(`  ${''.padEnd(12)} ${origin}/counter\n`);
console.log(`  All three, printable: ${OUT}/index.html`);
console.log(`\nScan one with a phone camera. Posters point at the deployed app,`);
console.log(`so they work from any network — no Wi-Fi to match.`);
