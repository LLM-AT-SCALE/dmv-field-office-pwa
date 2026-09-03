import * as React from "react"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/ui/focus-ring"

/**
 * Fields are nearly square (4px radius), white, and 52px tall with generous
 * side padding. The type size floor is 16px, which is also what stops iOS
 * zooming the viewport when the field takes focus.
 */
const fieldBase = cn(
  "w-full min-w-0 rounded-input border border-input bg-background",
  "text-body text-foreground",
  "transition-[border-color,background-color] duration-fast ease-brand",
  "placeholder:text-muted-foreground",
  "hover:border-border-strong",
  "focus-visible:border-primary",
  "disabled:cursor-not-allowed disabled:bg-elevated disabled:text-muted-foreground disabled:opacity-70",
  /* Invalid state is a thicker border plus the message the caller renders —
     never the colour on its own. */
  "aria-invalid:border-2 aria-invalid:border-destructive",
  focusRing
)

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "min-h-13 px-5 py-3",
        "file:mr-4 file:inline-flex file:border-0 file:bg-transparent file:text-body file:font-medium file:text-primary",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldBase }
