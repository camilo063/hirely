import { NextResponse } from 'next/server';
import { AppError, isAppError } from './errors';
import { ZodError } from 'zod';

/**
 * Respuesta estandar de la API.
 *
 * Con un status de error (>= 400) marca `success: false` y sube el mensaje al
 * nivel superior, igual que hace `apiError`.
 *
 * Antes devolvia SIEMPRE `success: true`, asi que una llamada como
 * `apiResponse({ error: 'checklist invalido' }, 422)` producia
 * `{ success: true, data: { error: '...' } }`. Los 112 puntos del cliente que
 * ramifican sobre `data.success` lo interpretaban como exito: la interfaz
 * mostraba "Checklist guardado" ante un 422 real y el usuario creia que su
 * cambio se habia aplicado. Afectaba a mas de 40 rutas.
 */
export function apiResponse<T>(data: T, status: number = 200) {
  if (status >= 400) {
    const payload = (data ?? {}) as Record<string, unknown>;
    const mensaje =
      typeof payload.error === 'string' ? payload.error : 'Error procesando la solicitud';
    const { error: _descartado, ...resto } = payload;
    void _descartado;
    return NextResponse.json(
      { success: false, error: mensaje, ...resto },
      { status }
    );
  }
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
