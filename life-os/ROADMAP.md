# Roadmap

## Guiding principle for V2
**Less cognitive load, not more.** AI connects things quietly in the background and surfaces only what matters. No new inboxes to tend, no dashboards to maintain.

## V1 (this release): capture you can trust
- Record in-app, or import MP3/M4A/WAV from a USB-C recorder through the iPhone Files app
- Original audio kept untouched in Google Drive
- Verbatim transcript (write-once) plus a separate clean transcript
- Split by meaning into items, with spoken cues as hard rules
- Four areas (Life, Church, Bible House, Liberty) × six types
- Review inbox: nothing external until approved
- Approve → Todoist, Google Calendar, Gmail drafts
- Search, Private (do-not-AI) recordings, audit log, basic delete

**Gate to V2:** V1 is stable and capture has become a daily habit.

## V2: a second brain that does the connecting
Each feature should remove work, not add screens.

1. **Ask my brain.** Conversational search across all history ("What did I say about the youth retreat budget?"), with answers that cite the exact recordings and timestamps. Embeddings via pgvector over clean transcripts. Private recordings are excluded unless you add your own notes.
2. **People intelligence.** Lightweight profiles built from mentions: who you talked about, follow-ups you owe, commitments made to you and by you. Surfaced only when relevant ("You told Sam you'd call back by Friday").
3. **Emerging projects.** Notice when separate items keep circling the same theme and suggest promoting them to a project. One tap to accept, otherwise silent.
4. **Daily brief and weekly review.** A short morning brief (today's commitments, follow-ups due, one resurfaced idea) and a guided weekly review across the four areas. Generated, not maintained.
5. **Personal vocabulary.** Learn names, places, Scripture references and ministry/business terms from corrections, and feed them to transcription and cleaning so accuracy improves over time.
6. **Intelligent relationships between notes.** Quiet "related" links between items and recordings (same person, passage, project), shown in context instead of as a graph to manage.
7. **Direct voice capture beyond manual import.** Lock-screen/Shortcut capture, Action Button, Apple Watch, and automatic pickup of new recorder files dropped into a Drive folder.
8. **Robust export and delete.** Full export (audio, transcripts, items, links) as a zip or to a Drive folder; per-recording and bulk hard delete across Supabase, Drive and derived indexes; retention rules (e.g. auto-purge transcripts of private-adjacent material after N days).

## Security track (ongoing)
- Passkeys (WebAuthn) instead of a passphrase
- Per-user isolation already modelled (`owner_id` + RLS). If Life OS ever serves more than one person, move to Supabase Auth and run queries under the user's JWT so RLS enforces isolation.
- Optional OpenAI Zero Data Retention; option to run transcription on a self-hosted model for sensitive areas
- Signed, append-only export of the audit log
- No compliance claims (e.g. HIPAA) without a formal program and vendor BAAs. See SECURITY.md.
