import { describe, it, expect } from 'vitest';
import { AppError, Errors } from './error-handler';

describe('error-handler', () => {
  it('creates AppError with statusCode and message', () => {
    const err = Errors.badRequest('Invalid input');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Invalid input');
    expect(err.code).toBe('BAD_REQUEST');
  });

  it('creates unauthorized error', () => {
    const err = Errors.unauthorized();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('creates forbidden error', () => {
    const err = Errors.forbidden();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('creates notFound error', () => {
    const err = Errors.notFound('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('User not found');
  });

  it('creates conflict error', () => {
    const err = Errors.conflict('Email already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
  });

  it('creates tooManyRequests error', () => {
    const err = Errors.tooManyRequests('Too many attempts');
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('TOO_MANY_REQUESTS');
  });

  it('creates internal error with default message', () => {
    const err = Errors.internal();
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe('Internal server error');
  });

  it('creates serviceUnavailable error', () => {
    const err = Errors.serviceUnavailable('Maintenance');
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('SERVICE_UNAVAILABLE');
  });
});
