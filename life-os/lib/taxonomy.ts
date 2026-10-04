export const AREAS = ['life', 'church', 'bible_house', 'liberty'] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  life: 'Life',
  church: 'Church',
  bible_house: 'Bible House',
  liberty: 'Liberty',
};

// Used by the classifier to route items. Edit to describe each area in your words.
export const AREA_HINTS: Record<Area, string> = {
  life: 'Personal life: family, marriage, kids, health, home, finances, friendships, personal growth and devotional life.',
  church: 'Church and ministry: sermons, preaching, teaching, pastoral care, church staff, events, members and church operations.',
  bible_house: 'Bible House Goods, the business: products (e.g. Bible bands), the Shopify store, orders, inventory, suppliers, marketing and customers.',
  liberty: 'Liberty: everything related to Liberty work, people, classes, projects and commitments.',
};

export const CONTENT_TYPES = ['task', 'note', 'idea', 'project', 'meeting', 'reference'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const TYPE_LABELS: Record<ContentType, string> = {
  task: 'Task',
  note: 'Note',
  idea: 'Idea',
  project: 'Project',
  meeting: 'Meeting',
  reference: 'Reference',
};

export function isArea(v: unknown): v is Area {
  return typeof v === 'string' && (AREAS as readonly string[]).includes(v);
}

export function isContentType(v: unknown): v is ContentType {
  return typeof v === 'string' && (CONTENT_TYPES as readonly string[]).includes(v);
}

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'mp4', 'aac', 'webm'] as const;
