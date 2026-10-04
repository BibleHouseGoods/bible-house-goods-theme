import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AreaBadge, CueBadge, TypeBadge } from '@/components/Badges';
import { formatWhen } from '@/components/format';
import ItemReview from '@/components/ItemReview';
import PageHeader from '@/components/PageHeader';
import { env } from '@/lib/env';
import { getItem, itemActions } from '@/lib/queries';
import { requireOwner } from '@/lib/session';

const KIND_LABELS = { todoist: 'Todoist task', calendar: 'Calendar event', email_draft: 'Gmail draft' } as const;

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const item = await getItem(ownerId, id);
  if (!item) notFound();
  const actions = await itemActions(ownerId, id);
  const tz = env().APP_TIMEZONE;

  return (
    <>
      <PageHeader title={item.status === 'pending' ? 'Review' : item.status === 'approved' ? 'Filed' : 'Rejected'} subtitle={formatWhen(item.created_at, tz)} />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <AreaBadge area={item.area} />
        <TypeBadge type={item.content_type} />
        {item.explicit_cue && <CueBadge cue={item.explicit_cue} />}
        <Link href={`/recordings/${item.recording_id}`} className="ml-auto text-sm text-stone-500 underline">Source recording</Link>
      </div>

      {actions.length > 0 && (
        <ul className="card mb-4 space-y-2 text-sm">
          {actions.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3">
              <span>
                {KIND_LABELS[a.kind]} {a.status === 'done' ? '✓' : '✗'}
                {a.error && <span className="block text-xs text-red-600">{a.error}</span>}
              </span>
              {a.external_url && (
                <a className="shrink-0 underline" href={a.external_url} target="_blank" rel="noopener noreferrer">Open ↗</a>
              )}
            </li>
          ))}
        </ul>
      )}

      <ItemReview item={item} />
    </>
  );
}
