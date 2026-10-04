import 'server-only';
import { z } from 'zod';
import { HttpError } from './session';
import { db } from './supabase';
import { AREAS, CONTENT_TYPES } from './taxonomy';

export const ItemEdit = z.object({
  title: z.string().min(1).max(200).optional(),
  area: z.enum(AREAS).optional(),
  content_type: z.enum(CONTENT_TYPES).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  task: z.object({ due_string: z.string().max(100).nullable(), priority: z.number().int().min(1).max(4) }).nullable().optional(),
  event: z
    .object({
      title: z.string().min(1).max(200),
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/).nullable(),
      all_day: z.boolean(),
      location: z.string().max(200).nullable(),
    })
    .nullable()
    .optional(),
  email: z.object({ to: z.string().max(500).nullable(), subject: z.string().max(300), body: z.string().max(20000) }).nullable().optional(),
  actions: z.object({ todoist: z.boolean(), calendar: z.boolean(), email_draft: z.boolean() }).optional(),
});

export async function applyEdit(ownerId: string, id: string, edit: z.infer<typeof ItemEdit>) {
  // The body is deliberately not editable: it is the speaker's own words.
  if (Object.keys(edit).length === 0) return;
  const { error, count } = await db().from('items').update(edit, { count: 'exact' }).eq('id', id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
  if (!count) throw new HttpError(404, 'Not found');
}

