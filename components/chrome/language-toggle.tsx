"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { focusRing } from "@/components/ui/focus-ring"

type Language = "en" | "es"

type LanguageToggleProps = Omit<React.ComponentProps<"div">, "onChange"> & {
  lang: Language
  onChange: (lang: Language) => void
  /** Accessible name for the group. Pass a translated string. */
  label?: string
}

const LANGUAGES: ReadonlyArray<{ value: Language; name: string }> = [
  { value: "en", name: "English" },
  /* Endonyms, so each option is legible to the person who needs it. */
  { value: "es", name: "Español" },
]

/**
 * Two buttons rather than a select: the choice is visible without opening
 * anything, and aria-pressed reports the current state. Selection is carried
 * by the filled shape as well as the colour.
 *
 * The i18n provider is owned elsewhere — this takes `lang` and `onChange`.
 */
function LanguageToggle({
  lang,
  onChange,
  label = "Language",
  className,
  ...props
}: LanguageToggleProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="language-toggle"
      className={cn(
        "inline-flex items-center gap-1 rounded-pill border border-border bg-background p-1",
        className
      )}
      {...props}
    >
      {LANGUAGES.map((language) => {
        const selected = language.value === lang
        return (
          <button
            key={language.value}
            type="button"
            lang={language.value}
            aria-pressed={selected}
            onClick={() => onChange(language.value)}
            className={cn(
              "inline-flex min-h-11 flex-1 items-center justify-center rounded-pill px-4 sm:flex-none sm:px-5",
              "text-small font-medium",
              "transition-[background-color,color] duration-fast ease-brand",
              selected
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground",
              focusRing
            )}
          >
            {language.name}
          </button>
        )
      })}
    </div>
  )
}

export { LanguageToggle, type Language }
