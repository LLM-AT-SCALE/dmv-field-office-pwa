import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * First thing in the tab order on every view. The .skip-link class in
 * globals.css parks it above the viewport and slides it into place on focus.
 */
function SkipLink({
  href = "#main",
  children = "Skip to main content",
  className,
  ...props
}: React.ComponentProps<"a">) {
  return (
    <a href={href} data-slot="skip-link" className={cn("skip-link", className)} {...props}>
      {children}
    </a>
  )
}

export { SkipLink }
