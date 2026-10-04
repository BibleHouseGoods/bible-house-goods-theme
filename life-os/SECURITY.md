# Security

Life OS is designed with strong security from day one. This document describes what is actually in place, what it relies on, and what it does **not** claim.

## What is in place (V1)

### Encryption
| | How |
|---|---|
| In transit | HTTPS everywhere. Vercel terminates TLS (TLS 1.2+, TLS 1.3 negotiated by modern clients) and HSTS is set with a 2-year max-age. All calls to Supabase, OpenAI, Google and Todoist are HTTPS. |
| At rest: database | Supabase (Postgres on AWS) encrypts disks with AES-256. |
| At rest: files | Google Drive encrypts stored files with AES-256. |
| At rest: app secrets | The Google refresh token and in-flight Drive upload-session URLs are additionally encrypted by the app with **AES-256-GCM** before being written to the database. The key (`ENCRYPTION_KEY`) exists only in Vercel's encrypted environment variables. |

### Secrets never reach the browser
- Every key (Supabase service role, OpenAI, Google client secret, Todoist, session and encryption keys) is read only in server code (`lib/env.ts`, imported with `server-only` so a bundling mistake fails the build).
- No variable is prefixed `NEXT_PUBLIC_`.
- The browser never talks to Supabase, OpenAI, Todoist or Google APIs directly. Audio uploads are proxied in chunks so even the Drive upload-session URL stays server-side.
- Audio playback is streamed through the app, so Drive file access never relies on public sharing links.

### Access control
- **Single user, no sign-ups.** One passphrase, stored only as a salted **scrypt** hash. Failed logins are delayed and audited.
- Sessions are signed (HS256) httpOnly, Secure, SameSite=Lax cookies; 30-day expiry.
- `proxy.ts` blocks every page and API route without a valid session, and rejects state-changing API requests whose `Origin` isn't the app (CSRF defence).
- Google: only the account in `GOOGLE_ALLOWED_EMAIL` can be connected. Scopes are minimal: `drive.file` (Life OS sees only files it created, not your whole Drive), `calendar.events`, and `gmail.compose` (create drafts; the app has no code path that sends mail).

### Data isolation
- Postgres: every table has Row Level Security **enabled and forced**, and all grants are revoked from `anon`/`authenticated`. The public API keys cannot read or write anything.
- Every row carries an `owner_id`, and every server query filters by it. Owner-scoped RLS policies (`owner_id = auth.uid()`) are already written, so if Life OS ever serves more than one person, per-user isolation is enforced by the database from the first row, with no data migration.

### Integrity of what you said
- The original audio is stored in Drive unmodified. Transcription works on a temporary derived copy.
- The verbatim transcript is write-once: a database trigger rejects any change after it is first saved (and to the original audio reference).
- Item text is never AI-written: it is rebuilt from the transcript's own sentences.
- Nothing external (Todoist, Calendar, email) happens without an explicit Approve, and each action runs at most once per item.

### Private recordings
Marked private, a recording is never sent to OpenAI or any other AI service. That's enforced in the pipeline and recorded in the audit log.

### Audit log
`audit_events` records sign-ins (including failures, with IP), uploads, processing, approvals with external ids, privacy changes, Google connect/disconnect and deletions. The latest events show in Settings.

### Headers
CSP (`default-src 'self'`, `frame-ancestors 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, permissions policy (microphone limited to this site), `noindex`.

## What it relies on
- Vercel, Supabase, Google and OpenAI's own security and their encryption at rest.
- OpenAI API data is not used for training by default. Life OS sets `store: false` on text requests. Ask OpenAI about Zero Data Retention if you need it.
- You keeping the passphrase strong (12+ characters; a long passphrase is best) and the Vercel/Supabase/Google accounts protected with 2FA.

## What it does not claim
**Life OS is not "HIPAA compliant", and this document should not be read as saying so.** HIPAA isn't a technical spec. It's a compliance program: risk assessments, written policies, workforce training, breach procedures, and signed Business Associate Agreements with every vendor that touches protected data (hosting, database, storage, AI). None of that has been done here. Strong technical controls are necessary but not sufficient. Don't make that claim unless the whole setup is formally reviewed.

For sensitive pastoral or personal material, use **Private** recordings: they never leave your Drive.

## Recommended hardening (operator checklist)
- [ ] Turn on 2FA on Vercel, Supabase, Google, OpenAI and Todoist.
- [ ] Mark all Vercel env vars "Sensitive"; restrict Vercel team access.
- [ ] Optionally put Vercel Deployment Protection or a custom domain behind Vercel's firewall rules.
- [ ] Rotate `SESSION_SECRET` to sign out all sessions; rotate the OpenAI and Todoist keys periodically.
- [ ] Rotating `ENCRYPTION_KEY` requires reconnecting Google (the stored token can't be decrypted with a new key).
- [ ] Enable Supabase Point-in-Time Recovery and Drive backups if you need recoverability.

## Reporting
This is a personal project. If you notice a problem, open a private issue or contact the owner directly.
