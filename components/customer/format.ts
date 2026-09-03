/* Display formatting shared by the customer screens. Both helpers take the
   active language, because both are read by someone who chose Spanish. */

import type { Lang } from '@/lib/i18n';

const LOCALES: Record<Lang, string> = { en: 'en-US', es: 'es-US' };

/** '9:41 am' — the clock time of an instant, never the date. */
export function formatTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(LOCALES[lang], { hour: 'numeric', minute: '2-digit' });
}

/** '18,500.00'. The currency mark is added by the caller — the form asks for
    US dollars whatever language the question is read in. */
export function formatMoney(value: string | number, lang: Lang): string {
  const n = Number(String(value).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString(LOCALES[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
