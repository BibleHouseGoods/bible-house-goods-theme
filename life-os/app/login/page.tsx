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
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">Life OS</h1>
      <p className="mb-8 text-stone-500">Private. Single user.</p>
      <form onSubmit={submit} className="space-y-3">
        <input className="field" type="password" autoComplete="current-password" placeholder="Passphrase" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        <button className="btn-primary w-full" disabled={busy || !password}>{busy ? 'Checking…' : 'Unlock'}</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </main>
  );
}
