"use client"

import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { visibleFields, visibleSections, type FieldDef } from "@/lib/reg343"
import type { FormData } from "@/lib/types"
import { displayValue, isBlank } from "./format"

/* A radio with long option text needs the full width of the grid or the answer
   wraps four times in a narrow cell. */
function isWide(field: FieldDef): boolean {
  return field.type === "radio" && !!field.options && field.options.join("").length > 40
}

type CellProps = {
  field: FieldDef
  value: FormData[string]
}

function Cell({ field, value }: CellProps) {
  const blank = isBlank(value)

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 border-r border-b border-border px-5 py-3",
        isWide(field) && "col-span-full"
      )}
    >
      <dt className="text-tiny leading-snug text-muted-foreground">{field.label}</dt>
      <dd
        className={cn(
          "m-0 text-small [overflow-wrap:anywhere]",
          blank
            ? "flex items-center gap-2 text-warning"
            : "font-semibold text-foreground"
        )}
      >
        {blank ? (
          <>
            <TriangleAlertIcon aria-hidden="true" className="size-4 shrink-0" />
            Not answered
          </>
        ) : (
          displayValue(field, value)
        )}
      </dd>
    </div>
  )
}

type RecordSectionsProps = {
  formData: FormData
}

/**
 * The REG 343 as the paper form lays it out — same sections, same order, same
 * numbering. The technician is about to hand the customer that piece of paper,
 * so the screen has to be walkable against it rather than reorganised into
 * whatever reads best.
 *
 * A field the customer left blank is DROPPED if it was optional and FLAGGED if
 * it was required. Hiding an unanswered required field would make the record
 * look finished when the whole point of this screen is to show that it is not.
 *
 * Columns respond to the width of the record column, not the viewport: the
 * queue rail takes 320px of a wide screen, so a viewport-based rule would put
 * three columns into a space that fits two. One column, two from 576px, three
 * from 896px — measured on the column itself, which is why the same grid works
 * with the rail beside it and without.
 */
function RecordSections({ formData }: RecordSectionsProps) {
  const sections = visibleSections(formData)
    .map((section) => ({
      section,
      fields: visibleFields(section, formData).filter(
        (field) => field.required || !isBlank(formData[field.id])
      ),
    }))
    .filter((entry) => entry.fields.length > 0)

  if (sections.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border px-6 py-16 text-center">
        <h3 className="mb-3">Nothing entered yet</h3>
        <p className="text-small text-muted-foreground">
          The customer has a ticket but has not started the form.
        </p>
      </div>
    )
  }

  return (
    <div className="@container flex flex-col gap-4">
      {sections.map(({ section, fields }) => (
        <section
          key={section.id}
          aria-labelledby={`counter-section-${section.id}`}
          className="overflow-hidden rounded-card border border-border"
        >
          <h3
            id={`counter-section-${section.id}`}
            className="border-b border-border bg-elevated px-5 py-3 font-sans text-tiny font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Section {section.num} — {section.title}
          </h3>

          {/* Every cell carries its own right and bottom hairline; the negative
              margins push the outermost ones under the section's own border,
              where overflow-hidden clips them. That divides cleanly at one, two
              or three columns with no nth-child arithmetic to keep in step. */}
          <dl className="m-0 -mr-px -mb-px grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3">
            {fields.map((field) => (
              <Cell key={field.id} field={field} value={formData[field.id]} />
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

export { RecordSections }
