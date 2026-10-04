import BottomNav from '@/components/BottomNav';
import { requireOwner } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <>
      <main className="mx-auto max-w-xl px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]">{children}</main>
      <BottomNav />
    </>
  );
}
