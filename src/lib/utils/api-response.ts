import { NextResponse } from 'next/server';
import { AppError, isAppError } from './errors';
import { ZodError } from 'zod';

export function apiResponse<T>(data: T, status: number = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(error: unknown) {
  if (isAppError(error)) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        ...(error instanceof AppError && 'details' in error
          ? { details: (error as AppError & { details?: unknown }).details }
          : {}),
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof ZodError) {
    const details: Record<string, string[]> = {};
    error.issues.forEach((err) => {
      const path = err.path.join('.');
      if (!details[path]) details[path] = [];
      details[path].push(err.message);
    });
    return NextResponse.json(
      { success: false, error: 'Error de validacion', code: 'VALIDATION_ERROR', details },
      { status: 400 }
    );
  }

  console.error('Unhandled error:', error);
  return NextResponse.json(
    { success: false, error: 'Error interno del servidor', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return apiResponse({
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
