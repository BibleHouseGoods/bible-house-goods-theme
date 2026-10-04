import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { isLockedOut, isSetupComplete, verifyLogin } from '@/lib/auth';
import { clientIp, setSessionCookie } from '@/lib/session-cookie';
import { OWNER_ID } from '@/lib/session-token';

const Body = z.object({ password: z.string().min(1).max(500), code: z.string().min(6).max(20) });

export const POST = handle(async (req: Request) => {
  const { password, code } = Body.parse(await req.json());
  const ip = clientIp(req);
  if (!(await isSetupComplete())) {
    return NextResponse.json({ error: 'Life OS isn’t set up yet. Open your setup link first.' }, { status: 409 });
  }
  if (await isLockedOut()) {
    await audit(OWNER_ID, 'auth.login_locked', undefined, {}, ip);
    return NextResponse.json({ error: 'Too many attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  const result = await verifyLogin(password, code);
  if (!result.ok) {
    await audit(OWNER_ID, 'auth.login_failed', undefined, {}, ip);
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ error: 'Passphrase or code is incorrect.' }, { status: 401 });
  }
  await audit(OWNER_ID, result.usedRecoveryCode ? 'auth.login_recovery_code' : 'auth.login', undefined, { recovery_left: result.recoveryLeft }, ip);
  const res = NextResponse.json({ ok: true, usedRecoveryCode: result.usedRecoveryCode, recoveryLeft: result.recoveryLeft });
  await setSessionCookie(res);
  return res;
});
