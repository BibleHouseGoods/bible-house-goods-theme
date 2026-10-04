'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Wordmark from '@/components/Wordmark';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'pass' | 'code'>('pass');
  const [recovery, setRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 'pass') {
      setStep('code');
      setTimeout(() => codeRef.current?.focus(), 50);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password, code }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      if (body.usedRecoveryCode) alert(`Recovery code used. ${body.recoveryLeft} left. Generate new ones in Settings.`);
      router.replace('/');
      router.refresh();
    } else {
      setError(body.error ?? 'Sign in failed');
      setCode('');
      if (res.status === 401) {
        setStep('pass');
        setPassword('');
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)]">
      <Wordmark />
      <h1 className="display mt-10 text-[44px] leading-none font-medium">Life OS</h1>
      <p className="mt-3 mb-10 text-[16px] leading-relaxed text-ink-2">Say it once. It’s kept exactly as you said it, and nothing moves until you approve.</p>
      <form onSubmit={submit} className="space-y-3">
        {step === 'pass' ? (
          <input className="field py-3.5" type="password" autoComplete="current-password" placeholder="Passphrase" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus aria-label="Passphrase" />
        ) : (
          <>
            <label className="label" htmlFor="code">{recovery ? 'Recovery code' : 'Code from your authenticator'}</label>
            <input
              id="code"
              ref={codeRef}
              className={`field py-3.5 text-center font-mono ${recovery ? 'text-[18px] tracking-[0.15em] uppercase' : 'text-[24px] tracking-[0.4em]'}`}
              inputMode={recovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              maxLength={recovery ? 11 : 6}
              placeholder={recovery ? 'XXXXX-XXXXX' : '••••••'}
              value={code}
              onChange={(e) => setCode(recovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
              aria-label={recovery ? 'Recovery code' : 'Authenticator code'}
            />
          </>
        )}
        <button className="btn-primary w-full" disabled={busy || (step === 'pass' ? !password : recovery ? code.length < 10 : code.length !== 6)}>
          {busy ? 'Unlocking…' : step === 'pass' ? 'Continue' : 'Unlock'}
        </button>
        {step === 'code' && (
          <div className="flex justify-between pt-1 text-[13px] text-muted">
            <button type="button" onClick={() => { setStep('pass'); setCode(''); }}>Back</button>
            <button type="button" onClick={() => { setRecovery(!recovery); setCode(''); }}>{recovery ? 'Use authenticator code' : 'Use a recovery code'}</button>
          </div>
        )}
        {error && <p className="pt-1 text-center text-[14px] text-danger">{error}</p>}
      </form>
      <p className="mt-16 text-center text-[12px] text-muted">Private · Two-factor protected</p>
    </main>
  );
}
