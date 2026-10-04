import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { decrypt } from '@/lib/crypto';
import { putChunk, querySession, type ChunkResult } from '@/lib/google/drive';
import { apiOwner, HttpError } from '@/lib/session';
import { db } from '@/lib/supabase';
import type { Recording } from '@/lib/types';

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function load(ownerId: string, id: string): Promise<Recording> {
  const { data } = await db().from('recordings').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle();
  if (!data) throw new HttpError(404, 'Not found');
  return data as Recording;
}

async function finish(rec: Recording, result: ChunkResult) {
  if (!result.done) {
    await db().from('recordings').update({ upload_offset: result.nextOffset }).eq('id', rec.id).eq('owner_id', rec.owner_id);
    return NextResponse.json({ done: false, nextOffset: result.nextOffset });
  }
  const { error } = await db()
    .from('recordings')
    .update({
      drive_audio_file_id: result.file.id,
      drive_audio_url: result.file.webViewLink ?? null,
      upload_session: null,
      upload_offset: rec.size_bytes,
      status: 'uploaded',
    })
    .eq('id', rec.id)
    .eq('owner_id', rec.owner_id);
  if (error) throw new Error(error.message);
  await audit(rec.owner_id, 'recording.uploaded', { type: 'recording', id: rec.id }, { drive_file: result.file.id });
  return NextResponse.json({ done: true });
}

/** Where to resume from. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const ownerId = await apiOwner();
  const rec = await load(ownerId, (await params).id);
  if (rec.drive_audio_file_id) return NextResponse.json({ done: true });
  if (!rec.upload_session) throw new HttpError(409, 'No upload in progress');
  return finish(rec, await querySession(decrypt(rec.upload_session), rec.size_bytes));
});

/** Receive one chunk (raw body) and forward it to the Drive resumable session. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const ownerId = await apiOwner();
  const rec = await load(ownerId, (await params).id);
  if (rec.drive_audio_file_id) return NextResponse.json({ done: true });
  if (!rec.upload_session) throw new HttpError(409, 'No upload in progress');
  const offset = Number(new URL(req.url).searchParams.get('offset'));
  if (!Number.isInteger(offset) || offset < 0 || offset >= rec.size_bytes) throw new HttpError(400, 'Bad offset');
  const chunk = await req.arrayBuffer();
  if (chunk.byteLength === 0 || offset + chunk.byteLength > rec.size_bytes) throw new HttpError(400, 'Bad chunk');
  return finish(rec, await putChunk(decrypt(rec.upload_session), chunk, offset, rec.size_bytes));
});
