import * as React from "react"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

/* Intrinsic dimensions of public/dmv-logo.png. Passed to next/image so it can
   reserve the right box; the rendered height is set in CSS. */
const LOGO_INTRINSIC_WIDTH = 648
const LOGO_INTRINSIC_HEIGHT = 265

type AppHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  /** Product name, beside the official mark. */
  productName: React.ReactNode
  /** Secondary line. Hidden on narrow screens rather than shrinking the mark. */
  subtitle?: React.ReactNode
  /** Alt text for the official mark. Pass a translated string. */
  logoAlt?: string
  /** Show the default PROTOTYPE badge. */
  prototype?: boolean
  /** Overrides the default badge entirely. */
  badge?: React.ReactNode
  badgeLabel?: string
  /** Trailing slot — language toggle, account, and so on. */
  actions?: React.ReactNode
}

/**
 * The mark carries two lines of microtype ("STATE OF CALIFORNIA" above,
 * "Department of Motor Vehicles" below) that stop being legible much under
 * 40px tall, so it holds --logo-h and the product subtitle is what gives way
 * on a narrow screen instead. It is never recoloured, never distorted:
 * `w-auto` keeps the aspect ratio and no filter touches it.
 */
function AppHeader({
  productName,
  subtitle,
  logoAlt = "State of California Department of Motor Vehicles",
  prototype = false,
  badge,
  badgeLabel = "PROTOTYPE",
  actions,
  className,
  ...props
}: AppHeaderProps) {
  const badgeNode =
    badge ??
    (prototype ? <Badge variant="accent">{badgeLabel}</Badge> : null)

  return (
    <header
      data-slot="app-header"
      className={cn(
        "sticky top-0 z-30 w-full border-b border-border bg-background/90 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {/* Wraps rather than overflows. On a 360px Android the logo, product name
          and language toggle cannot share one line — pinned side by side they
          pushed the page 136px wider than the screen, so the whole app scrolled
          sideways. The toggle drops to its own row instead, which costs a little
          height and keeps both languages visible: a customer who needs Español
          has to be able to find it without hunting. */}
      <div className="mx-auto flex min-h-(--header-h) w-full max-w-shell flex-wrap items-center gap-x-4 gap-y-2 px-(--gutter) py-3">
        <Image
          src="/dmv-logo.png"
          alt={logoAlt}
          width={LOGO_INTRINSIC_WIDTH}
          height={LOGO_INTRINSIC_HEIGHT}
          priority
          className="h-(--logo-h) w-auto shrink-0 object-contain"
        />

        {/* Hairline separating the official mark from the product it fronts. */}
        <span aria-hidden="true" className="h-8 w-px shrink-0 bg-border" />

        <div className="flex min-w-0 flex-1 shrink flex-col justify-center">
          <span className="truncate font-display text-h3 leading-tight font-bold text-deep">
            {productName}
          </span>
          {subtitle ? (
            <span className="hidden truncate text-tiny text-muted-foreground sm:block">
              {subtitle}
            </span>
          ) : null}
        </div>

        {badgeNode ? <div className="shrink-0">{badgeNode}</div> : null}

        {actions ? (
          <div className="ml-auto flex shrink-0 items-center gap-3 max-[27rem]:ml-0 max-[27rem]:w-full">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export { AppHeader }
