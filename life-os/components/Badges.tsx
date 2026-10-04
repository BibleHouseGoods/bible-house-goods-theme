import { AREA_LABELS, TYPE_LABELS, type Area, type ContentType } from '@/lib/taxonomy';

const AREA_STYLES: Record<Area, string> = {
  life: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  church: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  bible_house: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  liberty: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
};

export function AreaBadge({ area }: { area: Area }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${AREA_STYLES[area]}`}>{AREA_LABELS[area]}</span>;
}

export function TypeBadge({ type }: { type: ContentType }) {
  return (
    <span className="rounded-full border border-stone-300 px-2 py-0.5 text-xs font-medium text-stone-600 dark:border-stone-700 dark:text-stone-300">
      {TYPE_LABELS[type]}
    </span>
  );
}

export function PrivateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-stone-100 dark:text-stone-900">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      Private
    </span>
  );
}

export function CueBadge({ cue }: { cue: string }) {
  return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-300">cue: “{cue}”</span>;
}
