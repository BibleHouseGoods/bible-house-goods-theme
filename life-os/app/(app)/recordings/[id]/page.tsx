import { notFound } from 'next/navigation';
import { AreaBadge, PrivateBadge } from '@/components/Badges';
import { formatBytes, formatDuration, formatWhen, STATUS_LABELS } from '@/components/format';
import Icon from '@/components/Icon';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import ProcessingWatcher from '@/components/ProcessingWatcher';
import RecordingControls from '@/components/RecordingControls';
import TranscriptTabs from '@/components/TranscriptTabs';
import { Stepper } from '@/components/ui';
import { env } from '@/lib/env';
import { getRecording, recordingItems } from '@/lib/queries';
import { needsKick } from '@/lib/resume';
import { requireOwner } from '@/lib/session';

const IN_FLIGHT = ['uploading', 'uploaded', 'transcribing', 'cleaning', 'classifying'];

export default async function RecordingPage({ params }: { params: Promise<{ id: string }> }) {
  const ownerId = await requireOwner();
  const { id } = await params;
  const rec = await getRecording(ownerId, id);
  if (!rec) notFound();
  const items = await recordingItems(ownerId, id);
  const tz = env().APP_TIMEZONE;
  const inFlight = IN_FLIGHT.includes(rec.status);
  const links = [
    ['Folder', rec.drive_folder_url],
    ['Original audio', rec.drive_audio_url],
    ['Verbatim', rec.drive_verbatim_url],
    ['Clean doc', rec.drive_clean_url],
  ].filter(([, url]) => url) as [string, string][];

  return (
    <>
      <PageHeader
        back={{ href: '/', label: 'Inbox' }}
        eyebrow={[formatWhen(rec.recorded_at ?? rec.created_at, tz), formatDuration(rec.duration_seconds), formatBytes(rec.size_bytes)].filter(Boolean).join(' · ')}
        title={rec.title || rec.original_filename.replace(/\.[^.]+$/, '')}
      />
      <ProcessingWatcher queued={needsKick(rec) ? [rec.id] : []} active={inFlight ? 1 : 0} />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {rec.is_private && <PrivateBadge />}
        {rec.area && <AreaBadge area={rec.area} />}
        {(inFlight || rec.status === 'error') && (
          <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${rec.status === 'error' ? 'text-danger' : 'text-ink-2'}`}>
            {inFlight && <Stepper status={rec.status} />}
            {STATUS_LABELS[rec.status]}
          </span>
        )}
      </div>
      {rec.error && <p className="mb-5 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] leading-snug text-danger">{rec.error}</p>}

      {rec.drive_audio_file_id && (
        <section className="card mb-4 p-3">
          <audio controls preload="none" className="h-11 w-full" src={`/api/recordings/${rec.id}/audio`} />
        </section>
      )}

      {links.length > 0 && (
        <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {links.map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[13px] font-medium text-ink-2">
              <Icon name="drive" className="h-4 w-4" />
              {label}
            </a>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow mb-3">
            {items.length} {items.length === 1 ? 'item' : 'items'} from this recording
          </h2>
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className={it.status === 'rejected' ? 'opacity-45' : ''}>
                <ItemCard
                  item={it}
                  quick
                  footer={
                    it.status !== 'pending' ? (
                      <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${it.status === 'approved' ? 'text-success' : 'text-muted'}`}>
                        <Icon name={it.status === 'approved' ? 'check' : 'x'} className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {it.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    ) : undefined
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-8">
        <TranscriptTabs clean={rec.clean_transcript} verbatim={rec.verbatim_transcript} warning={rec.cleaning_warning} />
      </div>

      <RecordingControls
        id={rec.id}
        status={rec.status}
        isPrivate={rec.is_private}
        hasTranscript={Boolean(rec.verbatim_transcript)}
        notes={rec.notes}
        area={rec.area}
        title={rec.title}
      />
    </>
  );
}
