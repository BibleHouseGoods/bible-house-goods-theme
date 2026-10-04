import 'server-only';
import { audit } from '../audit';
import { LOCK_STALE_MS } from '../concurrency';
import { uploadText } from '../google/drive';
import { db } from '../supabase';
import type { Recording } from '../types';
import { classifyTranscript } from './classify';
import { cleanTranscript } from './clean';
import { transcribeRecording } from './transcribe';


async function update(rec: Recording, patch: Partial<Recording>): Promise<Recording> {
  const { data, error } = await db()
    .from('recordings')
    .update(patch)
    .eq('id', rec.id)
    .eq('owner_id', rec.owner_id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as Recording;
}

async function claim(ownerId: string, id: string): Promise<Recording | null> {
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const { data, error } = await db()
    .from('recordings')
    .update({ processing_lock: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId)
    .or(`processing_lock.is.null,processing_lock.lt.${staleBefore}`)
    .select('*')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Recording) ?? null;
}

function label(rec: Recording): string {
  return rec.title || rec.original_filename.replace(/\.[^.]+$/, '');
}

/**
 * Runs whatever pipeline steps are still missing. Every step is idempotent and
 * persisted, so calling this again after a timeout or error resumes where it
 * stopped. Nothing here touches Todoist, Calendar or email — those only run on
 * approval in the review inbox.
 */
export async function processRecording(ownerId: string, id: string): Promise<Recording> {
  let rec = await claim(ownerId, id);
  if (!rec) {
    const { data } = await db().from('recordings').select('*').eq('id', id).eq('owner_id', ownerId).single();
    return data as Recording; // already being processed
  }

  try {
    if (!rec.drive_audio_file_id) throw new Error('Upload has not finished');

    // Do-not-AI recordings are stored only. No transcription, no cleaning,
    // no classification, nothing sent to any AI service.
    if (rec.is_private) {
      rec = await update(rec, { status: 'private', error: null });
      return rec;
    }

    if (!rec.verbatim_transcript) {
      rec = await update(rec, { status: 'transcribing', error: null });
      const t = await transcribeRecording(rec);
      rec = await update(rec, {
        verbatim_transcript: t.text,
        verbatim_segments: t.segments,
        transcription_model: t.model,
        transcribed_at: new Date().toISOString(),
        duration_seconds: rec.duration_seconds ?? t.duration,
      });
      await audit(ownerId, 'recording.transcribed', { type: 'recording', id }, { model: t.model });
    }

    if (rec.drive_folder_id && !rec.drive_verbatim_file_id && rec.verbatim_transcript) {
      // Stored as plain text so the bytes are exactly the verbatim transcript.
      const f = await uploadText(ownerId, {
        name: `${label(rec)} – verbatim.txt`,
        content: rec.verbatim_transcript,
        parent: rec.drive_folder_id,
      });
      rec = await update(rec, { drive_verbatim_file_id: f.id, drive_verbatim_url: f.webViewLink ?? null });
    }

    const verbatim = rec.verbatim_transcript;
    if (!rec.clean_transcript && verbatim) {
      rec = await update(rec, { status: 'cleaning' });
      const c = await cleanTranscript(verbatim);
      rec = await update(rec, { clean_transcript: c.text, clean_model: c.model, cleaned_at: new Date().toISOString(), cleaning_warning: c.warning });
    }

    if (rec.drive_folder_id && !rec.drive_clean_file_id && rec.clean_transcript) {
      const f = await uploadText(ownerId, {
        name: `${label(rec)} – clean`,
        content: rec.clean_transcript,
        parent: rec.drive_folder_id,
        asGoogleDoc: true,
      });
      rec = await update(rec, { drive_clean_file_id: f.id, drive_clean_url: f.webViewLink ?? null });
    }

    const clean = rec.clean_transcript;
    if (!rec.classified_at && clean) {
      rec = await update(rec, { status: 'classifying' });
      const items = await classifyTranscript(clean, new Date(rec.recorded_at ?? rec.created_at), rec.area);
      // Clear partial results from an interrupted earlier run.
      await db().from('items').delete().eq('recording_id', rec.id).eq('owner_id', ownerId).eq('status', 'pending');
      if (items.length) {
        const rows = items.map((it, i) => ({
          owner_id: ownerId,
          recording_id: rec!.id,
          position: i,
          title: it.title.slice(0, 200),
          body: it.body,
          area: it.area,
          content_type: it.content_type,
          tags: it.tags,
          explicit_cue: it.explicit_cue,
          confidence: it.confidence,
          task: it.task,
          event: it.event,
          email: it.email,
          actions: { todoist: it.content_type === 'task', calendar: Boolean(it.event), email_draft: Boolean(it.email) },
        }));
        const { error } = await db().from('items').insert(rows);
        if (error) throw new Error(error.message);
      }
      rec = await update(rec, { classified_at: new Date().toISOString() });
      await audit(ownerId, 'recording.classified', { type: 'recording', id }, { items: items.length });
    }

    rec = await update(rec, { status: 'ready', error: null });
    return rec;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rec = await update(rec, { status: 'error', error: message.slice(0, 1000) });
    await audit(ownerId, 'recording.error', { type: 'recording', id }, { message: message.slice(0, 300) });
    return rec;
  } finally {
    await db().from('recordings').update({ processing_lock: null }).eq('id', id).eq('owner_id', ownerId);
  }
}
