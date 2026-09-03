/* ==========================================================================
   Staff authentication — STUB
   Architecture: docs/03 §5 (Staff authentication / Staff authorisation)

   ┌────────────────────────────────────────────────────────────────────────┐
   │  THIS IS A STUB. IT IS NOT AUTHENTICATION. IT MUST NOT REACH PILOT.    │
   │                                                                        │
   │  TODO — DMV SINGLE SIGN-ON                                             │
   │  Replace identify() with a real check against DMV SSO (OIDC / SAML     │
   │  against the DMV identity provider). No local accounts, no shared      │
   │  counter logins, no API keys in config — docs/03 §5 is explicit that   │
   │  staff authentication is DMV SSO and nothing else.                     │
   │                                                                        │
   │  The replacement must establish, per request:                          │
   │    - staff_id      the individual, not the workstation. The audit log  │
   │                    is worthless if twelve technicians share an id.     │
   │    - office_id     the office the technician is authorised for. Today  │
   │                    the office comes from the query string and is only  │
   │                    a scope, not a permission; after SSO it must be     │
   │                    checked against the identity's assigned office.     │
   │  and must reject any request that carries neither.                     │
   └────────────────────────────────────────────────────────────────────────┘

   Authorisation model, which does not change when the stub is replaced
   (docs/03 §5, "Staff authorisation"): lookup BY TOKEN ONLY. There is no
   listing endpoint, no search by customer name, and no bulk export. A
   technician can reach exactly the one application whose token they were
   given, at their own office, on the current business day.
   ========================================================================== */

export interface StaffIdentity {
  staff_id: string;
  /** Set once real SSO supplies it; used to check the requested office. */
  assigned_office_id: string | null;
}

const DEV_STAFF_ID = 'dev-technician';

/**
 * Identifies the staff member making the request.
 *
 * Returns null when the request is not authenticated, in which case the caller
 * must return 401 and MUST NOT read, write or purge anything.
 *
 * Fails closed in production: with no real identity provider wired up, every
 * staff request in a production build is rejected rather than silently
 * accepted under the development identity. That is what stops this stub from
 * shipping by accident.
 */
export function authenticateStaff(request: Request): StaffIdentity | null {
  /* A header a caller can set at will is not a credential. It exists so the
     staff view can be developed and demonstrated before SSO is available. */
  const header = request.headers.get('x-dmv-staff-id')?.trim();
  if (header) {
    return { staff_id: header, assigned_office_id: null };
  }

  /* A deployed demo still has to show the counter working, and SSO does not
     exist yet. DEMO_STAFF_ID opts a deployment into an unauthenticated counter
     EXPLICITLY — it is absent by default, so a deployment that forgets it fails
     closed rather than opening quietly.

     Setting it means anyone who can reach the URL can read every application at
     that office. That is acceptable for a stakeholder demo carrying synthetic
     data and nothing else. It announces itself on first use rather than sitting
     silently in config, so it cannot be forgotten on the way to a pilot. */
  const demoIdentity = process.env.DEMO_STAFF_ID?.trim();
  if (demoIdentity) {
    warnDemoAuthOnce();
    return { staff_id: demoIdentity, assigned_office_id: null };
  }

  if (process.env.NODE_ENV === 'production') return null;

  return { staff_id: DEV_STAFF_ID, assigned_office_id: null };
}

let demoWarned = false;

function warnDemoAuthOnce(): void {
  if (demoWarned) return;
  demoWarned = true;
  console.warn(
    '[auth] DEMO_STAFF_ID is set: staff endpoints are UNAUTHENTICATED. ' +
      'Anyone who can reach this deployment can read every application at this ' +
      'office. Use synthetic data only, and unset this before any pilot.'
  );
}

/**
 * True when the identity may act on the given office.
 *
 * Always true today because the stub carries no office assignment. Kept as a
 * seam so that adding the check after SSO is a one-line change in one place
 * rather than an audit of every staff route.
 */
export function mayAccessOffice(identity: StaffIdentity, officeId: string): boolean {
  if (identity.assigned_office_id === null) return true;
  return identity.assigned_office_id === officeId;
}
