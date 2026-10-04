import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from './session-token';

/** For pages: redirect to /login when there is no valid session. */
export async function requireOwner(): Promise<string> {
  const ownerId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!ownerId) redirect('/login');
  return ownerId;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** For route handlers: throw 401 when there is no valid session. */
export async function apiOwner(): Promise<string> {
  const ownerId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!ownerId) throw new HttpError(401, 'Unauthorized');
  return ownerId;
}
