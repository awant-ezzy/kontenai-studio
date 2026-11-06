import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const items = await db.content.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { assets: true },
  });
  return NextResponse.json({ items });
}
