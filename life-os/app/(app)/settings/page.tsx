import PageHeader from '@/components/PageHeader';
import { formatWhen } from '@/components/format';
import { DisconnectGoogle, LogoutButton } from '@/components/SettingsActions';
import { env, envStatus } from '@/lib/env';
import { getIntegration } from '@/lib/google/auth';
import { recentAudit } from '@/lib/queries';
import { requireOwner } from '@/lib/session';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const ownerId = await requireOwner();
  const { google: googleMsg } = await searchParams;
  const status = envStatus();
  const missing = Object.entries(status).filter(([k, ok]) => !ok && !k.startsWith('TODOIST_PROJECT') && !['APP_TIMEZONE', 'OPENAI_TRANSCRIBE_MODEL', 'OPENAI_TEXT_MODEL', 'OPENAI_REASONING_EFFORT', 'GOOGLE_ALLOWED_EMAIL', 'GOOGLE_CALENDAR_ID', 'GOOGLE_DRIVE_ROOT_NAME'].includes(k));
  let e: ReturnType<typeof env> | null = null;
  try { e = env(); } catch { /* shown below */ }
  const google = e ? await getIntegration(ownerId).catch(() => null) : null;
  const audit = await recentAudit(ownerId).catch(() => []);

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        {missing.length > 0 && (
          <div className="card border-amber-300 text-sm dark:border-amber-800">
            <p className="font-semibold">Missing environment variables</p>
            <p className="mt-1 break-words text-stone-500">{missing.map(([k]) => k).join(', ')}</p>
          </div>
        )}

        <section className="card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Google</p>
              <p className="text-sm text-stone-500">{google ? `Connected${google.meta.email ? ` as ${google.meta.email}` : ''}` : 'Drive, Calendar and Gmail drafts'}</p>
            </div>
            {google ? <DisconnectGoogle /> : <a className="btn-primary" href="/api/google/connect">Connect</a>}
          </div>
          {googleMsg && <p className={`mt-2 text-sm ${googleMsg === 'connected' ? 'text-emerald-700' : 'text-red-600'}`}>{googleMsg === 'connected' ? 'Google connected.' : googleMsg}</p>}
          <p className="mt-2 text-xs text-stone-500">Scopes: files Life OS creates (not your whole Drive), calendar events, and creating Gmail drafts (never sending).</p>
        </section>

        <section className="card text-sm">
          <p className="font-semibold">Todoist</p>
          <p className="text-stone-500">{status.TODOIST_API_TOKEN ? 'API token configured' : 'Set TODOIST_API_TOKEN'}</p>
          <p className="mt-1 text-xs text-stone-500">
            Area projects: {(['LIFE', 'CHURCH', 'BIBLE_HOUSE', 'LIBERTY'] as const).map((a) => `${a.toLowerCase()} ${status[`TODOIST_PROJECT_${a}`] ? '✓' : '→ Inbox'}`).join(' · ')}
          </p>
        </section>

        {e && (
          <section className="card text-sm">
            <p className="font-semibold">Processing</p>
            <dl className="mt-1 grid grid-cols-2 gap-y-1 text-stone-500">
              <dt>Transcription</dt><dd>{e.OPENAI_TRANSCRIBE_MODEL}</dd>
              <dt>Clean + classify</dt><dd>{e.OPENAI_TEXT_MODEL}</dd>
              <dt>Time zone</dt><dd>{e.APP_TIMEZONE}</dd>
            </dl>
          </section>
        )}

        <section className="card text-sm">
          <p className="font-semibold">Recent activity</p>
          <ul className="mt-2 space-y-1 text-xs text-stone-500">
            {audit.map((a, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{a.action}</span>
                <span className="shrink-0">{formatWhen(a.at, e?.APP_TIMEZONE)}</span>
              </li>
            ))}
            {audit.length === 0 && <li>No activity yet.</li>}
          </ul>
        </section>

        <LogoutButton />
      </div>
    </>
  );
}
