import Link from 'next/link';
import Icon from './Icon';

export default function PageHeader({
  title,
  eyebrow,
  subtitle,
  back,
  children,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 pt-3">
      {back && (
        <Link href={back.href} className="-ml-1 mb-3 inline-flex items-center gap-1 text-[14px] font-medium text-muted">
          <Icon name="arrowLeft" className="h-4 w-4" strokeWidth={2} />
          {back.label}
        </Link>
      )}
      {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
      <div className="flex items-end justify-between gap-3">
        <h1 className="display min-w-0 text-[34px] leading-[1.05] font-medium text-balance">{title}</h1>
        {children}
      </div>
      {subtitle && <div className="mt-2 text-[15px] leading-snug text-ink-2">{subtitle}</div>}
    </header>
  );
}
