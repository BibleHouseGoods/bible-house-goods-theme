import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { verifyPassword } from '@/lib/crypto';
import { env } from '@/lib/env';
import { OWNER_ID, SESSION_COOKIE, SESSION_TTL_SECONDS, signSession } from '@/lib/session-token';

const Body = z.object({ password: z.string().min(1).max(500) });

export const POST = handle(async (req: Request) => {
  const { password } = Body.parse(await req.json());
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!verifyPassword(password, env().APP_PASSWORD_HASH)) {
    await audit(OWNER_ID, 'auth.login_failed', undefined, {}, ip);
    await new Promise((r) => setTimeout(r, 1500)); // slow down guessing
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  await audit(OWNER_ID, 'auth.login', undefined, {}, ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(OWNER_ID), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
});
