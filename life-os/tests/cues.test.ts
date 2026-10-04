import { describe, expect, it } from 'vitest';
import { detectCue, detectCues } from '@/lib/cues';

describe('detectCue', () => {
  it('detects punctuated single-word cues', () => {
    expect(detectCue('Task, call Sam about the van.', 0)).toMatchObject({ type: 'task' });
    expect(detectCue('Note: the roof is leaking.', 0)).toMatchObject({ type: 'note' });
    expect(detectCue('Okay, meeting. We talked budget.', 0)).toMatchObject({ type: 'meeting' });
  });

  it('detects multi-word and area-qualified cues', () => {
    expect(detectCue('Sermon idea about the prodigal son.', 3)).toMatchObject({ sentence: 3, type: 'idea', area: 'church', tags: ['sermon'] });
    expect(detectCue('Bible House task order more band inventory.', 0)).toMatchObject({ type: 'task', area: 'bible_house' });
    expect(detectCue('New task call the printer.', 0)).toMatchObject({ type: 'task' });
    expect(detectCue('Liberty: follow up on the proposal.', 0)).toMatchObject({ area: 'liberty' });
    expect(detectCue('So brainstorm, what if we did a podcast.', 0)).toMatchObject({ type: 'idea', tags: ['brainstorm'] });
  });

  it('ignores ordinary sentences that merely contain cue words', () => {
    expect(detectCue('Note that we should leave early.', 0)).toBeNull();
    expect(detectCue('Book the room for Tuesday.', 0)).toBeNull();
    expect(detectCue('To do this we need more time.', 0)).toBeNull();
    expect(detectCue('Life is busy right now.', 0)).toBeNull();
    expect(detectCue('I went to church on Sunday.', 0)).toBeNull();
  });

  it('finds cues across sentences', () => {
    const cues = detectCues(['Hey.', 'Task, email Joe.', 'Then lunch.', 'Sermon idea grace.']);
    expect(cues.map((c) => c.sentence)).toEqual([1, 3]);
  });
});
