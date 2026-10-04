import Link from 'next/link';
import { AreaBadge } from '@/components/Badges';
import PageHeader from '@/components/PageHeader';
import { areaCounts } from '@/lib/queries';
import { requireOwner } from '@/lib/session';
import { AREA_HINTS, AREAS } from '@/lib/taxonomy';

export default async function AreasPage() {
  const ownerId = await requireOwner();
  const counts = await areaCounts(ownerId);
  return (
    <>
      <PageHeader title="Areas" />
      <div className="grid grid-cols-1 gap-3">
        {AREAS.map((a) => (
          <Link key={a} href={`/areas/${a}`} className="card flex items-center justify-between gap-3">
            <div className="min-w-0">
              <AreaBadge area={a} />
              <p className="mt-2 line-clamp-2 text-sm text-stone-500">{AREA_HINTS[a]}</p>
            </div>
            <span className="text-2xl font-bold tabular-nums">{counts[a] ?? 0}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
