import Link from 'next/link';
import { PrivateBadge } from '@/components/Badges';
import EmptyState from '@/components/EmptyState';
import { formatDuration, formatWhen } from '@/components/format';
import Icon from '@/components/Icon';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import { env } from '@/lib/env';
import { recentRecordings, search, type RecordingSummary } from '@/lib/queries';
import { requireOwner } from '@/lib/session';

function RecordingList({ rows, tz }: { rows: RecordingSummary[]; tz: string }) {
  if (!rows.length) return null;
  return (
    <div className="card divide-y divide-line p-0">
      {rows.map((r) => (
        <Link key={r.id} href={`/recordings/${r.id}`} className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
            <Icon name="wave" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{r.title || r.original_filename}</p>
            <p className="text-[13px] text-muted">{[formatWhen(r.recorded_at ?? r.created_at, tz), formatDuration(r.duration_seconds)].filter(Boolean).join(' · ')}</p>
          </div>
          {r.is_private && <PrivateBadge />}
        </Link>
      ))}
    </div>
  );
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ownerId = await requireOwner();
  const q = ((await searchParams).q ?? '').trim().slice(0, 200);
  const tz = env().APP_TIMEZONE;
  const results = q ? await search(ownerId, q) : null;
  const recent = q ? [] : await recentRecordings(ownerId);

  return (
    <>
      <PageHeader eyebrow="Everything you've said" title="Search" />
      <form action="/search" className="relative mb-7">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-muted" />
        <input name="q" defaultValue={q} className="field rounded-full py-3.5 pl-12 shadow-card" type="search" placeholder='Words, "exact phrase", -exclude' autoComplete="off" enterKeyHint="search" />
      </form>

      {results ? (
        results.items.length + results.recordings.length === 0 ? (
          <EmptyState title="No matches." body="Try fewer words, or a phrase you remember saying. Private recordings match on title and notes only." />
        ) : (
          <>
            {results.items.length > 0 && (
              <section className="mb-8">
                <h2 className="eyebrow mb-3">Items · {results.items.length}</h2>
                <div className="space-y-3">{results.items.map((it) => <ItemCard key={it.id} item={it} />)}</div>
              </section>
            )}
            {results.recordings.length > 0 && (
              <section>
                <h2 className="eyebrow mb-3">Recordings · {results.recordings.length}</h2>
                <RecordingList rows={results.recordings} tz={tz} />
              </section>
            )}
          </>
        )
      ) : (
        <section>
          <h2 className="eyebrow mb-3">Recent recordings</h2>
          {recent.length ? <RecordingList rows={recent} tz={tz} /> : <EmptyState title="Nothing yet." body="Your recordings will show up here." />}
        </section>
      )}
    </>
  );
}
