'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AREA_LABELS, AREAS } from '@/lib/taxonomy';

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
    if (await patch('ai', { isPrivate: false })) {
      await req('process', `/api/recordings/${p.id}/process`, { method: 'POST' });
    }
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
    if (!confirm('Delete this recording? Its Drive folder (audio + transcripts) moves to Drive trash and all items are removed from Life OS. Items already sent to Todoist/Calendar/Gmail stay there.')) return;
    if (await req('delete', `/api/recordings/${p.id}`, { method: 'DELETE' })) {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="rt">Title</label>
          <input id="rt" className="field" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== (p.title ?? '') && patch('title', { title: title || null }).then(() => router.refresh())} />
        </div>
        <div>
          <label className="label" htmlFor="ra">Area</label>
          <select id="ra" className="field" value={area} onChange={(e) => { setArea(e.target.value); patch('area', { area: e.target.value || null }).then(() => router.refresh()); }}>
            <option value="">None</option>
            {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="rn">Your notes</label>
          <textarea id="rn" className="field min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={p.isPrivate ? 'Private recordings are never transcribed. Jot what it was about so you can find it.' : 'Optional'} />
          {notes !== (p.notes ?? '') && (
            <button className="btn-secondary mt-2" disabled={busy !== null} onClick={() => patch('notes', { notes: notes || null }).then(() => router.refresh())}>
              {busy === 'notes' ? 'Saving…' : 'Save notes'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(p.status === 'error' || p.status === 'uploaded') && !p.isPrivate && (
          <button className="btn-primary" disabled={busy !== null} onClick={retry}>{busy === 'process' ? 'Processing…' : 'Retry processing'}</button>
        )}
        {p.isPrivate ? (
          <button className="btn-secondary" disabled={busy !== null} onClick={allowAi}>{busy ? 'Working…' : 'Allow AI processing'}</button>
        ) : (
          <button className="btn-secondary" disabled={busy !== null} onClick={makePrivate}>Mark private</button>
        )}
        <button className="btn-danger" disabled={busy !== null} onClick={remove}>{busy === 'delete' ? 'Deleting…' : 'Delete'}</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
