import 'server-only';
import { db } from './supabase';

export async function audit(
  ownerId: string | null,
  action: string,
  entity?: { type: string; id: string },
  detail: Record<string, unknown> = {},
  ip?: string | null,
): Promise<void> {
  const { error } = await db().from('audit_events').insert({
    owner_id: ownerId,
    action,
    entity_type: entity?.type ?? null,
    entity_id: entity?.id ?? null,
    detail,
    ip: ip ?? null,
  });
  if (error) console.error('audit log failed', error.message);
}
