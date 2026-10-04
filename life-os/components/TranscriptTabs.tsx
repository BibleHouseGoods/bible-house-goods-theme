'use client';
import { useState } from 'react';

export default function TranscriptTabs({ clean, verbatim, warning }: { clean: string | null; verbatim: string | null; warning: string | null }) {
  const [tab, setTab] = useState<'clean' | 'verbatim'>(clean ? 'clean' : 'verbatim');
  if (!clean && !verbatim) return null;
  const text = tab === 'clean' ? clean : verbatim;
  return (
    <section className="card">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="eyebrow">Transcript</h2>
        <div className="flex rounded-full bg-sunken p-1 text-[13px] font-semibold" role="tablist">
          {(['clean', 'verbatim'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              disabled={t === 'clean' ? !clean : !verbatim}
              className={`rounded-full px-4 py-1.5 transition disabled:opacity-40 ${tab === t ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
            >
              {t === 'clean' ? 'Clean' : 'Verbatim'}
            </button>
          ))}
        </div>
      </div>
      {tab === 'clean' && warning && <p className="mb-4 rounded-2xl bg-bible-house-soft px-4 py-3 text-[13px] leading-snug text-bible-house">{warning}</p>}
      {tab === 'verbatim' && <p className="mb-4 text-[12px] text-muted">Exactly as transcribed. Locked and never edited.</p>}
      <div className="display space-y-4 text-[18px] leading-[1.65] text-ink [font-variation-settings:'opsz'_14]">
        {(text ?? '').split(/\n\s*\n/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}
