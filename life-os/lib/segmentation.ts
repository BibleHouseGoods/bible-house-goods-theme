// Turns model output into final items. The model only chooses sentence ranges
// and labels; item bodies are always rebuilt from the clean transcript's own
// sentences, so the classifier can never rewrite what you said.
import type { DetectedCue } from './cues';
import { isArea, isContentType, type Area, type ContentType } from './taxonomy';

export interface ProposedItem {
  title: string;
  area: string;
  content_type: string;
  tags: string[];
  start: number;
  end: number;
  confidence: number;
  task: { due_string: string | null; priority: number } | null;
  event: { title: string; start: string; end: string | null; all_day: boolean; location: string | null } | null;
  email: { to: string | null; subject: string; body: string } | null;
}

export interface FinalItem extends Omit<ProposedItem, 'area' | 'content_type'> {
  area: Area;
  content_type: ContentType;
  explicit_cue: string | null;
  body: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function enforceSegmentation(
  proposed: ProposedItem[],
  cues: DetectedCue[],
  sentences: string[],
  defaultArea: Area = 'life',
): FinalItem[] {
  const n = sentences.length;
  if (n === 0) return [];

  // 1. Normalise ranges and sort.
  let items = proposed
    .map((p) => ({ ...p, start: clamp(p.start, 0, n - 1), end: clamp(p.end, 0, n - 1) }))
    .map((p) => (p.end < p.start ? { ...p, end: p.start } : p))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  // 2. Every explicit cue must start an item. Split any item that spans a cue.
  for (const cue of cues) {
    if (items.some((it) => it.start === cue.sentence)) continue;
    const host = items.find((it) => it.start < cue.sentence && it.end >= cue.sentence);
    if (host) {
      const tail: ProposedItem = {
        ...host,
        start: cue.sentence,
        title: sentences[cue.sentence].slice(0, 80),
        task: null,
        event: null,
        email: null,
        confidence: 0.5,
      };
      host.end = cue.sentence - 1;
      items.push(tail);
    } else {
      // Cue sentence was not covered by any item: create one running to the
      // next item (or the end).
      const next = items.filter((it) => it.start > cue.sentence).sort((a, b) => a.start - b.start)[0];
      items.push({
        title: sentences[cue.sentence].slice(0, 80),
        area: cue.area ?? defaultArea,
        content_type: cue.type ?? 'note',
        tags: [],
        start: cue.sentence,
        end: next ? next.start - 1 : n - 1,
        confidence: 0.5,
        task: null,
        event: null,
        email: null,
      });
    }
    items = items.sort((a, b) => a.start - b.start || a.end - b.end);
  }

  // 3. A cue also ends the previous item: trim items that run past a cue that
  //    starts a different item.
  const cueStarts = new Set(cues.map((c) => c.sentence));
  for (const it of items) {
    for (let s = it.start + 1; s <= it.end; s++) {
      if (cueStarts.has(s)) {
        it.end = s - 1;
        break;
      }
    }
  }

  // 4. Force type/area/tags implied by the cue and rebuild bodies.
  const cueAt = new Map(cues.map((c) => [c.sentence, c]));
  return items.map((it) => {
    const cue = cueAt.get(it.start);
    const area: Area = cue?.area ?? (isArea(it.area) ? it.area : defaultArea);
    const content_type: ContentType = cue?.type ?? (isContentType(it.content_type) ? it.content_type : 'note');
    const tags = Array.from(new Set([...(it.tags ?? []), ...(cue?.tags ?? [])].map((t) => t.toLowerCase().trim()).filter(Boolean)));
    return {
      ...it,
      area,
      content_type,
      tags,
      explicit_cue: cue?.phrase ?? null,
      body: sentences.slice(it.start, it.end + 1).join(' '),
      task: content_type === 'task' ? it.task ?? { due_string: null, priority: 1 } : it.task,
    };
  });
}
