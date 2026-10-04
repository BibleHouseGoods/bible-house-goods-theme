'use client';
import { useState } from 'react';
import RecoveryCodes from './RecoveryCodes';

export default function SecurityActions() {
  const [mode, setMode] = useState<null | 'passphrase' | 'codes'>(null);
  const [current, setCurrent] = useState('');
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setCurrent(''); setCode(''); setNext(''); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const url = mode === 'passphrase' ? '/api/auth/security/passphrase' : '/api/auth/security/recovery-codes';
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ current, code, next }) });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: body.error ?? 'Failed' });
    reset();
    if (mode === 'codes') setCodes(body.recoveryCodes);
    else { setMsg({ ok: true, text: 'Passphrase changed.' }); setMode(null); }
  }

  if (codes) return <div className="pt-1"><RecoveryCodes codes={codes} /><button className="btn-ghost mt-2 w-full" onClick={() => { setCodes(null); setMode(null); }}>Done</button></div>;

  return (
    <div className="space-y-3">
      {!mode && (
        <div className="flex gap-2">
          <button className="btn-secondary min-h-10 flex-1 text-[14px]" onClick={() => setMode('passphrase')}>Change passphrase</button>
          <button className="btn-secondary min-h-10 flex-1 text-[14px]" onClick={() => setMode('codes')}>New recovery codes</button>
        </div>
      )}
      {mode && (
        <form onSubmit={submit} className="space-y-2">
          <input className="field" type="password" autoComplete="current-password" placeholder="Current passphrase" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          <input className="field font-mono tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Authenticator code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} required />
          {mode === 'passphrase' && <input className="field" type="password" autoComplete="new-password" minLength={12} placeholder="New passphrase (12+ characters)" value={next} onChange={(e) => setNext(e.target.value)} required />}
          <div className="flex gap-2">
            <button className="btn-primary min-h-10 flex-1 text-[14px]" disabled={busy}>{busy ? 'Checking…' : mode === 'passphrase' ? 'Change passphrase' : 'Generate codes'}</button>
            <button type="button" className="btn-ghost min-h-10 text-[14px]" onClick={() => { setMode(null); reset(); setMsg(null); }}>Cancel</button>
          </div>
          {mode === 'codes' && <p className="text-[12px] text-muted">Your old recovery codes stop working.</p>}
        </form>
      )}
      {msg && <p className={`text-[13px] ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
    </div>
  );
}
