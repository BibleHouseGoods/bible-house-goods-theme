'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { AREA_LABELS, AREAS, type Area } from '@/lib/taxonomy';
import { AreaDot } from './Badges';
import { formatBytes } from './format';
import Icon from './Icon';
import { Chip, Switch } from './ui';
import { startProcessing, uploadRecording } from './upload-client';

type Job = { name: string; size: number; progress: number; state: 'waiting' | 'uploading' | 'done' | 'error'; error?: string };

const BARS = 32;

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
  const [area, setArea] = useState<Area | ''>('');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [micError, setMicError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef<Date | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - (startedAt.current?.getTime() ?? Date.now())) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => () => stopMeter(), []);

  function startMeter(stream: MediaStream) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtx.current = ctx;
    const data = new Uint8Array(analyser.fftSize);
    let last = 0;
    const tick = (t: number) => {
      raf.current = requestAnimationFrame(tick);
      if (t - last < 70) return;
      last = t;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const rms = Math.min(1, Math.sqrt(sum / data.length) * 4);
      setLevels((l) => [...l.slice(1), rms]);
    };
    raf.current = requestAnimationFrame(tick);
  }

  function stopMeter() {
    if (raf.current) cancelAnimationFrame(raf.current);
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    setLevels(Array(BARS).fill(0));
  }

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
        stopMeter();
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
      startMeter(stream);
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
  const locked = busy || recording;

  return (
    <div className="space-y-5">
      {/* Hero: record */}
      <section className="card flex flex-col items-center overflow-hidden px-5 pt-6 pb-5">
        <div className="relative flex h-36 w-36 items-center justify-center">
          {recording && (
            <>
              <span className="animate-ring absolute inset-0 rounded-full bg-danger/25" />
              <span className="animate-ring absolute inset-0 rounded-full bg-danger/20 [animation-delay:0.9s]" />
            </>
          )}
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
            className={`relative flex h-28 w-28 items-center justify-center rounded-full transition duration-200 active:scale-95 disabled:opacity-50 ${
              recording ? 'bg-danger text-white shadow-[0_12px_32px_-8px_rgb(180_67_47/0.7)]' : 'bg-ink text-paper shadow-[0_14px_36px_-10px_rgb(31_28_23/0.65)]'
            }`}
          >
            {recording ? <span className="h-8 w-8 rounded-[8px] bg-white" /> : <Icon name="mic" className="h-11 w-11" strokeWidth={1.8} />}
          </button>
        </div>

        <div className="mt-3 flex h-10 items-center gap-[3px]" aria-hidden>
          {levels.map((l, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-[height] duration-75 ${recording ? 'bg-ink' : 'bg-line-strong'}`}
              style={{ height: `${Math.max(4, l * 40)}px`, opacity: recording ? 0.35 + (i / BARS) * 0.65 : 1 }}
            />
          ))}
        </div>

        <p className={`display mt-1 text-[30px] tabular-nums ${recording ? 'text-ink' : 'text-muted'}`}>{recording ? mmss : '0:00'}</p>
        <p className="mt-1 text-[13px] text-muted">{recording ? 'Recording. Tap to stop and upload.' : 'Tap to record'}</p>
        {micError && <p className="mt-3 text-center text-[13px] text-danger">{micError}</p>}
      </section>

      <label className={`btn-secondary w-full cursor-pointer ${locked ? 'pointer-events-none opacity-45' : ''}`}>
        <Icon name="upload" className="h-[18px] w-[18px]" />
        Import from recorder
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
      <p className="-mt-2 px-4 text-center text-[12px] leading-relaxed text-muted">
        MP3, M4A or WAV. Plug your USB-C recorder into your iPhone, tap Import, then Browse and choose the recorder.
      </p>

      {jobs.length > 0 && (
        <ul className="card space-y-4">
          {jobs.map((j, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-3 text-[14px]">
                <span className="truncate font-medium">{j.name}</span>
                <span className={`shrink-0 text-[12px] tabular-nums ${j.state === 'error' ? 'text-danger' : 'text-muted'}`}>
                  {j.state === 'error' ? 'Failed' : j.state === 'done' ? 'Uploaded' : j.state === 'waiting' ? 'Waiting' : `${Math.round(j.progress * 100)}% · ${formatBytes(j.size)}`}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
                <div className={`h-full rounded-full transition-[width] duration-300 ${j.state === 'error' ? 'bg-danger' : j.state === 'done' ? 'bg-success' : 'bg-ink'}`} style={{ width: `${Math.round(j.progress * 100)}%` }} />
              </div>
              {j.error && <p className="mt-1.5 text-[12px] text-danger">{j.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {/* Options for the next capture */}
      <section className="card space-y-5">
        <div>
          <label className="label" htmlFor="title">Title</label>
          <input id="title" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Optional, e.g. Morning drive" disabled={locked} />
        </div>

        <div>
          <span className="label">Area</span>
          <div className="flex flex-wrap gap-2">
            <Chip active={area === ''} onClick={() => setArea('')} disabled={locked}>
              {isPrivate ? 'None' : 'Auto'}
            </Chip>
            {AREAS.map((a) => (
              <Chip key={a} active={area === a} onClick={() => setArea(a)} disabled={locked}>
                <AreaDot area={a} />
                {AREA_LABELS[a]}
              </Chip>
            ))}
          </div>
        </div>

        <div className={`flex items-center gap-4 rounded-2xl p-4 transition ${isPrivate ? 'bg-ink text-paper' : 'bg-sunken'}`}>
          <Icon name="lock" className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Private</p>
            <p className={`text-[13px] leading-snug ${isPrivate ? 'text-paper/70' : 'text-muted'}`}>Store in Drive only. Never sent to AI.</p>
          </div>
          <Switch checked={isPrivate} onChange={setPrivate} disabled={locked} label="Private, do not AI process" />
        </div>
      </section>
    </div>
  );
}
