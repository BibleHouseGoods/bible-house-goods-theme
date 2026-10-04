import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AREA_TEXT, AreaDot, PrivateBadge } from '@/components/Badges';
import EmptyState from '@/components/EmptyState';
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

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition ${active ? 'bg-ink text-paper' : 'border border-line bg-surface text-ink-2'}`;

  return (
    <>
      <PageHeader
        back={{ href: '/areas', label: 'Areas' }}
        eyebrow={
          <span className={`inline-flex items-center gap-1.5 ${AREA_TEXT[area]}`}>
            <AreaDot area={area} />
            {items.length} {t ? TYPE_LABELS[t].toLowerCase() + (items.length === 1 ? '' : 's') : 'filed'}
          </span>
        }
        title={AREA_LABELS[area]}
      />
      <nav className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <Link href={`/areas/${area}`} className={chip(!t)}>All</Link>
        {CONTENT_TYPES.map((c) => (
          <Link key={c} href={`/areas/${area}?type=${c}`} className={chip(t === c)}>
            {TYPE_LABELS[c]}
          </Link>
        ))}
      </nav>

      <div className="space-y-3">
        {items.map((it) => <ItemCard key={it.id} item={it} />)}
        {items.length === 0 && <EmptyState title="Nothing here yet." body={`Approved ${t ? TYPE_LABELS[t].toLowerCase() + 's' : 'items'} for ${AREA_LABELS[area]} will collect here.`} />}
      </div>

      {privates.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow mb-3">Private recordings</h2>
          <div className="card divide-y divide-line p-0">
            {privates.map((r) => (
              <Link key={r.id} href={`/recordings/${r.id}`} className="flex items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{r.title || r.original_filename}</p>
                  <p className="truncate text-[13px] text-muted">{formatWhen(r.recorded_at ?? r.created_at, tz)}{r.notes ? ` · ${r.notes}` : ''}</p>
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
