'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AREA_LABELS, AREAS } from '@/lib/taxonomy';
import { formatBytes } from './format';
import { startProcessing, uploadRecording } from './upload-client';

type Job = { name: string; size: number; progress: number; state: 'waiting' | 'uploading' | 'done' | 'error'; error?: string };

function pickMime(): string {
  for (const t of ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/webm;codecs=opus', 'audio/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}${p(d.getMinutes())}`;
}

export default function Capture() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [area, setArea] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef<Date | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current?.getTime() ?? Date.now())) / 1000)), 500);
    return () => clearInterval(t);
  }, [recording]);

  async function upload(files: { blob: Blob; name: string; source: 'recorder' | 'import'; recordedAt: Date }[]) {
    setBusy(true);
    setJobs(files.map((f) => ({ name: f.name, size: f.blob.size, progress: 0, state: 'waiting' })));
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const set = (patch: Partial<Job>) => setJobs((js) => js.map((j, k) => (k === i ? { ...j, ...patch } : j)));
      set({ state: 'uploading' });
      try {
        const id = await uploadRecording({
          file: f.blob,
          filename: f.name,
          source: f.source,
          isPrivate,
          title: files.length === 1 ? title : title ? `${title} (${i + 1})` : undefined,
          area: area || undefined,
          recordedAt: f.recordedAt,
          onProgress: (p) => set({ progress: p }),
        });
        set({ state: 'done', progress: 1 });
        startProcessing(id);
        ok++;
      } catch (err) {
        set({ state: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
      }
    }
    setBusy(false);
    if (ok === files.length) {
      router.push('/');
      router.refresh();
    }
  }

  function onFiles(list: FileList | null) {
    if (!list?.length) return;
    // A recorder's file modified time is usually when the recording ended:
    // the best available "recorded at" for imports.
    upload(Array.from(list).map((f) => ({ blob: f, name: f.name, source: 'import' as const, recordedAt: new Date(f.lastModified || Date.now()) })));
  }

  async function startRecording() {
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
      const mimeType = pickMime();
      const r = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        wakeLock.current?.release().catch(() => {});
        const type = r.mimeType || mimeType || 'audio/mp4';
        const ext = type.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(chunks.current, { type: type.split(';')[0] });
        const when = startedAt.current ?? new Date();
        upload([{ blob, name: `Recording ${stamp(when)}.${ext}`, source: 'recorder', recordedAt: when }]);
      };
      r.start(1000);
      recorder.current = r;
      startedAt.current = new Date();
      setElapsed(0);
      setRecording(true);
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request('screen').catch(() => null)) ?? null;
    } catch (err) {
      setMicError(err instanceof Error ? err.message : 'Microphone unavailable');
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">Title (optional)</label>
          <input id="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Morning drive thoughts" disabled={busy || recording} />
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-stone-900" checked={isPrivate} onChange={(e) => setPrivate(e.target.checked)} disabled={busy || recording} />
          <span>
            <span className="block font-semibold">Private — do not AI process</span>
            <span className="block text-sm text-stone-500">Audio is stored in your Drive only. No transcription, cleaning or classification. Nothing is sent to OpenAI.</span>
          </span>
        </label>

        <div>
          <label className="label" htmlFor="area">Area {isPrivate ? '' : '(optional — AI routes items otherwise)'}</label>
          <select id="area" className="field" value={area} onChange={(e) => setArea(e.target.value)} disabled={busy || recording}>
            <option value="">{isPrivate ? 'No area' : 'Let AI decide'}</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{AREA_LABELS[a]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {recording ? (
          <button className="btn h-20 bg-red-600 text-lg text-white" onClick={stopRecording}>
            <span className="h-3 w-3 animate-pulse rounded-full bg-white" /> Stop · {mmss}
          </button>
        ) : (
          <button className="btn-primary h-20 text-lg" onClick={startRecording} disabled={busy}>
            Record
          </button>
        )}
        <label className={`btn-secondary h-16 cursor-pointer text-base ${busy || recording ? 'pointer-events-none opacity-50' : ''}`}>
          Import audio (MP3, M4A, WAV)
          <input
            type="file"
            className="sr-only"
            multiple
            accept="audio/*,.mp3,.m4a,.wav,.aac,.mp4"
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        <p className="text-center text-xs text-stone-500">
          From a USB-C recorder: plug it into your iPhone, tap Import, then Browse → your recorder in the Files app.
        </p>
        {micError && <p className="text-sm text-red-600">{micError}</p>}
      </div>

      {jobs.length > 0 && (
        <ul className="card space-y-3">
          {jobs.map((j, i) => (
            <li key={i}>
              <div className="flex justify-between text-sm">
                <span className="truncate pr-2">{j.name}</span>
                <span className="shrink-0 text-stone-500">{j.state === 'error' ? 'Failed' : j.state === 'done' ? 'Uploaded' : `${Math.round(j.progress * 100)}% of ${formatBytes(j.size)}`}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                <div className={`h-full ${j.state === 'error' ? 'bg-red-500' : 'bg-stone-900 dark:bg-stone-100'}`} style={{ width: `${Math.round(j.progress * 100)}%` }} />
              </div>
              {j.error && <p className="mt-1 text-xs text-red-600">{j.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
