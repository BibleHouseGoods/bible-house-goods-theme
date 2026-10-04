import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { disconnect } from '@/lib/google/auth';
import { apiOwner } from '@/lib/session';

export const POST = handle(async () => {
  const ownerId = await apiOwner();
  await disconnect(ownerId);
  await audit(ownerId, 'google.disconnected');
  return NextResponse.json({ ok: true });
});
