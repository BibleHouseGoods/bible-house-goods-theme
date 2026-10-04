import 'server-only';
import OpenAI from 'openai';
import { env } from './env';

let client: OpenAI | null = null;
export function openai(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: env().OPENAI_API_KEY, maxRetries: 3, timeout: 240_000 });
  return client;
}
