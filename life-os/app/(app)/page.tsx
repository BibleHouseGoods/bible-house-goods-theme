import Link from 'next/link';
import { PrivateBadge } from '@/components/Badges';
import { formatWhen, STATUS_LABELS } from '@/components/format';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import ProcessingWatcher from '@/components/ProcessingWatcher';
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
      <PageHeader title="Inbox" subtitle={items.length ? `${items.length} to review — nothing leaves Life OS until you approve` : 'Nothing to review'} />
      <ProcessingWatcher queued={queued} active={active} />

      {processing.length > 0 && (
        <section className="mb-6 space-y-2">
          {processing.map((r) => (
            <Link key={r.id} href={`/recordings/${r.id}`} className="card flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{r.title || r.original_filename}</p>
                <p className={`text-xs ${r.status === 'error' ? 'text-red-600' : 'text-stone-500'}`}>
                  {STATUS_LABELS[r.status]}
                  {r.status === 'error' && r.error ? ` — ${r.error.slice(0, 80)}` : ''}
                </p>
              </div>
              {r.is_private ? <PrivateBadge /> : r.status !== 'error' && <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-500" />}
            </Link>
          ))}
        </section>
      )}

      {groups.size === 0 && processing.length === 0 && (
        <div className="card py-10 text-center">
          <p className="font-semibold">Inbox zero.</p>
          <p className="mt-1 text-sm text-stone-500">Capture a thought or import from your recorder.</p>
          <Link href="/capture" className="btn-primary mt-4">Capture</Link>
        </div>
      )}

      <div className="space-y-6">
        {[...groups.entries()].map(([recId, g]) => (
          <section key={recId}>
            <Link href={`/recordings/${recId}`} className="mb-2 flex items-baseline justify-between text-sm">
              <span className="truncate font-semibold text-stone-700 dark:text-stone-300">{g.label}</span>
              <span className="shrink-0 pl-2 text-xs text-stone-500">{formatWhen(g.when, tz)}</span>
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
