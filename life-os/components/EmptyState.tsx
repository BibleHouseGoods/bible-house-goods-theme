import Link from 'next/link';

export default function EmptyState({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <svg viewBox="0 0 120 80" className="mb-5 h-20 w-32 text-line-strong" fill="none" aria-hidden>
        <path d="M10 60c15-25 30-25 45 0s30 25 55-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="30" r="14" className="fill-bible-house-soft" />
        <path d="M53 30l5 5 9-10" className="stroke-bible-house" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <h2 className="display text-[24px] font-medium">{title}</h2>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-ink-2">{body}</p>
      {action && (
        <Link href={action.href} className="btn-primary mt-6">
          {action.label}
        </Link>
      )}
    </div>
  );
}
