import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/ui/focus-ring"

const badgeVariants = cva(
  cn(
    "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-2",
    "rounded-pill border border-transparent px-3 py-1",
    /* A badge is normally static text, so it is sized as text. Rendered as a
       link or button via asChild it becomes a target, and picks up the floor. */
    "[a&]:min-h-11 [button&]:min-h-11 [a&]:px-5 [button&]:px-5",
    "text-tiny font-medium tracking-wide whitespace-nowrap",
    "[&>svg]:pointer-events-none [&>svg]:size-4",
    focusRing
  ),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        /* Gold as a background, near-black ink on top — 13.4:1. */
        accent: "bg-gold text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border-border-strong text-foreground",
        success: "border-success/30 bg-background text-success",
        warning: "border-warning/30 bg-background text-warning",
        destructive: "border-destructive/30 bg-background text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
