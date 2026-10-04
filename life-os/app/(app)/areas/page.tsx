import Link from 'next/link';
import { AREA_SOFT, AREA_TEXT, AreaDot } from '@/components/Badges';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import { areaCounts } from '@/lib/queries';
import { requireOwner } from '@/lib/session';
import { AREA_HINTS, AREA_LABELS, AREAS } from '@/lib/taxonomy';

export default async function AreasPage() {
  const ownerId = await requireOwner();
  const counts = await areaCounts(ownerId);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader eyebrow={`${total} filed`} title="Areas" />
      <div className="grid grid-cols-2 gap-3">
        {AREAS.map((a) => (
          <Link key={a} href={`/areas/${a}`} className={`animate-rise group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[22px] p-4 ${AREA_SOFT[a]}`}>
            <div className="flex items-center justify-between">
              <AreaDot area={a} className="h-2.5 w-2.5" />
              <Icon name="arrowRight" className={`h-4 w-4 opacity-50 transition group-active:translate-x-0.5 ${AREA_TEXT[a]}`} strokeWidth={2} />
            </div>
            <div>
              <p className={`display text-[44px] leading-none font-medium tabular-nums ${AREA_TEXT[a]}`}>{counts[a] ?? 0}</p>
              <p className="display mt-2 text-[20px] leading-tight font-medium text-ink">{AREA_LABELS[a]}</p>
              <p className="mt-1 line-clamp-2 min-h-[2lh] text-[12px] leading-snug text-ink-2/80">{AREA_HINTS[a].split(':')[0]}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
