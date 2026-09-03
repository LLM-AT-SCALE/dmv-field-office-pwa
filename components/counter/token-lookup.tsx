"use client"

import * as React from "react"
import { ScanLineIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { normaliseToken } from "@/lib/queue"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type TokenLookupProps = {
  onLookup: (token: string) => void
  /** Disables the submit while a lookup is in flight; the field stays live. */
  busy?: boolean
  /** Set false while a modal owns the focus. */
  keepFocus?: boolean
  className?: string
}

/* Anything a click could reasonably have been aimed at. A click that lands on
   one of these is the technician's business; anything else is empty space. */
const INTERACTIVE =
  'a[href], button, input, select, textarea, summary, [contenteditable], [role="dialog"], [role="button"], [tabindex]:not([tabindex="-1"])'

/**
 * The lookup field, and the whole reason the counter screen is fast.
 *
 * A BARCODE SCANNER IS A KEYBOARD. It types the value at machine speed and
 * presses Enter, so the field needs no scanner integration at all — it needs
 * to be the thing that has focus when the scan arrives, and to be forgiving
 * about what arrives. Three behaviours cover that:
 *
 *   1. It is autofocused, and it takes focus back when the technician clicks
 *      empty space. Otherwise a scan aimed at a screen whose focus has drifted
 *      to the body goes nowhere and the technician has to scan twice.
 *   2. A printable keystroke that lands on the body — the scanner starting to
 *      transmit before anything is focused — is redirected here. Focusing
 *      during keydown puts the character in the field, so the first digit of
 *      the scan is not lost. Focus that genuinely belongs to another control
 *      is never taken.
 *   3. What arrives is normalised, not validated: Code 39 scanners transmit
 *      the start/stop asterisks (`*A-042*`), and typing produces stray spaces
 *      and lower case. normaliseToken() strips all of it.
 *
 * Refocusing is deliberately limited to pointer input and to the body. A
 * keyboard user tabbing through the queue is never dragged back here, and a
 * text selection is never destroyed by a stray click.
 */
function TokenLookup({
  onLookup,
  busy = false,
  keepFocus = true,
  className,
}: TokenLookupProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [value, setValue] = React.useState("")

  React.useEffect(() => {
    if (!keepFocus) return

    const field = inputRef.current
    if (!field) return

    function returnFocusOnEmptySpace(event: PointerEvent) {
      const target = event.target as Element | null
      if (target?.closest(INTERACTIVE)) return
      /* Clicking to finish a selection must not wipe it out. */
      if (window.getSelection()?.toString()) return
      field?.focus()
    }

    function catchStrayKeystroke(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      /* Only when nothing has focus. If the technician is typing into another
         control, that is where the characters belong. */
      const active = document.activeElement
      if (active && active !== document.body) return
      /* Printable characters only — Tab, arrows and shortcuts pass through. */
      if (event.key.length !== 1) return
      field?.focus()
    }

    document.addEventListener("pointerup", returnFocusOnEmptySpace)
    document.addEventListener("keydown", catchStrayKeystroke)
    return () => {
      document.removeEventListener("pointerup", returnFocusOnEmptySpace)
      document.removeEventListener("keydown", catchStrayKeystroke)
    }
  }, [keepFocus])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const token = normaliseToken(value)
    if (!token) {
      inputRef.current?.focus()
      return
    }
    onLookup(token)
    /* Clear for the next call. The scanner's next transmission starts the
       moment the technician points it at another ticket. */
    setValue("")
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={submit}
      className={cn("flex flex-col gap-3", className)}
      /* A scanner's Enter must never be swallowed by browser validation. */
      noValidate
    >
      <Label htmlFor="counter-token" className="text-small text-muted-foreground">
        Token number
      </Label>

      <div className="flex flex-wrap gap-3">
        <Input
          id="counter-token"
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
          /* The one field on the screen that should have focus on arrival. */
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoCapitalize="characters"
          enterKeyHint="search"
          placeholder="A-042"
          aria-describedby="counter-token-hint"
          className={cn(
            "min-h-16 flex-1 basis-56 text-center font-display text-h3 font-bold tracking-widest uppercase",
            "tabular-nums"
          )}
        />
        <Button type="submit" size="field" variant="accent" disabled={busy} className="min-h-16">
          {busy ? "Looking up…" : "Look up"}
        </Button>
      </div>

      <p
        id="counter-token-hint"
        className="flex items-center gap-2 text-tiny text-muted-foreground"
      >
        <ScanLineIcon aria-hidden="true" className="size-4 shrink-0" />
        Scan the ticket or type the number. The field keeps focus, so a scan
        always lands.
      </p>
    </form>
  )
}

export { TokenLookup }
