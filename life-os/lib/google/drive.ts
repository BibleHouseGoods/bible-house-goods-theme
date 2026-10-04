import 'server-only';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { env } from '../env';
import { getIntegration, googleFetch, googleJson, updateMeta } from './auth';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';

interface DriveFile {
  id: string;
  name: string;
  webViewLink?: string;
}

const q = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function findFolder(ownerId: string, name: string, parent?: string): Promise<DriveFile | null> {
  const query = [`mimeType='${FOLDER}'`, `name='${q(name)}'`, 'trashed=false', parent ? `'${parent}' in parents` : null]
    .filter(Boolean)
    .join(' and ');
  const res = await googleJson<{ files: DriveFile[] }>(
    ownerId,
    `${API}/files?${new URLSearchParams({ q: query, fields: 'files(id,name,webViewLink)', spaces: 'drive' })}`,
  );
  return res.files[0] ?? null;
}

async function createFolder(ownerId: string, name: string, parent?: string): Promise<DriveFile> {
  return googleJson<DriveFile>(ownerId, `${API}/files?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }),
  });
}

async function ensureFolder(ownerId: string, name: string, parent?: string): Promise<DriveFile> {
  return (await findFolder(ownerId, name, parent)) ?? createFolder(ownerId, name, parent);
}

export async function rootFolderId(ownerId: string): Promise<string> {
  const integ = await getIntegration(ownerId);
  if (integ?.meta.rootFolderId) return integ.meta.rootFolderId;
  const root = await ensureFolder(ownerId, env().GOOGLE_DRIVE_ROOT_NAME);
  await updateMeta(ownerId, { rootFolderId: root.id });
  return root.id;
}

/** Life OS / Recordings / 2026-10 / 2026-10-04 0930 – Title */
export async function createRecordingFolder(ownerId: string, when: Date, title: string): Promise<DriveFile> {
  const root = await rootFolderId(ownerId);
  const recordings = await ensureFolder(ownerId, 'Recordings', root);
  const tz = env().APP_TIMEZONE;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(when)
      .map((p) => [p.type, p.value]),
  );
  const month = await ensureFolder(ownerId, `${parts.year}-${parts.month}`, recordings.id);
  const name = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}${parts.minute} – ${title}`.slice(0, 200);
  return createFolder(ownerId, name, month.id);
}

/** Starts a resumable upload. The session URI must stay server-side. */
export async function startResumableUpload(
  ownerId: string,
  opts: { name: string; mimeType: string; size: number; parent: string },
): Promise<string> {
  const res = await googleFetch(ownerId, `${UPLOAD}/files?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-type': opts.mimeType,
      'x-upload-content-length': String(opts.size),
    },
    body: JSON.stringify({ name: opts.name, parents: [opts.parent] }),
  });
  if (!res.ok) throw new Error(`Drive upload init failed ${res.status}: ${await res.text()}`);
  const location = res.headers.get('location');
  if (!location) throw new Error('Drive did not return an upload session');
  return location;
}

export type ChunkResult = { done: false; nextOffset: number } | { done: true; file: DriveFile };

/** Forward one chunk to the resumable session. */
export async function putChunk(sessionUri: string, chunk: ArrayBuffer, offset: number, total: number): Promise<ChunkResult> {
  const end = offset + chunk.byteLength - 1;
  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: { 'content-range': `bytes ${offset}-${end}/${total}` },
    body: chunk,
    redirect: 'manual',
  });
  if (res.status === 308) {
    const range = res.headers.get('range');
    const next = range ? Number(range.split('-')[1]) + 1 : 0;
    return { done: false, nextOffset: next };
  }
  if (res.ok) return { done: true, file: (await res.json()) as DriveFile };
  throw new Error(`Drive chunk upload failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Ask the session how many bytes it already has (to resume). */
export async function querySession(sessionUri: string, total: number): Promise<ChunkResult> {
  const res = await fetch(sessionUri, { method: 'PUT', headers: { 'content-range': `bytes */${total}` }, redirect: 'manual' });
  if (res.status === 308) {
    const range = res.headers.get('range');
    return { done: false, nextOffset: range ? Number(range.split('-')[1]) + 1 : 0 };
  }
  if (res.ok) return { done: true, file: (await res.json()) as DriveFile };
  throw new Error(`Drive upload session expired (${res.status}). Start the upload again.`);
}

export async function fileLink(ownerId: string, fileId: string): Promise<string | undefined> {
  const f = await googleJson<DriveFile>(ownerId, `${API}/files/${fileId}?fields=id,webViewLink`);
  return f.webViewLink;
}

export async function downloadToFile(ownerId: string, fileId: string, dest: string): Promise<void> {
  const res = await googleFetch(ownerId, `${API}/files/${fileId}?alt=media`);
  if (!res.ok || !res.body) throw new Error(`Drive download failed ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(dest));
}

export async function downloadBuffer(ownerId: string, fileId: string): Promise<Buffer> {
  const res = await googleFetch(ownerId, `${API}/files/${fileId}?alt=media`);
  if (!res.ok) throw new Error(`Drive download failed ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Stream a Drive file through the app (keeps Drive links private). */
export async function streamFile(ownerId: string, fileId: string, range?: string | null): Promise<Response> {
  const headers: Record<string, string> = {};
  if (range) headers.range = range;
  return googleFetch(ownerId, `${API}/files/${fileId}?alt=media`, { headers });
}

/**
 * Upload a text document. `asGoogleDoc` converts to a Google Doc; otherwise
 * the bytes are stored exactly as given (used for the verbatim transcript).
 */
export async function uploadText(
  ownerId: string,
  opts: { name: string; content: string; parent: string; asGoogleDoc?: boolean },
): Promise<DriveFile> {
  const boundary = `lifeos${crypto.randomUUID()}`;
  const metadata = {
    name: opts.name,
    parents: [opts.parent],
    ...(opts.asGoogleDoc ? { mimeType: 'application/vnd.google-apps.document' } : {}),
  };
  const body =
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\ncontent-type: text/plain; charset=UTF-8\r\n\r\n${opts.content}\r\n--${boundary}--`;
  return googleJson<DriveFile>(ownerId, `${UPLOAD}/files?uploadType=multipart&fields=id,name,webViewLink`, {
    method: 'POST',
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
    body,
  });
}

/** Move to Drive trash (recoverable for 30 days). */
export async function trashFile(ownerId: string, fileId: string): Promise<void> {
  await googleJson(ownerId, `${API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}
