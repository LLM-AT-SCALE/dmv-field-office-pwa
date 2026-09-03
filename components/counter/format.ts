/* ==========================================================================
   Counter view — display helpers.

   Formatting only. Nothing here decides anything; the domain lives in
   lib/reg343 and lib/office.
   ========================================================================== */

import type { FieldDef } from "@/lib/reg343"
import type { FieldValue } from "@/lib/types"

/**
 * '4:12 PM', read on the clock at the office.
 *
 * The zone is passed in rather than left to the browser. A technician is
 * standing in the building so the two usually agree, but "deleted at 5:00 PM
 * today" is a retention promise: it has to name the office's five o'clock,
 * which is also the one expiryFor() in lib/office.ts computed against, and not
 * whatever the workstation clock happens to be set to.
 */
export function formatTime(
  iso: string | null | undefined,
  timeZone?: string
): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  /* en-US explicitly, not the workstation's locale. On a 24-hour machine this
     rendered midnight as "0:49", which reads as a duration rather than a time,
     and printed the retention promise as "17:00" directly beneath office hours
     written as "8:00am to 5:00pm". The counter should show one clock. */
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  })
}

function formatMoney(value: FieldValue): string {
  const amount = Number(String(value).replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(amount)) return String(value)
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** True when a field holds nothing the technician could read out. */
export function isBlank(value: FieldValue): boolean {
  return value === undefined || value === null || String(value).trim() === ""
}

/**
 * One answer, as it should appear on the counter screen.
 *
 * The stored value is always the English option string — that is what gets
 * written into the DMV AcroForm — so this reformats rather than translates.
 */
export function displayValue(field: FieldDef, value: FieldValue): string {
  if (field.type === "checkbox") return value ? "Yes" : "No"
  if (field.type === "currency") return "$" + formatMoney(value)
  return String(value)
}

/** Milliseconds until a ticket expires; 0 once it has. */
export function millisUntil(iso: string, now: number = Date.now()): number {
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return Number.POSITIVE_INFINITY
  return Math.max(0, at - now)
}

export function hasExpired(iso: string, now: number = Date.now()): boolean {
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return false
  return at <= now
}
