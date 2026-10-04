'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (res.ok) {
      router.replace('/');
      router.refresh();
    } else {
      setError((await res.json().catch(() => ({}))).error ?? 'Sign in failed');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="mb-10 flex items-end gap-[5px]" aria-hidden>
        {[10, 22, 36, 20, 8].map((h, i) => (
          <span key={i} className={`w-[5px] rounded-full ${i === 4 ? 'bg-bible-house' : 'bg-ink'}`} style={{ height: h }} />
        ))}
      </div>
      <h1 className="display text-[44px] leading-none font-medium">Life OS</h1>
      <p className="mt-3 mb-10 text-[16px] leading-relaxed text-ink-2">Say it once. It's kept exactly as you said it, and nothing moves until you approve.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="field py-3.5" type="password" autoComplete="current-password" placeholder="Passphrase" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus aria-label="Passphrase" />
        <button className="btn-primary w-full" disabled={busy || !password}>
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
        {error && <p className="pt-1 text-center text-[14px] text-danger">{error}</p>}
      </form>
      <p className="mt-16 text-center text-[12px] text-muted">Private · Single user</p>
    </main>
  );
}
