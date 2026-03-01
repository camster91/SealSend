/**
 * API route wrapper utilities for consistent error handling,
 * logging, and response formatting
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, getClientIp } from './rate-limit';

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: Record<string, unknown>;
}

/**
 * Wrapper for API route handlers with automatic error handling
 */
export function withErrorHandling<T>(
  handler: (request: NextRequest, context?: { params: Promise<{ [key: string]: string }> }) => Promise<ApiResponse<T>>,
  options: {
    rateLimit?: { max: number; windowSeconds: number; keyPrefix?: string };
    requireAuth?: boolean;
  } = {}
) {
  return async function (
    request: NextRequest,
    context?: { params: Promise<{ [key: string]: string }> }
  ): Promise<NextResponse> {
    try {
      // Rate limiting
      if (options.rateLimit) {
        const ip = getClientIp(request);
        const key = `${options.rateLimit.keyPrefix || 'api'}:${ip}`;
        const { success } = rateLimit(key, {
          max: options.rateLimit.max,
          windowSeconds: options.rateLimit.windowSeconds,
        });

        if (!success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: 'Too many requests. Please try again later.',
                code: 'RATE_LIMITED',
                status: 429,
              },
            },
            { status: 429 }
          );
        }
      }

      const result = await handler(request, context);

      const statusCode = result.error?.status || (result.success ? 200 : 400);
      return NextResponse.json(result, { status: statusCode });
    } catch (error) {
      console.error('API Error:', error);

      const message = error instanceof Error ? error.message : 'Internal server error';
      const status = (error as ApiError).status || 500;

      return NextResponse.json(
        {
          success: false,
          error: {
            message: status === 500 ? 'Internal server error' : message,
            code: 'INTERNAL_ERROR',
            status,
          },
        },
        { status }
      );
    }
  };
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta,
  };
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  code: string = 'ERROR',
  status: number = 400
): ApiResponse {
  return {
    success: false,
    error: {
      message,
      code,
      status,
    },
  };
}

/**
 * Common error responses
 */
export const commonErrors = {
  unauthorized: () => errorResponse('Unauthorized', 'UNAUTHORIZED', 401),
  forbidden: () => errorResponse('Forbidden', 'FORBIDDEN', 403),
  notFound: (resource: string = 'Resource') => errorResponse(`${resource} not found`, 'NOT_FOUND', 404),
  validation: (message: string) => errorResponse(message, 'VALIDATION_ERROR', 400),
  tooManyRequests: () => errorResponse('Too many requests', 'RATE_LIMITED', 429),
};
