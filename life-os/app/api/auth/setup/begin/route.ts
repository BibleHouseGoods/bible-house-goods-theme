import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { beginSetup, checkSetupToken, isSetupComplete, MIN_PASSPHRASE } from '@/lib/auth';
import { HttpError } from '@/lib/session';
import { clientIp } from '@/lib/session-cookie';
import { OWNER_ID } from '@/lib/session-token';

const Body = z.object({
  token: z.string().min(1).max(200),
  passphrase: z.string().min(MIN_PASSPHRASE).max(500),
  account: z.string().max(100).default('Owner'),
});

export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  if (!checkSetupToken(b.token)) {
    await audit(OWNER_ID, 'auth.setup_bad_token', undefined, {}, clientIp(req));
    throw new HttpError(403, 'This setup link is invalid.');
  }
  if (await isSetupComplete()) throw new HttpError(409, 'Setup is already complete. Sign in instead.');
  const { otpauth, secret } = await beginSetup(b.passphrase, b.account);
  const qr = await QRCode.toString(otpauth, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1f1c17', light: '#00000000' } });
  await audit(OWNER_ID, 'auth.setup_started', undefined, {}, clientIp(req));
  return NextResponse.json({ qr: `data:image/svg+xml;base64,${Buffer.from(qr).toString('base64')}`, secret, otpauth });
});
