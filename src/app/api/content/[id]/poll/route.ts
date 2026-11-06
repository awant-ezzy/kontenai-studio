import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

// Long-polling: returns latest content with progress; used to track generation status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticatedRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const sinceStr = req.nextUrl.searchParams.get('since');
  const since = sinceStr ? parseInt(sinceStr, 10) : 0;

  // Poll up to ~30s
  const maxAttempts = 30;
  const intervalMs = 1000;
  let content: any = null;
  let updatedAt = 0;

  for (let i = 0; i < maxAttempts; i++) {
    content = await db.content.findUnique({
      where: { id },
      include: { assets: true },
    });
    if (!content) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    updatedAt = new Date(content.updatedAt).getTime();
    if (content.status === 'completed' || content.status === 'failed' || updatedAt > since) {
      return NextResponse.json({ content });
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return NextResponse.json({ content });
}
