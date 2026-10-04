import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { apiOwner } from '@/lib/session';
import { db } from '@/lib/supabase';

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ownerId = await apiOwner();
  const id = (await params).id;
  const { error } = await db().from('items').update({ status: 'rejected' }).eq('id', id).eq('owner_id', ownerId).eq('status', 'pending');
  if (error) throw new Error(error.message);
  await audit(ownerId, 'item.rejected', { type: 'item', id });
  return NextResponse.json({ ok: true });
});
