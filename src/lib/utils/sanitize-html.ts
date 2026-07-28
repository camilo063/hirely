/**
 * Saneamiento de HTML enriquecido.
 *
 * PROBLEMA QUE RESUELVE
 * Las plantillas de contrato, el HTML de los contratos y las plantillas de email
 * aceptaban HTML arbitrario y se pintaban con `dangerouslySetInnerHTML`. Un
 * usuario podia inyectar `<script>` y quedarse con la sesion de un administrador
 * que abriera el documento. Con el control de roles ya aplicado deja de ser una
 * escalada desde `viewer`, pero sigue siendo XSS almacenado entre usuarios de la
 * misma empresa, y las plantillas de email viajan a los candidatos.
 *
 * CRITERIO
 * Lista blanca. Se permite lo que un documento o un correo necesitan de verdad
 * (texto, tablas, imagenes, estilos en linea) y se elimina todo lo ejecutable:
 * `script`, `iframe`, `object`, manejadores `on*` y URLs `javascript:`.
 */

import DOMPurify from 'isomorphic-dompurify';

/** Etiquetas admitidas en contratos, plantillas y correos. */
const ETIQUETAS_PERMITIDAS = [
  'p', 'br', 'hr', 'div', 'span', 'section', 'article',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'small', 'sub', 'sup', 'mark',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'a', 'img', 'figure', 'figcaption',
  'blockquote', 'pre', 'code',
];

const ATRIBUTOS_PERMITIDOS = [
  'href', 'src', 'alt', 'title', 'width', 'height',
  'style', 'class', 'id',
  'colspan', 'rowspan', 'align', 'valign',
  'target', 'rel',
];

/**
 * Sanea HTML enriquecido conservando el formato del documento.
 *
 * `ALLOWED_URI_REGEXP` restringe los enlaces a esquemas seguros: sin el,
 * `javascript:` en un `href` sigue ejecutandose al hacer clic.
 */
export function sanitizarHtml(html: string | null | undefined): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ETIQUETAS_PERMITIDAS,
    ALLOWED_ATTR: ATRIBUTOS_PERMITIDOS,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'link', 'meta', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'formaction'],
  });
}

/**
 * Escapa texto plano para interpolarlo dentro de HTML.
 *
 * Para los datos que vienen de terceros y NO deben llevar formato: el nombre del
 * candidato sale de un formulario publico y se interpola en correos firmados con
 * la marca del cliente. Sin escapar, permite inyectar enlaces o maquetacion en
 * un correo que el destinatario atribuye a la empresa.
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
