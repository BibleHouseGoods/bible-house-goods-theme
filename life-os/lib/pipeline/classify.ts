import 'server-only';
import { detectCues } from '../cues';
import { env } from '../env';
import { openai } from '../openai';
import { enforceSegmentation, type FinalItem, type ProposedItem } from '../segmentation';
import { AREA_HINTS, AREA_LABELS, AREAS, CONTENT_TYPES, type Area } from '../taxonomy';
import { splitSentences } from '../text';

const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'area', 'content_type', 'tags', 'start', 'end', 'confidence', 'task', 'event', 'email'],
        properties: {
          title: { type: 'string', description: 'Short label (max 10 words) in the speaker’s own words where possible.' },
          area: { type: 'string', enum: [...AREAS] },
          content_type: { type: 'string', enum: [...CONTENT_TYPES] },
          tags: { type: 'array', items: { type: 'string' } },
          start: { type: 'integer', description: 'First sentence number of this item (inclusive).' },
          end: { type: 'integer', description: 'Last sentence number of this item (inclusive).' },
          confidence: { type: 'number' },
          task: nullable({
            type: 'object',
            additionalProperties: false,
            required: ['due_string', 'priority'],
            properties: {
              due_string: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Absolute date/time like "2026-10-06 3pm", a recurrence like "every Monday", or null.' },
              priority: { type: 'integer', description: '1 normal, 2 medium, 3 high, 4 urgent' },
            },
          }),
          event: nullable({
            type: 'object',
            additionalProperties: false,
            required: ['title', 'start', 'end', 'all_day', 'location'],
            properties: {
              title: { type: 'string' },
              start: { type: 'string', description: 'Local time "YYYY-MM-DDTHH:mm" or date "YYYY-MM-DD" when all_day.' },
              end: { anyOf: [{ type: 'string' }, { type: 'null' }] },
              all_day: { type: 'boolean' },
              location: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            },
          }),
          email: nullable({
            type: 'object',
            additionalProperties: false,
            required: ['to', 'subject', 'body'],
            properties: {
              to: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Email address only if spoken explicitly, else null.' },
              subject: { type: 'string' },
              body: { type: 'string' },
            },
          }),
        },
      },
    },
  },
} as const;

function systemPrompt(now: string, tz: string): string {
  const areas = AREAS.map((a) => `- ${a} (${AREA_LABELS[a]}): ${AREA_HINTS[a]}`).join('\n');
  return `You organize a person's spoken voice notes. You receive a transcript as numbered sentences.

Split the recording into items BY MEANING: one item per distinct task, idea, note, project, meeting or reference. A single recording often contains several unrelated items. Consecutive sentences about the same thing belong to one item. Items must not overlap. Every meaningful sentence should belong to an item; skip only pure chatter (e.g. "okay, testing").

EXPLICIT CUES ARE HARD RULES. When the speaker says a cue such as "task", "sermon idea", "book", "brainstorm", "meeting", "note", "project", "idea", "reference", optionally preceded by an area ("Bible House task", "church note"), that sentence STARTS a new item and the cue decides its type and area. You are given the detected cues; obey them exactly.

Areas:
${areas}

Content types: task (something to do), note (information to keep), idea (a thought to develop; sermon ideas are church ideas tagged "sermon"), project (a multi-step effort), meeting (a meeting that happened or must be scheduled), reference (a book, link, quote, resource).

For each item return sentence numbers "start" and "end" (inclusive). Do NOT return the item text — it is taken from the transcript verbatim.

Proposed actions (only when clearly warranted, otherwise null):
- task: for tasks. Resolve relative dates ("tomorrow", "next Tuesday") to ABSOLUTE dates using the recording time. Keep recurrences ("every Monday"). null due_string if no date was spoken.
- event: only when a specific date/time to meet or attend was spoken. Times are local (${tz}).
- email: only when the speaker says to email/write/reply to someone. Draft a short, plain email in the speaker's voice using only facts from the transcript.

Recording time: ${now} (${tz}).`;
}

export async function classifyTranscript(clean: string, recordedAt: Date, area: Area | null = null): Promise<FinalItem[]> {
  const e = env();
  const sentences = splitSentences(clean);
  if (sentences.length === 0) return [];
  const cues = detectCues(sentences);

  const now = new Intl.DateTimeFormat('en-US', {
    timeZone: e.APP_TIMEZONE,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(recordedAt);

  const numbered = sentences.map((s, i) => `[${i}] ${s}`).join('\n');
  const cueText = cues.length
    ? cues.map((c) => `- Sentence ${c.sentence} begins with cue "${c.phrase}" → new item${c.type ? `, type=${c.type}` : ''}${c.area ? `, area=${c.area}` : ''}${c.tags.length ? `, tags=${c.tags.join(',')}` : ''}`).join('\n')
    : '- none detected';

  const res = await openai().chat.completions.create({
    model: e.OPENAI_TEXT_MODEL,
    ...(e.OPENAI_REASONING_EFFORT ? { reasoning_effort: e.OPENAI_REASONING_EFFORT } : {}),
    store: false,
    response_format: { type: 'json_schema', json_schema: { name: 'life_os_items', strict: true, schema: ITEM_SCHEMA as unknown as Record<string, unknown> } },
    messages: [
      { role: 'system', content: systemPrompt(now, e.APP_TIMEZONE) },
      {
        role: 'user',
        content:
          (area ? `The speaker filed this recording under ${AREA_LABELS[area]}. Use that area unless an explicit cue or the content clearly says otherwise.\n\n` : '') +
          `Detected explicit cues:\n${cueText}\n\nTranscript:\n${numbered}`,
      },
    ],
  });
  const raw = res.choices[0]?.message?.content;
  if (!raw) throw new Error('Classification returned nothing');
  const parsed = JSON.parse(raw) as { items: ProposedItem[] };
  return enforceSegmentation(parsed.items, cues, sentences, area ?? 'life');
}
