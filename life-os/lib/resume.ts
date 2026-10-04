import { LOCK_STALE_MS } from './concurrency';

const RESUMABLE = ['uploaded', 'transcribing', 'cleaning', 'classifying'];

/** Recordings whose pipeline should be (re)started: queued, or a run that timed out. */
export function needsKick(r: { status: string; is_private: boolean; processing_lock: string | null; drive_audio_file_id: string | null }): boolean {
  if (r.is_private || !r.drive_audio_file_id || !RESUMABLE.includes(r.status)) return false;
  return !r.processing_lock || Date.now() - new Date(r.processing_lock).getTime() > LOCK_STALE_MS;
}
