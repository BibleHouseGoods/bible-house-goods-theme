import PageHeader from '@/components/PageHeader';
import { formatWhen, timeZoneLabel } from '@/components/format';
import Icon from '@/components/Icon';
import SecurityActions from '@/components/SecurityActions';
import { DisconnectGoogle, LogoutButton } from '@/components/SettingsActions';
import { Row } from '@/components/ui';
import { env, envStatus } from '@/lib/env';
import { securityStatus } from '@/lib/auth';
import { getIntegration } from '@/lib/google/auth';
import { recentAudit } from '@/lib/queries';
import { requireOwner } from '@/lib/session';

const OPTIONAL = new Set(['SETUP_TOKEN', 'APP_TIMEZONE', 'OPENAI_TRANSCRIBE_MODEL', 'OPENAI_TEXT_MODEL', 'OPENAI_REASONING_EFFORT', 'GOOGLE_ALLOWED_EMAIL', 'GOOGLE_CALENDAR_ID', 'GOOGLE_DRIVE_ROOT_NAME']);

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${ok ? 'text-success' : 'text-muted'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-success' : 'bg-line-strong'}`} />
      {children}
    </span>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const ownerId = await requireOwner();
  const { google: googleMsg } = await searchParams;
  const status = envStatus();
  const missing = Object.entries(status).filter(([k, ok]) => !ok && !k.startsWith('TODOIST_PROJECT') && !OPTIONAL.has(k));
  let e: ReturnType<typeof env> | null = null;
  try {
    e = env();
  } catch {
    /* shown below */
  }
  const google = e ? await getIntegration(ownerId).catch(() => null) : null;
  const audit = await recentAudit(ownerId).catch(() => []);
  const security = await securityStatus().catch(() => null);
  const areaProjects = (['LIFE', 'CHURCH', 'BIBLE_HOUSE', 'LIBERTY'] as const).filter((a) => status[`TODOIST_PROJECT_${a}`]).length;

  return (
    <>
      <PageHeader eyebrow="Life OS" title="Settings" />
      <div className="space-y-6">
        {missing.length > 0 && (
          <div className="rounded-[22px] bg-bible-house-soft p-5 text-[14px]">
            <p className="font-semibold text-bible-house">Finish setup</p>
            <p className="mt-1 break-words text-ink-2">Missing environment variables: {missing.map(([k]) => k).join(', ')}</p>
          </div>
        )}

        <section>
          <h2 className="eyebrow mb-3 px-1">Connections</h2>
          <div className="card divide-y divide-line">
            <Row
              icon={<Icon name="drive" />}
              title="Google"
              description={google ? (google.meta.email ?? 'Connected') : 'Drive, Calendar and Gmail drafts'}
              control={google ? <DisconnectGoogle /> : <a className="btn-primary min-h-10 px-4 text-[14px]" href="/api/google/connect">Connect</a>}
            >
              {googleMsg && (
                <p className={`rounded-2xl px-4 py-3 text-[13px] ${googleMsg === 'connected' ? 'bg-life-soft text-success' : 'bg-danger/10 text-danger'}`}>
                  {googleMsg === 'connected' ? 'Google connected.' : googleMsg}
                </p>
              )}
            </Row>
            <Row
              icon={<Icon name="task" />}
              title="Todoist"
              description={status.TODOIST_API_TOKEN ? `${areaProjects} of 4 areas mapped to projects. Others go to Inbox.` : 'Set TODOIST_API_TOKEN'}
              control={<Status ok={status.TODOIST_API_TOKEN}>{status.TODOIST_API_TOKEN ? 'Ready' : 'Off'}</Status>}
            />
          </div>
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted">Google access is limited to files Life OS creates, calendar events, and creating Gmail drafts. Life OS can't send email.</p>
        </section>

        <section>
          <h2 className="eyebrow mb-3 px-1">Security</h2>
          <div className="card divide-y divide-line">
            <Row
              icon={<Icon name="lock" />}
              title="Two-factor sign-in"
              description={security?.mfa ? `On since ${formatWhen(security.since, e?.APP_TIMEZONE)} · ${security.recoveryLeft} recovery codes left` : 'Not set up'}
              control={<Status ok={Boolean(security?.mfa)}>{security?.mfa ? 'On' : 'Off'}</Status>}
            >
              {security?.mfa && <SecurityActions />}
            </Row>
          </div>
          <p className="mt-2 px-1 text-[12px] leading-relaxed text-muted">Sign-in needs your passphrase and a code from your authenticator. Eight failed attempts lock sign-in for 15 minutes.</p>
        </section>

        {e && (
          <section>
            <h2 className="eyebrow mb-3 px-1">Processing</h2>
            <div className="card divide-y divide-line py-1 text-[14px]">
              {[
                ['Transcription', e.OPENAI_TRANSCRIBE_MODEL],
                ['Clean and sort', e.OPENAI_TEXT_MODEL],
                ['Time zone', timeZoneLabel(e.APP_TIMEZONE)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <span className="text-ink-2">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="eyebrow mb-3 px-1">Recent activity</h2>
          <div className="card divide-y divide-line py-1">
            {audit.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                <span className="truncate font-mono text-[12px] text-ink-2">{a.action}</span>
                <span className="shrink-0 text-muted">{formatWhen(a.at, e?.APP_TIMEZONE)}</span>
              </div>
            ))}
            {audit.length === 0 && <p className="py-3 text-[13px] text-muted">No activity yet.</p>}
          </div>
        </section>

        <LogoutButton />
      </div>
    </>
  );
}
