'use client';
import { useRouter } from 'next/navigation';
import Icon from './Icon';

export function DisconnectGoogle() {
  const router = useRouter();
  return (
    <button
      className="btn-ghost min-h-9 px-3 text-[13px] text-danger"
      onClick={async () => {
        if (!confirm('Disconnect Google? Uploads and approvals that need Drive, Calendar or Gmail will stop until you reconnect.')) return;
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
      <Icon name="lock" className="h-[18px] w-[18px]" />
      Lock Life OS
    </button>
  );
}
