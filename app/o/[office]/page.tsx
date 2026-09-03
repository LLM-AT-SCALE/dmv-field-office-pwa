/* ==========================================================================
   /o/{office} — the customer flow.

   The office is resolved on the server so the first paint carries the right
   name and address, and so an unknown identifier is flagged rather than
   hidden. resolveOffice() always returns an office: a mistyped short URL
   shows the default one with a notice, never a broken page.

   The language provider wraps the flow rather than the root layout, because
   the counter application below /counter has its own chrome and does not
   want it.
   ========================================================================== */

import { I18nProvider } from '@/lib/i18n';
import { resolveOffice } from '@/lib/office';
import { CustomerApp } from '@/components/customer/customer-app';

export default async function OfficePage({ params }: PageProps<'/o/[office]'>) {
  const { office } = await params;
  const resolved = resolveOffice(office);

  /* Keyed by office id so that moving between two offices REMOUNTS the flow
     rather than re-rendering it in place. Both URLs are the same route, so
     without this React keeps the component instance alive and every piece of
     per-office state — the restored ticket, the queue position, which section
     you were on — survives a change of building. Keying resets all of it in
     one move, and it is what makes the office check in the restore effect run
     on a client-side navigation and not only on a fresh page load. */
  return (
    <I18nProvider>
      <CustomerApp key={resolved.id} office={resolved} />
    </I18nProvider>
  );
}
