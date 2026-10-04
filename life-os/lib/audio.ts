import 'server-only';
import { spawn } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

/** OpenAI accepts up to 25 MB per request; stay safely below. */
export const DIRECT_LIMIT_BYTES = 24 * 1024 * 1024;
export const DIRECT_FORMATS = new Set(['mp3', 'm4a', 'wav', 'mp4', 'mpeg', 'mpga', 'webm']);
const SEGMENT_SECONDS = 600;

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg binary not available'));
    const p = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err = (err + d.toString()).slice(-2000)));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err}`))));
  });
}

/**
 * Prepare audio for transcription WITHOUT touching the original (the original
 * stays untouched in Drive). Produces 16 kHz mono MP3 segments of 10 minutes,
 * which keeps every request well under the API size limit while retaining
 * speech fidelity.
 */
export async function segmentForTranscription(input: string, workDir: string): Promise<string[]> {
  await run([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', input,
    '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'libmp3lame', '-b:a', '48k',
    '-f', 'segment', '-segment_time', String(SEGMENT_SECONDS), '-reset_timestamps', '1',
    path.join(workDir, 'part-%03d.mp3'),
  ]);
  const files = (await readdir(workDir)).filter((f) => f.startsWith('part-')).sort();
  for (const f of files) {
    if ((await stat(path.join(workDir, f))).size > DIRECT_LIMIT_BYTES) throw new Error('Segment exceeded size limit');
  }
  return files.map((f) => path.join(workDir, f));
}

export function extOf(filename: string): string {
  return (filename.split('.').pop() ?? '').toLowerCase();
}
