import * as React from "react"

import { cn } from "@/lib/utils"

type StatTileProps = React.ComponentProps<"div"> & {
  /** The figure. Kept short — this is meant to be read across a lobby. */
  value: React.ReactNode
  label: React.ReactNode
  /** Optional third line, e.g. "updated a moment ago". */
  hint?: React.ReactNode
}

/**
 * A large Playfair figure in deep navy over a small muted label, parted by a
 * hairline that fades out to the right. The rule is decorative; the reading
 * order is figure then label, which is how the pair is spoken aloud.
 */
function StatTile({
  value,
  label,
  hint,
  className,
}: StatTileProps) {
  return (
    <div data-slot="stat-tile" className={cn("grid gap-3", className)}>
      <span className="font-display text-h1 leading-none tracking-tight text-deep tabular-nums">
        {value}
      </span>

      <span
        aria-hidden="true"
        className="h-px w-full bg-linear-to-r from-primary/50 to-transparent"
      />

      <span className="text-tiny tracking-wide text-muted-foreground uppercase">
        {label}
      </span>

      {hint ? (
        <span className="text-tiny text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  )
}

export { StatTile }
