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
 *
 * POR QUE `sanitize-html` Y NO DOMPurify
 * DOMPurify necesita un DOM. En el servidor eso significaba `isomorphic-dompurify`
 * -> `jsdom`, y jsdom >= 28 depende de `@exodus/bytes`, que se distribuye como ESM
 * puro. El `require()` que hace `html-encoding-sniffer` sobre ese paquete revienta
 * con ERR_REQUIRE_ESM dentro de las funciones serverless de Vercel — al cargar el
 * modulo, antes de que la ruta ejecute una sola linea — y devuelve una pagina HTML
 * de error en vez de JSON ("Unexpected token '<'" en el cliente). Tumbaba
 * POST /api/plantillas-contrato, /api/contratos, /vacantes/[id] y /candidatos/[id].
 * Marcar jsdom como paquete externo en next.config no lo arregla: el require de un
 * ESM sigue fallando en ese runtime.
 *
 * `sanitize-html` analiza el HTML con htmlparser2, sin DOM. Funciona igual en Node
 * y en el navegador, asi que servidor y cliente producen EXACTAMENTE la misma
 * salida y no hay desajustes de hidratacion en las vistas previas.
 */

import sanitizeHtmlLib from 'sanitize-html';
import { escaparHtml } from './escape-html';

// Se re-exporta para no romper a quienes ya importaban `escaparHtml` desde aqui.
export { escaparHtml };

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
 * Construcciones de CSS que pueden ejecutar codigo o filtrar datos desde un
 * atributo `style`. Se dejan pasar el resto de estilos en linea porque la
 * maquetacion de los contratos depende de ellos.
 */
const CSS_PELIGROSO = /(?:expression|behavior|-moz-binding)\s*\(|(?:javascript|vbscript|data)\s*:/i;

/** Quita del `style` solo las declaraciones peligrosas, conservando el formato. */
function limpiarStyle(style: string): string | undefined {
  const seguro = style
    .split(';')
    .filter((declaracion) => declaracion.trim() && !CSS_PELIGROSO.test(declaracion))
    .join('; ')
    .trim();
  return seguro || undefined;
}

/**
 * Sanea HTML enriquecido conservando el formato del documento.
 *
 * Los esquemas de URL se limitan a los seguros: sin eso, `javascript:` en un
 * `href` sigue ejecutandose al hacer clic. Las URLs relativas siguen permitidas.
 */
export function sanitizarHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtmlLib(html, {
    allowedTags: ETIQUETAS_PERMITIDAS,
    allowedAttributes: { '*': ATRIBUTOS_PERMITIDOS },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    // Etiquetas cuyo contenido de texto tambien se descarta: dejar el cuerpo de
    // un <script> como texto plano en el documento no aporta nada y confunde.
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template'],
    disallowedTagsMode: 'discard',
    transformTags: {
      '*': (tagName, attribs) => {
        const limpios: Record<string, string> = { ...attribs };
        if (limpios.style) {
          const style = limpiarStyle(limpios.style);
          if (style) limpios.style = style;
          else delete limpios.style;
        }
        // Un enlace a otra pestaña sin `noopener` deja que el destino manipule
        // la ventana de origen via `window.opener`.
        if (tagName === 'a' && limpios.target === '_blank') {
          limpios.rel = 'noopener noreferrer';
        }
        return { tagName, attribs: limpios };
      },
    },
  });
}
