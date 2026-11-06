import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  if (!isAuthenticatedRequest(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const items = await db.content.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { assets: true },
  });
  return NextResponse.json({ items });
}
