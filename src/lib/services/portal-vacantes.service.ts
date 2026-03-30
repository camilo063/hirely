import { pool } from '@/lib/db';
import { getAppUrl } from '@/lib/utils/url';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';

// --- Types ---

export interface VacantePublica {
  id: string;
  titulo: string;
  descripcion: string;
  habilidades_requeridas: string[];
  experiencia_minima: number;
  nivel_estudios: string | null;
  modalidad: string;
  tipo_contrato: string;
  ubicacion: string;
  rango_salarial_min: number | null;
  rango_salarial_max: number | null;
  moneda: string;
  published_at: string;
  slug: string;
  empresa_nombre: string;
  empresa_logo: string | null;
  color_primario: string;
  empresa_descripcion: string | null;
  empresa_website: string | null;
  organization_id: string;
  departamento: string | null;
  candidatos_count: number;
}

// --- Slug Generation ---

export function generateSlug(titulo: string, empresaNombre: string): string {
  const base = `${titulo} ${empresaNombre}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
  const suffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${suffix}`;
}

// --- Publicar Vacante ---

export async function publicarVacante(
  vacanteId: string,
  orgId: string
): Promise<{ slug: string; publicUrl: string }> {
  const vacanteResult = await pool.query(
    `SELECT v.slug, v.titulo, o.name as org_nombre
     FROM vacantes v
     JOIN organizations o ON o.id = v.organization_id
     WHERE v.id = $1 AND v.organization_id = $2`,
    [vacanteId, orgId]
  );

  if (vacanteResult.rows.length === 0) {
    throw new Error('Vacante no encontrada');
  }

  const vacante = vacanteResult.rows[0];
  let slug = vacante.slug;

  if (!slug) {
    slug = generateSlug(vacante.titulo, vacante.org_nombre);

    // Check uniqueness, regenerate if collision
    const existing = await pool.query('SELECT id FROM vacantes WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      slug = generateSlug(vacante.titulo, vacante.org_nombre);
    }
  }

  await pool.query(
    `UPDATE vacantes
     SET slug = $1,
         is_published = true,
         published_at = COALESCE(published_at, NOW()),
         estado = CASE WHEN estado = 'borrador' OR estado = 'pausada' THEN 'publicada' ELSE estado END,
         updated_at = NOW()
     WHERE id = $2`,
    [slug, vacanteId]
  );

  const baseUrl = getAppUrl();
  return { slug, publicUrl: `${baseUrl}/empleo/${slug}` };
}

// --- Get Vacante Pública ---

export async function getVacantePublica(slug: string): Promise<VacantePublica | null> {
  const result = await pool.query(
    `SELECT
       v.id, v.titulo, v.descripcion, v.habilidades_requeridas,
       v.experiencia_minima, v.nivel_estudios, v.modalidad,
       v.tipo_contrato, v.ubicacion, v.departamento,
       v.rango_salarial_min, v.rango_salarial_max, v.moneda,
       v.published_at, v.slug, v.organization_id,
       o.name as empresa_nombre,
       os.portal_logo_url as empresa_logo,
       COALESCE(os.portal_color_primario, '#00BCD4') as color_primario,
       os.portal_descripcion as empresa_descripcion,
       os.portal_website as empresa_website,
       (SELECT COUNT(*) FROM aplicaciones a WHERE a.vacante_id = v.id)::int AS candidatos_count
     FROM vacantes v
     JOIN organizations o ON o.id = v.organization_id
     LEFT JOIN org_settings os ON os.organization_id = o.id
     WHERE v.slug = $1 AND v.is_published = true AND v.estado = 'publicada'`,
    [slug]
  );

  if (result.rows.length === 0) return null;

  // Increment views
  await pool.query(
    'UPDATE vacantes SET views_count = COALESCE(views_count, 0) + 1 WHERE slug = $1',
    [slug]
  );

  return result.rows[0];
}

// --- Procesar Aplicación ---

export async function procesarAplicacionPortal(params: {
  vacanteSlug: string;
  nombre: string;
  email: string;
  telefono: string;
  linkedinUrl?: string;
  ubicacion?: string;
  experienciaAnos?: number;
  nivelEducativo?: string;
  habilidades?: string[];
  cvFile?: File;
  cartaPresentacion?: string;
  comoSeEntero?: string;
  referrerUrl?: string;
  ipAddress?: string;
}): Promise<{ success: boolean; aplicacionId?: string; error?: string }> {
  const vacante = await getVacantePublica(params.vacanteSlug);
  if (!vacante) return { success: false, error: 'Vacante no encontrada o no está activa' };

  // Check duplicate
  const existente = await pool.query(
    `SELECT a.id FROM aplicaciones a
     JOIN candidatos c ON c.id = a.candidato_id
     WHERE a.vacante_id = $1 AND c.email = $2`,
    [vacante.id, params.email]
  );
  if (existente.rows.length > 0) {
    return { success: false, error: 'Ya existe una postulación con este email para esta vacante' };
  }

  // Find or create candidato
  let candidatoId: string;
  const candidatoExistente = await pool.query(
    'SELECT id FROM candidatos WHERE email = $1 AND organization_id = $2',
    [params.email, vacante.organization_id]
  );

  // Split nombre into nombre/apellido
  const nameParts = params.nombre.trim().split(' ');
  const nombre = nameParts[0] || params.nombre;
  const apellido = nameParts.slice(1).join(' ') || '';

  if (candidatoExistente.rows.length > 0) {
    candidatoId = candidatoExistente.rows[0].id;
    await pool.query(
      `UPDATE candidatos SET
         nombre = COALESCE($1, nombre),
         apellido = COALESCE($2, apellido),
         telefono = COALESCE($3, telefono),
         ubicacion = COALESCE($4, ubicacion),
         linkedin_url = COALESCE($5, linkedin_url),
         experiencia_anos = COALESCE($6, experiencia_anos),
         nivel_educativo = COALESCE($7, nivel_educativo),
         habilidades = CASE WHEN $8::jsonb != '[]'::jsonb THEN $8::jsonb ELSE habilidades END,
         updated_at = NOW()
       WHERE id = $9`,
      [
        nombre, apellido,
        params.telefono || null, params.ubicacion || null,
        params.linkedinUrl || null, params.experienciaAnos ?? null,
        params.nivelEducativo || null,
        JSON.stringify(params.habilidades || []),
        candidatoId,
      ]
    );
  } else {
    const newCandidato = await pool.query(
      `INSERT INTO candidatos
       (organization_id, nombre, apellido, email, telefono, linkedin_url, ubicacion,
        experiencia_anos, nivel_educativo, habilidades, fuente)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'portal')
       RETURNING id`,
      [
        vacante.organization_id, nombre, apellido, params.email,
        params.telefono || null, params.linkedinUrl || null,
        params.ubicacion || null, params.experienciaAnos ?? null,
        params.nivelEducativo || null,
        JSON.stringify(params.habilidades || []),
      ]
    );
    candidatoId = newCandidato.rows[0].id;
  }

  // Save CV if uploaded
  if (params.cvFile) {
    try {
      const { saveFile } = await import('@/lib/utils/file-storage');
      const saved = await saveFile(params.cvFile, candidatoId, 'cv', vacante.organization_id, 'candidatos');
      await pool.query('UPDATE candidatos SET cv_url = $1 WHERE id = $2', [saved.url, candidatoId]);
    } catch (error) {
      console.error('[Portal] Error guardando CV:', error);
    }
  }

  // Create aplicacion
  const aplicacion = await pool.query(
    `INSERT INTO aplicaciones
     (organization_id, vacante_id, candidato_id, estado, origen, referrer_url, ip_address, notas)
     VALUES ($1, $2, $3, 'nuevo', $4, $5, $6, $7)
     RETURNING id`,
    [
      vacante.organization_id, vacante.id, candidatoId,
      params.comoSeEntero || 'portal',
      params.referrerUrl || null,
      params.ipAddress || null,
      params.cartaPresentacion ? `Carta de presentación: ${params.cartaPresentacion}` : null,
    ]
  );
  const aplicacionId = aplicacion.rows[0].id;

  // Increment applications_count
  await pool.query(
    'UPDATE vacantes SET applications_count = COALESCE(applications_count, 0) + 1 WHERE id = $1',
    [vacante.id]
  );

  // Auto-scoring (non-blocking)
  try {
    const { runScoringPipeline } = await import('./scoring-pipeline.service');
    await runScoringPipeline(candidatoId, vacante.id, vacante.organization_id);
  } catch (error) {
    console.error('[Portal] Error en auto-scoring:', error);
  }

  // Activity log
  try {
    await pool.query(
      `INSERT INTO activity_log (organization_id, entity_type, entity_id, action, details)
       VALUES ($1, 'aplicacion', $2, 'created_from_portal', $3)`,
      [
        vacante.organization_id,
        aplicacionId,
        JSON.stringify({
          fuente: params.comoSeEntero || 'portal',
          candidato_nombre: params.nombre,
          vacante_titulo: vacante.titulo,
        }),
      ]
    );
  } catch {
    // Non-critical
  }

  // Notificacion en tiempo real
  try {
    const notif = await crearNotificacion({
      organizacionId: vacante.organization_id,
      tipo: 'nueva_aplicacion',
      titulo: 'Nueva aplicacion recibida',
      mensaje: `${params.nombre} aplico a ${vacante.titulo}`,
      meta: { aplicacion_id: aplicacionId, candidato_id: candidatoId, vacante_id: vacante.id, url: `/vacantes/${vacante.id}/candidatos` },
    });
    if (notif) {
      emitirNotificacion(vacante.organization_id, {
        type: 'notificacion',
        id: notif.id,
        tipo: 'nueva_aplicacion',
        titulo: 'Nueva aplicacion recibida',
        mensaje: `${params.nombre} aplico a ${vacante.titulo}`,
        browser_activo: notif.browser_activo,
        meta: { aplicacion_id: aplicacionId, candidato_id: candidatoId, vacante_id: vacante.id, url: `/vacantes/${vacante.id}/candidatos` },
        created_at: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.error('[notificacion] Error:', e);
  }

  return { success: true, aplicacionId };
}

// --- List Vacantes Públicas ---

export async function listVacantesPublicas(orgId?: string): Promise<VacantePublica[]> {
  const query = orgId
    ? `SELECT
         v.id, v.titulo, v.descripcion, v.habilidades_requeridas,
         v.experiencia_minima, v.nivel_estudios, v.modalidad,
         v.tipo_contrato, v.ubicacion, v.departamento,
         v.rango_salarial_min, v.rango_salarial_max, v.moneda,
         v.published_at, v.slug, v.organization_id,
         o.name as empresa_nombre,
         os.portal_logo_url as empresa_logo,
         COALESCE(os.portal_color_primario, '#00BCD4') as color_primario,
         os.portal_descripcion as empresa_descripcion,
         os.portal_website as empresa_website
       FROM vacantes v
       JOIN organizations o ON o.id = v.organization_id
       LEFT JOIN org_settings os ON os.organization_id = o.id
       WHERE v.organization_id = $1 AND v.is_published = true AND v.estado = 'publicada'
       ORDER BY v.published_at DESC`
    : `SELECT
         v.id, v.titulo, v.descripcion, v.habilidades_requeridas,
         v.experiencia_minima, v.nivel_estudios, v.modalidad,
         v.tipo_contrato, v.ubicacion, v.departamento,
         v.rango_salarial_min, v.rango_salarial_max, v.moneda,
         v.published_at, v.slug, v.organization_id,
         o.name as empresa_nombre,
         os.portal_logo_url as empresa_logo,
         COALESCE(os.portal_color_primario, '#00BCD4') as color_primario,
         os.portal_descripcion as empresa_descripcion,
         os.portal_website as empresa_website
       FROM vacantes v
       JOIN organizations o ON o.id = v.organization_id
       LEFT JOIN org_settings os ON os.organization_id = o.id
       WHERE v.is_published = true AND v.estado = 'publicada'
       ORDER BY v.published_at DESC`;

  const result = await pool.query(query, orgId ? [orgId] : []);
  return result.rows;
}
