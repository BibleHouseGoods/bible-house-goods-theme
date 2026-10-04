import Link from 'next/link';
import { PrivateBadge } from '@/components/Badges';
import { formatWhen } from '@/components/format';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import { env } from '@/lib/env';
import { recentRecordings, search } from '@/lib/queries';
import { requireOwner } from '@/lib/session';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ownerId = await requireOwner();
  const q = ((await searchParams).q ?? '').trim().slice(0, 200);
  const tz = env().APP_TIMEZONE;
  const results = q ? await search(ownerId, q) : null;
  const recent = q ? [] : await recentRecordings(ownerId);

  return (
    <>
      <PageHeader title="Search" />
      <form action="/search" className="mb-5">
        <input name="q" defaultValue={q} className="field" type="search" placeholder='Words, phrases in "quotes", -exclude' autoComplete="off" enterKeyHint="search" />
      </form>

      {results && (
        <>
          <h2 className="label">Items ({results.items.length})</h2>
          <div className="mb-6 space-y-3">
            {results.items.map((it) => <ItemCard key={it.id} item={it} />)}
            {results.items.length === 0 && <p className="text-sm text-stone-500">No matching items.</p>}
          </div>
        </>
      )}

      <h2 className="label">{results ? `Recordings (${results.recordings.length})` : 'Recent recordings'}</h2>
      <div className="space-y-2">
        {(results?.recordings ?? recent).map((r) => (
          <Link key={r.id} href={`/recordings/${r.id}`} className="card flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.title || r.original_filename}</p>
              <p className="text-xs text-stone-500">{formatWhen(r.recorded_at ?? r.created_at, tz)}</p>
            </div>
            {r.is_private && <PrivateBadge />}
          </Link>
        ))}
      </div>
      {results && <p className="mt-6 text-center text-xs text-stone-500">Private recordings are searchable by title and your notes only.</p>}
    </>
  );
}
