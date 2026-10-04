import Link from 'next/link';
import { AREA_LABELS } from '@/lib/taxonomy';
import type { Item } from '@/lib/types';
import { ItemMeta } from './Badges';
import Icon, { type IconName } from './Icon';
import ItemQuickActions from './ItemQuickActions';

export function plannedActions(item: Item): { icon: IconName; label: string }[] {
  const out: { icon: IconName; label: string }[] = [];
  if (item.actions.todoist) out.push({ icon: 'task', label: item.task?.due_string ? `Todoist · ${item.task.due_string}` : 'Todoist' });
  if (item.actions.calendar && item.event) out.push({ icon: 'calendar', label: `Calendar · ${item.event.start.replace('T', ' ')}` });
  if (item.actions.email_draft && item.email) out.push({ icon: 'mail', label: 'Gmail draft' });
  return out;
}

export default function ItemCard({ item, quick = false, footer }: { item: Item; quick?: boolean; footer?: React.ReactNode }) {
  const actions = plannedActions(item);
  return (
    <article className="card animate-rise p-0">
      <Link href={`/items/${item.id}`} className="block p-5 pb-4">
        <ItemMeta area={item.area} type={item.content_type} cue={item.explicit_cue} tags={item.tags} />
        <h3 className="display mt-2.5 text-[20px] leading-snug font-medium">{item.title}</h3>
        <p className="mt-2 line-clamp-3 text-[15px] leading-relaxed text-ink-2">{item.body}</p>
      </Link>
      {quick && item.status === 'pending' && (
        <div className="border-t border-line px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {actions.length ? (
              actions.map((a) => (
                <span key={a.label} className="inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-[12px] font-medium text-ink-2">
                  <Icon name={a.icon} className="h-3.5 w-3.5" />
                  {a.label}
                </span>
              ))
            ) : (
              <span className="text-[12px] text-muted">Files to {AREA_LABELS[item.area]} · nothing external</span>
            )}
          </div>
          <ItemQuickActions id={item.id} />
        </div>
      )}
      {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
    </article>
  );
}
