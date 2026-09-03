import { NextResponse } from 'next/server';

/* ==========================================================================
   Health check — for the load balancer, not for people.

   App Runner and ECS both need a cheap endpoint that proves the process can
   serve a request. It deliberately reports NOTHING about tickets, customers,
   sessions or store contents: a health endpoint is reachable without
   authentication, so anything it returns is public.
   ========================================================================== */

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { status: 'ok', service: 'field-office-pwa' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
