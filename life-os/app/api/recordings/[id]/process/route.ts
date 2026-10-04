import { NextResponse } from 'next/server';
import { handle } from '@/lib/api';
import { processRecording } from '@/lib/pipeline/process';
import { apiOwner } from '@/lib/session';

// 300s works on every Vercel plan with Fluid compute. Each pipeline step is
// persisted, so if a very long recording runs out of time the next call
// resumes from the last finished step. On Vercel Pro you can raise this to 800.
export const maxDuration = 300;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const ownerId = await apiOwner();
  const rec = await processRecording(ownerId, (await params).id);
  return NextResponse.json({ status: rec.status, error: rec.error });
});
