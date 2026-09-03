import * as React from "react"
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

type NoticeVariant = "default" | "info" | "warn" | "success" | "destructive"

type NoticeProps = Omit<React.ComponentProps<typeof Alert>, "title"> & {
  variant?: NoticeVariant
  title: React.ReactNode
  children?: React.ReactNode
  /**
   * Visually hidden word spoken before the title ("Warning", "Success"). Pass
   * a translated string; the icon shapes already differ, so this is a second
   * signal rather than the only one.
   */
  statusLabel?: string
  /** Replaces the variant's icon. Pass null to drop it. */
  icon?: React.ReactNode
  /**
   * Whether this notice should be announced when it appears.
   *
   * "off" (the default) is right for notices that are simply part of the page:
   * a live region that is present on load interrupts a screen reader for
   * content the user is about to reach anyway. Use "polite" for something that
   * appears in response to an action, "assertive" only for a failure that
   * stops the customer.
   */
  live?: "off" | "polite" | "assertive"
}

/* Each variant gets a distinct silhouette, so the status survives greyscale,
   low vision and colour blindness. */
const NOTICE_ICONS: Record<NoticeVariant, React.ReactNode> = {
  default: <InfoIcon aria-hidden="true" />,
  info: <InfoIcon aria-hidden="true" />,
  warn: <TriangleAlertIcon aria-hidden="true" />,
  success: <CircleCheckIcon aria-hidden="true" />,
  destructive: <CircleAlertIcon aria-hidden="true" />,
}

function Notice({
  variant = "default",
  title,
  children,
  statusLabel,
  icon,
  live = "off",
  className,
  ...props
}: NoticeProps) {
  const iconNode = icon === undefined ? NOTICE_ICONS[variant] : icon
  /* Alert defaults to role="alert"; undefined removes the attribute entirely. */
  const role =
    live === "assertive" ? "alert" : live === "polite" ? "status" : undefined

  return (
    <Alert
      data-slot="notice"
      variant={variant}
      role={role}
      className={cn(className)}
      {...props}
    >
      {iconNode}
      <AlertTitle>
        {statusLabel ? <span className="sr-only">{statusLabel}: </span> : null}
        {title}
      </AlertTitle>
      {children ? <AlertDescription>{children}</AlertDescription> : null}
    </Alert>
  )
}

export { Notice, type NoticeVariant }
