'use client';

/* ==========================================================================
   The assistant — a modal Sheet that persists across every screen.

   Accessibility notes, since this is the one component that can trap someone:
     · Radix's Dialog gives us the Tab trap, Escape to close, and focus return
       to whatever opened the panel. Verified: FocusScope records
       document.activeElement on open and restores it on close, which matters
       here because the panel is opened programmatically from several
       different buttons, not from a single trigger.
     · Opening focus is redirected from the close button to the input, so the
       customer can start typing immediately.
     · The transcript is a role="log" with aria-live="polite", so each reply is
       announced without interrupting whatever is being read.
   ========================================================================== */

import * as React from 'react';

import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { focusRing } from '@/components/ui/focus-ring';
import { answerFor, SUGGESTED_QUESTION_KEYS, type AnswerSource } from './assistant-kb';

/* Long enough to read as a reply rather than a lookup, short enough that
   nobody waits for it. */
const REPLY_DELAY_MS = 320;

export interface AssistantQuestion {
  text: string;
  /** Bumped on every ask, so the same question twice still fires twice. */
  nonce: number;
}

interface Message {
  id: number;
  who: 'me' | 'bot';
  /** Opening line only — kept as a key so it follows a language change. */
  opening?: boolean;
  text?: string;
  source?: AnswerSource | null;
}

/**
 * Renders emphasis without going near dangerouslySetInnerHTML. The English
 * answers mark it with **, the Spanish ones in lib/i18n use <b>; both are
 * normalised to the same delimiter and split, so neither is ever parsed as
 * markup and no assistant text can inject an element.
 */
function RichText({ text }: { text: string }) {
  const parts = text.replace(/<\/?b>/g, '**').split('**');
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <React.Fragment key={i}>{part}</React.Fragment>,
      )}
    </>
  );
}

type AssistantProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Set by a "ask the assistant" button elsewhere in the flow. */
  question: AssistantQuestion | null;
};

function Assistant({ open, onOpenChange, question }: AssistantProps) {
  const { t, lang } = useTranslation();
  const [messages, setMessages] = React.useState<Message[]>([{ id: 0, who: 'bot', opening: true }]);
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const logRef = React.useRef<HTMLDivElement>(null);
  const nextId = React.useRef(1);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  /* The answer is resolved in the language the question was asked in, and the
     transcript keeps it that way: a later language switch changes the chrome,
     not what was already said. */
  const ask = React.useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const answer = answerFor(trimmed, lang);
    setMessages((prev) => [...prev, { id: nextId.current++, who: 'me', text: trimmed }]);
    if (!answer) return;
    const timer = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, who: 'bot', text: answer.text, source: answer.source },
      ]);
    }, REPLY_DELAY_MS);
    timers.current.push(timer);
  }, [lang]);

  /* A question pushed in from the flow ("I'm missing something — what now?"). */
  const lastNonce = React.useRef(0);
  React.useEffect(() => {
    if (!question || question.nonce === lastNonce.current) return;
    lastNonce.current = question.nonce;
    ask(question.text);
  }, [question, ask]);

  React.useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t('chat.close')}
        aria-describedby={undefined}
        className="w-full gap-0 p-0 sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{t('chat.title')}</SheetTitle>
        </SheetHeader>

        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'max-w-[85%] rounded-panel px-5 py-3 text-small leading-normal',
                message.who === 'me'
                  ? 'self-end bg-primary text-primary-foreground'
                  : 'self-start bg-elevated text-foreground',
              )}
            >
              {message.opening ? t('chat.opening') : <RichText text={message.text ?? ''} />}
              {message.source ? (
                <span className="mt-3 block text-tiny text-muted-foreground">
                  {t('chat.source')}:{' '}
                  <a
                    href={message.source.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'rounded-chip text-primary underline underline-offset-4',
                      focusRing,
                    )}
                  >
                    {message.source.title} ↗
                  </a>
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border px-6 py-4">
          {SUGGESTED_QUESTION_KEYS.map((key) => {
            /* Rendered in the active language, and asked in it too, so the
               keyword match resolves to a real answer rather than falling
               through to low confidence. */
            const suggestion = t(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => ask(suggestion)}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-pill border border-border-strong px-5',
                  'text-tiny text-muted-foreground',
                  'transition-[background-color,color] duration-fast ease-brand',
                  'hover:bg-elevated hover:text-foreground',
                  focusRing,
                )}
              >
                {suggestion}
              </button>
            );
          })}
        </div>

        <form
          className="flex items-end gap-3 border-t border-border p-6"
          onSubmit={(event) => {
            event.preventDefault();
            ask(draft);
            setDraft('');
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor="assistant-input" className="sr-only">
              {t('chat.yourQuestion')}
            </label>
            <Input
              id="assistant-input"
              ref={inputRef}
              value={draft}
              autoComplete="off"
              placeholder={t('chat.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" size="field">
            {t('chat.send')}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The floating way in. It is NOT rendered on the form screen — there it would
 * sit on top of the sticky Next button, and the form's progress bar carries
 * the same control instead.
 */
function AssistantFab({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="accent"
      size="icon-lg"
      aria-haspopup="dialog"
      aria-label={t('form.help')}
      onClick={onClick}
      className="fixed right-5 bottom-5 z-40 border border-gold-ink text-h3"
    >
      <span aria-hidden="true">?</span>
    </Button>
  );
}

export { Assistant, AssistantFab };
