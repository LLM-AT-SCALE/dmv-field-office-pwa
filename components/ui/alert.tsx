import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * A 3px left border in a status colour, on the flat card surface. The colour
 * is never the only signal — callers pair it with an icon and a title (see the
 * Notice pattern, which is the intended way to use this).
 */
const alertVariants = cva(
  cn(
    "group/alert relative grid w-full gap-1 rounded-card border border-border border-l-3",
    "bg-card px-5 py-4 text-left text-body text-card-foreground",
    "has-data-[slot=alert-action]:pr-16",
    "has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-4",
    "*:[svg]:row-span-2 *:[svg]:mt-1 *:[svg:not([class*='size-'])]:size-5"
  ),
  {
    variants: {
      variant: {
        default: "border-l-border-strong *:[svg]:text-muted-foreground",
        info: "border-l-primary *:[svg]:text-primary",
        warn: "border-l-warning *:[svg]:text-warning",
        success: "border-l-success *:[svg]:text-success",
        destructive: "border-l-destructive *:[svg]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      data-variant={variant}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium text-foreground group-has-[>svg]/alert:col-start-2",
        "[&_a]:underline [&_a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-small text-pretty text-muted-foreground group-has-[>svg]/alert:col-start-2",
        "[&_a]:underline [&_a]:underline-offset-4 [&_p:not(:last-child)]:mb-3",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-4 right-4", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants }
