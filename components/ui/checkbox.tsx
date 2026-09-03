"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/ui/focus-ring"
import { CheckIcon } from "lucide-react"

/**
 * The box draws at 24px but the ::after pseudo-element pushes the hit area out
 * to 48px square, clearing the 44px floor without opening a visual hole in the
 * layout. Prefer CheckboxField, which puts the whole label row inside the
 * target.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-6 shrink-0 items-center justify-center rounded-chip",
        "border border-border-strong bg-background text-primary-foreground",
        "transition-[background-color,border-color] duration-fast ease-brand",
        "after:absolute after:-inset-3",
        "hover:border-primary",
        "data-checked:border-primary data-checked:bg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "group-has-disabled/field:opacity-50",
        "aria-invalid:border-2 aria-invalid:border-destructive",
        focusRing,
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current [&>svg]:size-4"
      >
        <CheckIcon strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

type CheckboxFieldProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  label: React.ReactNode
  description?: React.ReactNode
  /** Applied to the row, not the control. */
  className?: string
}

/**
 * Control plus label as one 44px-plus target — the whole row is the hit area,
 * which is what a thumb expects.
 */
function CheckboxField({
  id,
  label,
  description,
  className,
  ...props
}: CheckboxFieldProps) {
  const generatedId = React.useId()
  const fieldId = id ?? generatedId
  const descriptionId = description ? `${fieldId}-description` : undefined

  return (
    <label
      htmlFor={fieldId}
      data-slot="checkbox-field"
      className={cn(
        "group/field flex min-h-11 w-full cursor-pointer items-start gap-4 py-2",
        "has-disabled:cursor-not-allowed",
        className
      )}
    >
      <Checkbox
        id={fieldId}
        aria-describedby={descriptionId}
        className="mt-1"
        {...props}
      />
      <span className="grid gap-1">
        <span className="text-body text-foreground">{label}</span>
        {description ? (
          <span id={descriptionId} className="text-small text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export { Checkbox, CheckboxField }
