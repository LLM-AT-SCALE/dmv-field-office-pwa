"use client"

/* ==========================================================================
   ENGLISH ONLY, DELIBERATELY.

   The customer side of this product is bilingual and its content lives in
   lib/i18n. The counter screen is not, and that is a decision rather than an
   oversight: it is staff-facing, DMV technicians work in English, and the
   REG 343 values it displays are the English strings that get written into the
   AcroForm (see lib/types.ts). Translating the chrome around untranslated data
   would suggest a completeness the screen does not have. If counter staff turn
   out to want Spanish, the strings here go into the same dictionary the
   customer app uses; nothing in the structure below prevents that.
   ========================================================================== */

import * as React from "react"

import { cn } from "@/lib/utils"
import type { Office } from "@/lib/types"
import { AppHeader } from "@/components/chrome/app-header"
import { Grain } from "@/components/chrome/grain"
import { SkipLink } from "@/components/chrome/skip-link"
import { Notice } from "@/components/patterns/notice"
import { fetchQueue, fetchRecord, StaffApiError } from "./api"
import { hasExpired, millisUntil } from "./format"
import { QueueRail } from "./queue-rail"
import { RecordPanel } from "./record-panel"
import { TokenLookup } from "./token-lookup"
import {
  isReg343,
  type LookupError,
  type QueueFeed,
  type QueueTicket,
  type StaffRecord,
} from "./types"

/* The lobby's board moves on its own; the rail follows it without the
   technician doing anything. Slow enough to be free, fast enough that a ticket
   appears in the list about as soon as the customer submits it. */
const QUEUE_POLL_MS = 5000

/** A ticket the technician has called, kept so the rail still works if the
    queue feed is unavailable. Metadata only — never the application. */
function ticketFromRecord(record: StaffRecord): QueueTicket {
  return {
    token_number: record.token_number,
    service: record.service,
    sub_transaction: record.sub_transaction,
    seq: Number(record.token_number.split("-")[1]) || 0,
    status: record.status,
    has_edl_reference: isReg343(record) ? false : !!record.edl_confirmation_number,
    issued_at: record.issued_at,
    expires_at: record.expires_at,
  }
}

const FAILURE_TITLE: Record<LookupError["kind"], (token: string) => string> = {
  not_found: (token) => `No application found for “${token}”`,
  unauthenticated: () => "Staff sign-on required",
  forbidden: () => "Not authorised for this office",
  rate_limited: () => "Too many lookups",
  network: () => "Could not reach the server",
}

function FailureBody({ kind }: { kind: LookupError["kind"] }) {
  switch (kind) {
    case "not_found":
      return (
        <>
          Either the customer has not submitted anything, the ticket belongs to
          another office, or the record has already been purged after
          completion.
        </>
      )
    case "unauthenticated":
      return (
        <>
          This workstation has no staff identity. Sign-on is not wired up yet —
          lib/server/auth.ts is a stub awaiting DMV single sign-on, and it
          refuses every request rather than guessing who you are.
        </>
      )
    case "forbidden":
      return (
        <>
          Your staff identity is assigned to a different field office. A token
          from one lobby cannot be opened at another.
        </>
      )
    case "rate_limited":
      return (
        <>
          The lookup limit for this identity has been reached. It exists because
          tokens are sequential and called aloud. Wait a moment and try again.
        </>
      )
    case "network":
      return <>The lookup did not complete. Check the connection and try again.</>
  }
}

type CounterScreenProps = {
  office: Office
}

function CounterScreen({ office }: CounterScreenProps) {
  const officeId = office.id

  const [record, setRecord] = React.useState<StaffRecord | null>(null)
  const [failure, setFailure] = React.useState<LookupError | null>(null)
  /* Set when a ticket expires under the technician's eyes, so the screen can
     say what happened to the record that was there a second ago. */
  const [expiredToken, setExpiredToken] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [modalOpen, setModalOpen] = React.useState(false)

  const [feed, setFeed] = React.useState<QueueFeed | null>(null)
  const [feedAvailable, setFeedAvailable] = React.useState(true)
  const [called, setCalled] = React.useState<QueueTicket[]>([])

  const [announcement, setAnnouncement] = React.useState("")

  /* ---- queue feed ------------------------------------------------------ */

  const refreshQueue = React.useCallback(async () => {
    const next = await fetchQueue(officeId)
    setFeed(next)
    setFeedAvailable(next !== null)
  }, [officeId])

  React.useEffect(() => {
    let stopped = false

    async function poll() {
      if (stopped || document.visibilityState !== "visible") return
      await refreshQueue()
    }

    void poll()
    const timer = setInterval(poll, QUEUE_POLL_MS)
    document.addEventListener("visibilitychange", poll)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", poll)
    }
  }, [refreshQueue])

  /* ---- expiry ----------------------------------------------------------
     A ticket that expires while it is on screen must stop being on screen.
     The API purges on read, so a reload would clear it anyway; this closes the
     window where the technician has walked away from a workstation showing an
     application that no longer exists.                                      */

  React.useEffect(() => {
    if (!record) return

    function expire(token: string) {
      setRecord(null)
      setExpiredToken(token)
      setAnnouncement(`${token} has expired. The record is being removed.`)
    }

    if (hasExpired(record.expires_at)) {
      expire(record.token_number)
      return
    }

    const remaining = millisUntil(record.expires_at)
    if (!Number.isFinite(remaining)) return

    const token = record.token_number
    const timer = setTimeout(() => expire(token), remaining + 1000)
    return () => clearTimeout(timer)
  }, [record])

  /* ---- lookup ---------------------------------------------------------- */

  const lookup = React.useCallback(
    async (token: string) => {
      setBusy(true)
      setFailure(null)
      setActionError(null)
      setExpiredToken(null)

      try {
        const found = await fetchRecord(token, officeId)

        /* Belt and braces: the server enforces expiry on read, and the screen
           refuses to paint a record that arrives already expired. */
        if (hasExpired(found.expires_at)) {
          setRecord(null)
          setExpiredToken(found.token_number)
          setAnnouncement(`${found.token_number} has expired.`)
          return
        }

        setRecord(found)
        setCalled((previous) => [
          ...previous.filter((t) => t.token_number !== found.token_number),
          ticketFromRecord(found),
        ])
        setAnnouncement(
          isReg343(found)
            ? `${found.token_number} loaded. REG 343, ${Math.round(found.completeness * 100)} percent complete.`
            : `${found.token_number} loaded. Driver license reference only.`
        )
      } catch (error) {
        setRecord(null)
        const kind = error instanceof StaffApiError ? error.kind : "network"
        setFailure({ kind, token })
        setAnnouncement(FAILURE_TITLE[kind](token))
      } finally {
        setBusy(false)
        void refreshQueue()
      }
    },
    [officeId, refreshQueue]
  )

  const handleCompleted = React.useCallback(() => {
    const token = record?.token_number
    setRecord(null)
    setCalled((previous) => previous.filter((t) => t.token_number !== token))
    setAnnouncement(token ? `${token} completed. The record has been deleted.` : "")
    void refreshQueue()
  }, [record, refreshQueue])

  /* ---- what the rail shows --------------------------------------------- */

  const tickets = React.useMemo(() => {
    const source = feed ? feed.tickets : called
    return [...source]
      .filter((ticket) => !hasExpired(ticket.expires_at))
      .sort((a, b) => a.seq - b.seq)
  }, [feed, called])

  return (
    <div className="page-wash relative z-2 flex min-h-full w-full flex-1 flex-col">
      <SkipLink />
      <Grain />

      <AppHeader
        productName="Counter View"
        subtitle={office.name}
        prototype
        actions={
          <div className="hidden text-right leading-tight sm:block">
            <span className="block text-small font-medium text-foreground">
              Counter workstation
            </span>
            <span className="block text-tiny text-muted-foreground">
              Sign-on stub · DMV SSO pending
            </span>
          </div>
        }
      />

      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-shell flex-1 px-(--gutter) pb-20 outline-none"
      >
        <section className="mb-8 border-b border-border py-10">
          <h1 className="mb-3">Retrieve an application</h1>
          <p className="max-w-content text-prose text-muted-foreground">
            Enter the token number you have just called. The customer&rsquo;s
            application appears already completed.
          </p>
          <TokenLookup
            onLookup={lookup}
            busy={busy}
            keepFocus={!modalOpen}
            className="mt-6 max-w-content"
          />
        </section>

        {office.unresolved ? (
          <Notice
            variant="warn"
            statusLabel="Warning"
            title="Unrecognised office identifier"
            className="mb-8"
          >
            No office matches &ldquo;{office.unresolved}&rdquo;. This screen is
            showing {office.name}. Check the address you opened before calling
            anyone.
          </Notice>
        ) : null}

        <div
          className={cn(
            "grid items-start gap-8",
            "lg:grid-cols-[var(--w-rail)_minmax(0,1fr)]"
          )}
        >
          <QueueRail
            tickets={tickets}
            nowServing={feed?.now_serving ?? null}
            selectedToken={record?.token_number ?? null}
            onSelect={lookup}
            degraded={!feedAvailable}
          />

          <section aria-label="Application record" className="min-w-0">
            {/* Announced rather than focused: focus belongs in the lookup
                field, because the next thing that happens is another scan. */}
            <p role="status" aria-live="polite" className="sr-only">
              {announcement}
            </p>

            {actionError ? (
              <Notice
                variant="destructive"
                statusLabel="Error"
                live="assertive"
                title="That did not work"
                className="mb-6"
              >
                {actionError}
              </Notice>
            ) : null}

            {record ? (
              <RecordPanel
                record={record}
                office={office}
                onCompleted={handleCompleted}
                onError={setActionError}
                onModalChange={setModalOpen}
              />
            ) : expiredToken ? (
              <Notice
                variant="warn"
                statusLabel="Warning"
                title={`Ticket ${expiredToken} has expired`}
              >
                Tickets and their application data are deleted at close of
                business. This record is being removed now.
              </Notice>
            ) : failure ? (
              <Notice
                variant={failure.kind === "not_found" ? "warn" : "destructive"}
                statusLabel={failure.kind === "not_found" ? "Warning" : "Error"}
                title={FAILURE_TITLE[failure.kind](failure.token)}
              >
                <FailureBody kind={failure.kind} />
              </Notice>
            ) : (
              <div className="rounded-card border border-dashed border-border px-6 py-20 text-center">
                <h2 className="mb-3">Call a ticket to begin</h2>
                <p className="text-small text-muted-foreground">
                  Scan the ticket, type the token number above, or choose one
                  from the queue.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* max-w-content is the measure token — the same reading width the
            customer-facing prose uses. */}
        <footer className="mt-16 max-w-content border-t border-border pt-6 text-tiny leading-loose text-muted-foreground">
          <strong className="text-foreground">Prototype.</strong> Every access
          shown here is authenticated against DMV single sign-on in production
          and written to the audit log — the log records that an access
          happened and by whom, never what the application said. Marking a
          transaction complete triggers a hard delete of the application
          record: no archive, no backup, nothing to retrieve afterwards.
        </footer>
      </main>
    </div>
  )
}

export { CounterScreen }
