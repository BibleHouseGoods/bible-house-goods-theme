'use client';
import { useState } from 'react';

export default function TranscriptTabs({ clean, verbatim, warning }: { clean: string | null; verbatim: string | null; warning: string | null }) {
  const [tab, setTab] = useState<'clean' | 'verbatim'>(clean ? 'clean' : 'verbatim');
  if (!clean && !verbatim) return null;
  return (
    <div className="card">
      <div className="mb-3 flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold dark:bg-stone-800">
        {(['clean', 'verbatim'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 ${tab === t ? 'bg-white shadow-sm dark:bg-stone-900' : 'text-stone-500'}`} disabled={t === 'clean' ? !clean : !verbatim}>
            {t === 'clean' ? 'Clean' : 'Verbatim'}
          </button>
        ))}
      </div>
      {tab === 'clean' && warning && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">{warning}</p>}
      {tab === 'verbatim' && <p className="mb-3 text-xs text-stone-500">Exactly as transcribed. Never edited.</p>}
      <p className="whitespace-pre-wrap leading-relaxed">{tab === 'clean' ? clean : verbatim}</p>
    </div>
  );
}
