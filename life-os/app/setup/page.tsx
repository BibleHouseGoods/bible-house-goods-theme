import Link from 'next/link';
import SetupFlow from '@/components/SetupFlow';
import Wordmark from '@/components/Wordmark';
import { checkSetupToken, isSetupComplete } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? '';
  let state: 'ok' | 'done' | 'bad' | 'error' = 'bad';
  try {
    if (await isSetupComplete()) state = 'done';
    else if (checkSetupToken(token)) state = 'ok';
  } catch {
    state = 'error';
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-10">
      <Wordmark />
      <p className="eyebrow mt-8 mb-2">Set up Life OS</p>
      {state === 'ok' && <SetupFlow token={token} />}
      {state === 'done' && (
        <div>
          <h1 className="display text-[30px] font-medium">Already set up.</h1>
          <p className="mt-2 text-[15px] text-ink-2">This link no longer does anything.</p>
          <Link href="/login" className="btn-primary mt-6 w-full">Sign in</Link>
        </div>
      )}
      {state === 'bad' && (
        <div>
          <h1 className="display text-[30px] font-medium">Invalid setup link.</h1>
          <p className="mt-2 text-[15px] text-ink-2">Use the exact link you were given, including everything after “token=”.</p>
        </div>
      )}
      {state === 'error' && (
        <div>
          <h1 className="display text-[30px] font-medium">Can’t reach the database.</h1>
          <p className="mt-2 text-[15px] text-ink-2">Check the database environment variables in Vercel, then reload.</p>
        </div>
      )}
    </main>
  );
}
