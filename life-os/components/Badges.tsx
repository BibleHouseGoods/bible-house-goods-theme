import { AREA_LABELS, TYPE_LABELS, type Area, type ContentType } from '@/lib/taxonomy';
import Icon from './Icon';

export const AREA_TEXT: Record<Area, string> = {
  life: 'text-life',
  church: 'text-church',
  bible_house: 'text-bible-house',
  liberty: 'text-liberty',
};
export const AREA_BG: Record<Area, string> = {
  life: 'bg-life',
  church: 'bg-church',
  bible_house: 'bg-bible-house',
  liberty: 'bg-liberty',
};
export const AREA_SOFT: Record<Area, string> = {
  life: 'bg-life-soft',
  church: 'bg-church-soft',
  bible_house: 'bg-bible-house-soft',
  liberty: 'bg-liberty-soft',
};

export function AreaDot({ area, className = 'h-2 w-2' }: { area: Area; className?: string }) {
  return <span className={`inline-block shrink-0 rounded-full ${AREA_BG[area]} ${className}`} aria-hidden />;
}

export function AreaBadge({ area }: { area: Area }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${AREA_SOFT[area]} ${AREA_TEXT[area]}`}>
      <AreaDot area={area} className="h-1.5 w-1.5" />
      {AREA_LABELS[area]}
    </span>
  );
}

export function TypeBadge({ type }: { type: ContentType }) {
  return <span className="text-[12px] font-medium text-muted">{TYPE_LABELS[type]}</span>;
}

/** "● Church · Idea" line used at the top of cards. */
export function ItemMeta({ area, type, cue, tags = [] }: { area: Area; type: ContentType; cue?: string | null; tags?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
      <span className={`inline-flex items-center gap-1.5 font-semibold ${AREA_TEXT[area]}`}>
        <AreaDot area={area} />
        {AREA_LABELS[area]}
      </span>
      <span className="text-line-strong">·</span>
      <span className="font-medium text-ink-2">{TYPE_LABELS[type]}</span>
      {cue && cue !== TYPE_LABELS[type].toLowerCase() && <CueBadge cue={cue} />}
      {tags.map((t) => (
        <span key={t} className="text-muted">#{t}</span>
      ))}
    </div>
  );
}

export function PrivateBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold text-paper">
      <Icon name="lock" className="h-3 w-3" strokeWidth={2.2} />
      Private
    </span>
  );
}

export function CueBadge({ cue }: { cue: string }) {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted" title="You said this cue out loud">
      “{cue}”
    </span>
  );
}
