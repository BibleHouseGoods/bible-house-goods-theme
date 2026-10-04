import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { regenerateRecoveryCodes } from '@/lib/auth';
import { apiOwner, HttpError } from '@/lib/session';
import { clientIp } from '@/lib/session-cookie';

const Body = z.object({ current: z.string().min(1).max(500), code: z.string().min(6).max(6) });

export const POST = handle(async (req: Request) => {
  const ownerId = await apiOwner();
  const b = Body.parse(await req.json());
  const codes = await regenerateRecoveryCodes(b.current, b.code);
  if (!codes) {
    await audit(ownerId, 'auth.login_failed', undefined, { context: 'recovery_codes' }, clientIp(req));
    throw new HttpError(401, 'Passphrase or authenticator code is incorrect.');
  }
  await audit(ownerId, 'auth.recovery_codes_regenerated', undefined, {}, clientIp(req));
  return NextResponse.json({ recoveryCodes: codes });
});
