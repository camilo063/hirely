/**
 * Lectura tolerante de una respuesta de la API desde el cliente.
 *
 * PROBLEMA QUE RESUELVE
 * El patron repetido en los componentes era `const data = await res.json()`
 * dentro de un try/catch que, en el catch, mostraba "Error de conexion". Pero
 * `res.json()` NO solo falla cuando se cae la red: falla siempre que el cuerpo
 * no es JSON, y eso es justo lo que devuelve la plataforma cuando la funcion
 * serverless se agota (504) o se cae antes de ejecutar el handler (500). El
 * resultado era el peor de los mensajes posibles: la peticion si llego, el
 * servidor si respondio —y con un codigo que dice exactamente que paso— pero al
 * usuario se le informaba de un problema de conexion inexistente y no se le
 * decia que el cambio pudo haberse aplicado igual.
 *
 * `leerRespuestaApi` distingue los tres casos y devuelve un mensaje accionable.
 */

export interface RespuestaApi<T> {
  /** La API respondio con exito (HTTP ok + success: true). */
  ok: boolean;
  /** Payload de `apiResponse` (el contenido de `data`), si lo hubo. */
  data: T | null;
  /** Mensaje listo para mostrar. Null cuando `ok` es true. */
  error: string | null;
  /**
   * El servidor respondio algo que no era JSON (timeout de la funcion, caida
   * del runtime, pagina de error de la plataforma). En estos casos la operacion
   * pudo haberse ejecutado igual: quien llama deberia refrescar sus datos.
   */
  respuestaNoJson: boolean;
}

/** Coletilla comun: tras una respuesta no-JSON el resultado real es incierto. */
const VERIFICAR = 'El cambio pudo haberse aplicado: recarga para verificarlo.';

export async function leerRespuestaApi<T = unknown>(res: Response): Promise<RespuestaApi<T>> {
  const texto = await res.text();

  let cuerpo: { success?: boolean; data?: T; error?: string } | null = null;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    cuerpo = null;
  }

  if (cuerpo === null) {
    // 504/408/502 son el timeout de la funcion; otro 5xx con cuerpo vacio o en
    // HTML es la funcion caida antes de responder. En ambos casos el trabajo
    // pudo haberse completado en el servidor.
    const esTimeout = res.status === 504 || res.status === 408 || res.status === 502;
    let error: string;
    if (esTimeout) {
      error = `El servidor tardo demasiado en responder. ${VERIFICAR}`;
    } else if (res.status >= 500) {
      error = `El servidor fallo al procesar la solicitud (HTTP ${res.status}). ${VERIFICAR}`;
    } else {
      error = `Respuesta inesperada del servidor (HTTP ${res.status}).`;
    }
    return { ok: false, data: null, error, respuestaNoJson: true };
  }

  if (res.ok && cuerpo.success) {
    return { ok: true, data: (cuerpo.data ?? null) as T | null, error: null, respuestaNoJson: false };
  }

  return {
    ok: false,
    data: (cuerpo.data ?? null) as T | null,
    error: cuerpo.error || 'No se pudo completar la operacion',
    respuestaNoJson: false,
  };
}
