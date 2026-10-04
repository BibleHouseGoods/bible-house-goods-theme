import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { audit } from '@/lib/audit';
import { env } from '@/lib/env';
import { exchangeCode } from '@/lib/google/auth';
import { rootFolderId } from '@/lib/google/drive';
import { apiOwner } from '@/lib/session';

export async function GET(req: Request) {
  const back = (msg: string) => NextResponse.redirect(`${env().APP_URL}/settings?google=${encodeURIComponent(msg)}`);
  try {
    const ownerId = await apiOwner();
    const url = new URL(req.url);
    const state = url.searchParams.get('state') ?? '';
    const expected = (await cookies()).get('lifeos_oauth_state')?.value ?? '';
    if (!expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
      return back('State mismatch, try again');
    }
    if (url.searchParams.get('error')) return back(url.searchParams.get('error')!);
    const code = url.searchParams.get('code');
    if (!code) return back('No code returned');
    const email = await exchangeCode(ownerId, code);
    await rootFolderId(ownerId); // create "Life OS" folder up front
    await audit(ownerId, 'google.connected', undefined, { email });
    const res = back('connected');
    res.cookies.delete('lifeos_oauth_state');
    return res;
  } catch (err) {
    return back(err instanceof Error ? err.message : 'Connection failed');
  }
}
