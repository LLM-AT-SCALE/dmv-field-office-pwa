import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/ui/focus-ring"

/**
 * Buttons are pills, 52px tall. The people using this are standing in a lobby
 * holding a phone in one hand, so the primary action is deliberately larger
 * than the 44px floor rather than merely clearing it.
 *
 * Tailwind v4 compiles `hover:` inside `@media (hover: hover)`, so a touch
 * device never paints a hover state it has no way to leave — the lift costs
 * phones nothing. Only transform and colour animate.
 */
const buttonVariants = cva(
  cn(
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2",
    "border border-transparent bg-clip-padding font-medium whitespace-nowrap select-none",
    "transition-[transform,background-color,border-color,color] duration-fast ease-brand",
    "hover:-translate-y-0.5 active:translate-y-0",
    "disabled:pointer-events-none disabled:opacity-50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
    focusRing
  ),
  {
    variants: {
      variant: {
        /* Primary action. */
        default:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-hover",
        /* Gold is a background colour only — the ink on it is near-black. */
        accent:
          "bg-gold text-accent-foreground hover:border-gold-ink active:bg-gold",
        /* Transparent with a strong border, for secondary actions. */
        ghost:
          "border-border-strong bg-transparent text-foreground hover:bg-elevated active:bg-elevated-2",
        outline:
          "border-border bg-background text-foreground hover:bg-elevated active:bg-elevated-2",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-elevated-2 active:bg-elevated-2",
        destructive:
          "bg-destructive text-destructive-foreground focus-visible:ring-destructive/40",
        link: "rounded-input text-primary underline underline-offset-4 hover:translate-y-0",
      },
      size: {
        /* 52px — the standing-up-holding-a-phone size. */
        pill: "min-h-13 rounded-pill px-8 py-3 text-body",
        default: "min-h-13 rounded-pill px-8 py-3 text-body",
        lg: "min-h-13 rounded-pill px-10 py-3 text-prose",
        /* Never below the 44px floor. */
        sm: "min-h-11 rounded-pill px-6 py-2 text-small",
        /* Squared off, to sit flush beside an input. */
        field: "min-h-13 rounded-input px-5 py-3 text-body",
        icon: "size-11 rounded-pill p-0",
        "icon-lg": "size-13 rounded-pill p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "pill",
    },
  }
)

type ButtonVariants = VariantProps<typeof buttonVariants>
type ButtonSize = NonNullable<ButtonVariants["size"]>
type IconOnlySize = Extract<ButtonSize, "icon" | "icon-lg">

type ButtonBaseProps = Omit<React.ComponentProps<"button">, "aria-label"> &
  Omit<ButtonVariants, "size"> & { asChild?: boolean }

/**
 * An icon-only button has no accessible name of its own, so the type system
 * asks for one: `size="icon"` without `aria-label` is a compile error.
 */
type ButtonProps =
  | (ButtonBaseProps & {
      size?: Exclude<ButtonSize, IconOnlySize>
      "aria-label"?: string
    })
  | (ButtonBaseProps & { size: IconOnlySize; "aria-label": string })

function Button({
  className,
  variant = "default",
  size = "pill",
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? type : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonProps }
