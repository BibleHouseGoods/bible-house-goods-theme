'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from './Icon';

export default function ItemQuickActions({ id }: { id: string }) {
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
    <>
      <div className="flex gap-2">
        <button className="btn-primary min-h-11 flex-1" disabled={busy !== null} onClick={() => act('approve')}>
          <Icon name="check" className="h-[18px] w-[18px]" strokeWidth={2.2} />
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button className="btn-secondary min-h-11 px-4" disabled={busy !== null} onClick={() => act('reject')} aria-label="Reject">
          <Icon name="x" className="h-[18px] w-[18px]" strokeWidth={2} />
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </>
  );
}
