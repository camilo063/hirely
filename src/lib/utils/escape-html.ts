/**
 * Escapa texto plano para interpolarlo dentro de HTML.
 *
 * Deliberadamente sin dependencias: `sanitizarHtml` (sanitize-html.ts) importa
 * `isomorphic-dompurify`, que arrastra `jsdom` — una dependencia pesada que
 * ademas rompe el bundle de las funciones serverless de Vercel en rutas que
 * jamas sanitizan HTML rico (ver next.config.mjs). Los archivos que solo
 * necesitan escapar texto (emails, notificaciones) deben importar desde AQUI,
 * no desde sanitize-html.ts, para no arrastrar esa dependencia sin necesitarla.
 *
 * Para los datos que vienen de terceros y NO deben llevar formato: el nombre
 * del candidato sale de un formulario publico y se interpola en correos
 * firmados con la marca del cliente. Sin escapar, permite inyectar enlaces o
 * maquetacion en un correo que el destinatario atribuye a la empresa.
 */
export function escaparHtml(texto: string | null | undefined): string {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
