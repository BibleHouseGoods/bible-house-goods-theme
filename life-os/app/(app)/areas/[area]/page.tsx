import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PrivateBadge } from '@/components/Badges';
import { formatWhen } from '@/components/format';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import { env } from '@/lib/env';
import { areaItems, privateRecordings } from '@/lib/queries';
import { requireOwner } from '@/lib/session';
import { AREA_LABELS, CONTENT_TYPES, isArea, isContentType, TYPE_LABELS } from '@/lib/taxonomy';

export default async function AreaPage({ params, searchParams }: { params: Promise<{ area: string }>; searchParams: Promise<{ type?: string }> }) {
  const ownerId = await requireOwner();
  const { area } = await params;
  const { type } = await searchParams;
  if (!isArea(area)) notFound();
  const t = isContentType(type) ? type : undefined;
  const [items, privates] = await Promise.all([areaItems(ownerId, area, t), t ? Promise.resolve([]) : privateRecordings(ownerId, area)]);
  const tz = env().APP_TIMEZONE;

  return (
    <>
      <PageHeader title={AREA_LABELS[area]} subtitle={`${items.length} filed${t ? ` · ${TYPE_LABELS[t]}` : ''}`} />
      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm">
        <Link href={`/areas/${area}`} className={`shrink-0 rounded-full px-3 py-1.5 ${!t ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'border border-stone-300 dark:border-stone-700'}`}>All</Link>
        {CONTENT_TYPES.map((c) => (
          <Link key={c} href={`/areas/${area}?type=${c}`} className={`shrink-0 rounded-full px-3 py-1.5 ${t === c ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'border border-stone-300 dark:border-stone-700'}`}>
            {TYPE_LABELS[c]}
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
        {items.length === 0 && <p className="py-8 text-center text-sm text-stone-500">Nothing filed here yet.</p>}
      </div>

      {privates.length > 0 && (
        <section className="mt-8">
          <h2 className="label">Private recordings</h2>
          <div className="space-y-2">
            {privates.map((r) => (
              <Link key={r.id} href={`/recordings/${r.id}`} className="card flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title || r.original_filename}</p>
                  <p className="truncate text-xs text-stone-500">{formatWhen(r.recorded_at ?? r.created_at, tz)}{r.notes ? ` · ${r.notes}` : ''}</p>
                </div>
                <PrivateBadge />
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
