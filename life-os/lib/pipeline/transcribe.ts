import 'server-only';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toFile } from 'openai';
import { mapLimit } from '../concurrency';
import { DIRECT_FORMATS, DIRECT_LIMIT_BYTES, extOf, segmentForTranscription } from '../audio';
import { env } from '../env';
import { downloadBuffer, downloadToFile } from '../google/drive';
import { openai } from '../openai';
import type { Recording } from '../types';

// A prompt written in a disfluent style nudges Whisper to keep fillers, false
// starts and repetitions instead of silently tidying them. It is a style hint
// only; it never adds words to the transcript.
const VERBATIM_PROMPT =
  'Umm, so, uh, I- I was thinking, like, hmm... okay. You know, we- we should, uh, maybe. ' +
  'Bible House, Liberty, Todoist, sermon idea, task, brainstorm.';

const TMP_LIMIT_BYTES = 450 * 1024 * 1024;

interface Segment {
  start: number;
  end: number;
  text: string;
}

async function transcribeOne(data: Buffer, filename: string, model: string): Promise<{ text: string; segments: Segment[]; duration: number | null }> {
  const verbose = model === 'whisper-1';
  const file = await toFile(data, filename);
  const res = (await openai().audio.transcriptions.create({
    file,
    model,
    prompt: VERBATIM_PROMPT,
    temperature: 0,
    response_format: verbose ? 'verbose_json' : 'json',
    ...(verbose ? { timestamp_granularities: ['segment'] as ('segment' | 'word')[] } : {}),
  })) as unknown as { text: string; duration?: number; segments?: { start: number; end: number; text: string }[] };
  return {
    text: res.text,
    segments: (res.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text })),
    duration: res.duration ?? null,
  };
}

export async function transcribeRecording(rec: Recording): Promise<{ text: string; segments: Segment[]; model: string; duration: number | null }> {
  if (!rec.drive_audio_file_id) throw new Error('Audio is not in Drive yet');
  const model = env().OPENAI_TRANSCRIBE_MODEL;
  const ext = extOf(rec.original_filename);

  // Small files in a supported format go straight through, byte-for-byte.
  if (rec.size_bytes <= DIRECT_LIMIT_BYTES && DIRECT_FORMATS.has(ext)) {
    const buf = await downloadBuffer(rec.owner_id, rec.drive_audio_file_id);
    const r = await transcribeOne(buf, rec.original_filename, model);
    return { ...r, model };
  }

  // Larger files: download to temp storage, derive 10-minute speech segments,
  // transcribe them in parallel and stitch the results in order.
  if (rec.size_bytes > TMP_LIMIT_BYTES) {
    throw new Error('Recording is larger than 450 MB. Export it as MP3/M4A (or split it) and import again.');
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lifeos-'));
  try {
    const input = path.join(dir, `original.${ext || 'bin'}`);
    await downloadToFile(rec.owner_id, rec.drive_audio_file_id, input);
    const parts = await segmentForTranscription(input, dir);
    await rm(input, { force: true });
    const results = await mapLimit(parts, 4, async (p) => transcribeOne(await readFile(p), path.basename(p), model));

    let offset = 0;
    const segments: Segment[] = [];
    for (const r of results) {
      for (const s of r.segments) segments.push({ start: s.start + offset, end: s.end + offset, text: s.text });
      offset += r.duration ?? 600;
    }
    // Join chunk texts with a single space; nothing else is altered.
    const text = results.map((r) => r.text.trim()).filter(Boolean).join(' ');
    return { text, segments, model, duration: offset || null };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
