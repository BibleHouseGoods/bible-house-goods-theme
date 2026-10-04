import Link from 'next/link';
import { PrivateBadge } from '@/components/Badges';
import EmptyState from '@/components/EmptyState';
import { formatWhen, greeting, STATUS_LABELS, todayLabel } from '@/components/format';
import Icon from '@/components/Icon';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import ProcessingWatcher from '@/components/ProcessingWatcher';
import { Stepper } from '@/components/ui';
import { env } from '@/lib/env';
import { inProgressRecordings, pendingItems } from '@/lib/queries';
import { needsKick } from '@/lib/resume';
import { requireOwner } from '@/lib/session';
import type { Item } from '@/lib/types';

export default async function InboxPage() {
  const ownerId = await requireOwner();
  const tz = env().APP_TIMEZONE;
  const [processing, items] = await Promise.all([inProgressRecordings(ownerId), pendingItems(ownerId)]);

  const groups = new Map<string, { label: string; when: string | null; items: Item[] }>();
  for (const it of items) {
    const g = groups.get(it.recording_id) ?? {
      label: it.recordings?.title || it.recordings?.original_filename || 'Recording',
      when: it.recordings?.recorded_at ?? null,
      items: [],
    };
    g.items.push(it);
    groups.set(it.recording_id, g);
  }

  const queued = processing.filter(needsKick).map((r) => r.id);
  const active = processing.filter((r) => r.status !== 'error').length;

  return (
    <>
      <PageHeader
        eyebrow={todayLabel(tz)}
        title={greeting(tz)}
        subtitle={
          items.length ? (
            <>
              <span className="font-semibold text-ink">{items.length}</span> {items.length === 1 ? 'item' : 'items'} to review. Nothing leaves Life OS until you approve.
            </>
          ) : undefined
        }
      />
      <ProcessingWatcher queued={queued} active={active} />

      {processing.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3">In progress</h2>
          <div className="space-y-2.5">
            {processing.map((r) => (
              <Link key={r.id} href={`/recordings/${r.id}`} className="card flex items-center gap-4 px-4 py-3.5">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${r.status === 'error' ? 'bg-danger/10 text-danger' : 'bg-sunken text-ink-2'}`}>
                  <Icon name={r.status === 'error' ? 'retry' : 'wave'} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{r.title || r.original_filename}</p>
                  <p className={`mt-0.5 truncate text-[13px] ${r.status === 'error' ? 'text-danger' : 'text-muted'}`}>
                    {STATUS_LABELS[r.status]}
                    {r.status === 'error' && r.error ? ` · ${r.error}` : ''}
                  </p>
                </div>
                {r.is_private ? <PrivateBadge /> : r.status !== 'error' && <Stepper status={r.status} />}
              </Link>
            ))}
          </div>
        </section>
      )}

      {groups.size === 0 && processing.length === 0 && (
        <EmptyState title="All clear." body="Nothing waiting on you. Capture a thought, or import from your recorder." action={{ href: '/capture', label: 'Capture' }} />
      )}

      <div className="space-y-9">
        {[...groups.entries()].map(([recId, g]) => (
          <section key={recId}>
            <Link href={`/recordings/${recId}`} className="mb-3 flex items-center gap-2 px-1">
              <Icon name="mic" className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink-2">{g.label}</span>
              <span className="shrink-0 text-[12px] text-muted">{formatWhen(g.when, tz)}</span>
            </Link>
            <div className="space-y-3">
              {g.items.map((it) => <ItemCard key={it.id} item={it} quick />)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
