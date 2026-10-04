import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handle } from '@/lib/api';
import { audit } from '@/lib/audit';
import { UPLOAD_CHUNK_BYTES } from '@/lib/constants';
import { encrypt } from '@/lib/crypto';
import { createRecordingFolder, startResumableUpload } from '@/lib/google/drive';
import { apiOwner } from '@/lib/session';
import { db } from '@/lib/supabase';
import { AREAS } from '@/lib/taxonomy';

const Body = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().max(100).default('application/octet-stream'),
  size: z.number().int().positive().max(2 * 1024 * 1024 * 1024),
  source: z.enum(['recorder', 'import']),
  isPrivate: z.boolean().default(false),
  title: z.string().max(200).optional(),
  area: z.enum(AREAS).optional(),
  recordedAt: z.string().datetime({ offset: true }).optional(),
  durationSeconds: z.number().positive().optional(),
});

export const POST = handle(async (req: Request) => {
  const ownerId = await apiOwner();
  const b = Body.parse(await req.json());
  const recordedAt = b.recordedAt ? new Date(b.recordedAt) : new Date();
  const title = b.title?.trim() || null;

  const folder = await createRecordingFolder(ownerId, recordedAt, title ?? b.filename.replace(/\.[^.]+$/, ''));
  const session = await startResumableUpload(ownerId, {
    name: b.filename,
    mimeType: b.mimeType || 'application/octet-stream',
    size: b.size,
    parent: folder.id,
  });

  const { data, error } = await db()
    .from('recordings')
    .insert({
      owner_id: ownerId,
      title,
      recorded_at: recordedAt.toISOString(),
      source: b.source,
      original_filename: b.filename,
      mime_type: b.mimeType || 'application/octet-stream',
      size_bytes: b.size,
      duration_seconds: b.durationSeconds ?? null,
      is_private: b.isPrivate,
      area: b.area ?? null,
      status: 'uploading',
      upload_session: encrypt(session),
      drive_folder_id: folder.id,
      drive_folder_url: folder.webViewLink ?? null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  await audit(ownerId, 'recording.created', { type: 'recording', id: data.id }, { private: b.isPrivate, size: b.size });
  return NextResponse.json({ id: data.id, chunkSize: UPLOAD_CHUNK_BYTES });
});
