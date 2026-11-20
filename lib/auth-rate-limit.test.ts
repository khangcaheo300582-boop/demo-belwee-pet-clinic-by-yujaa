import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  consumeRateLimit,
  rateLimitLogin,
  rateLimitForgotPassword,
  rateLimitResetPassword,
  rateLimitChangePassword,
  clearRateLimit,
} from './auth-rate-limit';

beforeEach(() => {
  clearRateLimit('test:*');
});

afterEach(() => {
  clearRateLimit('test:*');
});

describe('auth-rate-limit', () => {
  it('allows requests within limit', () => {
    const result = consumeRateLimit('test:login:ip:email', 5, 15 * 60 * 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests after limit exceeded', () => {
    const key = 'test:login:ip:blocked';
    for (let i = 0; i < 5; i++) {
      const r = consumeRateLimit(key, 5, 15 * 60 * 1000);
      expect(r.allowed).toBe(true);
    }
    const blocked = consumeRateLimit(key, 5, 15 * 60 * 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('rateLimitLogin blocks after 5 attempts', () => {
    const ip = '1.2.3.4';
    const email = 'test@example.com';
    for (let i = 0; i < 5; i++) {
      expect(rateLimitLogin(ip, email).allowed).toBe(true);
    }
    expect(rateLimitLogin(ip, email).allowed).toBe(false);
  });

  it('rateLimitForgotPassword blocks after 3 attempts', () => {
    const ip = '5.6.7.8';
    const email = 'forgot@example.com';
    for (let i = 0; i < 3; i++) {
      expect(rateLimitForgotPassword(ip, email).allowed).toBe(true);
    }
    expect(rateLimitForgotPassword(ip, email).allowed).toBe(false);
  });

  it('rateLimitResetPassword blocks after 5 attempts per IP', () => {
    const ip = '9.9.9.9';
    for (let i = 0; i < 5; i++) {
      expect(rateLimitResetPassword(ip).allowed).toBe(true);
    }
    expect(rateLimitResetPassword(ip).allowed).toBe(false);
  });

  it('rateLimitChangePassword allows 10 attempts per user', () => {
    const userId = 'USR_1';
    for (let i = 0; i < 10; i++) {
      expect(rateLimitChangePassword(userId).allowed).toBe(true);
    }
    expect(rateLimitChangePassword(userId).allowed).toBe(false);
  });

  it('clearRateLimit resets the counter', () => {
    const key = 'test:clear';
    consumeRateLimit(key, 5, 15 * 60 * 1000);
    clearRateLimit(key);
    // After clear, first call starts fresh with count=1, remaining=4
    const first = consumeRateLimit(key, 5, 15 * 60 * 1000);
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(4);
  });
});
