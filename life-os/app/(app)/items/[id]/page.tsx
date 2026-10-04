import { notFound } from 'next/navigation';
import { ItemMeta } from '@/components/Badges';
import { formatWhen } from '@/components/format';
import Icon from '@/components/Icon';
import ItemReview from '@/components/ItemReview';
import PageHeader from '@/components/PageHeader';
import { env } from '@/lib/env';
import { getItem, itemActions } from '@/lib/queries';
import { requireOwner } from '@/lib/session';

const KIND = {
  todoist: { label: 'Todoist task', icon: 'task' },
  calendar: { label: 'Calendar event', icon: 'calendar' },
  email_draft: { label: 'Gmail draft', icon: 'mail' },
} as const;

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const item = await getItem(ownerId, id);
  if (!item) notFound();
  const actions = await itemActions(ownerId, id);
  const tz = env().APP_TIMEZONE;

  return (
    <>
      <PageHeader
        back={item.status === 'pending' ? { href: '/', label: 'Inbox' } : { href: `/areas/${item.area}`, label: 'Back' }}
        eyebrow={item.status === 'pending' ? 'Review' : item.status === 'approved' ? `Filed ${formatWhen(item.approved_at, tz)}` : 'Rejected'}
        title={item.title}
        subtitle={
          <span className="mt-1 flex items-center justify-between gap-3">
            <ItemMeta area={item.area} type={item.content_type} cue={item.explicit_cue} />
            <a href={`/recordings/${item.recording_id}`} className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-muted">
              <Icon name="mic" className="h-3.5 w-3.5" />
              Source
            </a>
          </span>
        }
      />

      {actions.length > 0 && (
        <section className="card mb-4 divide-y divide-line py-1">
          {actions.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.status === 'done' ? 'bg-life-soft text-success' : 'bg-danger/10 text-danger'}`}>
                <Icon name={a.status === 'done' ? 'check' : 'x'} className="h-4 w-4" strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{KIND[a.kind].label}</p>
                {a.error && <p className="truncate text-[12px] text-danger">{a.error}</p>}
              </div>
              {a.external_url && (
                <a className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-ink-2" href={a.external_url} target="_blank" rel="noopener noreferrer">
                  Open <Icon name="external" className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      <ItemReview item={item} />
    </>
  );
}
