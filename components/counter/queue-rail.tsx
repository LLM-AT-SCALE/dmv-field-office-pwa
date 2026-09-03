"use client"

import * as React from "react"
import { CircleCheckIcon, CircleDashedIcon, CircleIcon, LinkIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { SERVICES } from "@/lib/office"
import type { ServiceCode } from "@/lib/types"
import { StatTile } from "@/components/patterns/stat-tile"
import type { QueueTicket } from "./types"

type TicketState = {
  label: string
  icon: React.ReactNode
  /* Ready is the state worth spotting from across the counter. */
  ready: boolean
}

/**
 * What the technician needs to know before they call a ticket: whether there
 * is anything waiting for them on screen.
 *
 * The icon carries the same distinction as the colour — a filled check for
 * ready, a dashed ring for still being typed, a link for a DL reference — so
 * the state survives greyscale and colour blindness.
 */
function stateOf(ticket: QueueTicket): TicketState {
  if (ticket.service === "VR") {
    if (ticket.status === "submitted") {
      return { label: "REG 343 ready", icon: <CircleCheckIcon aria-hidden="true" />, ready: true }
    }
    /* "In progress" and "not started" mean different things at the counter: one
       customer is mid-form and worth waiting a moment for, the other has
       nothing and will be filling it in at the window. */
    return ticket.has_draft === false
      ? { label: "not started", icon: <CircleIcon aria-hidden="true" />, ready: false }
      : { label: "in progress", icon: <CircleDashedIcon aria-hidden="true" />, ready: false }
  }

  return ticket.has_edl_reference
    ? { label: "eDL 44 ref", icon: <LinkIcon aria-hidden="true" />, ready: true }
    : { label: "no reference", icon: <CircleIcon aria-hidden="true" />, ready: false }
}

type QueueRailProps = {
  tickets: QueueTicket[]
  nowServing: Record<ServiceCode, string> | null
  selectedToken: string | null
  onSelect: (token: string) => void
  /** True when the queue feed could not be read; the rail says so plainly. */
  degraded?: boolean
  className?: string
}

/**
 * The lobby's call-board, on the technician's screen.
 *
 * Below 1024px it is a horizontally scrolling shelf. A vertical list of
 * today's tickets on a phone would push the record — the thing the technician
 * actually came for — clean off the bottom of the screen, so the queue gives
 * up the vertical space instead. From 1024px up it becomes the sticky left
 * rail it wants to be, and stays in view while the record scrolls.
 */
function QueueRail({
  tickets,
  nowServing,
  selectedToken,
  onSelect,
  degraded = false,
  className,
}: QueueRailProps) {
  return (
    <section
      aria-labelledby="counter-queue-heading"
      className={cn(
        /* min-w-0 because this is a grid item: without it the automatic
           minimum size lets the shelf's fixed-width tickets force the whole
           row wider than the viewport, and the page scrolls sideways. */
        "flex min-w-0 flex-col gap-5",
        "lg:sticky lg:top-[calc(var(--header-h)+var(--s6))]",
        "lg:max-h-[calc(100dvh-var(--header-h)-var(--s10))] lg:overflow-y-auto",
        className
      )}
    >
      <h2 id="counter-queue-heading" className="text-h3">
        Queue
      </h2>

      <div className="grid grid-cols-2 gap-5 rounded-card border border-border bg-elevated p-5">
        {(["VR", "DL"] as ServiceCode[]).map((code) => (
          <StatTile
            key={code}
            value={nowServing?.[code] ?? "—"}
            label={`Now serving · ${code}`}
            hint={SERVICES[code].name}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-tiny font-sans font-semibold tracking-widest text-muted-foreground uppercase">
          Waiting
        </h3>

        {tickets.length === 0 ? (
          <p className="text-small text-muted-foreground">
            {degraded
              ? "The queue feed is unavailable. Tickets you look up will be listed here."
              : "No tickets issued yet."}
          </p>
        ) : (
          <ul
            className={cn(
              "flex min-w-0 list-none gap-2",
              /* Shelf below lg, column at lg and up. */
              "snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-2",
              "lg:flex-col lg:snap-none lg:overflow-x-visible lg:pb-0"
            )}
          >
            {tickets.map((ticket) => {
              const state = stateOf(ticket)
              const current = ticket.token_number === selectedToken

              return (
                <li key={ticket.token_number} className="shrink-0 snap-start lg:w-full lg:shrink">
                  <button
                    type="button"
                    onClick={() => onSelect(ticket.token_number)}
                    aria-current={current ? "true" : undefined}
                    className={cn(
                      "flex min-h-14 w-48 items-center gap-3 lg:w-full",
                      "rounded-card border border-border border-l-4 border-l-border bg-elevated px-4 py-3 text-left",
                      "transition-[border-color,transform] duration-(--t-fast) ease-brand",
                      "hover:-translate-y-0.5 hover:border-border-strong",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      /* Selection is a border AND the aria-current state, never
                         colour on its own. */
                      current && "border-gold-ink border-l-gold-ink bg-background"
                    )}
                  >
                    <span className="font-display text-h3 font-bold tracking-tight text-deep tabular-nums">
                      {ticket.token_number}
                    </span>
                    <span className="text-tiny text-muted-foreground">{ticket.service}</span>
                    <span
                      className={cn(
                        "ml-auto flex items-center gap-1 text-tiny whitespace-nowrap",
                        state.ready ? "text-success" : "text-muted-foreground",
                        "[&_svg]:size-4 [&_svg]:shrink-0"
                      )}
                    >
                      {state.icon}
                      {state.label}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export { QueueRail }
