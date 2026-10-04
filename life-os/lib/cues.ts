// Explicit spoken cues. When you say one of these at the start of a thought,
// the classifier MUST start a new item there and MUST honor the type/area it
// implies. Edit this list to match how you actually talk.
import type { Area, ContentType } from './taxonomy';

export interface CueRule {
  phrases: string[];
  type?: ContentType;
  area?: Area;
  tags?: string[];
}

export const TYPE_CUES: CueRule[] = [
  { phrases: ['sermon idea', 'sermon thought', 'sermon note', 'sermon illustration', 'preaching idea'], type: 'idea', area: 'church', tags: ['sermon'] },
  { phrases: ['book idea', 'chapter idea'], type: 'idea', tags: ['book'] },
  { phrases: ['book to read', 'reading list', 'book recommendation', 'book'], type: 'reference', tags: ['book'] },
  { phrases: ['brainstorm', 'brain dump'], type: 'idea', tags: ['brainstorm'] },
  { phrases: ['new task', 'action item', 'to do', 'todo', 'to-do', 'task', 'reminder'], type: 'task' },
  { phrases: ['meeting notes', 'meeting with', 'meeting'], type: 'meeting' },
  { phrases: ['new project', 'project'], type: 'project' },
  { phrases: ['quick note', 'note to self', 'note'], type: 'note' },
  { phrases: ['new idea', 'idea'], type: 'idea' },
  { phrases: ['for reference', 'reference'], type: 'reference' },
  { phrases: ['draft an email', 'email draft', 'email'], type: 'task', tags: ['email'] },
];

export const AREA_CUES: { area: Area; phrases: string[] }[] = [
  { area: 'bible_house', phrases: ['bible house'] },
  { area: 'liberty', phrases: ['liberty'] },
  { area: 'church', phrases: ['church'] },
  { area: 'life', phrases: ['personal', 'life', 'family', 'home'] },
];

// Words people say before a cue that should not block detection.
const LEAD_INS = ['okay', 'ok', 'alright', 'all right', 'so', 'and', 'next', 'also', 'um', 'uh', 'another', 'new', 'a'];

export interface DetectedCue {
  sentence: number; // index into the sentence list
  phrase: string; // what was actually said, e.g. "Bible House task"
  type?: ContentType;
  area?: Area;
  tags: string[];
}

const AMBIGUOUS = new Set(['to do']);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function alternation(phrases: string[]): string {
  // Longest first so "sermon idea" wins over "idea".
  return [...phrases].sort((a, b) => b.length - a.length).map(esc).join('|');
}

const leadIn = `(?:(?:${alternation(LEAD_INS)})[\\s,]+)*`;
const areaAlt = alternation(AREA_CUES.flatMap((a) => a.phrases));
const typeAlt = alternation(TYPE_CUES.flatMap((t) => t.phrases));

// [lead-ins] [area] [type] followed by punctuation, or a multi-word phrase, or end.
const CUE_RE = new RegExp(
  `^${leadIn}(?:(?<area>${areaAlt})[\\s,]+)?(?<type>${typeAlt})(?<after>\\s*[:.,;\\-–—]|\\s*$|\\s+)`,
  'i',
);
// Area alone ("Bible House: ...") counts only when followed by a colon or dash.
const AREA_ONLY_RE = new RegExp(`^${leadIn}(?<area>${areaAlt})\\s*[:\\-–—]`, 'i');

function findType(phrase: string): CueRule | undefined {
  const p = phrase.toLowerCase();
  return TYPE_CUES.find((r) => r.phrases.includes(p));
}

function findArea(phrase: string): Area | undefined {
  const p = phrase.toLowerCase();
  return AREA_CUES.find((a) => a.phrases.includes(p))?.area;
}

export function detectCue(sentence: string, index: number): DetectedCue | null {
  const s = sentence.trim();
  const m = CUE_RE.exec(s);
  if (m?.groups) {
    const typePhrase = m.groups.type;
    const areaPhrase = m.groups.area;
    const punctuated = /[:.,;\-–—]/.test(m.groups.after) || m.groups.after.trim() === '' && m[0].length === s.length;
    const prefix = m[0].slice(0, m.index + m[0].toLowerCase().lastIndexOf(typePhrase.toLowerCase()));
    // Single ambiguous words ("note that...", "book the room", "to do this")
    // only count as cues when followed by punctuation ("Note: ...", "Task, call
    // Sam") or when clearly marked ("new task", "Bible House idea ...").
    const strong =
      Boolean(areaPhrase) ||
      (typePhrase.includes(' ') && !AMBIGUOUS.has(typePhrase.toLowerCase())) ||
      /\b(new|another)\b/i.test(prefix);
    if (punctuated || strong) {
      const rule = findType(typePhrase);
      const area = areaPhrase ? findArea(areaPhrase) : rule?.area;
      return {
        sentence: index,
        phrase: [areaPhrase, typePhrase].filter(Boolean).join(' ').toLowerCase(),
        type: rule?.type,
        area,
        tags: rule?.tags ?? [],
      };
    }
  }
  const a = AREA_ONLY_RE.exec(s);
  if (a?.groups) {
    return { sentence: index, phrase: a.groups.area.toLowerCase(), area: findArea(a.groups.area), tags: [] };
  }
  return null;
}

export function detectCues(sentences: string[]): DetectedCue[] {
  return sentences.flatMap((s, i) => {
    const c = detectCue(s, i);
    return c ? [c] : [];
  });
}
