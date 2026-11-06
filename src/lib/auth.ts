import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'kontenai_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET harus diisi dengan minimal 32 karakter acak.');
  }
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', getAuthSecret()).update(value).digest('base64url');
}

export function createSessionToken(now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string, now = Date.now()): boolean {
  if (!token) return false;
  const [expiresAt, signature, extra] = token.split('.');
  if (!expiresAt || !signature || extra !== undefined) return false;

  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000)) return false;

  try {
    const expected = Buffer.from(sign(expiresAt));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(candidate: string): boolean {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || !candidate || candidate.length > 1024) return false;

  const expected = Buffer.from(configured);
  const actual = Buffer.from(candidate);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
