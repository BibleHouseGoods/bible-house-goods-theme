import 'server-only';
import { z } from 'zod';

// All secrets are read here, on the server only. Nothing in this file is ever
// prefixed NEXT_PUBLIC_, so none of it can be bundled into browser code.
const schema = z.object({
  APP_URL: z.string().url(),
  APP_TIMEZONE: z.string().default('America/Chicago'),
  // One-time token that unlocks /setup (choose passphrase + enrol authenticator).
  // Setup locks itself permanently once two-factor is confirmed.
  SETUP_TOKEN: z.string().min(24).optional(),
  SESSION_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().min(40), // base64 of 32 random bytes

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  OPENAI_API_KEY: z.string().min(20),
  OPENAI_TRANSCRIBE_MODEL: z.string().default('whisper-1'),
  OPENAI_TEXT_MODEL: z.string().default('gpt-5'),
  OPENAI_REASONING_EFFORT: z.enum(['minimal', 'low', 'medium', 'high']).optional(),

  GOOGLE_CLIENT_ID: z.string().min(10),
  GOOGLE_CLIENT_SECRET: z.string().min(10),
  GOOGLE_ALLOWED_EMAIL: z.string().email().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),
  GOOGLE_DRIVE_ROOT_NAME: z.string().default('Life OS'),

  TODOIST_API_TOKEN: z.string().min(10),
  TODOIST_PROJECT_LIFE: z.string().optional(),
  TODOIST_PROJECT_CHURCH: z.string().optional(),
  TODOIST_PROJECT_BIBLE_HOUSE: z.string().optional(),
  TODOIST_PROJECT_LIBERTY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

/** Non-throwing check used by the settings page. */
export function envStatus(): Record<string, boolean> {
  const keys = Object.keys(schema.shape) as (keyof Env)[];
  return Object.fromEntries(keys.map((k) => [k, Boolean(process.env[k])]));
}
