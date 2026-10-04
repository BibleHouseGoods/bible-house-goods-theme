import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { changePassphrase, MIN_PASSPHRASE } from '@/lib/auth';
import { apiOwner, HttpError } from '@/lib/session';
import { clientIp } from '@/lib/session-cookie';

const Body = z.object({ current: z.string().min(1).max(500), code: z.string().min(6).max(10), next: z.string().min(MIN_PASSPHRASE).max(500) });

export const POST = handle(async (req: Request) => {
  const ownerId = await apiOwner();
  const b = Body.parse(await req.json());
  if (!(await changePassphrase(b.current, b.code, b.next))) {
    await audit(ownerId, 'auth.login_failed', undefined, { context: 'change_passphrase' }, clientIp(req));
    throw new HttpError(401, 'Current passphrase or code is incorrect.');
  }
  await audit(ownerId, 'auth.passphrase_changed', undefined, {}, clientIp(req));
  return NextResponse.json({ ok: true });
});
