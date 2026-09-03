"use client"

import * as React from "react"
import { DownloadIcon, Trash2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { FormData } from "@/lib/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { completeAndPurge, StaffApiError } from "./api"

type DownloadState = "idle" | "working" | "done" | "failed"

type RecordActionsProps = {
  token: string
  officeId: string
  /** Omitted for a Driver License ticket — there is no REG 343 to fill. */
  formData?: FormData
  /** The record has been purged; the screen clears it. */
  onCompleted: () => void
  /** Something the technician must be told about, in their words. */
  onError: (message: string) => void
  /** Raised while a dialog owns focus, so the lookup field stops reclaiming it. */
  onModalChange?: (open: boolean) => void
  className?: string
}

/**
 * The two things the technician does with a record, and nothing else.
 *
 * Both are consequential in different directions: one produces the legal
 * document the customer signs, the other destroys the record permanently. The
 * download reports its own progress inline because generating a 363-field
 * AcroForm takes a visible moment; the purge asks first because there is no
 * undo anywhere in the system.
 */
function RecordActions({
  token,
  officeId,
  formData,
  onCompleted,
  onError,
  onModalChange,
  className,
}: RecordActionsProps) {
  const [download, setDownload] = React.useState<DownloadState>("idle")
  const [confirming, setConfirming] = React.useState(false)
  const [purging, setPurging] = React.useState(false)

  /* Opening the dialog is announced to the parent as it happens rather than
     watched for afterwards, so the lookup field stops reclaiming focus on the
     same render the dialog takes it. */
  function setDialog(open: boolean) {
    setConfirming(open)
    onModalChange?.(open)
  }

  async function handleDownload() {
    if (!formData) return
    setDownload("working")
    try {
      /* pdf-lib and the 363-field mapping are loaded only when a technician
         actually asks for a form — they have no business in the bundle that
         renders a completeness percentage. */
      const { downloadREG343 } = await import("@/lib/reg343/pdf")
      await downloadREG343(formData, { token })
      setDownload("done")
    } catch (error) {
      setDownload("failed")
      onError(
        error instanceof Error
          ? `Could not generate the PDF. ${error.message}`
          : "Could not generate the PDF."
      )
    }
  }

  async function handlePurge() {
    setPurging(true)
    try {
      await completeAndPurge(token, officeId)
      setDialog(false)
      onCompleted()
    } catch (error) {
      setDialog(false)
      onError(
        error instanceof StaffApiError && error.kind === "not_found"
          ? `${token} has already been removed.`
          : `Could not complete ${token}. The record has not been deleted.`
      )
    } finally {
      setPurging(false)
    }
  }

  const downloadLabel =
    download === "working"
      ? "Preparing…"
      : download === "done"
        ? "Downloaded"
        : download === "failed"
          ? "Try again"
          : "Download filled REG 343"

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {formData ? (
        <Button
          onClick={handleDownload}
          disabled={download === "working"}
          size="field"
          /* whitespace-normal because the stock button is nowrap: if a label
             ever outgrows the column it must wrap inside the button rather
             than spill past its edge. */
          className="h-auto w-full py-3 text-center leading-tight whitespace-normal"
        >
          <DownloadIcon aria-hidden="true" className="shrink-0" />
          {downloadLabel}
        </Button>
      ) : null}

      <Button
        variant="ghost"
        size="field"
        onClick={() => setDialog(true)}
        className="h-auto w-full py-3 text-center leading-tight whitespace-normal"
      >
        <Trash2Icon aria-hidden="true" className="shrink-0" />
        Mark complete &amp; purge
      </Button>

      {/* The button's own label changes as well, so this is a second channel
          for screen readers rather than the only one. */}
      <p role="status" aria-live="polite" className="sr-only">
        {download === "working"
          ? "Preparing the REG 343."
          : download === "done"
            ? "REG 343 downloaded."
            : download === "failed"
              ? "The REG 343 could not be generated."
              : ""}
      </p>

      <Dialog open={confirming} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {token} complete?</DialogTitle>
            <DialogDescription>
              The application record is deleted immediately and permanently —
              no archive, no backup, nothing to retrieve afterwards. Make sure
              you have the signed REG 343 in your hand first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="field">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="field"
              onClick={handlePurge}
              disabled={purging}
            >
              {purging ? "Deleting…" : "Complete & delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { RecordActions }
