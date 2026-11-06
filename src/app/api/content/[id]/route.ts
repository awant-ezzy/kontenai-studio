import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { deleteContentAssets } from '@/lib/storage';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthenticatedRequest(_req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const content = await db.content.findUnique({
    where: { id },
    include: { assets: true },
  });
  if (!content) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ content });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const content = await db.content.findUnique({ where: { id } });
  if (!content) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await db.content.delete({ where: { id } });
  await deleteContentAssets(id);
  return NextResponse.json({ ok: true });
}
