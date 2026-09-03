"use client"

import * as React from "react"

import { formatProblems, triggeredForms } from "@/lib/reg343"
import type { FormData } from "@/lib/types"
import { Notice } from "@/components/patterns/notice"
import type { Reg343Record } from "./types"

type RecordFlagsProps = {
  formData: FormData
  missing: Reg343Record["missing_required_detail"]
}

/**
 * Everything the technician has to act on, above the data rather than buried
 * in it. A problem found while reading section 6 is a problem found too late:
 * by then they have already told the customer the form looks fine.
 *
 * Order is deliberate — what is wrong, what is missing, what else the customer
 * has to fill in, and then the one flag that is always true.
 */
function RecordFlags({ formData, missing }: RecordFlagsProps) {
  const problems = formatProblems(formData)
  const forms = triggeredForms(formData)

  return (
    <div className="flex flex-col gap-4">
      {problems.length > 0 ? (
        <Notice
          variant="warn"
          statusLabel="Warning"
          title={`${problems.length} ${problems.length === 1 ? "entry looks" : "entries look"} incorrect`}
        >
          <ul className="flex list-none flex-col gap-1">
            {problems.map((problem) => (
              <li key={problem.id}>
                <span className="font-medium">{problem.label}</span> — {problem.message}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {missing.length > 0 ? (
        <Notice
          variant="warn"
          statusLabel="Warning"
          title={`${missing.length} required field${missing.length === 1 ? "" : "s"} outstanding`}
        >
          {/* Named, not counted. The technician has to ask for these out loud,
              so the list is the useful part. */}
          <p>{missing.map((field) => field.label).join(" · ")}</p>
        </Notice>
      ) : (
        <Notice variant="success" statusLabel="Ready" title="All required fields answered">
          Download the filled form, obtain signature, and proceed.
        </Notice>
      )}

      {forms.length > 0 ? (
        <Notice variant="warn" statusLabel="Warning" title="Supplementary forms required">
          <ul className="flex list-none flex-col gap-1">
            {forms.map((form) => (
              <li key={form.form}>
                <span className="font-medium">{form.form}</span> — {form.title}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {/* Always shown, on every REG 343, complete or not. The whole product
          stops short of the signature on purpose: section 9 is executed on
          paper, in person, under penalty of perjury (CVC §1808.21). Nothing
          the customer did on their phone changes that, so this notice is not
          conditional on anything. */}
      <Notice variant="info" title="Signature required at the counter">
        REG 343 section 9 must be signed in person under penalty of perjury
        (CVC §1808.21). Download the filled form and take a wet signature
        before processing.
      </Notice>
    </div>
  )
}

export { RecordFlags }
