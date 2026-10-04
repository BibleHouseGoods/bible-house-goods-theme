const PATHS = {
  inbox: 'M3 13h4.5l1.5 3h6l1.5-3H21M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z',
  areas: 'M4 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM13 5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zM4 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM13 14a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4.6-4.6',
  settings: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 10h16M8.5 3v4M15.5 3v4',
  mail: 'M4 6h16v12H4zM4.5 6.5 12 13l7.5-6.5',
  task: 'M4 12.5l3 3 6-6M15 8h5M15 13h5M4 19h16',
  drive: 'M8.5 4h7l5 8.5-3.5 6H7l-3.5-6zM8.5 4l5 8.5M15.5 4l-5 8.5M3.5 12.5h17',
  arrowLeft: 'M15 5l-7 7 7 7',
  arrowRight: 'M9 5l7 7-7 7',
  external: 'M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4',
  sparkle: 'M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M6.5 17.5 9 15M15 9l2.5-2.5',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13',
  wave: 'M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2',
  retry: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4',
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.7 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
