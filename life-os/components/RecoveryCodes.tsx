'use client';
import { useState } from 'react';

export default function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <ol className="grid grid-cols-2 gap-2 rounded-2xl bg-sunken p-4 font-mono text-[15px] tracking-wider">
        {codes.map((c) => (
          <li key={c} className="text-center">{c}</li>
        ))}
      </ol>
      <button
        type="button"
        className="btn-secondary mt-3 w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(codes.join('\n')).catch(() => {});
          setCopied(true);
        }}
      >
        {copied ? 'Copied' : 'Copy codes'}
      </button>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-2">
        Save these somewhere safe, like your password manager. Each works once if you lose your phone. They won’t be shown again.
      </p>
    </div>
  );
}
