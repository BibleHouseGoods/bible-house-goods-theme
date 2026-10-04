import { handle } from '@/lib/api';
import { streamFile } from '@/lib/google/drive';
import { apiOwner, HttpError } from '@/lib/session';
import { db } from '@/lib/supabase';

/** Streams the original audio from Drive with Range support for scrubbing. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ownerId = await apiOwner();
  const { data } = await db()
    .from('recordings')
    .select('drive_audio_file_id, mime_type')
    .eq('id', (await params).id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (!data?.drive_audio_file_id) throw new HttpError(404, 'Audio not available');
  const upstream = await streamFile(ownerId, data.drive_audio_file_id, req.headers.get('range'));
  if (!upstream.ok && upstream.status !== 206) throw new HttpError(502, 'Could not load audio from Drive');
  const headers = new Headers({ 'content-type': data.mime_type, 'accept-ranges': 'bytes', 'cache-control': 'private, no-store' });
  for (const h of ['content-length', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
});
