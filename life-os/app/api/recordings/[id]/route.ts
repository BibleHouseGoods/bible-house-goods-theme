import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { trashFile } from '@/lib/google/drive';
import { apiOwner, HttpError } from '@/lib/session';
import { db } from '@/lib/supabase';
import { AREAS } from '@/lib/taxonomy';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const ownerId = await apiOwner();
  const { data } = await db()
    .from('recordings')
    .select('id, status, error, is_private, drive_audio_file_id')
    .eq('id', (await params).id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (!data) throw new HttpError(404, 'Not found');
  return NextResponse.json(data);
});

const Patch = z.object({
  title: z.string().max(200).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  area: z.enum(AREAS).nullable().optional(),
  isPrivate: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const ownerId = await apiOwner();
  const id = (await params).id;
  const b = Patch.parse(await req.json());
  const { data: cur } = await db().from('recordings').select('is_private, verbatim_transcript, status').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!cur) throw new HttpError(404, 'Not found');

  const patch: Record<string, unknown> = {};
  if (b.title !== undefined) patch.title = b.title;
  if (b.notes !== undefined) patch.notes = b.notes;
  if (b.area !== undefined) patch.area = b.area;
  if (b.isPrivate !== undefined && b.isPrivate !== cur.is_private) {
    // Once text has been sent to AI it cannot be un-sent; marking private then
    // only stops further processing.
    patch.is_private = b.isPrivate;
    if (b.isPrivate) patch.status = 'private';
    else if (cur.status === 'private') patch.status = 'uploaded';
  }
  const { error } = await db().from('recordings').update(patch).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  if (b.isPrivate !== undefined) await audit(ownerId, b.isPrivate ? 'recording.marked_private' : 'recording.ai_allowed', { type: 'recording', id });
  return NextResponse.json({ ok: true });
});

/** Deletes metadata and moves the Drive folder (audio + transcripts) to Drive trash. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const ownerId = await apiOwner();
  const id = (await params).id;
  const { data } = await db().from('recordings').select('drive_folder_id').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!data) throw new HttpError(404, 'Not found');
  if (data.drive_folder_id) await trashFile(ownerId, data.drive_folder_id);
  const { error } = await db().from('recordings').delete().eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  await audit(ownerId, 'recording.deleted', { type: 'recording', id });
  return NextResponse.json({ ok: true });
});
