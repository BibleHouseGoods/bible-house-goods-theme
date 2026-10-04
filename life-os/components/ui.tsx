import type { ReactNode } from 'react';

/** iOS-style switch built on a real checkbox (accessible, form-friendly). */
export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className={`relative inline-flex h-[30px] w-[50px] shrink-0 cursor-pointer items-center ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span className="absolute inset-0 rounded-full bg-line-strong transition peer-checked:bg-ink peer-focus-visible:ring-4 peer-focus-visible:ring-ink/15" />
      <span className="absolute left-[3px] h-6 w-6 rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform peer-checked:translate-x-5" />
    </label>
  );
}

export function Row({ icon, title, description, control, children }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; control?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink-2">{icon}</span>}
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">{title}</div>
          {description && <div className="text-[13px] leading-snug text-muted">{description}</div>}
        </div>
        {control}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function Chip({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition active:scale-[0.97] disabled:opacity-50 ${
        active ? 'bg-ink text-paper' : 'border border-line bg-surface text-ink-2'
      }`}
    >
      {children}
    </button>
  );
}

const STEPS = [
  { key: 'uploading', label: 'Upload' },
  { key: 'transcribing', label: 'Transcribe' },
  { key: 'cleaning', label: 'Clean' },
  { key: 'classifying', label: 'Sort' },
];
const ORDER = ['uploading', 'uploaded', 'transcribing', 'cleaning', 'classifying', 'ready'];

/** Four-bar pipeline progress: done = ink, current = amber pulse, ahead = dot. */
export function Stepper({ status }: { status: string }) {
  const idx = ORDER.indexOf(status);
  return (
    <ol className="flex items-center gap-1" aria-label="Processing progress">
      {STEPS.map((s) => {
        const si = ORDER.indexOf(s.key);
        const done = idx > si;
        const active = idx === si;
        return (
          <li
            key={s.key}
            title={s.label}
            className={`h-1.5 rounded-full transition-all duration-500 ${done ? 'w-5 bg-ink' : active ? 'w-5 animate-pulse bg-bible-house' : 'w-1.5 bg-line-strong'}`}
          />
        );
      })}
    </ol>
  );
}
