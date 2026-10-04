// Pure text helpers shared by the pipeline (and unit-tested).

/**
 * Split text into sentences without altering any characters: joining the
 * result with a single space reproduces the text modulo whitespace.
 */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);
  for (const p of paragraphs) {
    const flat = p.replace(/\s+/g, ' ').trim();
    if (!flat) continue;
    // Break after . ! ? (optionally followed by quotes/brackets) when the next
    // token starts a new sentence.
    const parts = flat.split(/(?<=[.!?]["'”’)\]]?)\s+(?=["'“‘(\[]?[A-Z0-9])/);
    for (const part of parts) if (part.trim()) out.push(part.trim());
  }
  return out;
}

/** Chunk text on sentence boundaries so each chunk stays under maxChars. */
export function chunkBySentences(text: string, maxChars: number): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let current = '';
  for (const s of sentences) {
    if (current && current.length + s.length + 1 > maxChars) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current} ${s}` : s;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{N}'’]+/gu) ?? []).length;
}

const FILLERS = new Set(['um', 'uh', 'umm', 'uhh', 'er', 'ah', 'hmm', 'mm', 'erm']);

/**
 * Sanity check that cleaning did not rewrite or drop content. Cleaning should
 * only remove fillers, repeats and false starts, so the clean word count should
 * stay close to the verbatim word count minus obvious fillers, and nearly every
 * clean word should appear in the verbatim transcript.
 */
export function cleaningWarning(verbatim: string, clean: string): string | null {
  const vWords = (verbatim.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) ?? []).filter((w) => !FILLERS.has(w));
  const cWords = clean.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) ?? [];
  if (vWords.length === 0) return null;
  const ratio = cWords.length / vWords.length;
  const vocab = new Set(vWords);
  const novel = cWords.filter((w) => !vocab.has(w));
  const novelRatio = cWords.length ? novel.length / cWords.length : 0;
  const issues: string[] = [];
  if (ratio < 0.7) issues.push(`clean transcript is ${Math.round(ratio * 100)}% of the verbatim length`);
  if (ratio > 1.1) issues.push(`clean transcript is longer than the verbatim (${Math.round(ratio * 100)}%)`);
  if (novelRatio > 0.05) issues.push(`${novel.length} words not present in the verbatim transcript`);
  return issues.length ? `Review recommended: ${issues.join('; ')}.` : null;
}
