/**
 * Validacion de direcciones de correo.
 *
 * Los correos de los candidatos entran por el CV parseado y por formularios
 * publicos, donde una direccion truncada ("angelagalvis@hotmai") se guarda sin
 * problema. El proveedor la rechaza despues, ya en mitad de un envio, con un
 * error que no le dice nada al reclutador. Este chequeo permite fallar antes y
 * con un mensaje que apunta al dato que hay que corregir.
 *
 * Es el mismo criterio que aplica Resend: parte local, arroba, dominio con al
 * menos un punto y un TLD de dos o mas letras.
 */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(\.[^\s@,;.]+)*\.[A-Za-z]{2,}$/;

export function esEmailValido(email: unknown): email is string {
  return typeof email === 'string' && email.trim().length > 0 && EMAIL_RE.test(email.trim());
}
