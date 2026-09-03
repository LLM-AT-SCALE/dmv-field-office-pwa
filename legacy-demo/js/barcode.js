/* ==========================================================================
   Code 39 barcode — client requirements §4

   The technician may scan the customer's token instead of typing it. Code 39
   is the right symbology here: it encodes A–Z, 0–9 and a hyphen, which is
   exactly the shape of our tokens (A-042), every counter scanner reads it
   without configuration, and it needs no checksum.

   Drawn as inline SVG. No library, no image request, scales without blurring.
   ========================================================================== */

/* Each character is nine elements, alternating bar and space, of which three
   are wide. 1 = wide, 0 = narrow. */
const CODE39 = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

const NARROW = 2;   // px per narrow element
const WIDE   = 5;   // px per wide element — must be 2–3x narrow
const QUIET  = 20;  // quiet zone; scanners need it to find the symbol

/* Returns an SVG string encoding `value`, or an empty string if any character
   cannot be represented. */
function code39SVG(value, height) {
  const text = String(value || '').toUpperCase();
  const h = height || 60;

  /* '*' delimits the symbol at both ends in Code 39. */
  const chars = ('*' + text + '*').split('');
  if (chars.some(c => !CODE39[c])) {
    console.warn('[barcode] cannot encode', value);
    return '';
  }

  let x = QUIET;
  let bars = '';

  chars.forEach((c, ci) => {
    const pattern = CODE39[c];
    for (let i = 0; i < 9; i++) {
      const w = pattern[i] === '1' ? WIDE : NARROW;
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${h}" />`;  // even index = bar
      x += w;
    }
    if (ci < chars.length - 1) x += NARROW;   // inter-character gap
  });

  const total = x + QUIET;

  return `<svg class="barcode" viewBox="0 0 ${total} ${h}" width="100%" height="${h}"
               role="img" aria-label="Barcode for ticket ${text}"
               preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
            <rect width="${total}" height="${h}" fill="#FFFFFF" />
            <g fill="#000000">${bars}</g>
          </svg>`;
}
