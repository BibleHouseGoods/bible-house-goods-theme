// Browser-side upload: audio goes in 4 MB chunks through the app to a Google
// Drive resumable session. The session URL and all keys stay on the server.

export interface UploadOptions {
  file: Blob;
  filename: string;
  source: 'recorder' | 'import';
  isPrivate: boolean;
  title?: string;
  area?: string;
  recordedAt?: Date;
  onProgress?: (fraction: number) => void;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export function audioDuration(file: Blob): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (v?: number) => {
      URL.revokeObjectURL(url);
      resolve(v && Number.isFinite(v) ? v : undefined);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done();
    setTimeout(() => done(), 8000);
    a.src = url;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function uploadRecording(o: UploadOptions): Promise<string> {
  const durationSeconds = await audioDuration(o.file);
  const { id, chunkSize } = await json<{ id: string; chunkSize: number }>(
    await fetch('/api/recordings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: o.filename,
        mimeType: o.file.type || guessMime(o.filename),
        size: o.file.size,
        source: o.source,
        isPrivate: o.isPrivate,
        title: o.title || undefined,
        area: o.area || undefined,
        recordedAt: (o.recordedAt ?? new Date()).toISOString(),
        durationSeconds,
      }),
    }),
  );

  let offset = 0;
  let failures = 0;
  while (offset < o.file.size) {
    const chunk = o.file.slice(offset, Math.min(offset + chunkSize, o.file.size));
    try {
      const r = await json<{ done: boolean; nextOffset?: number }>(
        await fetch(`/api/recordings/${id}/upload?offset=${offset}`, { method: 'PUT', body: chunk }),
      );
      failures = 0;
      if (r.done) {
        o.onProgress?.(1);
        return id;
      }
      offset = r.nextOffset ?? offset + chunk.size;
      o.onProgress?.(offset / o.file.size);
    } catch (err) {
      if (++failures > 5) throw err;
      await sleep(1000 * 2 ** failures);
      // Ask where Drive actually is before retrying.
      try {
        const s = await json<{ done: boolean; nextOffset?: number }>(await fetch(`/api/recordings/${id}/upload`));
        if (s.done) return id;
        offset = s.nextOffset ?? offset;
      } catch {
        /* retry same offset */
      }
    }
  }
  return id;
}

export function startProcessing(id: string): void {
  // Fire and forget; the server keeps going and the inbox shows progress.
  fetch(`/api/recordings/${id}/process`, { method: 'POST' }).catch(() => {});
}

function guessMime(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  return { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', mp4: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm' }[ext ?? ''] ?? 'application/octet-stream';
}
