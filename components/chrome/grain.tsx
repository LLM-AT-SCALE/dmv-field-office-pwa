import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Decorative only — a fixed noise overlay that takes the sterility off flat
 * white. Hidden from assistive tech, non-interactive, and removed entirely
 * under prefers-reduced-motion (see globals.css).
 */
function Grain({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="grain"
      className={cn("grain", className)}
      {...props}
    />
  )
}

export { Grain }
