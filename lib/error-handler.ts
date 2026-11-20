// lib/error-handler.ts
// Centralized error handling for all API routes.
// Wraps route handlers to catch unhandled errors and return consistent JSON responses.

import { NextResponse } from 'next/server';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (msg: string) => new AppError(400, msg, 'BAD_REQUEST'),
  unauthorized: (msg = 'Unauthorized') => new AppError(401, msg, 'UNAUTHORIZED'),
  forbidden: (msg = 'Forbidden') => new AppError(403, msg, 'FORBIDDEN'),
  notFound: (msg = 'Not found') => new AppError(404, msg, 'NOT_FOUND'),
  conflict: (msg: string) => new AppError(409, msg, 'CONFLICT'),
  tooManyRequests: (msg: string) => new AppError(429, msg, 'TOO_MANY_REQUESTS'),
  internal: (msg = 'Internal server error') => new AppError(500, msg, 'INTERNAL_ERROR'),
  serviceUnavailable: (msg: string) => new AppError(503, msg, 'SERVICE_UNAVAILABLE'),
};

/**
 * Wrap an async route handler to catch errors and return consistent JSON.
 *
 * Usage:
 *   export const POST = withErrorHandler(async (request) => {
 *     // ... your logic
 *     return NextResponse.json({ success: true });
 *   });
 */
export function withErrorHandler(
  handler: (request: Request, context?: any) => Promise<NextResponse>
): (request: Request, context?: any) => Promise<NextResponse> {
  return async (request: Request, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AppError) {
        const headers: Record<string, string> = {};
        if (error.statusCode === 429) {
          // Extract retry-after if available
        }
        return NextResponse.json(
          { success: false, message: error.message, code: error.code },
          { status: error.statusCode, headers }
        );
      }

      // Mongoose validation errors
      if (error && typeof error === 'object' && 'name' in error && error.name === 'ValidationError') {
        return NextResponse.json(
          { success: false, message: 'Dữ liệu không hợp lệ.', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }

      // Duplicate key
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return NextResponse.json(
          { success: false, message: 'Dữ liệu đã tồn tại.', code: 'DUPLICATE_KEY' },
          { status: 409 }
        );
      }

      // Log unexpected errors
      console.error('[ErrorHandler] Unhandled error:', error);
      return NextResponse.json(
        { success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }
  };
}

/**
 * Safe JSON parse for request body.
 */
export async function parseJsonBody(request: Request): Promise<{ ok: true; data: any } | { ok: false; response: NextResponse }> {
  try {
    const text = await request.text();
    if (!text || text.trim().length === 0) {
      return { ok: false, response: NextResponse.json({ success: false, message: 'Thiếu nội dung yêu cầu.' }, { status: 400 }) };
    }
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Dữ liệu không phải JSON hợp lệ.' }, { status: 400 }) };
  }
}
