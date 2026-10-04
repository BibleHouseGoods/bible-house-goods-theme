'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AREA_LABELS, AREAS } from '@/lib/taxonomy';
import { AreaDot } from './Badges';
import Icon from './Icon';
import { Chip } from './ui';

interface Props {
  id: string;
  status: string;
  isPrivate: boolean;
  hasTranscript: boolean;
  notes: string | null;
  area: string | null;
  title: string | null;
}

export default function RecordingControls(p: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState(p.notes ?? '');
  const [title, setTitle] = useState(p.title ?? '');
  const [area, setArea] = useState(p.area ?? '');
  const [error, setError] = useState<string | null>(null);

  async function req(kind: string, url: string, init: RequestInit) {
    setBusy(kind);
    setError(null);
    const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) setError(body.error ?? 'Failed');
    return res.ok;
  }

  const patch = (kind: string, body: object) => req(kind, `/api/recordings/${p.id}`, { method: 'PATCH', body: JSON.stringify(body) });

  async function allowAi() {
    if (!confirm('Allow AI processing? The audio will be sent to OpenAI for transcription, cleaning and classification.')) return;
    if (await patch('ai', { isPrivate: false })) await req('process', `/api/recordings/${p.id}/process`, { method: 'POST' });
    router.refresh();
  }

  async function makePrivate() {
    const msg = p.hasTranscript
      ? 'Mark private? Processing stops from now on. Text already transcribed stays stored (delete the recording to remove it).'
      : 'Mark private? This recording will never be sent to AI.';
    if (!confirm(msg)) return;
    await patch('private', { isPrivate: true });
    router.refresh();
  }

  async function retry() {
    await req('process', `/api/recordings/${p.id}/process`, { method: 'POST' });
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this recording? Its Drive folder (audio and transcripts) moves to Drive trash and its items are removed from Life OS. Anything already sent to Todoist, Calendar or Gmail stays there.')) return;
    if (await req('delete', `/api/recordings/${p.id}`, { method: 'DELETE' })) {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-5">
        <h2 className="eyebrow">Details</h2>
        <div>
          <label className="label" htmlFor="rt">Title</label>
          <input
            id="rt"
            className="field"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== (p.title ?? '') && patch('title', { title: title || null }).then(() => router.refresh())}
          />
        </div>
        <div>
          <span className="label">Area</span>
          <div className="flex flex-wrap gap-2">
            <Chip active={area === ''} onClick={() => { setArea(''); patch('area', { area: null }).then(() => router.refresh()); }}>None</Chip>
            {AREAS.map((a) => (
              <Chip key={a} active={area === a} onClick={() => { setArea(a); patch('area', { area: a }).then(() => router.refresh()); }}>
                <AreaDot area={a} />
                {AREA_LABELS[a]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rn">Your notes</label>
          <textarea
            id="rn"
            className="field min-h-28 leading-relaxed"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={p.isPrivate ? 'Private recordings are never transcribed. Jot what it was about so you can find it later.' : 'Optional'}
          />
          {notes !== (p.notes ?? '') && (
            <button className="btn-secondary mt-3 min-h-10" disabled={busy !== null} onClick={() => patch('notes', { notes: notes || null }).then(() => router.refresh())}>
              {busy === 'notes' ? 'Saving…' : 'Save notes'}
            </button>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(p.status === 'error' || p.status === 'uploaded') && !p.isPrivate && (
          <button className="btn-primary" disabled={busy !== null} onClick={retry}>
            <Icon name="retry" className="h-[18px] w-[18px]" />
            {busy === 'process' ? 'Processing…' : 'Retry processing'}
          </button>
        )}
        {p.isPrivate ? (
          <button className="btn-secondary" disabled={busy !== null} onClick={allowAi}>
            <Icon name="sparkle" className="h-[18px] w-[18px]" />
            {busy ? 'Working…' : 'Allow AI processing'}
          </button>
        ) : (
          <button className="btn-secondary" disabled={busy !== null} onClick={makePrivate}>
            <Icon name="lock" className="h-[18px] w-[18px]" />
            Mark private
          </button>
        )}
        <button className="btn-ghost ml-auto text-danger" disabled={busy !== null} onClick={remove}>
          <Icon name="trash" className="h-[18px] w-[18px]" />
          {busy === 'delete' ? 'Deleting…' : 'Delete'}
        </button>
      </div>
      {error && <p className="text-[13px] text-danger">{error}</p>}
    </div>
  );
}
