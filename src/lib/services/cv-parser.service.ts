import { pool } from '@/lib/db';
import { createAnthropicClient } from '@/lib/integrations/anthropic.client';
import { pdfUrlToBase64 } from '@/lib/utils/pdf-extract';
import { parseJsonResponse } from '@/lib/utils/parse-json-response';
import type { CVParsedData } from '@/lib/types/scoring.types';

/**
 * Servicio de parsing de CVs usando Claude API.
 *
 * Dos fuentes de datos:
 * 1. PDF subido manualmente -> Se envia a Claude como documento base64
 * 2. Datos de LinkedIn (via Unipile) -> Ya vienen semi-estructurados,
 *    se complementan con Claude para normalizacion
 *
 * El resultado es un objeto CVParsedData normalizado que se guarda
 * en candidatos.cv_parsed (JSONB) para scoring posterior.
 */

const CV_PARSER_SYSTEM_PROMPT = `Eres un experto en recursos humanos y analisis de hojas de vida. Tu trabajo es extraer datos estructurados de CVs/hojas de vida de forma precisa y completa.

REGLAS:
- Extrae TODOS los datos disponibles, no omitas nada
- Si un dato no esta presente, usa null (no inventes datos)
- Para experiencia, calcula la duracion en meses basandote en las fechas
- Para idiomas, infiere el nivel basandote en contexto (certificaciones, estudios en ese idioma, etc.)
- Para habilidades tecnicas, extrae tecnologias, herramientas, frameworks y lenguajes mencionados
- Normaliza nombres de tecnologias (ej: "JS" -> "JavaScript", "React.js" -> "React")
- El campo "keywords" debe incluir TODOS los terminos tecnicos y relevantes del CV
- Genera un resumen_profesional conciso (2-3 oraciones) del perfil del candidato
- El campo "confianza" (0-1) indica que tan completa y clara es la informacion extraida

RESPONDE UNICAMENTE con un objeto JSON valido, sin markdown, sin backticks, sin texto adicional.`;

const CV_PARSER_USER_PROMPT = `Analiza este CV/hoja de vida y extrae los datos en el siguiente formato JSON exacto:

{
  "nombre": "string",
  "email": "string | null",
  "telefono": "string | null",
  "ubicacion": "string | null",
  "linkedin_url": "string | null",
  "experiencia": [
    {
      "cargo": "string",
      "empresa": "string",
      "ubicacion": "string | null",
      "fecha_inicio": "YYYY-MM",
      "fecha_fin": "YYYY-MM | null",
      "duracion_meses": number,
      "descripcion": "string",
      "tecnologias": ["string"]
    }
  ],
  "experiencia_total_anos": number,
  "educacion": [
    {
      "titulo": "string",
      "institucion": "string",
      "nivel": "doctorado | maestria | especializacion | profesional | tecnologo | bachiller",
      "campo_estudio": "string",
      "fecha_inicio": "YYYY-MM | null",
      "fecha_fin": "YYYY-MM | null",
      "en_curso": boolean
    }
  ],
  "nivel_educativo_max": "doctorado | maestria | especializacion | profesional | tecnologo | bachiller",
  "habilidades_tecnicas": ["string"],
  "habilidades_blandas": ["string"],
  "idiomas": [
    { "idioma": "string", "nivel": "basico | intermedio | avanzado | nativo" }
  ],
  "certificaciones": [
    { "nombre": "string", "emisor": "string", "fecha": "YYYY-MM | null", "vigente": boolean }
  ],
  "keywords": ["string"],
  "resumen_profesional": "string",
  "confianza": number
}

Analiza el documento adjunto y extrae toda la informacion disponible.`;

/**
 * Parsea un CV desde PDF usando Claude API.
 * Estrategia: intenta enviar PDF nativo (type:"document"), si falla extrae texto con pdf-parse.
 */
export async function parseCVFromPDF(
  pdfBase64: string,
  candidatoId: string,
  orgId: string
): Promise<CVParsedData> {
  const client = createAnthropicClient();
  if (!client) {
    throw new Error('Claude API no esta configurado. Configura ANTHROPIC_API_KEY.');
  }

  let responseText: string;

  try {
    // Intentar envio nativo de PDF (requiere anthropic-version >= 2024-10-22)
    responseText = await client.parseDocument(
      pdfBase64,
      CV_PARSER_SYSTEM_PROMPT,
      CV_PARSER_USER_PROMPT
    );
  } catch (error: any) {
    const msg = error.message || '';
    if (msg.includes('document') || msg.includes('unsupported') || msg.includes('Could not process')) {
      console.log('[CV Parser] PDF nativo no soportado, extrayendo texto con pdf-parse...');
      responseText = await parseCVFromPDFText(client, pdfBase64);
    } else {
      throw error;
    }
  }

  const parsed = parseJsonResponse(responseText);

  const cvData: CVParsedData = {
    ...parsed,
    parsed_at: new Date().toISOString(),
    parser_version: '1.0',
    fuente: 'pdf',
  };

  await saveParsedCV(candidatoId, orgId, cvData);

  return cvData;
}

/**
 * Fallback: extrae texto del PDF con pdf-parse y lo envia como texto a Claude.
 */
async function parseCVFromPDFText(
  client: NonNullable<ReturnType<typeof createAnthropicClient>>,
  pdfBase64: string
): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const buffer = Buffer.from(pdfBase64, 'base64');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const textResult = await parser.getText();
  const textContent = textResult.text;

  if (!textContent || textContent.trim().length < 20) {
    throw new Error('El PDF no contiene texto extraible. Puede ser una imagen escaneada.');
  }

  return client.parseDocumentText(
    textContent,
    CV_PARSER_SYSTEM_PROMPT,
    CV_PARSER_USER_PROMPT
  );
}

/**
 * Parsea/normaliza datos que ya vienen de LinkedIn (via Unipile).
 * Los datos de LinkedIn ya estan semi-estructurados, pero necesitan
 * normalizacion para que el scoring funcione de forma consistente.
 */
export async function parseCVFromLinkedIn(
  candidatoId: string,
  orgId: string
): Promise<CVParsedData> {
  const result = await pool.query(
    `SELECT nombre, email, telefono, linkedin_url, cv_parsed,
            habilidades, experiencia_anos, nivel_educativo,
            idiomas, certificaciones, ubicacion
     FROM candidatos WHERE id = $1 AND organization_id = $2`,
    [candidatoId, orgId]
  );

  if (result.rows.length === 0) {
    throw new Error('Candidato no encontrado');
  }

  const candidato = result.rows[0];
  const existingParsed = candidato.cv_parsed || {};

  const client = createAnthropicClient();

  if (client && existingParsed.experiencia?.length > 0) {
    const enrichPrompt = `Dado este perfil profesional de LinkedIn, normaliza y estructura los datos.

Datos del perfil:
- Nombre: ${candidato.nombre}
- Ubicacion: ${candidato.ubicacion || 'No especificada'}
- Anos de experiencia: ${candidato.experiencia_anos || 'No especificado'}
- Nivel educativo: ${candidato.nivel_educativo || 'No especificado'}
- Habilidades: ${JSON.stringify(candidato.habilidades || [])}
- Experiencia: ${JSON.stringify(existingParsed.experiencia || existingParsed.experience || [])}
- Educacion: ${JSON.stringify(existingParsed.educacion || existingParsed.education || [])}
- Idiomas: ${JSON.stringify(candidato.idiomas || [])}
- Certificaciones: ${JSON.stringify(candidato.certificaciones || [])}

${CV_PARSER_USER_PROMPT}`;

    try {
      const responseText = await client.complete(
        CV_PARSER_SYSTEM_PROMPT,
        [{ role: 'user', content: enrichPrompt }]
      );

      const parsed = parseJsonResponse(responseText);
      const cvData: CVParsedData = {
        ...parsed,
        nombre: parsed.nombre || candidato.nombre,
        email: parsed.email || candidato.email,
        telefono: parsed.telefono || candidato.telefono,
        linkedin_url: parsed.linkedin_url || candidato.linkedin_url,
        parsed_at: new Date().toISOString(),
        parser_version: '1.0',
        fuente: 'linkedin',
        confianza: parsed.confianza || 0.7,
      };

      await saveParsedCV(candidatoId, orgId, cvData);
      return cvData;
    } catch (error) {
      console.error('[CV Parser] Error enriqueciendo datos LinkedIn:', error);
    }
  }

  // Fallback: construir datos estructurados sin IA
  const cvData: CVParsedData = buildCVFromRawData(candidato, existingParsed);
  await saveParsedCV(candidatoId, orgId, cvData);
  return cvData;
}

/**
 * Construye CVParsedData desde datos crudos sin usar IA.
 * Fallback para cuando Claude no esta disponible.
 */
function buildCVFromRawData(candidato: any, existingParsed: any): CVParsedData {
  return {
    nombre: candidato.nombre,
    email: candidato.email,
    telefono: candidato.telefono,
    ubicacion: candidato.ubicacion,
    linkedin_url: candidato.linkedin_url,
    experiencia: (existingParsed.experiencia || existingParsed.experience || []).map((e: any) => ({
      cargo: e.cargo || e.title || '',
      empresa: e.empresa || e.company || '',
      ubicacion: e.ubicacion || e.location || null,
      fecha_inicio: e.fecha_inicio || e.start_date || '',
      fecha_fin: e.fecha_fin || e.end_date || null,
      duracion_meses: e.duracion_meses || 0,
      descripcion: e.descripcion || e.description || '',
      tecnologias: e.tecnologias || [],
    })),
    experiencia_total_anos: candidato.experiencia_anos || 0,
    educacion: (existingParsed.educacion || existingParsed.education || []).map((e: any) => ({
      titulo: e.titulo || e.degree || '',
      institucion: e.institucion || e.school || '',
      nivel: e.nivel || 'profesional',
      campo_estudio: e.campo_estudio || e.field_of_study || '',
      fecha_inicio: e.fecha_inicio || e.start_date || null,
      fecha_fin: e.fecha_fin || e.end_date || null,
      en_curso: e.en_curso || false,
    })),
    nivel_educativo_max: candidato.nivel_educativo || 'profesional',
    habilidades_tecnicas: Array.isArray(candidato.habilidades) ? candidato.habilidades : [],
    habilidades_blandas: [],
    idiomas: Array.isArray(candidato.idiomas)
      ? candidato.idiomas.map((i: any) => typeof i === 'string' ? { idioma: i, nivel: 'intermedio' as const } : i)
      : [],
    certificaciones: Array.isArray(candidato.certificaciones)
      ? candidato.certificaciones.map((c: any) => typeof c === 'string' ? { nombre: c, emisor: '', fecha: undefined, vigente: true } : c)
      : [],
    keywords: Array.isArray(candidato.habilidades) ? candidato.habilidades : [],
    resumen_profesional: '',
    parsed_at: new Date().toISOString(),
    parser_version: '1.0-fallback',
    fuente: 'linkedin',
    confianza: 0.4,
  };
}

/**
 * Guarda los datos parseados en la BD y actualiza campos del candidato.
 */
async function saveParsedCV(candidatoId: string, orgId: string, cvData: CVParsedData): Promise<void> {
  // Don't overwrite nombre/apellido from parsed CV — the portal form already has correct split.
  // Only update data fields: habilidades, experiencia, educacion, idiomas, certificaciones, etc.
  await pool.query(
    `UPDATE candidatos SET
       cv_parsed = $1,
       habilidades = $2,
       experiencia_anos = COALESCE($3, experiencia_anos),
       nivel_educativo = COALESCE($4, nivel_educativo),
       idiomas = $5,
       certificaciones = $6,
       telefono = COALESCE(NULLIF($7, ''), telefono),
       ubicacion = COALESCE(NULLIF($8, ''), ubicacion),
       updated_at = NOW()
     WHERE id = $9 AND organization_id = $10`,
    [
      JSON.stringify(cvData),
      JSON.stringify(cvData.habilidades_tecnicas),
      cvData.experiencia_total_anos || null,
      cvData.nivel_educativo_max || null,
      JSON.stringify(cvData.idiomas),
      JSON.stringify(cvData.certificaciones),
      cvData.telefono,
      cvData.ubicacion,
      candidatoId,
      orgId,
    ]
  );
}

// Legacy export for backward compatibility
export async function parseCv(_fileBuffer: Buffer, _fileName: string): Promise<CVParsedData> {
  console.warn('[CV Parser] parseCv() is deprecated. Use parseCVFromPDF() instead.');
  return buildCVFromRawData(
    { nombre: '', email: null, telefono: null, ubicacion: null, linkedin_url: null, habilidades: [], experiencia_anos: 0 },
    {}
  );
}
