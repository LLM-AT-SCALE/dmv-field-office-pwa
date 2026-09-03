"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
/* SERVICES and the zone default only. checklistFor() is exported from both
   lib/office and lib/i18n/content with different signatures, and neither
   belongs on this screen — naming the imports keeps that unambiguous. */
import { DEFAULT_TIME_ZONE, SERVICES } from "@/lib/office"
import type { Office } from "@/lib/types"
import { Progress } from "@/components/ui/progress"
import { Notice } from "@/components/patterns/notice"
import { RecordActions } from "./record-actions"
import { RecordFlags } from "./record-flags"
import { RecordSections } from "./record-sections"
import { formatTime, hasExpired } from "./format"
import { isReg343, type StaffRecord } from "./types"

type RecordPanelProps = {
  record: StaffRecord
  /* The whole office, not just its id: the times below are read on the clock
     at that office, in its own zone. */
  office: Office
  onCompleted: () => void
  onError: (message: string) => void
  onModalChange?: (open: boolean) => void
}

function subLabel(record: StaffRecord): string {
  const service = SERVICES[record.service]
  return (
    service.subs.find((sub) => sub.id === record.sub_transaction)?.label ??
    record.sub_transaction
  )
}

/**
 * Token, service, timings, completeness and the two actions — the header the
 * technician reads before they say a word to the customer.
 */
function RecordHead({
  record,
  office,
  onCompleted,
  onError,
  onModalChange,
}: RecordPanelProps) {
  const zone = office.hours.timeZone ?? DEFAULT_TIME_ZONE

  /* Completeness is a REG 343 measurement — the fraction of visible fields the
     customer has answered. A Driver License ticket has no form to measure, so
     it gets no meter rather than a meaningless 100%: the confirmation number
     below is the whole of what this product holds for that path. */
  const complete = isReg343(record) ? Math.round(record.completeness * 100) : null

  const submitted = isReg343(record) ? record.submitted_at : record.edl_recorded_at

  return (
    <div
      className={cn(
        "grid items-start gap-4 gap-x-6 rounded-card border border-border bg-elevated p-6",
        "lg:grid-cols-[auto_minmax(0,1fr)_auto]"
      )}
    >
      <h2 className="font-display text-h1 leading-none font-bold text-deep tabular-nums">
        {record.token_number}
      </h2>

      <div className="min-w-0 text-small leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">{SERVICES[record.service].name}</p>
        <p>{subLabel(record)}</p>
        <p>
          Issued {formatTime(record.issued_at, zone)}
          {submitted ? ` · submitted ${formatTime(submitted, zone)}` : " · not yet submitted"}
        </p>
        {/* Retention, stated where the technician can see it rather than in a
            policy document. The customer was told the same thing. */}
        <p>Deleted on completion, or at {formatTime(record.expires_at, zone)} today</p>

        {complete !== null ? (
          <div className="mt-3 flex items-center gap-3">
            {/* The figure is written out, so the bar is a second reading of it
                rather than the only one. */}
            <span id="counter-completeness-label" className="text-tiny">
              {complete}% complete
            </span>
            <Progress
              value={complete}
              aria-labelledby="counter-completeness-label"
              className="max-w-40 flex-1"
            />
          </div>
        ) : null}
      </div>

      <RecordActions
        /* Remounted per ticket, so the download button never shows
           "Downloaded" for a form belonging to the previous customer. */
        key={record.token_number}
        token={record.token_number}
        officeId={office.id}
        formData={isReg343(record) ? record.form_data : undefined}
        onCompleted={onCompleted}
        onError={onError}
        onModalChange={onModalChange}
        /* Sized by its own labels, not a guessed width. At 224px "Download
           filled REG 343" overflowed the button and ran into the card edge. */
        className="col-span-full lg:col-auto lg:w-auto lg:min-w-52"
      />
    </div>
  )
}

/**
 * The Driver License path holds one field and says so.
 *
 * The eDL 44 is completed at edl.dmv.ca.gov, not here. All this product ever
 * receives is the confirmation number the customer typed in, which is why
 * there is no form to show and nothing to purge but a reference. Saying that
 * plainly on the screen matters: a technician who assumes the data is missing
 * will go looking for it.
 */
function DlRecordBody({ record }: { record: Extract<StaffRecord, { service: "DL" }> }) {
  return (
    <div className="flex flex-col gap-4">
      {record.edl_confirmation_number ? (
        <Notice variant="success" statusLabel="Ready" title="Online application reference supplied">
          <p>
            Look up confirmation number{" "}
            <strong className="font-display text-h3 font-bold text-deep tabular-nums">
              {record.edl_confirmation_number}
            </strong>{" "}
            in the DMV system.
          </p>
        </Notice>
      ) : (
        <Notice variant="warn" statusLabel="Warning" title="No reference yet">
          The customer has not completed the online application, or has not
          entered their confirmation number.
        </Notice>
      )}

      <Notice variant="info" title="No personal data held by this application">
        For driver license transactions this system stores only the
        confirmation number. Name, date of birth, address and social security
        number remain in the DMV system of record.
      </Notice>
    </div>
  )
}

/**
 * One called ticket, in full.
 *
 * The expiry check here is a second line of defence, not the first: the API
 * purges on read and the screen drops a record the moment it expires. It stays
 * because "an expired ticket never renders its data" is the kind of claim that
 * should be true in more than one place.
 */
function RecordPanel(props: RecordPanelProps) {
  const { record } = props

  if (hasExpired(record.expires_at)) return null

  return (
    <div className="flex flex-col gap-6" data-stagger>
      <RecordHead {...props} />

      {isReg343(record) ? (
        <>
          <RecordFlags
            formData={record.form_data}
            missing={record.missing_required_detail}
          />
          <RecordSections formData={record.form_data} />
        </>
      ) : (
        <DlRecordBody record={record} />
      )}
    </div>
  )
}

export { RecordPanel }
