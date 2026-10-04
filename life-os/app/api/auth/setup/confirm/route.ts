import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { checkSetupToken, confirmSetup } from '@/lib/auth';
import { HttpError } from '@/lib/session';
import { clientIp, setSessionCookie } from '@/lib/session-cookie';
import { OWNER_ID } from '@/lib/session-token';

const Body = z.object({ token: z.string().min(1).max(200), code: z.string().min(6).max(10) });

export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  if (!checkSetupToken(b.token)) throw new HttpError(403, 'This setup link is invalid.');
  let codes: string[];
  try {
    codes = await confirmSetup(b.code);
  } catch (err) {
    throw new HttpError(400, err instanceof Error ? err.message : 'Could not confirm');
  }
  await audit(OWNER_ID, 'auth.mfa_enabled', undefined, {}, clientIp(req));
  const res = NextResponse.json({ recoveryCodes: codes });
  await setSessionCookie(res);
  return res;
});
