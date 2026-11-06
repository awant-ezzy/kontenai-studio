import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, verifyAdminPassword } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Password tidak valid.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSessionToken(),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return response;
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json({ error: 'Autentikasi belum dikonfigurasi dengan benar.' }, { status: 500 });
  }
}
