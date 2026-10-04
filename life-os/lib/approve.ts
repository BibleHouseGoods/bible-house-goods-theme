import 'server-only';
import { audit } from './audit';
import { env } from './env';
import { createEvent } from './google/calendar';
import { createDraft } from './google/gmail';
import { db } from './supabase';
import { createTodoistTask } from './todoist';
import type { Item, ItemAction } from './types';

type Kind = ItemAction['kind'];

async function alreadyDone(itemId: string): Promise<Set<Kind>> {
  const { data } = await db().from('item_actions').select('kind').eq('item_id', itemId).eq('status', 'done');
  return new Set((data ?? []).map((r) => r.kind as Kind));
}

async function record(item: Item, kind: Kind, result: { id?: string; url?: string; error?: string }) {
  await db().from('item_actions').insert({
    owner_id: item.owner_id,
    item_id: item.id,
    kind,
    status: result.error ? 'error' : 'done',
    external_id: result.id ?? null,
    external_url: result.url ?? null,
    error: result.error ?? null,
  });
}

/**
 * The ONLY place external side effects happen. Runs each enabled action once
 * (idempotent per item+kind), records links back, and files the item.
 */
export async function approveItem(item: Item): Promise<{ ok: boolean; errors: string[] }> {
  const done = await alreadyDone(item.id);
  const errors: string[] = [];
  const backlink = `${env().APP_URL}/items/${item.id}`;

  const { data: rec } = await db()
    .from('recordings')
    .select('drive_audio_url, title, original_filename')
    .eq('id', item.recording_id)
    .eq('owner_id', item.owner_id)
    .single();
  const context = [item.body, '', `Life OS: ${backlink}`, rec?.drive_audio_url ? `Audio: ${rec.drive_audio_url}` : null]
    .filter((l) => l !== null)
    .join('\n');

  const run = async (kind: Kind, enabled: boolean, fn: () => Promise<{ id: string; url: string }>) => {
    if (!enabled || done.has(kind)) return;
    try {
      const r = await fn();
      await record(item, kind, r);
      await audit(item.owner_id, `action.${kind}`, { type: 'item', id: item.id }, { external_id: r.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${kind}: ${message}`);
      await record(item, kind, { error: message.slice(0, 1000) });
    }
  };

  await run('todoist', item.actions.todoist, () =>
    createTodoistTask({
      content: item.title,
      description: context,
      area: item.area,
      due_string: item.task?.due_string ?? null,
      priority: item.task?.priority ?? 1,
      labels: item.tags,
    }),
  );

  await run('calendar', item.actions.calendar && Boolean(item.event), async () => {
    const ev = await createEvent(item.owner_id, { ...item.event!, description: context });
    return { id: ev.id, url: ev.htmlLink };
  });

  await run('email_draft', item.actions.email_draft && Boolean(item.email), () => createDraft(item.owner_id, item.email!));

  if (errors.length === 0) {
    await db()
      .from('items')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('owner_id', item.owner_id);
    await audit(item.owner_id, 'item.approved', { type: 'item', id: item.id });
  }
  return { ok: errors.length === 0, errors };
}
