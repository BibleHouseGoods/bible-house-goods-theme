import 'server-only';
import { mapLimit } from '../concurrency';
import { env } from '../env';
import { openai } from '../openai';
import { chunkBySentences, cleaningWarning } from '../text';

const SYSTEM = `You produce a CLEAN READ of a verbatim speech transcript.

You may ONLY:
- remove filler sounds and filler words used as filler (um, uh, er, hmm, "like" / "you know" / "I mean" / "sort of" / "kind of" ONLY when they carry no meaning),
- remove false starts, stutters and immediate word repetitions ("I- I think", "the the"),
- remove abandoned fragments that the speaker immediately restarts,
- fix punctuation, capitalization and paragraph breaks.

You must NEVER:
- paraphrase, summarize, shorten, reorder or "improve" wording,
- replace the speaker's words with synonyms or fix their grammar or dialect,
- add any words, headings, labels, commentary or explanations,
- remove content, opinions, names, numbers, Scripture references, emotion, humor or anything uncertain,
- remove spoken cue words such as "task", "sermon idea", "book", "brainstorm", "meeting", "note", "project", "idea", "reference", "church", "Bible House", "Liberty".

If unsure whether something is filler, KEEP IT. Preserve the speaker's voice exactly.
Return only the cleaned text.`;

export async function cleanTranscript(verbatim: string): Promise<{ text: string; model: string; warning: string | null }> {
  const e = env();
  const chunks = chunkBySentences(verbatim, 8000);
  const cleaned = await mapLimit(chunks, 4, async (chunk) => {
    const res = await openai().chat.completions.create({
      model: e.OPENAI_TEXT_MODEL,
      ...(e.OPENAI_REASONING_EFFORT ? { reasoning_effort: e.OPENAI_REASONING_EFFORT } : {}),
      store: false,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: chunk },
      ],
    });
    const out = res.choices[0]?.message?.content?.trim();
    if (!out) throw new Error('Cleaning returned no text');
    return out;
  });
  const text = cleaned.join('\n\n');
  return { text, model: e.OPENAI_TEXT_MODEL, warning: cleaningWarning(verbatim, text) };
}
