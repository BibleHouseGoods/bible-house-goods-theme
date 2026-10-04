import 'server-only';
import { env } from './env';
import type { Area } from './taxonomy';
import { AREA_LABELS } from './taxonomy';

function projectFor(area: Area): string | undefined {
  const e = env();
  return {
    life: e.TODOIST_PROJECT_LIFE,
    church: e.TODOIST_PROJECT_CHURCH,
    bible_house: e.TODOIST_PROJECT_BIBLE_HOUSE,
    liberty: e.TODOIST_PROJECT_LIBERTY,
  }[area];
}

export async function createTodoistTask(input: {
  content: string;
  description: string;
  area: Area;
  due_string: string | null;
  priority: number; // 1 (normal) .. 4 (urgent), Todoist convention
  labels: string[];
}): Promise<{ id: string; url: string }> {
  const res = await fetch('https://api.todoist.com/api/v1/tasks', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env().TODOIST_API_TOKEN}`,
      'content-type': 'application/json',
      'x-request-id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      content: input.content,
      description: input.description,
      project_id: projectFor(input.area),
      due_string: input.due_string || undefined,
      due_lang: 'en',
      priority: Math.min(4, Math.max(1, input.priority || 1)),
      labels: Array.from(new Set([AREA_LABELS[input.area].replace(/\s+/g, '_'), 'life_os', ...input.labels])),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Todoist ${res.status}: ${text.slice(0, 300)}`);
  const task = JSON.parse(text) as { id: string; url?: string };
  return { id: task.id, url: task.url ?? `https://app.todoist.com/app/task/${task.id}` };
}
