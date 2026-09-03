import * as React from "react"

import { cn } from "@/lib/utils"

type PageShellProps = React.ComponentProps<"div"> & {
  /** Rendered above the content band, full bleed. Typically <AppHeader />. */
  header?: React.ReactNode
  /** Sticky companion column from 1024px up; stacks under the content below. */
  rail?: React.ReactNode
  footer?: React.ReactNode
  /** Target for <SkipLink />. */
  mainId?: string
  /** The radial primary wash behind the page. */
  wash?: boolean
  /** Applied to <main>. */
  contentClassName?: string
  railClassName?: string
}

/**
 * One column under 1024px. At 1024px and up, a 680px content column and a
 * 320px rail sit side by side, centred as a pair with a fixed gap — so on a
 * wide monitor they stay together instead of drifting to opposite edges.
 *
 * z-2 puts the shell above the fixed grain overlay (z-1).
 */
function PageShell({
  header,
  rail,
  footer,
  children,
  mainId = "main",
  wash = true,
  className,
  contentClassName,
  railClassName,
  ...props
}: PageShellProps) {
  return (
    <div
      data-slot="page-shell"
      className={cn(
        "relative z-2 flex min-h-full w-full flex-1 flex-col",
        wash && "page-wash",
        className
      )}
      {...props}
    >
      {header}

      <div
        className={cn(
          "mx-auto flex w-full max-w-shell flex-1 flex-col items-center gap-10 px-(--gutter) py-10",
          "lg:flex-row lg:items-start lg:justify-center lg:gap-12"
        )}
      >
        <main
          id={mainId}
          tabIndex={-1}
          className={cn(
            "w-full max-w-content min-w-0 outline-none",
            contentClassName
          )}
        >
          {children}
        </main>

        {rail ? (
          <aside
            data-slot="page-rail"
            className={cn(
              "w-full max-w-content min-w-0 self-stretch",
              "lg:sticky lg:top-(--header-h) lg:w-rail lg:max-w-none lg:shrink-0 lg:self-start",
              "lg:max-h-[calc(100dvh-var(--header-h))] lg:overflow-y-auto",
              railClassName
            )}
          >
            {rail}
          </aside>
        ) : null}
      </div>

      {footer}
    </div>
  )
}

export { PageShell }
