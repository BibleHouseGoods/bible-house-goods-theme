import 'server-only';
import type { NextResponse } from 'next/server';
import { OWNER_ID, SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from './session-token';

export async function setSessionCookie(res: NextResponse): Promise<void> {
  res.cookies.set(SESSION_COOKIE, await signSession(OWNER_ID), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clientIp(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}
