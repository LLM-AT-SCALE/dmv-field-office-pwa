import * as React from "react"

import { cn } from "@/lib/utils"
import { fieldBase } from "@/components/ui/input"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldBase,
        "field-sizing-content flex min-h-32 resize-y px-5 py-4 leading-normal",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
