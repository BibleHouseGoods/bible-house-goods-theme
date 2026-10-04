import 'server-only';
import { env } from '../env';
import { googleJson } from './auth';

export interface EventInput {
  title: string;
  start: string; // ISO date (all-day) or local datetime "2026-10-06T15:00"
  end: string | null;
  all_day: boolean;
  location: string | null;
  description?: string;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMinutes(local: string, minutes: number): string {
  // local is "YYYY-MM-DDTHH:mm[:ss]" without zone; do arithmetic in UTC space.
  const d = new Date(`${local.slice(0, 16)}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

export async function createEvent(ownerId: string, ev: EventInput): Promise<{ id: string; htmlLink: string }> {
  const tz = env().APP_TIMEZONE;
  const body = ev.all_day
    ? {
        start: { date: ev.start.slice(0, 10) },
        end: { date: ev.end ? addDays(ev.end.slice(0, 10), 1) : addDays(ev.start.slice(0, 10), 1) },
      }
    : {
        start: { dateTime: `${ev.start.slice(0, 16)}:00`, timeZone: tz },
        end: { dateTime: `${(ev.end ?? addMinutes(ev.start, 60)).slice(0, 16)}:00`, timeZone: tz },
      };
  return googleJson(ownerId, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(env().GOOGLE_CALENDAR_ID)}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ summary: ev.title, location: ev.location ?? undefined, description: ev.description, ...body }),
  });
}
