import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { approveItem } from '@/lib/approve';
import { applyEdit, ItemEdit } from '@/lib/items';
import { apiOwner, HttpError } from '@/lib/session';
import { db } from '@/lib/supabase';
import type { Item } from '@/lib/types';

export const maxDuration = 60;

/** Save any final edits, then run the approved external actions. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ownerId = await apiOwner();
  const id = (await params).id;
  const text = await req.text();
  if (text) await applyEdit(ownerId, id, ItemEdit.parse(JSON.parse(text)));
  const { data } = await db().from('items').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!data) throw new HttpError(404, 'Not found');
  const item = data as Item;
  if (item.status === 'rejected') throw new HttpError(409, 'Item was rejected');
  const result = await approveItem(item);
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
});
