'use client';

/* ==========================================================================
   Language provider

   Holds the active language and hands components a `t`. Client-only, because
   the choice lives in localStorage and the language switch has to reach
   document.documentElement.

   Server components do not use this. They take `lang` as a prop or a route
   segment and call `translate(lang, key)` from ./dictionary directly — the
   same dictionary, no context required.
   ========================================================================== */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import {
  LANG_STORAGE_KEY,
  isLang,
  translate,
  type Lang,
  type TranslationKey,
  type TranslationVars,
} from './dictionary';

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** t('key') → string in the active language. t('key', { n: 3 }) fills {n}. */
  t: (key: TranslationKey, vars?: TranslationVars) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/* An explicit choice wins; failing that the browser's language; failing that
   English. Read on the client only — on the server there is no navigator, and
   guessing there would ship the wrong markup to be hydrated. */
function detectLang(): Lang {
  if (typeof window === 'undefined') return 'en';

  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* Safari private browsing throws on localStorage. Fall through. */
  }

  const nav = (window.navigator.language || 'en').slice(0, 2).toLowerCase();
  return isLang(nav) ? nav : 'en';
}


/* ---- language store -------------------------------------------------------
   A tiny external store so useSyncExternalStore can read the persisted choice
   without an effect. getSnapshot must return a STABLE value or React re-renders
   forever, so the raw string is cached and only replaced when it changes. */

const langListeners = new Set<() => void>();
let cachedLang: Lang | null = null;

function subscribeToLangChanges(onChange: () => void) {
  langListeners.add(onChange);
  /* Another tab switching language should switch this one too. */
  window.addEventListener('storage', onStorage);
  return () => {
    langListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key && event.key !== LANG_STORAGE_KEY) return;
  cachedLang = null;
  langListeners.forEach((fn) => fn());
}

function notifyLangChanged() {
  cachedLang = null;
  langListeners.forEach((fn) => fn());
}

function getStoredLangSnapshot(): Lang {
  if (cachedLang !== null) return cachedLang;
  cachedLang = detectLang();
  return cachedLang;
}

export function I18nProvider({
  children,
  initialLang = 'en',
}: {
  children: ReactNode;
  /** Server-rendered language, so the first paint matches the markup. */
  initialLang?: Lang;
}) {
  /* The stored choice is client-only state: the server has no localStorage, so
     reading it during render would ship markup that does not match hydration.
     useSyncExternalStore is the React idiom for exactly this — the server
     snapshot is the server-rendered language, the client snapshot is what the
     customer actually chose, and React reconciles the difference itself rather
     than us chasing it with an effect.

     Subscribing to `storage` also keeps two tabs in step, which the previous
     effect could not do. */
  const stored = useSyncExternalStore(
    subscribeToLangChanges,
    getStoredLangSnapshot,
    () => initialLang,
  );

  const [override, setOverride] = useState<Lang | null>(null);
  const lang = override ?? stored;

  /* A screen reader picks its voice from this attribute. Keeping it in an
     effect is correct: it is a DOM side effect, not state. */
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;

    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
      notifyLangChanged();
    } catch {
      /* Storage unavailable — hold the choice in memory for this session. */
      setOverride(next);
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used inside <I18nProvider>.');
  }
  return ctx;
}
