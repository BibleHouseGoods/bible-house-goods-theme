// Edge/Node-safe JWT helpers shared by proxy.ts and server code.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'lifeos_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const OWNER_ID = '00000000-0000-0000-0000-000000000001';

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return new TextEncoder().encode(s);
}

export async function signSession(ownerId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(ownerId)
    .setIssuedAt()
    .setAudience('life-os')
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: 'life-os', algorithms: ['HS256'] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
