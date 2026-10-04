import 'server-only';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { decrypt, encrypt, hashPassword, verifyPassword } from './crypto';
import { env } from './env';
import { OWNER_ID } from './session-token';
import { db } from './supabase';
import { generateSecret, otpauthUri, verifyTotp } from './totp';

export const MIN_PASSPHRASE = 12;
const LOCKOUT_WINDOW_MIN = 15;
const LOCKOUT_MAX_FAILURES = 8;

interface CredRow {
  owner_id: string;
  password_hash: string;
  totp_secret: string;
  totp_confirmed_at: string | null;
  totp_last_step: number;
  recovery_codes: string[];
}

async function getCreds(ownerId = OWNER_ID): Promise<CredRow | null> {
  const { data, error } = await db().from('auth_credentials').select('*').eq('owner_id', ownerId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as CredRow | null;
}

export async function isSetupComplete(): Promise<boolean> {
  return Boolean((await getCreds())?.totp_confirmed_at);
}

/** Setup is allowed only with the one-time SETUP_TOKEN and only until MFA is confirmed. */
export function checkSetupToken(token: string): boolean {
  const expected = env().SETUP_TOKEN;
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Step 1: save the passphrase and a fresh TOTP secret (unconfirmed). */
export async function beginSetup(passphrase: string, account: string): Promise<{ otpauth: string; secret: string }> {
  if (await isSetupComplete()) throw new Error('Setup is already complete');
  const secret = generateSecret();
  const { error } = await db().from('auth_credentials').upsert({
    owner_id: OWNER_ID,
    password_hash: hashPassword(passphrase),
    totp_secret: encrypt(secret),
    totp_confirmed_at: null,
    totp_last_step: -1,
    recovery_codes: [],
  });
  if (error) throw new Error(error.message);
  return { otpauth: otpauthUri(secret, account), secret };
}

const sha = (s: string) => createHash('sha256').update(s.toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

function newRecoveryCodes(): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  return Array.from({ length: 10 }, () => {
    const raw = Array.from({ length: 10 }, () => alphabet[randomInt(alphabet.length)]).join('');
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

/** Step 2: confirm the authenticator works; returns one-time recovery codes. */
export async function confirmSetup(code: string): Promise<string[]> {
  const creds = await getCreds();
  if (!creds) throw new Error('Start setup first');
  if (creds.totp_confirmed_at) throw new Error('Setup is already complete');
  const step = verifyTotp(decrypt(creds.totp_secret), code);
  if (step === null) throw new Error('That code didn’t match. Check the time on your phone and try the newest code.');
  const codes = newRecoveryCodes();
  const { error } = await db()
    .from('auth_credentials')
    .update({ totp_confirmed_at: new Date().toISOString(), totp_last_step: step, recovery_codes: codes.map(sha) })
    .eq('owner_id', OWNER_ID)
    .is('totp_confirmed_at', null);
  if (error) throw new Error(error.message);
  return codes;
}

export async function recentFailures(): Promise<number> {
  const since = new Date(Date.now() - LOCKOUT_WINDOW_MIN * 60_000).toISOString();
  const { count } = await db()
    .from('audit_events')
    .select('id', { count: 'exact', head: true })
    .eq('action', 'auth.login_failed')
    .gte('at', since);
  return count ?? 0;
}

export async function isLockedOut(): Promise<boolean> {
  return (await recentFailures()) >= LOCKOUT_MAX_FAILURES;
}

export type LoginResult = { ok: true; usedRecoveryCode: boolean; recoveryLeft: number } | { ok: false };

/** Passphrase AND (TOTP code OR unused recovery code). */
export async function verifyLogin(passphrase: string, code: string): Promise<LoginResult> {
  const creds = await getCreds();
  // Always run scrypt so timing doesn't reveal whether setup exists.
  const pwOk = verifyPassword(passphrase, creds?.password_hash ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA');
  if (!creds?.totp_confirmed_at || !pwOk) return { ok: false };

  const step = verifyTotp(decrypt(creds.totp_secret), code, Date.now(), creds.totp_last_step);
  if (step !== null) {
    // Conditional update makes concurrent replays of the same code fail.
    const { data } = await db()
      .from('auth_credentials')
      .update({ totp_last_step: step })
      .eq('owner_id', creds.owner_id)
      .lt('totp_last_step', step)
      .select('owner_id');
    return data?.length ? { ok: true, usedRecoveryCode: false, recoveryLeft: creds.recovery_codes.length } : { ok: false };
  }

  const hash = sha(code);
  if (code.replace(/[^A-Za-z0-9]/g, '').length === 10 && creds.recovery_codes.includes(hash)) {
    const left = creds.recovery_codes.filter((h) => h !== hash);
    await db().from('auth_credentials').update({ recovery_codes: left }).eq('owner_id', creds.owner_id);
    return { ok: true, usedRecoveryCode: true, recoveryLeft: left.length };
  }
  return { ok: false };
}

export async function securityStatus(): Promise<{ mfa: boolean; recoveryLeft: number; since: string | null }> {
  const c = await getCreds();
  return { mfa: Boolean(c?.totp_confirmed_at), recoveryLeft: c?.recovery_codes.length ?? 0, since: c?.totp_confirmed_at ?? null };
}

/** Change passphrase (requires current passphrase + a fresh TOTP code). */
export async function changePassphrase(current: string, code: string, next: string): Promise<boolean> {
  const r = await verifyLogin(current, code);
  if (!r.ok) return false;
  const { error } = await db().from('auth_credentials').update({ password_hash: hashPassword(next) }).eq('owner_id', OWNER_ID);
  if (error) throw new Error(error.message);
  return true;
}

/** Replace recovery codes (requires passphrase + TOTP). */
export async function regenerateRecoveryCodes(current: string, code: string): Promise<string[] | null> {
  const r = await verifyLogin(current, code);
  if (!r.ok || r.usedRecoveryCode) return null;
  const codes = newRecoveryCodes();
  const { error } = await db().from('auth_credentials').update({ recovery_codes: codes.map(sha) }).eq('owner_id', OWNER_ID);
  if (error) throw new Error(error.message);
  return codes;
}

