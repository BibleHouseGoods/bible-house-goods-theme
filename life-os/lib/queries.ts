import 'server-only';
import { db } from './supabase';
import type { Area, ContentType } from './taxonomy';
import type { Item, ItemAction, Recording } from './types';

const LIST_COLUMNS =
  'id, owner_id, created_at, title, recorded_at, source, original_filename, mime_type, size_bytes, duration_seconds, is_private, area, notes, status, error, processing_lock, drive_audio_file_id, classified_at';

export type RecordingSummary = Pick<
  Recording,
  'id' | 'created_at' | 'title' | 'recorded_at' | 'original_filename' | 'size_bytes' | 'duration_seconds' | 'is_private' | 'area' | 'notes' | 'status' | 'error' | 'processing_lock' | 'drive_audio_file_id'
>;

function check<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export async function inProgressRecordings(ownerId: string): Promise<RecordingSummary[]> {
  return check(
    await db()
      .from('recordings')
      .select(LIST_COLUMNS)
      .eq('owner_id', ownerId)
      .in('status', ['uploading', 'uploaded', 'transcribing', 'cleaning', 'classifying', 'error'])
      .order('created_at', { ascending: false })
      .limit(50),
  );
}

export async function pendingItems(ownerId: string): Promise<(Item & { recordings: { title: string | null; original_filename: string; recorded_at: string | null } })[]> {
  return check(
    await db()
      .from('items')
      .select('*, recordings(title, original_filename, recorded_at)')
      .eq('owner_id', ownerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .order('position', { ascending: true })
      .limit(200),
  );
}

export async function areaCounts(ownerId: string): Promise<Record<string, number>> {
  const rows = check(await db().from('items').select('area').eq('owner_id', ownerId).eq('status', 'approved')) as { area: Area }[];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.area] = (counts[r.area] ?? 0) + 1;
  return counts;
}

export async function areaItems(ownerId: string, area: Area, type?: ContentType): Promise<Item[]> {
  let q = db().from('items').select('*').eq('owner_id', ownerId).eq('area', area).eq('status', 'approved');
  if (type) q = q.eq('content_type', type);
  return check(await q.order('approved_at', { ascending: false }).limit(200));
}

export async function privateRecordings(ownerId: string, area?: Area): Promise<RecordingSummary[]> {
  let q = db().from('recordings').select(LIST_COLUMNS).eq('owner_id', ownerId).eq('is_private', true);
  if (area) q = q.eq('area', area);
  return check(await q.order('created_at', { ascending: false }).limit(100));
}

export async function recentRecordings(ownerId: string, limit = 20): Promise<RecordingSummary[]> {
  return check(await db().from('recordings').select(LIST_COLUMNS).eq('owner_id', ownerId).order('created_at', { ascending: false }).limit(limit));
}

export async function getRecording(ownerId: string, id: string): Promise<Recording | null> {
  return check(await db().from('recordings').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle());
}

export async function recordingItems(ownerId: string, recordingId: string): Promise<Item[]> {
  return check(await db().from('items').select('*').eq('owner_id', ownerId).eq('recording_id', recordingId).order('position'));
}

export async function getItem(ownerId: string, id: string): Promise<Item | null> {
  return check(await db().from('items').select('*').eq('id', id).eq('owner_id', ownerId).maybeSingle());
}

export async function itemActions(ownerId: string, itemId: string): Promise<ItemAction[]> {
  return check(await db().from('item_actions').select('*').eq('owner_id', ownerId).eq('item_id', itemId).order('created_at', { ascending: false }));
}

export async function search(ownerId: string, q: string): Promise<{ items: Item[]; recordings: RecordingSummary[] }> {
  const [items, recordings] = await Promise.all([
    db().from('items').select('*').eq('owner_id', ownerId).neq('status', 'rejected').textSearch('search', q, { type: 'websearch', config: 'english' }).limit(50),
    db().from('recordings').select(LIST_COLUMNS).eq('owner_id', ownerId).textSearch('search', q, { type: 'websearch', config: 'english' }).limit(30),
  ]);
  return { items: check(items), recordings: check(recordings) };
}

export async function recentAudit(ownerId: string, limit = 15) {
  return check(
    await db().from('audit_events').select('at, action, entity_type, entity_id, ip').eq('owner_id', ownerId).order('at', { ascending: false }).limit(limit),
  ) as { at: string; action: string; entity_type: string | null; entity_id: string | null; ip: string | null }[];
}
