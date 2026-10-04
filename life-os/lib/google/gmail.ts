import 'server-only';
import { googleJson } from './auth';

export interface DraftInput {
  to: string | null;
  subject: string;
  body: string;
}

function encodeHeader(v: string): string {
  // RFC 2047 for non-ASCII subjects
  return /^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`;
}

/** Creates a Gmail draft. Never sends. */
export async function createDraft(ownerId: string, d: DraftInput): Promise<{ id: string; url: string }> {
  const lines = [
    d.to ? `To: ${d.to.replace(/[\r\n]/g, '')}` : null,
    `Subject: ${encodeHeader(d.subject.replace(/[\r\n]/g, ' '))}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(d.body, 'utf8').toString('base64'),
  ].filter((l) => l !== null);
  const raw = Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
  const res = await googleJson<{ id: string; message: { id: string } }>(ownerId, 'https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  return { id: res.id, url: `https://mail.google.com/mail/u/0/#drafts?compose=${res.message.id}` };
}
