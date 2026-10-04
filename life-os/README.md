# Life OS

A private, mobile-first web app for one person: capture voice → verbatim transcript → clean transcript → items sorted by meaning → **you approve** → Todoist / Google Calendar / Gmail drafts. Google Drive is the long-term store; Supabase holds metadata and links.

Built with Next.js 16 (App Router), TypeScript, Tailwind, Supabase, OpenAI, deployed on Vercel.

## How it works

```
 iPhone (Safari / home-screen app)
   │  Record (MediaRecorder) or Import MP3/M4A/WAV from a USB-C recorder via Files
   ▼
 /api/recordings ── creates a Drive folder + resumable upload session (server-side)
   │  audio streamed in 4 MB chunks through the app → Google Drive (original, untouched)
   ▼
 Pipeline (/api/recordings/:id/process, resumable, idempotent)
   1. Private?  → stop. Stored only. Nothing sent to any AI.
   2. Verbatim transcript (OpenAI) → written once, DB trigger blocks any edit
                                   → saved to Drive as exact .txt
   3. Clean transcript (fillers, false starts removed; meaning & voice kept)
                                   → saved to Drive as a Google Doc
                                   → automatic word-level check flags over-editing
   4. Classification: split by meaning into items, routed to an area + type.
      Spoken cues ("task", "sermon idea", "Bible House note"…) are detected in
      code and are hard rules. Item text = exact transcript sentences.
   ▼
 Review inbox — nothing external happens here until you tap Approve
   ▼
 Approve → Todoist task · Google Calendar event · Gmail draft (never sent)
```

**Areas:** Life · Church · Bible House · Liberty
**Types:** Task · Note · Idea · Project · Meeting · Reference

### Explicit cues

Start a thought with a cue and it always becomes its own item with that type:

| Say | Becomes |
|---|---|
| "Task, call Sam about the van" | Task |
| "Sermon idea, the lost coin…" | Church · Idea · #sermon |
| "Bible House task: reorder bands" | Bible House · Task |
| "Book: *Gentle and Lowly*" | Reference · #book |
| "Brainstorm, what if…" | Idea · #brainstorm |
| "Meeting with the elders…" | Meeting |
| "Liberty: follow up on…" | Liberty (type decided by AI) |

Single words like "note", "book", "project" only count when followed by punctuation (a pause), so "note that…" or "book the room" are not mistaken for cues. Edit `lib/cues.ts` to match how you talk, and `lib/taxonomy.ts` (`AREA_HINTS`) to describe each area.

### Private / do-not-AI

Tick **Private** at capture (or later, on the recording). Audio goes to your Drive and nowhere else: no transcription, cleaning or classification. Add your own notes so you can find it. "Allow AI processing" is an explicit, confirmed action.

## Setup

### 1. Supabase
1. Create a project.
2. SQL editor → run `supabase/migrations/0001_init.sql` (or `supabase db push`).
3. Copy the project URL and **service role** key. Auth → disable sign-ups (the app doesn't use Supabase Auth, but keep it closed).

### 2. Google Cloud
1. Create a project; enable **Google Drive API**, **Google Calendar API**, **Gmail API**.
2. OAuth consent screen: External, add yourself as a test user (or publish for personal use). Scopes: `drive.file`, `calendar.events`, `gmail.compose`, `openid`, `email`.
3. Credentials → OAuth client ID → Web application. Redirect URI: `https://<your-app>/api/google/callback` (and `http://localhost:3000/api/google/callback` for dev).

> In "Testing" mode Google expires refresh tokens after 7 days. Publish the app (personal, unverified is fine for your own account) to avoid reconnecting weekly.

### 3. Todoist
Settings → Integrations → Developer → copy API token. Optionally put per-area project ids in `TODOIST_PROJECT_*`.

### 4. Vercel
1. Import this repo; set **Root Directory** to `life-os`.
2. Add every variable from `.env.example` (mark secrets Sensitive).
3. Enable Fluid compute (default on new projects). The processing route uses `maxDuration = 300`; on Pro you can raise it to 800 in `app/api/recordings/[id]/process/route.ts`.
4. Deploy, open the app, sign in, go to **Settings → Connect Google**.
5. On iPhone: Share → **Add to Home Screen**.

### Local development
```bash
cd life-os
cp .env.example .env.local   # fill in
npm install
npm run dev                  # http://localhost:3000
npm test                     # cue detection, segmentation, cleaning guard
npm run lint                 # typecheck
```

## Limits & notes
- Files ≤ 24 MB in a supported format go to OpenAI unchanged. Larger files are converted on the server (ffmpeg) to 16 kHz mono 10-minute parts for transcription only; the original in Drive is never modified. The limit is about 450 MB per file (Vercel's temp storage); export very long WAVs as M4A/MP3.
- If a long recording runs out of function time, the next visit to the inbox resumes it from the last finished step.
- Calendar events use `APP_TIMEZONE`. Relative dates ("next Tuesday") are resolved from the recording time, not the approval time.
- Email drafts go to Gmail Drafts. Other providers can be added in `lib/google/gmail.ts`'s shape.

See [SECURITY.md](./SECURITY.md) and [ROADMAP.md](./ROADMAP.md).
