export function formatWhen(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', { timeZone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${r}s` : `${r}s`;
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const STATUS_LABELS: Record<string, string> = {
  uploading: 'Uploading',
  uploaded: 'Queued',
  transcribing: 'Transcribing',
  cleaning: 'Cleaning transcript',
  classifying: 'Sorting into items',
  ready: 'Ready',
  private: 'Private — stored only',
  error: 'Needs attention',
};
