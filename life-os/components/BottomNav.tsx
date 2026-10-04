'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon, { type IconName } from './Icon';

const tabs: { href: string; label: string; icon: IconName; primary?: boolean }[] = [
  { href: '/', label: 'Inbox', icon: 'inbox' },
  { href: '/areas', label: 'Areas', icon: 'areas' },
  { href: '/capture', label: 'Capture', icon: 'mic', primary: true },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function BottomNav() {
  const path = usePathname();
  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 pb-[max(env(safe-area-inset-bottom),8px)]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-paper via-paper/95 to-paper/0" />
      <div className="relative mx-auto max-w-md px-4">
      <ul className="flex items-center justify-between rounded-full border border-line bg-surface/85 px-2 py-1.5 shadow-float backdrop-blur-xl">
        {tabs.map((t) => {
          const active = isActive(t.href);
          if (t.primary) {
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-label={t.label}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-paper shadow-[0_8px_20px_-6px_rgb(31_28_23/0.55)] transition active:scale-95"
                >
                  <Icon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={2} />
                </Link>
              </li>
            );
          }
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold tracking-wide transition ${active ? 'text-ink' : 'text-muted'}`}
              >
                <Icon name={t.icon} className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.6} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
      </div>
    </nav>
  );
}
