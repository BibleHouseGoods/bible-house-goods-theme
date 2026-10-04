'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AREA_LABELS, AREAS, CONTENT_TYPES, TYPE_LABELS, type Area, type ContentType } from '@/lib/taxonomy';
import type { EmailProposal, EventProposal, Item, ItemActions, TaskProposal } from '@/lib/types';
import { AREA_BG, AreaDot } from './Badges';
import Icon from './Icon';
import { Chip, Row, Switch } from './ui';

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

  const setAction = (k: keyof ItemActions, v: boolean) => setActions((a) => ({ ...a, [k]: v }));
  const nothingExternal = !actions.todoist && !actions.calendar && !actions.email_draft;

  return (
    <div className="space-y-4 pb-4">
      {/* What was said */}
      <figure className="card relative overflow-hidden pl-7">
        <span className={`absolute inset-y-5 left-0 w-1 rounded-r-full ${AREA_BG[area]}`} aria-hidden />
        <figcaption className="eyebrow mb-3">What you said</figcaption>
        <blockquote className="display text-[19px] leading-[1.6] text-ink [font-variation-settings:'opsz'_14]">{item.body}</blockquote>
      </figure>

      {/* Classification */}
      <section className="card space-y-5">
        <div>
          <label className="label" htmlFor="t">Title</label>
          <input id="t" className="field display text-[18px]" value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} />
        </div>
        <div>
          <span className="label">Area</span>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((a) => (
              <Chip key={a} active={area === a} onClick={() => setArea(a)} disabled={locked}>
                <AreaDot area={a} />
                {AREA_LABELS[a]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Type</span>
          <div className="flex flex-wrap gap-2">
            {CONTENT_TYPES.map((c) => (
              <Chip
                key={c}
                active={type === c}
                disabled={locked}
                onClick={() => {
                  setType(c);
                  setAction('todoist', c === 'task');
                }}
              >
                {TYPE_LABELS[c]}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="g">Tags</label>
          <input id="g" className="field" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sermon, follow-up" disabled={locked} />
        </div>
      </section>

      {/* Actions */}
      <section className="card">
        <h2 className="eyebrow mb-4">When you approve</h2>
        <div className="divide-y divide-line">
          <Row
            icon={<Icon name="task" />}
            title="Todoist task"
            description={actions.todoist ? (task.due_string ? `Due ${task.due_string}` : 'No due date') : 'Off'}
            control={<Switch checked={actions.todoist} onChange={(v) => setAction('todoist', v)} disabled={locked} label="Send to Todoist" />}
          >
            {actions.todoist && (
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input className="field" placeholder="Due, e.g. Oct 6 3pm" value={task.due_string ?? ''} onChange={(e) => setTask({ ...task, due_string: e.target.value || null })} disabled={locked} />
                <select className="field w-24" value={task.priority} onChange={(e) => setTask({ ...task, priority: Number(e.target.value) })} disabled={locked} aria-label="Priority">
                  <option value={4}>P1</option>
                  <option value={3}>P2</option>
                  <option value={2}>P3</option>
                  <option value={1}>P4</option>
                </select>
              </div>
            )}
          </Row>

          <Row
            icon={<Icon name="calendar" />}
            title="Calendar event"
            description={actions.calendar && event ? event.start.replace('T', ' at ') : 'Off'}
            control={
              <Switch
                checked={actions.calendar}
                disabled={locked}
                label="Create calendar event"
                onChange={(v) => {
                  if (v && !event) setEvent({ title, start: new Date().toISOString().slice(0, 10) + 'T09:00', end: null, all_day: false, location: null });
                  setAction('calendar', v);
                }}
              />
            }
          >
            {actions.calendar && event && (
              <div className="space-y-2">
                <input className="field" value={event.title} onChange={(e) => setEvent({ ...event, title: e.target.value })} disabled={locked} aria-label="Event title" />
                <div className="grid grid-cols-2 gap-2">
                  <input className="field" type={event.all_day ? 'date' : 'datetime-local'} value={event.all_day ? event.start.slice(0, 10) : event.start.slice(0, 16)} onChange={(e) => setEvent({ ...event, start: e.target.value })} disabled={locked} aria-label="Start" />
                  <input className="field" type={event.all_day ? 'date' : 'datetime-local'} value={event.end ? (event.all_day ? event.end.slice(0, 10) : event.end.slice(0, 16)) : ''} onChange={(e) => setEvent({ ...event, end: e.target.value || null })} disabled={locked} aria-label="End" />
                </div>
                <input className="field" placeholder="Location" value={event.location ?? ''} onChange={(e) => setEvent({ ...event, location: e.target.value || null })} disabled={locked} />
                <label className="flex items-center justify-between rounded-2xl bg-sunken px-4 py-3 text-[14px] font-medium">
                  All day
                  <Switch
                    checked={event.all_day}
                    disabled={locked}
                    label="All day"
                    onChange={(v) => setEvent({ ...event, all_day: v, start: event.start.slice(0, 10) + (v ? '' : 'T09:00'), end: null })}
                  />
                </label>
              </div>
            )}
          </Row>

          <Row
            icon={<Icon name="mail" />}
            title="Gmail draft"
            description={actions.email_draft ? 'Saved to Drafts. Never sent.' : 'Off'}
            control={
              <Switch
                checked={actions.email_draft}
                disabled={locked}
                label="Create email draft"
                onChange={(v) => {
                  if (v && !email) setEmail({ to: null, subject: title, body: item.body });
                  setAction('email_draft', v);
                }}
              />
            }
          >
            {actions.email_draft && email && (
              <div className="space-y-2">
                <input className="field" placeholder="To" type="email" value={email.to ?? ''} onChange={(e) => setEmail({ ...email, to: e.target.value || null })} disabled={locked} />
                <input className="field" placeholder="Subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} disabled={locked} />
                <textarea className="field min-h-44 leading-relaxed" value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} disabled={locked} />
                <p className="text-[12px] text-muted">AI drafted this from your words. Edit it here or in Gmail before sending.</p>
              </div>
            )}
          </Row>
        </div>
        {nothingExternal && <p className="mt-4 rounded-2xl bg-sunken px-4 py-3 text-[13px] text-ink-2">Nothing external. Approving files this in {AREA_LABELS[area]}.</p>}
      </section>

      {message && (
        <p className={`whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14px] ${message.ok ? 'bg-life-soft text-success' : 'bg-danger/10 text-danger'}`}>{message.text}</p>
      )}

      {item.status === 'pending' ? (
        <div className="sticky bottom-[calc(max(env(safe-area-inset-bottom),8px)+76px)] z-20 -mx-1 flex gap-2 rounded-full border border-line bg-surface/90 p-1.5 shadow-float backdrop-blur-xl">
          <button className="btn-primary flex-1" disabled={busy !== null} onClick={() => call('approve')}>
            <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.2} />
            {busy === 'approve' ? 'Approving…' : 'Approve'}
          </button>
          <button className="btn-ghost px-4" disabled={busy !== null} onClick={() => call('save')}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button className="btn-ghost px-4 text-danger" disabled={busy !== null} onClick={() => call('reject')}>
            Reject
          </button>
        </div>
      ) : item.status === 'approved' ? (
        <button className="btn-secondary w-full" disabled={busy !== null} onClick={() => call('approve')}>
          <Icon name="retry" className="h-[18px] w-[18px]" />
          {busy === 'approve' ? 'Retrying…' : 'Retry failed actions'}
        </button>
      ) : null}
    </div>
  );
}
