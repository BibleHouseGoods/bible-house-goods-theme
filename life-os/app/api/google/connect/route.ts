import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { authUrl } from '@/lib/google/auth';
import { apiOwner } from '@/lib/session';

export const GET = handle(async () => {
  await apiOwner();
  const state = randomBytes(24).toString('base64url');
  const res = NextResponse.redirect(authUrl(state));
  res.cookies.set('lifeos_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/google', maxAge: 600 });
  return res;
});
