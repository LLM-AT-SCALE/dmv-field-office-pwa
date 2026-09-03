import * as React from "react"

import { cn } from "@/lib/utils"

type BarcodeProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** SVG markup produced elsewhere (the encoder lives outside components/). */
  svg: string
  /** Accessible name — the human-readable value the barcode encodes. */
  label: string
  /** Shown if the markup fails the safety check. */
  fallback?: React.ReactNode
}

const SVG_ROOT = /^\s*<svg[\s>]/i
const ACTIVE_ELEMENTS = /<\s*(script|iframe|object|embed|foreignObject|style|link|meta)\b[\s\S]*?(<\s*\/\s*\1\s*>|\/>)/gi
const EVENT_HANDLERS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const SCRIPT_URLS = /\b(href|xlink:href|src)\s*=\s*("|')\s*(javascript|data:text\/html)[^"']*\2/gi

/**
 * The markup is generated server-side and injected as HTML, so it is filtered
 * first: anything that could execute — script and friends, inline event
 * handlers, javascript: and data:text/html URLs — is stripped, and anything
 * that is not an <svg> root is refused outright rather than rendered.
 */
function sanitizeSvg(svg: string): string | null {
  if (!SVG_ROOT.test(svg)) return null

  const cleaned = svg
    .replace(ACTIVE_ELEMENTS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(SCRIPT_URLS, "")

  return SVG_ROOT.test(cleaned) ? cleaned : null
}

/**
 * Scanners need maximum contrast, so the plate stays white whatever surface it
 * lands on (.barcode-plate in globals.css).
 */
function Barcode({ svg, label, fallback, className, ...props }: BarcodeProps) {
  const safeSvg = sanitizeSvg(svg)

  if (!safeSvg) {
    return (
      <div
        data-slot="barcode"
        data-state="unavailable"
        className={cn(
          "barcode-plate flex min-h-13 items-center justify-center border border-border",
          className
        )}
        {...props}
      >
        <span className="text-small leading-normal text-muted-foreground">
          {fallback ?? label}
        </span>
      </div>
    )
  }

  return (
    <div
      data-slot="barcode"
      role="img"
      aria-label={label}
      className={cn(
        "barcode-plate border border-border [&>svg]:h-auto [&>svg]:w-full",
        className
      )}
      {...props}
      dangerouslySetInnerHTML={{ __html: safeSvg }}
    />
  )
}

export { Barcode }
