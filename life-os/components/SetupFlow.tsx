'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import RecoveryCodes from './RecoveryCodes';

type Step = 'passphrase' | 'scan' | 'codes';

export default function SetupFlow({ token }: { token: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('passphrase');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [qr, setQr] = useState<{ qr: string; secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post<T>(url: string, body: object): Promise<T | null> {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? 'Something went wrong');
      return null;
    }
    return json as T;
  }

  const dots = (['passphrase', 'scan', 'codes'] as Step[]).map((s, i) => (
    <span key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-6 bg-ink' : i < ['passphrase', 'scan', 'codes'].indexOf(step) ? 'w-1.5 bg-ink' : 'w-1.5 bg-line-strong'}`} />
  ));

  return (
    <div>
      <div className="mb-6 flex gap-1.5">{dots}</div>

      {step === 'passphrase' && (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pass !== pass2) return setError('Passphrases don’t match.');
            const r = await post<{ qr: string; secret: string; otpauth: string }>('/api/auth/setup/begin', { token, passphrase: pass });
            if (r) {
              setQr(r);
              setStep('scan');
            }
          }}
        >
          <div>
            <h2 className="display text-[26px] font-medium">Choose a passphrase</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">At least 12 characters. A few unrelated words is strong and easy to type, like “cedar lantern quiet harbor”.</p>
          </div>
          <input className="field" type="password" autoComplete="new-password" placeholder="Passphrase" value={pass} onChange={(e) => setPass(e.target.value)} minLength={12} required />
          <input className="field" type="password" autoComplete="new-password" placeholder="Type it again" value={pass2} onChange={(e) => setPass2(e.target.value)} minLength={12} required />
          <button className="btn-primary w-full" disabled={busy || pass.length < 12}>{busy ? 'Saving…' : 'Continue'}</button>
        </form>
      )}

      {step === 'scan' && qr && (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await post<{ recoveryCodes: string[] }>('/api/auth/setup/confirm', { token, code });
            if (r) {
              setCodes(r.recoveryCodes);
              setStep('codes');
            }
          }}
        >
          <div>
            <h2 className="display text-[26px] font-medium">Add two-factor</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">
              Scan with an authenticator app (iPhone Passwords, 1Password, Google Authenticator, Authy). On this phone, tap the link instead.
            </p>
          </div>
          <div className="card flex flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr.qr} alt="Authenticator QR code" className="h-48 w-48" />
            <a href={qr.otpauth} className="btn-secondary min-h-10 w-full text-[14px]">Open in authenticator app</a>
            <details className="w-full text-center text-[13px] text-muted">
              <summary className="cursor-pointer">Enter the key manually</summary>
              <p className="mt-2 font-mono text-[14px] tracking-wider break-all text-ink select-all">{qr.secret.match(/.{1,4}/g)?.join(' ')}</p>
            </details>
          </div>
          <div>
            <label className="label" htmlFor="code">6-digit code from the app</label>
            <input
              id="code"
              className="field text-center font-mono text-[24px] tracking-[0.4em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify and turn on'}</button>
        </form>
      )}

      {step === 'codes' && (
        <div className="space-y-5">
          <div>
            <h2 className="display text-[26px] font-medium">Recovery codes</h2>
            <p className="mt-1 text-[15px] text-ink-2">Two-factor is on. One last thing.</p>
          </div>
          <RecoveryCodes codes={codes} />
          <button className="btn-primary w-full" onClick={() => { router.replace('/'); router.refresh(); }}>
            I’ve saved them. Open Life OS
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-[14px] text-danger">{error}</p>}
    </div>
  );
}
