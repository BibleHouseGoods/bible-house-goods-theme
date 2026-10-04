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

export function todayLabel(timeZone: string): string {
  return new Date().toLocaleDateString('en-US', { timeZone, weekday: 'long', month: 'long', day: 'numeric' });
}

export function greeting(timeZone: string): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(new Date()));
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** "Chicago · CDT" */
export function timeZoneLabel(timeZone: string): string {
  const city = timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
  const abbr = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value;
  return abbr ? `${city} · ${abbr}` : city;
}
