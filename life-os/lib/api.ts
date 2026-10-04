import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { HttpError } from './session';

/** Wrap a route handler: consistent JSON errors, no stack traces to the client. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ error: 'Invalid request', issues: err.issues }, { status: 400 });
      console.error(err);
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
    }
  };
}
