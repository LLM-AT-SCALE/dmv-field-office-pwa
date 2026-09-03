/**
 * The single focus treatment for the whole app.
 *
 * The ring token is gold, and gold on white measures 1.34:1 — well under the
 * 3:1 that WCAG 2.1 SC 1.4.11 asks of a focus indicator. So the ring is paired
 * with a hairline in deep navy sitting exactly on its outer edge (3px offset +
 * 3px ring = 6px), which carries the contrast on light surfaces while the gold
 * carries it on dark ones. Every focusable element in the app imports this, so
 * a keyboard user sees one shape everywhere.
 */
export const focusRing = [
  "outline-none",
  "focus-visible:ring-3 focus-visible:ring-ring",
  "focus-visible:ring-offset-3 focus-visible:ring-offset-background",
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-deep",
  "focus-visible:outline-offset-6",
].join(" ")

/** Same treatment for elements that must not be clipped by an ancestor. */
export const focusRingInset = [
  "outline-none",
  "focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset",
  "focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-deep",
  "focus-visible:-outline-offset-2",
].join(" ")

/**
 * For a container whose focusable child is visually the whole surface (the
 * stretched-link tiles) — the ring is drawn around the card, not the link.
 */
export const focusRingWithin = [
  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring",
  "has-[:focus-visible]:ring-offset-3 has-[:focus-visible]:ring-offset-background",
  "has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-deep",
  "has-[:focus-visible]:outline-offset-6",
].join(" ")
