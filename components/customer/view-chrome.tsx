/* ==========================================================================
   Small shared pieces every customer view is built from.

   ViewHeading is the load-bearing one. This is a single-page flow: content is
   replaced without a page load, so without moving focus a screen reader is
   never told anything changed and the keyboard focus is left on a button that
   no longer exists. Every view therefore opens with a focusable heading, and
   CustomerApp moves focus to it whenever the view changes. Views with no
   visible heading — the ticket screens, which lead with the token itself —
   carry a screen-reader-only one instead.
   ========================================================================== */

import * as React from 'react';

import { cn } from '@/lib/utils';

type HeadingLevel = 'h1' | 'h2';

type ViewHeadingProps = React.ComponentProps<'h2'> & {
  level?: HeadingLevel;
  /** Present but not painted — for views whose subject is a number, not a title. */
  srOnly?: boolean;
};

/**
 * tabIndex={-1} makes it programmatically focusable without adding it to the
 * tab order. globals.css suppresses the focus ring on exactly this shape, so
 * the announcement happens without a stray outline appearing mid-flow.
 */
function ViewHeading({ level = 'h2', srOnly, className, ...props }: ViewHeadingProps) {
  const Tag = level;
  return (
    <Tag
      data-view-heading=""
      tabIndex={-1}
      className={cn(srOnly && 'sr-only', 'text-balance', className)}
      {...props}
    />
  );
}

type SectionHeadProps = {
  eyebrow?: React.ReactNode;
  /** Gold-ink eyebrow, for the second step of a two-step choice. */
  eyebrowAccent?: boolean;
  heading: React.ReactNode;
  level?: HeadingLevel;
  note?: React.ReactNode;
  className?: string;
};

function SectionHead({
  eyebrow,
  eyebrowAccent,
  heading,
  level = 'h2',
  note,
  className,
}: SectionHeadProps) {
  return (
    <div className={cn('grid gap-3', className)}>
      {eyebrow ? (
        <span
          className={cn(
            'text-tiny font-medium tracking-wide uppercase',
            eyebrowAccent ? 'text-gold-ink' : 'text-muted-foreground',
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      <ViewHeading level={level}>{heading}</ViewHeading>
      {note ? <p className="text-small text-pretty text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Two figures side by side — wait time and queue depth, position and wait. */
function StatStrip({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-6 rounded-card border border-border bg-card p-5',
        className,
      )}
      {...props}
    />
  );
}

type DefinitionRow = {
  term: React.ReactNode;
  value: React.ReactNode;
  /** Colours the value. Omitted means ordinary foreground. */
  tone?: 'positive' | 'caution';
};

/** Label/value rows, parted by hairlines. A <dl>, because that is what it is. */
function DefinitionRows({ rows, className }: { rows: DefinitionRow[]; className?: string }) {
  return (
    <dl
      className={cn(
        'divide-y divide-border overflow-hidden rounded-card border border-border bg-card',
        className,
      )}
    >
      {rows.map((row, i) => (
        <div key={i} className="flex flex-wrap items-baseline justify-between gap-4 px-5 py-4">
          <dt className="text-small text-muted-foreground">{row.term}</dt>
          <dd
            className={cn(
              'text-body text-right font-medium',
              row.tone === 'positive' && 'text-success',
              row.tone === 'caution' && 'text-warning',
              !row.tone && 'text-foreground',
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Full-width buttons stacked, primary first. */
function ButtonStack({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('grid gap-3 [&>*]:w-full', className)} {...props} />;
}

export { ButtonStack, DefinitionRows, SectionHead, StatStrip, ViewHeading };
