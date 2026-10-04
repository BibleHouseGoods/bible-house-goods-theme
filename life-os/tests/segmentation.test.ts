import { describe, expect, it } from 'vitest';
import { detectCues } from '@/lib/cues';
import { enforceSegmentation, type ProposedItem } from '@/lib/segmentation';
import { cleaningWarning, splitSentences } from '@/lib/text';

const base = { tags: [], confidence: 0.9, task: null, event: null, email: null };

describe('enforceSegmentation', () => {
  const sentences = [
    'Task, call Sam about the van.',
    'He needs it by Friday.',
    'Sermon idea, the lost coin.',
    'Nobody sweeps for a penny anymore.',
    'I also want to rethink the kitchen.',
  ];
  const cues = detectCues(sentences);

  it('splits an item that swallowed an explicit cue and forces cue type/area', () => {
    const proposed: ProposedItem[] = [
      { ...base, title: 'Van', area: 'life', content_type: 'task', start: 0, end: 3 },
      { ...base, title: 'Kitchen', area: 'life', content_type: 'idea', start: 4, end: 4 },
    ];
    const items = enforceSegmentation(proposed, cues, sentences);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ start: 0, end: 1, content_type: 'task', explicit_cue: 'task' });
    expect(items[1]).toMatchObject({ start: 2, end: 3, content_type: 'idea', area: 'church', explicit_cue: 'sermon idea' });
    expect(items[1].tags).toContain('sermon');
  });

  it('builds bodies only from transcript sentences, never model text', () => {
    const proposed: ProposedItem[] = [{ ...base, title: 'x', area: 'life', content_type: 'note', start: 4, end: 4 }];
    const items = enforceSegmentation(proposed, cues, sentences);
    for (const it of items) {
      expect(sentences.join(' ')).toContain(it.body);
    }
    expect(items.find((i) => i.start === 4)?.body).toBe('I also want to rethink the kitchen.');
  });

  it('overrides a wrong model label when a cue is explicit', () => {
    const proposed: ProposedItem[] = [{ ...base, title: 'x', area: 'liberty', content_type: 'note', start: 2, end: 3 }];
    const items = enforceSegmentation(proposed, cues, sentences);
    expect(items.find((i) => i.start === 2)).toMatchObject({ area: 'church', content_type: 'idea' });
  });
});

describe('text helpers', () => {
  it('splits sentences without changing characters', () => {
    const text = 'Hello there. How are you? "Great!" I said.';
    expect(splitSentences(text).join(' ')).toBe(text);
  });

  it('flags cleaning that rewrites content', () => {
    const verbatim = 'Um so I I think we should uh call the the printer tomorrow morning.';
    expect(cleaningWarning(verbatim, 'So I think we should call the printer tomorrow morning.')).toBeNull();
    expect(cleaningWarning(verbatim, 'Contact the vendor.')).not.toBeNull();
  });
});
