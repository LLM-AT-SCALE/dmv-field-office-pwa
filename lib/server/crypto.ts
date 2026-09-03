/* ==========================================================================
   Application-layer encryption for stored application data

   docs/03 §3.2: `form_data` is encrypted at rest under DMV KMS keys.

   With the in-memory store there was no "at rest" to encrypt — a process
   restart was a complete purge. Redis changes that: the customer's name,
   address, driver licence number and lienholder details now sit in another
   process, which may write them to an AOF file or an RDB snapshot on somebody
   else's disk. So they are encrypted BEFORE they leave this process, and the
   key never goes to Redis.

   Envelope shape, AES-256-GCM:  v1.<iv>.<authTag>.<ciphertext>   (all base64url)

   THE KEY
     Read from FOPWA_DATA_KEY as base64. In production this is not an
     environment variable typed by a person — it is a data key unwrapped from
     DMV KMS at boot. The interface is the same either way, which is the point:
     swapping in KMS changes how `key()` obtains 32 bytes and nothing else.

   FAILS CLOSED
     If Redis is configured and no key is present, the store refuses to start.
     Holding a customer's licence number in plaintext in someone else's process
     is not a degraded mode worth having — it is the thing the security review
     exists to prevent.
   ========================================================================== */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96-bit nonce, the size GCM is specified for
const VERSION = 'v1';

let cached: Buffer | null = null;

/** 32 bytes, or a thrown error. Never a silently generated key: a key that
    changes on restart would make yesterday's ciphertext unreadable and look
    like data loss rather than a misconfiguration. */
export function dataKey(): Buffer {
  if (cached) return cached;

  const raw = process.env.FOPWA_DATA_KEY;
  if (!raw) {
    throw new Error(
      'FOPWA_DATA_KEY is not set. Application data may not be written to Redis ' +
        'unencrypted. Generate one with: openssl rand -base64 32',
    );
  }

  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `FOPWA_DATA_KEY must decode to 32 bytes for AES-256; got ${key.length}. ` +
        'Generate one with: openssl rand -base64 32',
    );
  }

  cached = key;
  return key;
}

/** True when a usable key is configured, without throwing. */
export function hasDataKey(): boolean {
  try {
    dataKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, dataKey(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    body.toString('base64url'),
  ].join('.');
}

export function decryptJson<T>(envelope: string): T {
  const [version, iv, tag, body] = envelope.split('.');
  if (version !== VERSION || !iv || !tag || !body) {
    throw new Error('Stored application data is not in the expected envelope format');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    dataKey(),
    Buffer.from(iv, 'base64url'),
  );
  /* GCM verifies the tag on final(): tampered or truncated ciphertext throws
     rather than returning plausible-looking data. */
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(body, 'base64url')),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(plain) as T;
}
