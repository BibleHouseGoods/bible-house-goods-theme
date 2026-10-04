import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { applyEdit, ItemEdit } from '@/lib/items';
import { apiOwner } from '@/lib/session';

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ownerId = await apiOwner();
  await applyEdit(ownerId, (await params).id, ItemEdit.parse(await req.json()));
  return NextResponse.json({ ok: true });
});
