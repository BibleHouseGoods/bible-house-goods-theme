'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AREA_LABELS, AREAS, CONTENT_TYPES, TYPE_LABELS, type Area, type ContentType } from '@/lib/taxonomy';
import type { EmailProposal, EventProposal, Item, ItemActions, TaskProposal } from '@/lib/types';

export default function ItemReview({ item }: { item: Item }) {
  const router = useRouter();
  const [title, setTitle] = useState(item.title);
  const [area, setArea] = useState<Area>(item.area);
  const [type, setType] = useState<ContentType>(item.content_type);
  const [tags, setTags] = useState(item.tags.join(', '));
  const [actions, setActions] = useState<ItemActions>(item.actions);
  const [task, setTask] = useState<TaskProposal>(item.task ?? { due_string: null, priority: 1 });
  const [event, setEvent] = useState<EventProposal | null>(item.event);
  const [email, setEmail] = useState<EmailProposal | null>(item.email);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const locked = item.status !== 'pending';

  const payload = () => ({
    title,
    area,
    content_type: type,
    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    task: type === 'task' || actions.todoist ? task : null,
    event,
    email,
    actions: { todoist: actions.todoist, calendar: actions.calendar && Boolean(event), email_draft: actions.email_draft && Boolean(email) },
  });

  async function call(kind: 'save' | 'approve' | 'reject') {
    setBusy(kind);
    setMessage(null);
    const url = kind === 'save' ? `/api/items/${item.id}` : `/api/items/${item.id}/${kind}`;
    const res = await fetch(url, {
      method: kind === 'save' ? 'PATCH' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: kind === 'reject' ? undefined : JSON.stringify(payload()),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || body.ok === false) {
      setMessage({ ok: false, text: body.errors?.join('\n') ?? body.error ?? 'Something went wrong' });
    } else {
      setMessage({ ok: true, text: kind === 'approve' ? 'Approved and filed.' : kind === 'reject' ? 'Rejected.' : 'Saved.' });
      if (kind !== 'save') router.push('/');
    }
    router.refresh();
  }

  const toggle = (k: keyof ItemActions) => setActions((a) => ({ ...a, [k]: !a[k] }));

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div>
          <label className="label" htmlFor="t">Title</label>
          <input id="t" className="field" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="a">Area</label>
            <select id="a" className="field" value={area} onChange={(e) => setArea(e.target.value as Area)} disabled={locked}>
              {AREAS.map((a) => <option key={a} value={a}>{AREA_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="c">Type</label>
            <select
              id="c"
              className="field"
              value={type}
              disabled={locked}
              onChange={(e) => {
                const v = e.target.value as ContentType;
                setType(v);
                setActions((a) => ({ ...a, todoist: v === 'task' }));
              }}
            >
              {CONTENT_TYPES.map((c) => <option key={c} value={c}>{TYPE_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="g">Tags</label>
          <input id="g" className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma separated" disabled={locked} />
        </div>
      </div>

      <div className="card">
        <p className="label">What you said (clean transcript excerpt)</p>
        <p className="whitespace-pre-wrap leading-relaxed">{item.body}</p>
      </div>

      <div className="card space-y-4">
        <p className="label">On approval</p>

        <section>
          <label className="flex items-center gap-3 font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-stone-900" checked={actions.todoist} onChange={() => toggle('todoist')} disabled={locked} />
            Send task to Todoist
          </label>
          {actions.todoist && (
            <div className="mt-2 grid grid-cols-3 gap-2 pl-8">
              <input className="field col-span-2" placeholder="Due (e.g. Oct 6 3pm)" value={task.due_string ?? ''} onChange={(e) => setTask({ ...task, due_string: e.target.value || null })} disabled={locked} />
              <select className="field" value={task.priority} onChange={(e) => setTask({ ...task, priority: Number(e.target.value) })} disabled={locked}>
                <option value={1}>P4</option>
                <option value={2}>P3</option>
                <option value={3}>P2</option>
                <option value={4}>P1</option>
              </select>
            </div>
          )}
        </section>

        <section>
          <label className="flex items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-stone-900"
              checked={actions.calendar}
              disabled={locked}
              onChange={() => {
                if (!event) setEvent({ title, start: new Date().toISOString().slice(0, 10) + 'T09:00', end: null, all_day: false, location: null });
                toggle('calendar');
              }}
            />
            Create Google Calendar event
          </label>
          {actions.calendar && event && (
            <div className="mt-2 space-y-2 pl-8">
              <input className="field" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} disabled={locked} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={event.all_day} onChange={(e) => setEvent({ ...event, all_day: e.target.checked, start: event.start.slice(0, 10) + (e.target.checked ? '' : 'T09:00'), end: null })} disabled={locked} />
                All day
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input className="field" type={event.all_day ? 'date' : 'datetime-local'} value={event.all_day ? event.start.slice(0, 10) : event.start.slice(0, 16)} onChange={(e) => setEvent({ ...event, start: e.target.value })} disabled={locked} />
                <input className="field" type={event.all_day ? 'date' : 'datetime-local'} value={event.end ? (event.all_day ? event.end.slice(0, 10) : event.end.slice(0, 16)) : ''} onChange={(e) => setEvent({ ...event, end: e.target.value || null })} disabled={locked} />
              </div>
              <input className="field" placeholder="Location" value={event.location ?? ''} onChange={(e) => setEvent({ ...event, location: e.target.value || null })} disabled={locked} />
            </div>
          )}
        </section>

        <section>
          <label className="flex items-center gap-3 font-semibold">
            <input
              type="checkbox"
              className="h-5 w-5 accent-stone-900"
              checked={actions.email_draft}
              disabled={locked}
              onChange={() => {
                if (!email) setEmail({ to: null, subject: title, body: item.body });
                toggle('email_draft');
              }}
            />
            Create email draft (Gmail — never sent)
          </label>
          {actions.email_draft && email && (
            <div className="mt-2 space-y-2 pl-8">
              <input className="field" placeholder="To" value={email.to ?? ''} onChange={(e) => setEmail({ ...email, to: e.target.value || null })} disabled={locked} />
              <input className="field" placeholder="Subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} disabled={locked} />
              <textarea className="field min-h-40" value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} disabled={locked} />
              <p className="text-xs text-stone-500">AI-drafted from your words. Edit freely; it lands in Gmail Drafts for you to send.</p>
            </div>
          )}
        </section>

        {!actions.todoist && !actions.calendar && !actions.email_draft && (
          <p className="text-sm text-stone-500">No external actions. Approving files this item in {AREA_LABELS[area]}.</p>
        )}
      </div>

      {message && <p className={`whitespace-pre-wrap text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}

      {item.status === 'pending' ? (
        <div className="sticky bottom-20 flex gap-2">
          <button className="btn-primary flex-1" disabled={busy !== null} onClick={() => call('approve')}>{busy === 'approve' ? 'Approving…' : 'Approve'}</button>
          <button className="btn-secondary" disabled={busy !== null} onClick={() => call('save')}>{busy === 'save' ? '…' : 'Save'}</button>
          <button className="btn-danger" disabled={busy !== null} onClick={() => call('reject')}>Reject</button>
        </div>
      ) : item.status === 'approved' ? (
        <button className="btn-secondary w-full" disabled={busy !== null} onClick={() => call('approve')}>
          {busy === 'approve' ? 'Retrying…' : 'Retry failed actions'}
        </button>
      ) : null}
    </div>
  );
}
