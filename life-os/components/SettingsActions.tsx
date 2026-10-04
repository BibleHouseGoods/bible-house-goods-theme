'use client';
import { useRouter } from 'next/navigation';

export function DisconnectGoogle() {
  const router = useRouter();
  return (
    <button
      className="btn-secondary"
      onClick={async () => {
        if (!confirm('Disconnect Google? Uploads and approvals that need Drive, Calendar or Gmail will stop working until you reconnect.')) return;
        await fetch('/api/google/disconnect', { method: 'POST' });
        router.refresh();
      }}
    >
      Disconnect
    </button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn-secondary w-full"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.replace('/login');
      }}
    >
      Lock Life OS
    </button>
  );
}
