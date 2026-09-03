import * as React from "react"

import { cn } from "@/lib/utils"

type TokenDisplayProps = React.ComponentProps<"div"> & {
  /** The queue token itself. */
  token: React.ReactNode
  /** Small line above the figure, e.g. "Your number". */
  label?: React.ReactNode
  /** Line beneath, e.g. "Now serving A-118". */
  sub?: React.ReactNode
  /** Barcode slot — pass <Barcode … />. */
  barcode?: React.ReactNode
}

/**
 * The single thing a customer holds up when their turn is called, so the
 * figure is the largest type in the app — --fs-token, which clamps up to
 * 104px and exists for this one job.
 */
function TokenDisplay({
  token,
  label,
  sub,
  barcode,
  className,
  ...props
}: TokenDisplayProps) {
  return (
    <div
      data-slot="token-display"
      className={cn("grid justify-items-center gap-5 text-center", className)}
      {...props}
    >
      {label ? (
        <span className="text-tiny tracking-wide text-muted-foreground uppercase">
          {label}
        </span>
      ) : null}

      <span className="font-display text-token leading-none tracking-tight text-deep tabular-nums">
        {token}
      </span>

      {barcode ? <div className="w-full max-w-content">{barcode}</div> : null}

      {sub ? (
        <p className="text-small leading-normal text-muted-foreground">{sub}</p>
      ) : null}
    </div>
  )
}

export { TokenDisplay }
