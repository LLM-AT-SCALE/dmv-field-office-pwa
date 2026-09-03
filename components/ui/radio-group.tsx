"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/ui/focus-ring"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid w-full gap-1", className)}
      {...props}
    />
  )
}

/** 24px dot, 48px hit area. See Checkbox for the reasoning. */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "group/radio-item peer relative flex aspect-square size-6 shrink-0 items-center justify-center",
        "rounded-pill border border-border-strong bg-background",
        "transition-[background-color,border-color] duration-fast ease-brand",
        "after:absolute after:-inset-3",
        "hover:border-primary",
        "data-checked:border-primary data-checked:bg-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-2 aria-invalid:border-destructive",
        focusRing,
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <span className="size-2 rounded-pill bg-primary-foreground" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

type RadioGroupFieldProps = React.ComponentProps<typeof RadioGroupPrimitive.Item> & {
  label: React.ReactNode
  description?: React.ReactNode
}

/** Control plus label as one target. */
function RadioGroupField({
  id,
  label,
  description,
  className,
  ...props
}: RadioGroupFieldProps) {
  const generatedId = React.useId()
  const fieldId = id ?? generatedId
  const descriptionId = description ? `${fieldId}-description` : undefined

  return (
    <label
      htmlFor={fieldId}
      data-slot="radio-group-field"
      className={cn(
        "group/field flex min-h-11 w-full cursor-pointer items-start gap-4 py-2",
        "has-disabled:cursor-not-allowed",
        className
      )}
    >
      <RadioGroupItem
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

export { RadioGroup, RadioGroupItem, RadioGroupField }
