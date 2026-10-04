'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Keeps the inbox fresh while recordings are in flight, and kicks off
 * processing for uploads that are queued but not running (e.g. the app was
 * closed right after upload).
 */
export default function ProcessingWatcher({ queued, active }: { queued: string[]; active: number }) {
  const router = useRouter();
  const kicked = useRef(new Set<string>());

  useEffect(() => {
    for (const id of queued) {
      if (kicked.current.has(id)) continue;
      kicked.current.add(id);
      fetch(`/api/recordings/${id}/process`, { method: 'POST' })
        .catch(() => {})
        .finally(() => router.refresh());
    }
  }, [queued, router]);

  useEffect(() => {
    if (active === 0) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [active, router]);

  return null;
}
