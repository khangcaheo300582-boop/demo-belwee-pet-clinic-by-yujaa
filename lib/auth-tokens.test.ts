import { describe, it, expect, beforeEach } from 'vitest';
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
  issueTokenPair,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
} from './auth-tokens';

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!!';
  process.env.NEXTAUTH_SECRET = 'nextauth-secret-at-least-32-chars!!!';
  process.env.STAFF_SESSION_SECRET = 'staff-secret-at-least-32-chars!!!';
});

describe('auth-tokens', () => {
  const user = { id: 'USR_123', email: 'test@example.com', name: 'Test User', role: 'ADMIN' };

  it('signs and verifies access token', () => {
    const token = signAccessToken(user);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(user.id);
    expect(payload?.type).toBe('access');
    expect(payload?.email).toBe(user.email);
  });

  it('signs and verifies refresh token', () => {
    const token = signRefreshToken(user);
    expect(typeof token).toBe('string');
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.type).toBe('refresh');
    expect(payload?.jti).toBeDefined();
  });

  it('rejects tampered token', () => {
    const token = signAccessToken(user);
    const tampered = token.slice(0, -5) + 'xxxxx';
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects invalid token formats', () => {
    expect(verifyToken('invalid.token.here')).toBeNull();
    expect(verifyToken('')).toBeNull();
    expect(verifyToken(undefined as unknown as string)).toBeNull();
    expect(verifyToken('not-a-jwt')).toBeNull();
  });

  it('issues token pair with correct structure', () => {
    const pair = issueTokenPair(user);
    expect(pair.accessToken).toBeDefined();
    expect(pair.refreshToken).toBeDefined();
    expect(pair.expiresIn).toBe(Math.floor(ACCESS_TOKEN_TTL_MS / 1000));
    const accessPayload = verifyToken(pair.accessToken);
    const refreshPayload = verifyToken(pair.refreshToken);
    expect(accessPayload?.type).toBe('access');
    expect(refreshPayload?.type).toBe('refresh');
    expect(accessPayload?.sub).toBe(user.id);
    expect(refreshPayload?.sub).toBe(user.id);
  });

  it('TTL constants are correct', () => {
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60 * 1000);
    expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('extracts Bearer token correctly', () => {
    const authHeader = 'Bearer eyJhbGciOiJIUzI1NiJ9';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    expect(match?.[1]).toBe('eyJhbGciOiJIUzI1NiJ9');
  });
});
