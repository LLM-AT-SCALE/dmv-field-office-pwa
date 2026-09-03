import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"
import { focusRingWithin } from "@/components/ui/focus-ring"

type ServiceTileProps = Omit<React.ComponentProps<"button">, "title"> & {
  title: React.ReactNode
  blurb?: React.ReactNode
  /** Meta row under the blurb — duration, documents needed, availability. */
  meta?: React.ReactNode
  icon?: React.ReactNode
  /** Left border colour. */
  accent?: "primary" | "gold" | "muted"
  /** Heading level, so a page of tiles keeps a sane outline. */
  headingLevel?: 2 | 3 | 4
  /** Render the control as a link: <ServiceTile asChild><Link …/></ServiceTile>. */
  asChild?: boolean
  /** Applied to the tile; every other prop goes to the control. */
  className?: string
}

const ACCENTS = {
  primary: "border-l-primary",
  gold: "border-l-gold",
  muted: "border-l-border-strong",
} as const

/**
 * A whole card that is one tap target.
 *
 * The control is the heading, stretched over the card by a full-bleed ::after
 * rather than by wrapping everything in a <button>. That keeps the heading a
 * real heading — so it appears in the screen reader's heading list and the
 * page keeps an outline — while the accessible name stays just the title
 * instead of the title, blurb and meta run together. :hover, :active and the
 * focus ring all resolve on the card, so the whole surface still lights up.
 */
function ServiceTile({
  title,
  blurb,
  meta,
  icon,
  accent = "primary",
  headingLevel = 3,
  asChild = false,
  className,
  type,
  ...props
}: ServiceTileProps) {
  const Comp = asChild ? Slot.Root : "button"
  const Heading = `h${headingLevel}` as const

  return (
    <div
      data-slot="service-tile"
      className={cn(
        "group/service-tile relative flex w-full flex-col items-start gap-3 text-left",
        "rounded-card border border-border border-l-3 bg-card p-5",
        "transition-[transform,background-color,border-color] duration-fast ease-brand",
        "hover:-translate-y-0.5 hover:bg-elevated",
        /* The pressed state is what a thumb gets instead of hover. It resolves
           here because :active matches ancestors of the control too. */
        "active:translate-y-0 active:bg-elevated-2",
        "has-disabled:pointer-events-none has-disabled:opacity-50",
        ACCENTS[accent],
        focusRingWithin,
        className
      )}
    >
      <div className="flex w-full items-start gap-4">
        {icon ? (
          <span
            aria-hidden="true"
            className="mt-1 shrink-0 text-primary [&_svg:not([class*='size-'])]:size-6"
          >
            {icon}
          </span>
        ) : null}

        <div className="flex min-w-0 flex-col gap-2">
          <Heading className="font-display text-h3 leading-tight font-bold text-foreground">
            <Comp
              type={asChild ? type : (type ?? "button")}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-card"
              {...props}
            >
              {title}
            </Comp>
          </Heading>

          {blurb ? (
            <p className="text-body text-pretty text-muted-foreground">
              {blurb}
            </p>
          ) : null}
        </div>
      </div>

      {meta ? (
        <div className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-3 text-tiny text-muted-foreground">
          {meta}
        </div>
      ) : null}
    </div>
  )
}

export { ServiceTile }
