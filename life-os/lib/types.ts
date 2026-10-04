import type { Area, ContentType } from './taxonomy';

export type RecordingStatus = 'uploading' | 'uploaded' | 'transcribing' | 'cleaning' | 'classifying' | 'ready' | 'private' | 'error';

export interface Recording {
  id: string;
  owner_id: string;
  created_at: string;
  title: string | null;
  recorded_at: string | null;
  source: 'recorder' | 'import';
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  is_private: boolean;
  area: Area | null;
  notes: string | null;
  status: RecordingStatus;
  error: string | null;
  processing_lock: string | null;
  upload_session: string | null;
  upload_offset: number;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  drive_audio_file_id: string | null;
  drive_audio_url: string | null;
  drive_verbatim_file_id: string | null;
  drive_verbatim_url: string | null;
  drive_clean_file_id: string | null;
  drive_clean_url: string | null;
  verbatim_transcript: string | null;
  verbatim_segments: { start: number; end: number; text: string }[] | null;
  transcription_model: string | null;
  transcribed_at: string | null;
  clean_transcript: string | null;
  clean_model: string | null;
  cleaned_at: string | null;
  cleaning_warning: string | null;
  classified_at: string | null;
}

export interface TaskProposal { due_string: string | null; priority: number }
export interface EventProposal { title: string; start: string; end: string | null; all_day: boolean; location: string | null }
export interface EmailProposal { to: string | null; subject: string; body: string }
export interface ItemActions { todoist: boolean; calendar: boolean; email_draft: boolean }

export interface Item {
  id: string;
  owner_id: string;
  recording_id: string;
  position: number;
  created_at: string;
  title: string;
  body: string;
  area: Area;
  content_type: ContentType;
  tags: string[];
  explicit_cue: string | null;
  confidence: number | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_at: string | null;
  task: TaskProposal | null;
  event: EventProposal | null;
  email: EmailProposal | null;
  actions: ItemActions;
}

export interface ItemAction {
  id: string;
  item_id: string;
  kind: 'todoist' | 'calendar' | 'email_draft';
  status: 'done' | 'error';
  external_id: string | null;
  external_url: string | null;
  error: string | null;
  created_at: string;
}
