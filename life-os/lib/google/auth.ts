import 'server-only';
import { decrypt, encrypt } from '../crypto';
import { env } from '../env';
import { db } from '../supabase';

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  // Only files this app creates — Life OS cannot see the rest of your Drive.
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/calendar.events',
  // Create drafts only; Life OS never sends mail.
  'https://www.googleapis.com/auth/gmail.compose',
];

export interface GoogleMeta {
  email?: string;
  rootFolderId?: string;
  connectedAt?: string;
}

export function redirectUri(): string {
  return `${env().APP_URL}/api/google/callback`;
}

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: env().GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  if (env().GOOGLE_ALLOWED_EMAIL) p.set('login_hint', env().GOOGLE_ALLOWED_EMAIL!);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env().GOOGLE_CLIENT_ID,
      client_secret: env().GOOGLE_CLIENT_SECRET,
      ...body,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${json.error_description ?? json.error ?? res.status}`);
  return json as { access_token: string; expires_in: number; refresh_token?: string; id_token?: string };
}

export async function exchangeCode(ownerId: string, code: string): Promise<string | undefined> {
  const tok = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() });
  if (!tok.refresh_token) throw new Error('Google did not return a refresh token. Remove Life OS access in your Google account and connect again.');
  // id_token comes straight from Google's token endpoint over TLS; decoding the
  // payload without signature verification is acceptable here.
  let email: string | undefined;
  if (tok.id_token) {
    const payload = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString('utf8'));
    email = payload.email;
  }
  const allowed = env().GOOGLE_ALLOWED_EMAIL;
  if (allowed && email?.toLowerCase() !== allowed.toLowerCase()) {
    throw new Error(`Signed in as ${email}, but only ${allowed} is allowed.`);
  }
  const existing = await getIntegration(ownerId);
  const meta: GoogleMeta = { ...(existing?.meta ?? {}), email, connectedAt: new Date().toISOString() };
  const { error } = await db().from('integrations').upsert({
    owner_id: ownerId,
    provider: 'google',
    secret: encrypt(JSON.stringify({ refresh_token: tok.refresh_token })),
    meta,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  tokenCache.delete(ownerId);
  return email;
}

export async function getIntegration(ownerId: string): Promise<{ meta: GoogleMeta; refreshToken: string } | null> {
  const { data, error } = await db()
    .from('integrations')
    .select('secret, meta')
    .eq('owner_id', ownerId)
    .eq('provider', 'google')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { meta: data.meta as GoogleMeta, refreshToken: JSON.parse(decrypt(data.secret)).refresh_token };
}

export async function updateMeta(ownerId: string, patch: Partial<GoogleMeta>): Promise<void> {
  const cur = await getIntegration(ownerId);
  if (!cur) throw new Error('Google is not connected');
  const { error } = await db()
    .from('integrations')
    .update({ meta: { ...cur.meta, ...patch } })
    .eq('owner_id', ownerId)
    .eq('provider', 'google');
  if (error) throw new Error(error.message);
}

export async function disconnect(ownerId: string): Promise<void> {
  const cur = await getIntegration(ownerId);
  if (cur) {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(cur.refreshToken)}`, { method: 'POST' }).catch(() => {});
  }
  await db().from('integrations').delete().eq('owner_id', ownerId).eq('provider', 'google');
  tokenCache.delete(ownerId);
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function accessToken(ownerId: string): Promise<string> {
  const cached = tokenCache.get(ownerId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const integ = await getIntegration(ownerId);
  if (!integ) throw new Error('Google is not connected. Open Settings and connect Google.');
  const tok = await tokenRequest({ refresh_token: integ.refreshToken, grant_type: 'refresh_token' });
  tokenCache.set(ownerId, { token: tok.access_token, expiresAt: Date.now() + tok.expires_in * 1000 });
  return tok.access_token;
}

export async function googleFetch(ownerId: string, url: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken(ownerId);
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function googleJson<T>(ownerId: string, url: string, init: RequestInit = {}): Promise<T> {
  const res = await googleFetch(ownerId, url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Google API ${res.status}: ${text.slice(0, 500)}`);
  return (text ? JSON.parse(text) : {}) as T;
}
