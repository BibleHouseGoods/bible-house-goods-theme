'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ItemQuickActions({ id, summary }: { id: string; summary: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | 'approve' | 'reject'>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(kind: 'approve' | 'reject') {
    setBusy(kind);
    setError(null);
    const res = await fetch(`/api/items/${id}/${kind}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || body.ok === false) setError(body.errors?.join('; ') ?? body.error ?? 'Failed');
    router.refresh();
  }

  return (
    <div className="mt-3">
      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={busy !== null} onClick={() => act('approve')}>
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button className="btn-secondary" disabled={busy !== null} onClick={() => act('reject')}>
          {busy === 'reject' ? '…' : 'Reject'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-stone-500">{summary}</p>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
