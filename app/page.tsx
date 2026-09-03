/* ==========================================================================
   The root URL is an entry point, not a screen.

   The QR poster, the short URL, the appointment email, the signage and the
   member of staff pointing at the poster all carry an OFFICE IDENTIFIER, in
   a path or in a query string. Both land here and both leave with the office
   in the path, so every screen below /o/{office} can rely on it.

   An unknown identifier is NOT corrected here: /o/{whatever} renders the
   default office with a notice saying so, which is better than silently
   sending someone to the wrong lobby's wait times.
   ========================================================================== */

import { redirect } from 'next/navigation';

import { DEFAULT_OFFICE } from '@/lib/office';

export default async function Home({ searchParams }: PageProps<'/'>) {
  const { office } = await searchParams;
  const requested = (Array.isArray(office) ? office[0] : office)?.trim();
  redirect(`/o/${encodeURIComponent(requested || DEFAULT_OFFICE)}`);
}
