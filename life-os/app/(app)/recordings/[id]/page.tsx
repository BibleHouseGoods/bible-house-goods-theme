import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AreaBadge, PrivateBadge } from '@/components/Badges';
import { formatBytes, formatDuration, formatWhen, STATUS_LABELS } from '@/components/format';
import ItemCard from '@/components/ItemCard';
import PageHeader from '@/components/PageHeader';
import ProcessingWatcher from '@/components/ProcessingWatcher';
import RecordingControls from '@/components/RecordingControls';
import TranscriptTabs from '@/components/TranscriptTabs';
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
  const links = [
    ['Drive folder', rec.drive_folder_url],
    ['Original audio', rec.drive_audio_url],
    ['Verbatim (.txt)', rec.drive_verbatim_url],
    ['Clean (Doc)', rec.drive_clean_url],
  ].filter(([, url]) => url) as [string, string][];

  return (
    <>
      <PageHeader
        title={rec.title || rec.original_filename}
        subtitle={[formatWhen(rec.recorded_at ?? rec.created_at, tz), formatDuration(rec.duration_seconds), formatBytes(rec.size_bytes)].filter(Boolean).join(' · ')}
      />
      <ProcessingWatcher queued={needsKick(rec) ? [rec.id] : []} active={IN_FLIGHT.includes(rec.status) ? 1 : 0} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {rec.is_private && <PrivateBadge />}
        {rec.area && <AreaBadge area={rec.area} />}
        <span className={rec.status === 'error' ? 'text-red-600' : 'text-stone-500'}>{STATUS_LABELS[rec.status]}</span>
      </div>
      {rec.error && <p className="card mb-4 border-red-200 text-sm text-red-700 dark:border-red-900 dark:text-red-400">{rec.error}</p>}

      {rec.drive_audio_file_id && (
        <audio controls preload="none" className="mb-4 w-full" src={`/api/recordings/${rec.id}/audio`} />
      )}

      {links.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {links.map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="rounded-full border border-stone-300 px-3 py-1 dark:border-stone-700">
              {label} ↗
            </a>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <section className="mb-6">
          <h2 className="label">Items</h2>
          <div className="space-y-3">
            {items.map((it) => (
              <div key={it.id} className={it.status === 'rejected' ? 'opacity-50' : ''}>
                <ItemCard item={it} quick />
                {it.status !== 'pending' && <p className="mt-1 px-1 text-xs text-stone-500">{it.status === 'approved' ? 'Approved' : 'Rejected'}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mb-6">
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

      <p className="mt-6 text-center text-xs text-stone-500">
        <Link href="/">← Back to inbox</Link>
      </p>
    </>
  );
}
