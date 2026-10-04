import Link from 'next/link';
import type { Item } from '@/lib/types';
import { AreaBadge, CueBadge, TypeBadge } from './Badges';
import ItemQuickActions from './ItemQuickActions';

export function actionSummary(item: Item): string {
  const parts: string[] = [];
  if (item.actions.todoist) parts.push(`Todoist task${item.task?.due_string ? ` (due ${item.task.due_string})` : ''}`);
  if (item.actions.calendar && item.event) parts.push(`Calendar event ${item.event.start.replace('T', ' ')}`);
  if (item.actions.email_draft && item.email) parts.push('Gmail draft');
  return parts.length ? `Approve → ${parts.join(' · ')}` : 'Approve → file only, nothing external';
}

export default function ItemCard({ item, quick = false }: { item: Item; quick?: boolean }) {
  return (
    <article className="card">
      <Link href={`/items/${item.id}`} className="block">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <AreaBadge area={item.area} />
          <TypeBadge type={item.content_type} />
          {item.explicit_cue && <CueBadge cue={item.explicit_cue} />}
          {item.tags.map((t) => (
            <span key={t} className="text-xs text-stone-500">#{t}</span>
          ))}
        </div>
        <h3 className="font-semibold leading-snug">{item.title}</h3>
        <p className="mt-1 line-clamp-3 text-sm text-stone-600 dark:text-stone-400">{item.body}</p>
      </Link>
      {quick && item.status === 'pending' && <ItemQuickActions id={item.id} summary={actionSummary(item)} />}
    </article>
  );
}
