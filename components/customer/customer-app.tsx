'use client';

/* ==========================================================================
   The customer flow, end to end.

   welcome → service → checklist → ticket → REG 343 → review → submitted,
   with the driver licence hand-off, the expired ticket and the assistant
   hanging off it. One client component holds the state because the whole
   thing is one uninterrupted sitting: the customer is standing in a lobby
   with a ticket, and a page load between steps is a chance to lose them.

   THREE THINGS HERE ARE LOAD-BEARING.

   · FOCUS. Content is replaced without a page load, so on every view change
     focus moves to that view's heading — a screen-reader-only one on the
     ticket screens, whose subject is a number rather than a title. Without
     it a screen reader is never told anything changed and the keyboard is
     left on a button that no longer exists.

   · AUTOSAVE IS FIELD-LEVEL. Answers are PATCHed one field per request, so a
     dropped connection costs the field being typed and nothing else. The
     local mirror is written first and synchronously: the server copy is for
     the technician, the local copy is what survives a reload.

   · RETENTION IS ENFORCED ON THIS SIDE TOO. A ticket left on a phone
     overnight expires whether or not the app is talking to the server, and
     'gone' from the API is treated exactly like a local expiry.
   ========================================================================== */

import * as React from 'react';

import { useTranslation, validationMessage } from '@/lib/i18n';
import {
  fieldById,
  setFieldValue,
  validateField,
  visibleFields,
  visibleSections,
} from '@/lib/reg343';
import type { ValidationProblem } from '@/lib/reg343';
import type { FieldValue, Office, Reg343FieldId, ServiceCode } from '@/lib/types';
import { AppHeader } from '@/components/chrome/app-header';
import { Grain } from '@/components/chrome/grain';
import { LanguageToggle } from '@/components/chrome/language-toggle';
import { PageShell } from '@/components/chrome/page-shell';
import { SkipLink } from '@/components/chrome/skip-link';
import { Notice } from '@/components/patterns/notice';
import { Assistant, AssistantFab, type AssistantQuestion } from './assistant';
import { ChecklistView } from './checklist-view';
import { DlView } from './dl-view';
import { ExpiredView } from './expired-view';
import { FormView } from './form-view';
import { ReviewView } from './review-view';
import { ServiceView } from './service-view';
import { SubmittedView } from './submitted-view';
import { TicketRail } from './ticket-rail';
import { TicketView } from './ticket-view';
import { WelcomeView } from './welcome-view';
import {
  deleteSession,
  fetchOfficeSnapshot,
  fetchQueueStatus,
  isLocallyExpired,
  issueTicket,
  patchField,
  purgeLocalSession,
  readLocalSession,
  saveDlReference,
  submitApplication,
  writeLocalSession,
  type LocalSession,
  type QueueStatus,
  type ServiceWaitView,
} from './session';

type View =
  | 'welcome'
  | 'service'
  | 'checklist'
  | 'token'
  | 'form'
  | 'review'
  | 'submitted'
  | 'dl'
  | 'expired';

/* The queue moves roughly once every twelve seconds, so polling faster than
   this buys nothing and costs a lobby full of phones on one access point. */
const QUEUE_POLL_MS = 5000;
/* Wait times on the welcome and service screens. Nobody is watching them
   move; they only have to be right when the screen is read. */
const OFFICE_POLL_MS = 30_000;
/* Local expiry check. The server enforces retention independently. */
const RETENTION_CHECK_MS = 60_000;
/* Keystrokes coalesce for this long before the field is sent. Long enough to
   not send a request per character, short enough that leaving the field, the
   section or the page never loses the answer. */
const AUTOSAVE_DEBOUNCE_MS = 700;
/* How long "Saved" stays up. */
const SAVED_PILL_MS = 1200;

const EMPTY_WAITS: Record<ServiceCode, ServiceWaitView> = {
  VR: { waitMinutes: 0, depth: 0 },
  DL: { waitMinutes: 0, depth: 0 },
};

function CustomerApp({ office }: { office: Office }) {
  const { t, lang, setLang } = useTranslation();

  const [view, setView] = React.useState<View>('welcome');
  const [service, setService] = React.useState<ServiceCode | null>(null);
  const [sub, setSub] = React.useState<string | null>(null);
  const [sectionIndex, setSectionIndex] = React.useState(0);
  const [session, setSession] = React.useState<LocalSession | null>(null);
  const [queue, setQueue] = React.useState<QueueStatus | null>(null);
  const [waits, setWaits] = React.useState(EMPTY_WAITS);
  /* undefined until the office answers. WelcomeView omits the status row
     rather than guess — "Open now" over a closed office is the one wrong
     answer that costs somebody a journey. */
  const [isOpen, setIsOpen] = React.useState<boolean | undefined>(undefined);
  /* A ticket held at a DIFFERENT office than the one just scanned. Kept
     separate from `session` so it is never treated as this office's ticket. */
  const [otherOfficeTicket, setOtherOfficeTicket] = React.useState<LocalSession | null>(null);
  const [problems, setProblems] = React.useState<Record<string, ValidationProblem | null>>({});
  const [saved, setSaved] = React.useState(false);
  /* True when an answer is on the phone but not yet on the server. */
  const [unsaved, setUnsaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [ticketFailed, setTicketFailed] = React.useState(false);
  const [dlFailed, setDlFailed] = React.useState(false);
  const [submitFailed, setSubmitFailed] = React.useState(false);
  const [announcement, setAnnouncement] = React.useState('');
  const [assistantOpen, setAssistantOpen] = React.useState(false);
  const [question, setQuestion] = React.useState<AssistantQuestion | null>(null);

  /* Read by timers and by the autosave flush, which must not re-subscribe
     every time a character is typed. */
  const sessionRef = React.useRef<LocalSession | null>(null);
  React.useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const announce = React.useCallback((message: string) => setAnnouncement(message), []);

  const ask = React.useCallback((text: string) => {
    setAssistantOpen(true);
    setQuestion((prev) => ({ text, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  /* ---- session lifecycle ------------------------------------------------ */

  const closeSession = React.useCallback((next: View) => {
    purgeLocalSession();
    sessionRef.current = null;
    setSession(null);
    setQueue(null);
    setService(null);
    setSub(null);
    setSectionIndex(0);
    setProblems({});
    setView(next);
  }, []);

  /* Restore the ticket from the local mirror.

     This adopts client-only state exactly once, after hydration. It cannot be
     read during render: localStorage does not exist on the server, so doing so
     would ship markup that fails to hydrate. It is also not a subscription —
     nothing external changes afterwards — so useSyncExternalStore would be the
     wrong shape here.

     react-hooks/set-state-in-effect cannot see that constraint. The rule exists
     to catch cascading renders from derived state; this runs once and then
     never again. Suppressed deliberately rather than restructured into
     something less honest. */
  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    const local = readLocalSession();
    if (!local) return;
    if (isLocallyExpired(local)) {
      purgeLocalSession();
      setView('expired');
      return;
    }

    /* A ticket belongs to the office that issued it. Without this check,
       scanning the Roseville poster and then the Sacramento South poster
       restored the Roseville ticket and dropped the customer back where they
       left off — at the wrong building.

       The stored ticket is NOT discarded: it may be a live place in a real
       queue somewhere else. It is surfaced instead, so the customer can go back
       to it or give it up deliberately. */
    if (local.office_id !== office.id) {
      setOtherOfficeTicket(local);
      return;
    }

    setSession(local);
    setService(local.service);
    setSub(local.sub_transaction);
    /* Service first, then submission. A DL session is marked submitted once
       its confirmation number is recorded, but the DL screen is still where
       that customer belongs — it is where the number they saved is shown. */
    setView(local.service === 'DL' ? 'dl' : local.submitted_at ? 'submitted' : 'token');
    /* office.id is fixed for the life of this instance: the page keys this
       component by it, so a different office is a different instance and this
       effect runs again from scratch. Listing it as a dependency would suggest
       the office can change under a live instance, which it cannot. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* Queue position. 'gone' means expired or never existed — both are a closed
     ticket as far as the customer is concerned. */
  const sessionId = session?.session_id ?? null;
  React.useEffect(() => {
    if (!sessionId || view === 'expired') return;

    const poll = async () => {
      if (document.hidden) return;
      const status = await fetchQueueStatus(sessionId);
      if (status === 'gone') {
        closeSession('expired');
        return;
      }
      /* null is a dropped connection: keep the last figure on screen rather
         than blanking it. */
      if (status) setQueue(status);
    };

    void poll();
    const timer = setInterval(() => void poll(), QUEUE_POLL_MS);
    return () => clearInterval(timer);
  }, [sessionId, view, closeSession]);

  /* A ticket left on a phone overnight disappears while the page is open. */
  React.useEffect(() => {
    const timer = setInterval(() => {
      const current = sessionRef.current;
      if (current && isLocallyExpired(current)) closeSession('expired');
    }, RETENTION_CHECK_MS);
    return () => clearInterval(timer);
  }, [closeSession]);

  /* Office wait times, for the two screens that show them. */
  React.useEffect(() => {
    if (view !== 'welcome' && view !== 'service') return;

    let stopped = false;
    const load = async () => {
      const snapshot = await fetchOfficeSnapshot(office.id);
      if (stopped || !snapshot) return;
      setWaits(snapshot.waits);
      /* Held separately from the waits so it stays undefined until the office
         has actually answered. Someone opening the link from an appointment
         email at eight in the evening needs to be told the office is shut —
         and must never be told it is open on the strength of a guess. */
      setIsOpen(snapshot.isOpen);
    };

    void load();
    const timer = setInterval(() => void load(), OFFICE_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [view, office.id]);

  /* ---- focus, on every view change -------------------------------------- */

  const firstPaint = React.useRef(true);
  React.useEffect(() => {
    if (firstPaint.current) {
      /* A fresh page load already starts focus at the top of the document;
         moving it here would only skip past the skip link. */
      firstPaint.current = false;
      return;
    }
    const heading = document.querySelector<HTMLElement>('[data-view-heading]');
    heading?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [view, sectionIndex]);

  /* ---- autosave --------------------------------------------------------- */

  const pending = React.useRef(new Map<string, FieldValue>());
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pillTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushRef = React.useRef<(() => Promise<void>) | null>(null);

  const flush = React.useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const id = sessionRef.current?.session_id;
    const entries = [...pending.current.entries()];
    pending.current.clear();
    if (!id || entries.length === 0) return;

    /* One request per field, deliberately. A PUT of the whole form would lose
       every answer when the connection drops mid-write. */
    const results = await Promise.all(entries.map(([field, value]) => patchField(id, field, value)));

    /* Anything that did not reach the server goes back on the queue and is
       retried with the next flush. Dropping it silently would leave the answer
       on the phone only — and then the technician opens the ticket at the
       counter and the field is simply blank, with nobody having been told. */
    const failed = entries.filter((_, i) => !results[i]);
    if (failed.length) {
      failed.forEach(([field, value]) => {
        if (!pending.current.has(field)) pending.current.set(field, value);
      });
      setUnsaved(true);
      /* Re-arm the same debounce so the retry rides along with the next
         keystroke, or fires on its own if the customer has stopped typing. */
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flushRef.current?.(), AUTOSAVE_DEBOUNCE_MS);
      return;
    }

    setUnsaved(false);
    setSaved(true);
    if (pillTimer.current) clearTimeout(pillTimer.current);
    pillTimer.current = setTimeout(() => setSaved(false), SAVED_PILL_MS);
  }, []);

  /* Held in a ref so the retry timer always calls the current flush without
     flush having to depend on itself. Written in an effect, never during
     render: a ref mutated in the render body is not safe to repeat, and a
     render can be repeated. */
  React.useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  React.useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pillTimer.current) clearTimeout(pillTimer.current);
    },
    [],
  );

  /* Give up the other office's ticket and start fresh here. */
  const discardOtherTicket = React.useCallback(() => {
    const other = otherOfficeTicket;
    setOtherOfficeTicket(null);
    if (!other) return;
    /* Release the place in that office's queue rather than leaving a ghost
       ticket for a technician to call. */
    void deleteSession(other.session_id).catch(() => {});
    purgeLocalSession();
  }, [otherOfficeTicket]);

  const handleChange = React.useCallback(
    (id: Reg343FieldId, value: FieldValue) => {
      const current = sessionRef.current;
      if (!current) return;

      const next: LocalSession = {
        ...current,
        form_data: setFieldValue({ ...current.form_data }, id, value),
      };
      sessionRef.current = next;
      setSession(next);
      writeLocalSession(next);

      /* Re-check only a field that is ALREADY flagged, so the message clears
         the moment it is fixed. An unflagged field is left alone until blur:
         nobody needs to be told a VIN is too short at the third character. */
      setProblems((prev) => {
        if (!prev[id]) return prev;
        const field = fieldById(id);
        return { ...prev, [id]: field ? validateField(field, value, next.form_data) : null };
      });

      pending.current.set(id, value);
      const type = fieldById(id)?.type;
      const discrete = type === 'radio' || type === 'select' || type === 'checkbox';
      if (discrete) {
        void flush();
        return;
      }
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), AUTOSAVE_DEBOUNCE_MS);
    },
    [flush],
  );

  /* Validation runs HERE and nowhere else in the typing path. */
  const handleBlur = React.useCallback(
    (id: Reg343FieldId) => {
      const current = sessionRef.current;
      if (!current) return;
      const field = fieldById(id);
      if (field) {
        setProblems((prev) => ({
          ...prev,
          [id]: validateField(field, current.form_data[id], current.form_data),
        }));
      }
      void flush();
    },
    [flush],
  );

  const errors = React.useMemo(() => {
    const out: Record<string, string | null> = {};
    for (const [id, problem] of Object.entries(problems)) {
      out[id] = validationMessage(problem, lang);
    }
    return out;
  }, [problems, lang]);

  /* ---- actions ---------------------------------------------------------- */

  const takeTicket = React.useCallback(async () => {
    if (!service || !sub) return;
    setBusy(true);
    setTicketFailed(false);
    try {
      const issued = await issueTicket(office.id, service, sub);
      const local: LocalSession = {
        session_id: issued.session_id,
        office_id: office.id,
        token_number: issued.token_number,
        service: issued.service,
        sub_transaction: issued.sub_transaction,
        /* The API does not return an issue time; the ticket was issued now. */
        issued_at: new Date().toISOString(),
        expires_at: issued.expires_at,
        submitted_at: null,
        edl_confirmation_number: null,
        form_data: {},
      };
      writeLocalSession(local);
      sessionRef.current = local;
      setSession(local);
      announce(t('a11y.ticketIssued', { token: local.token_number }));
      setView('token');
    } catch {
      setTicketFailed(true);
    } finally {
      setBusy(false);
    }
  }, [announce, office.id, service, sub, t]);

  const nextSection = React.useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    void flush();

    const data = current.form_data;
    const sections = visibleSections(data);
    const index = Math.min(sectionIndex, sections.length - 1);

    /* Flag anything malformed in this section — and move on regardless. */
    const found: Record<string, ValidationProblem | null> = {};
    let flagged = 0;
    visibleFields(sections[index], data).forEach((field) => {
      const problem = validateField(field, data[field.id], data);
      found[field.id] = problem;
      if (problem) flagged++;
    });
    setProblems((prev) => ({ ...prev, ...found }));
    if (flagged) {
      announce(flagged === 1 ? t('form.needsChecking1') : t('form.needsChecking', { n: flagged }));
    }

    if (index >= sections.length - 1) setView('review');
    else setSectionIndex(index + 1);
  }, [announce, flush, sectionIndex, t]);

  const prevSection = React.useCallback(() => {
    void flush();
    if (sectionIndex === 0) setView('token');
    else setSectionIndex((i) => i - 1);
  }, [flush, sectionIndex]);

  const submit = React.useCallback(async () => {
    const current = sessionRef.current;
    if (!current) return;
    setBusy(true);
    setSubmitFailed(false);
    /* Every answer reaches the server before the submit does, which is what
       lets the failure notice promise the work is not lost. */
    await flush();
    const result = await submitApplication(current.session_id);
    setBusy(false);

    if (!result) {
      /* The likeliest cause is that the ticket no longer exists. That has its
         own screen, and it is a better answer than "try again" — so ask
         before assuming this is a transient failure. */
      const status = await fetchQueueStatus(current.session_id);
      if (status === 'gone') {
        closeSession('expired');
        return;
      }
      setSubmitFailed(true);
      return;
    }

    const next: LocalSession = { ...current, submitted_at: result.submittedAt };
    sessionRef.current = next;
    setSession(next);
    writeLocalSession(next);
    announce(t('a11y.submitted'));
    setView('submitted');
  }, [announce, closeSession, flush, t]);

  const saveConfirmation = React.useCallback(
    async (confirmationNumber: string) => {
      const current = sessionRef.current;
      if (!current) return;
      setBusy(true);
      setDlFailed(false);
      const result = await saveDlReference(current.session_id, confirmationNumber);
      setBusy(false);
      if (!result.ok) {
        setDlFailed(true);
        return;
      }
      /* Recording the number IS finishing on this path — there is no form to
         send afterwards. Without this the technician's screen cannot tell a DL
         customer who has completed DL 44 from one who has not started, which
         is the whole point of holding the reference. POST /submit has a DL
         branch that reports completeness against exactly this fact. */
      const submitted = await submitApplication(current.session_id);

      const next: LocalSession = {
        ...current,
        edl_confirmation_number: confirmationNumber.toUpperCase(),
        /* Only claimed when the server agreed. The reference is saved either
           way, which is what this screen promises. */
        submitted_at: submitted ? submitted.submittedAt : current.submitted_at,
      };
      sessionRef.current = next;
      setSession(next);
      writeLocalSession(next);
      announce(t('a11y.confSaved'));
    },
    [announce, t],
  );

  const leaveQueue = React.useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    if (!window.confirm(t('ticket.leaveConfirm'))) return;
    void deleteSession(current.session_id);
    closeSession('welcome');
  }, [closeSession, t]);

  /* ---- views ------------------------------------------------------------ */

  let content: React.ReactNode;

  if (view === 'expired' || (view !== 'welcome' && view !== 'service' && view !== 'checklist' && !session)) {
    content = <ExpiredView onRestart={() => closeSession('welcome')} />;
  } else if (view === 'service') {
    content = (
      <ServiceView
        waits={waits}
        service={service}
        sub={sub}
        onSelectService={(code) => {
          setService(code);
          setSub(null);
        }}
        onSelectSub={setSub}
        onContinue={() => setView('checklist')}
        onAsk={ask}
      />
    );
  } else if (view === 'checklist' && service && sub) {
    content = (
      <>
        {ticketFailed ? (
          <Notice
            variant="destructive"
            live="assertive"
            title={t('error.ticketFailedTitle')}
            className="mb-8"
          >
            {t('error.ticketFailedBody')}
          </Notice>
        ) : null}
        <ChecklistView
          service={service}
          sub={sub}
          busy={busy}
          onTakeTicket={() => void takeTicket()}
          onAsk={ask}
        />
      </>
    );
  } else if (view === 'token' && session) {
    content = (
      <TicketView
        session={session}
        queue={queue}
        onStartApplication={() => {
          if (session.service === 'DL') {
            setView('dl');
            return;
          }
          setSectionIndex(0);
          setView('form');
        }}
        onLeave={leaveQueue}
      />
    );
  } else if (view === 'form' && session) {
    content = (
      <FormView
        data={session.form_data}
        sectionIndex={sectionIndex}
        errors={errors}
        saved={saved}
        unsaved={unsaved}
        onChange={handleChange}
        onBlur={handleBlur}
        onPrev={prevSection}
        onNext={nextSection}
        onAsk={ask}
      />
    );
  } else if (view === 'review' && session) {
    content = (
      <ReviewView
        data={session.form_data}
        busy={busy}
        error={submitFailed ? { title: t('error.submitFailedTitle'), body: t('error.submitFailedBody') } : null}
        onSubmit={() => void submit()}
        onKeepEditing={() => {
          setSubmitFailed(false);
          setSectionIndex(0);
          setView('form');
        }}
      />
    );
  } else if (view === 'submitted' && session) {
    content = (
      <SubmittedView
        session={session}
        queue={queue}
        onViewAnswers={() => setView('review')}
        onLeave={leaveQueue}
      />
    );
  } else if (view === 'dl' && session) {
    content = (
      <DlView
        session={session}
        busy={busy}
        error={dlFailed ? t('error.dlConfInvalid') : null}
        onSave={(value) => void saveConfirmation(value)}
        onBack={() => setView('token')}
      />
    );
  } else {
    content = (
      <WelcomeView
        office={office}
        waits={waits}
        isOpen={isOpen}
        otherOfficeTicket={otherOfficeTicket}
        onDiscardOtherTicket={discardOtherTicket}
        onStart={() => setView('service')}
      />
    );
  }

  return (
    <>
      <SkipLink>{t('skip.content')}</SkipLink>
      <Grain />

      <PageShell
        header={
          <AppHeader
            productName={t('app.title')}
            subtitle={t('app.subtitle')}
            prototype
            badgeLabel={t('app.prototype')}
            actions={
              <LanguageToggle
                lang={lang}
                onChange={setLang}
                label={`${t('lang.english')} / ${t('lang.spanish')}`}
              />
            }
          />
        }
        rail={session && view !== 'token' && view !== 'expired' ? (
          <TicketRail session={session} queue={queue} onGoToTicket={() => setView('token')} />
        ) : undefined}
      >
        {content}
      </PageShell>

      {/* One polite region for the whole flow: ticket issued, application
          submitted, confirmation saved, and how many entries were flagged. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Not on the form screen — there it would sit on top of the sticky
          Next button, so the form carries the same control in its progress
          bar instead. */}
      {view !== 'form' ? <AssistantFab onClick={() => setAssistantOpen(true)} /> : null}

      <Assistant open={assistantOpen} onOpenChange={setAssistantOpen} question={question} />
    </>
  );
}

export { CustomerApp };
