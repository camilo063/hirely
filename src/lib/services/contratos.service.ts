import { pool } from '../db';
import { UUID } from '../types/common.types';
import {
  Contrato, ContratoConDetalles, PlantillaContrato, ContratoVersion,
  CreateContratoInput, UpdateContratoInput, DatosContrato,
  TipoContrato, VARIABLES_CONTRATO,
} from '../types/contrato.types';
import { PLANTILLAS_CONTRATO_DEFAULT, renderPlantillaContrato } from '../utils/plantillas-contrato-default';
import { NotFoundError } from '../utils/errors';
import { crearNotificacion } from '@/lib/services/notificaciones.service';
import { emitirNotificacion } from '@/lib/services/sse-clients';

// ─── LIST / GET ──────────────────────────────────

export async function listContratos(
  orgId: UUID,
  filters?: { estado?: string; tipo?: string; search?: string }
): Promise<ContratoConDetalles[]> {
  const conditions = ['ct.organization_id = $1'];
  const params: unknown[] = [orgId];
  let idx = 2;

  if (filters?.estado) {
    conditions.push(`ct.estado = $${idx++}`);
    params.push(filters.estado);
  }
  if (filters?.tipo) {
    conditions.push(`ct.tipo = $${idx++}`);
    params.push(filters.tipo);
  }
  if (filters?.search) {
    conditions.push(`(c.nombre ILIKE $${idx} OR c.apellido ILIKE $${idx} OR v.titulo ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const result = await pool.query<ContratoConDetalles>(
    `SELECT ct.*,
      c.nombre as candidato_nombre, COALESCE(c.apellido, '') as candidato_apellido, c.email as candidato_email,
      v.titulo as vacante_titulo
    FROM contratos ct
    LEFT JOIN candidatos c ON ct.candidato_id = c.id
    LEFT JOIN vacantes v ON ct.vacante_id = v.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY ct.created_at DESC`,
    params
  );
  return result.rows;
}

export async function getContrato(orgId: UUID, contratoId: UUID): Promise<ContratoConDetalles> {
  const result = await pool.query<ContratoConDetalles & { plantilla_html?: string }>(
    `SELECT ct.*,
      c.nombre as candidato_nombre, COALESCE(c.apellido, '') as candidato_apellido, c.email as candidato_email,
      v.titulo as vacante_titulo,
      pc.contenido_html as plantilla_html
    FROM contratos ct
    LEFT JOIN candidatos c ON ct.candidato_id = c.id
    LEFT JOIN vacantes v ON ct.vacante_id = v.id
    LEFT JOIN plantillas_contrato pc ON pc.id = ct.plantilla_id
    WHERE ct.id = $1 AND ct.organization_id = $2`,
    [contratoId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Contrato', contratoId);

  const contrato = result.rows[0];

  // Re-renderizar desde plantilla real + datos actuales para garantizar consistencia
  if (contrato.plantilla_html && contrato.datos_contrato) {
    const datos = typeof contrato.datos_contrato === 'string'
      ? JSON.parse(contrato.datos_contrato)
      : contrato.datos_contrato;
    contrato.contenido_html = renderPlantillaContrato(contrato.plantilla_html, datos as Record<string, unknown>);
    delete (contrato as unknown as Record<string, unknown>).plantilla_html;
  }

  return contrato;
}

// ─── AUTO-POPULATE ───────────────────────────────

export async function autoPoblarDatos(
  orgId: UUID,
  aplicacionId: UUID,
  tipo: TipoContrato | string
): Promise<Partial<DatosContrato>> {
  const result = await pool.query(
    `SELECT
      a.id as aplicacion_id,
      c.nombre as candidato_nombre,
      COALESCE(c.apellido, '') as candidato_apellido,
      c.email as candidato_email,
      c.telefono as candidato_telefono,
      c.ubicacion as candidato_ubicacion,
      v.titulo as vacante_titulo,
      v.modalidad as vacante_modalidad,
      v.ubicacion as vacante_ubicacion,
      v.rango_salarial_min,
      v.rango_salarial_max,
      o.name as org_nombre,
      o.config_empresa
    FROM aplicaciones a
    JOIN candidatos c ON a.candidato_id = c.id
    JOIN vacantes v ON a.vacante_id = v.id
    JOIN organizations o ON v.organization_id = o.id
    WHERE a.id = $1 AND v.organization_id = $2`,
    [aplicacionId, orgId]
  );

  if (result.rows.length === 0) return {};
  const row = result.rows[0];

  const nombreCompleto = row.candidato_apellido
    ? `${row.candidato_nombre} ${row.candidato_apellido}`
    : row.candidato_nombre;

  const salario = row.rango_salarial_max || row.rango_salarial_min || 0;

  const today = new Date().toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const configEmpresa = (typeof row.config_empresa === 'object' && row.config_empresa) ? row.config_empresa : {};

  const datos: Partial<DatosContrato> = {
    nombre_completo: nombreCompleto,
    correo: row.candidato_email || '',
    telefono: row.candidato_telefono || '',
    ciudad: row.candidato_ubicacion || '',
    cargo: row.vacante_titulo || '',
    empresa_nombre: configEmpresa.nombre || row.org_nombre || '',
    empresa_nit: configEmpresa.nit || '',
    empresa_representante: configEmpresa.representante_legal || '',
    empresa_direccion: configEmpresa.direccion || '',
    salario: salario,
    modalidad: row.vacante_modalidad || '',
    ubicacion_trabajo: row.vacante_ubicacion || '',
    fecha_contrato: today,
    fecha_inicio: '',
    ciudad_contrato: configEmpresa.ciudad || 'Bogotá D.C.',
  };

  // Set defaults from VARIABLES_CONTRATO
  const variables = VARIABLES_CONTRATO[tipo as TipoContrato] || VARIABLES_CONTRATO['laboral'] || [];
  for (const v of variables) {
    if (v.default_value && !datos[v.key]) {
      (datos as Record<string, unknown>)[v.key] = v.default_value;
    }
  }

  return datos;
}

// ─── CREATE ──────────────────────────────────────

export async function createContrato(
  orgId: UUID,
  userId: UUID,
  input: CreateContratoInput
): Promise<Contrato> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve candidato_id and vacante_id from aplicacion if not provided
    let candidatoId = input.candidato_id;
    let vacanteId = input.vacante_id;
    if (!candidatoId || !vacanteId) {
      const appResult = await client.query(
        'SELECT candidato_id, vacante_id FROM aplicaciones WHERE id = $1',
        [input.aplicacion_id]
      );
      if (appResult.rows.length > 0) {
        candidatoId = candidatoId || appResult.rows[0].candidato_id;
        vacanteId = vacanteId || appResult.rows[0].vacante_id;
      }
    }

    const tipo = input.tipo || 'laboral';

    // Render HTML from template
    let htmlContent: string | null = null;
    if (input.plantilla_id) {
      const tplResult = await client.query<PlantillaContrato>(
        'SELECT * FROM plantillas_contrato WHERE id = $1 AND organization_id = $2',
        [input.plantilla_id, orgId]
      );
      if (tplResult.rows.length > 0) {
        htmlContent = renderPlantillaContrato(tplResult.rows[0].contenido_html, input.datos as Record<string, unknown>);
      }
    }
    if (!htmlContent) {
      const defaultTpl = PLANTILLAS_CONTRATO_DEFAULT[tipo as TipoContrato] || PLANTILLAS_CONTRATO_DEFAULT['laboral'];
      if (defaultTpl) {
        htmlContent = renderPlantillaContrato(defaultTpl.contenido_html, input.datos as Record<string, unknown>);
      }
    }

    const result = await client.query<Contrato>(
      `INSERT INTO contratos (organization_id, aplicacion_id, candidato_id, vacante_id,
        plantilla_id, tipo, datos_contrato, contenido_html, created_by, version)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)
      RETURNING *`,
      [
        orgId, input.aplicacion_id, candidatoId, vacanteId,
        input.plantilla_id ?? null, tipo, JSON.stringify(input.datos),
        htmlContent, userId,
      ]
    );

    const contrato = result.rows[0];

    // Create initial version record
    await client.query(
      `INSERT INTO contrato_versiones (contrato_id, version, contenido_html, datos_contrato, editado_por, nota_cambio)
      VALUES ($1, 1, $2, $3, $4, 'Versión inicial')`,
      [contrato.id, htmlContent, JSON.stringify(input.datos), userId]
    );

    await client.query('COMMIT');

    // Notificacion en tiempo real
    try {
      const candResult = await pool.query(
        `SELECT c.nombre as candidato_nombre, c.apellido as candidato_apellido
         FROM candidatos c WHERE c.id = $1`,
        [candidatoId]
      );
      const candNombre = candResult.rows.length > 0
        ? `${candResult.rows[0].candidato_nombre} ${candResult.rows[0].candidato_apellido || ''}`.trim()
        : 'Candidato';
      const notif = await crearNotificacion({
        organizacionId: orgId,
        tipo: 'contrato_generado',
        titulo: 'Contrato generado',
        mensaje: `Contrato borrador creado para ${candNombre}`,
        meta: { contrato_id: contrato.id, url: `/contratos/${contrato.id}` },
      });
      if (notif) {
        emitirNotificacion(orgId, {
          type: 'notificacion',
          id: notif.id,
          tipo: 'contrato_generado',
          titulo: 'Contrato generado',
          mensaje: `Contrato borrador creado para ${candNombre}`,
          browser_activo: notif.browser_activo,
          meta: { contrato_id: contrato.id, url: `/contratos/${contrato.id}` },
          created_at: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.error('[notificacion] Error:', e);
    }

    return contrato;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── UPDATE ──────────────────────────────────────

export async function updateContrato(
  orgId: UUID,
  contratoId: UUID,
  userId: UUID,
  input: UpdateContratoInput
): Promise<Contrato> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current contrato
    const current = await client.query<Contrato>(
      'SELECT * FROM contratos WHERE id = $1 AND organization_id = $2',
      [contratoId, orgId]
    );
    if (current.rows.length === 0) throw new NotFoundError('Contrato', contratoId);

    const contrato = current.rows[0];
    const fields: string[] = [];
    const params: unknown[] = [contratoId, orgId];
    let paramIndex = 3;

    let newDatos = contrato.datos_contrato;
    if (input.datos) {
      newDatos = { ...contrato.datos_contrato, ...input.datos };
      fields.push(`datos_contrato = $${paramIndex++}`);
      params.push(JSON.stringify(newDatos));
    }

    const htmlContent = input.contenido_html || input.html_content;
    if (htmlContent) {
      fields.push(`contenido_html = $${paramIndex++}`);
      params.push(htmlContent);
    }

    if (input.estado) {
      fields.push(`estado = $${paramIndex++}`);
      params.push(input.estado);
      if (input.estado === 'firmado') {
        fields.push('firmado_at = NOW()');
      }
    }

    if (fields.length === 0) {
      await client.query('COMMIT');
      return getContrato(orgId, contratoId);
    }

    // Increment version
    const newVersion = (contrato.version || 1) + 1;
    fields.push(`version = $${paramIndex++}`);
    params.push(newVersion);
    fields.push('updated_at = NOW()');

    const result = await client.query<Contrato>(
      `UPDATE contratos SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
      params
    );

    // Create version record
    await client.query(
      `INSERT INTO contrato_versiones (contrato_id, version, contenido_html, datos_contrato, editado_por, nota_cambio)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        contratoId, newVersion,
        htmlContent || result.rows[0].contenido_html,
        JSON.stringify(newDatos),
        userId,
        input.nota_cambio || null,
      ]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── REGENERATE HTML ─────────────────────────────

export async function regenerarHtml(
  orgId: UUID,
  contratoId: UUID,
  userId: UUID
): Promise<Contrato> {
  const contrato = await getContrato(orgId, contratoId);
  const datos = contrato.datos_contrato || {};

  // Refrescar datos de empresa desde config_empresa actual
  const orgResult = await pool.query(
    'SELECT name, config_empresa FROM organizations WHERE id = $1',
    [orgId]
  );
  if (orgResult.rows.length > 0) {
    const org = orgResult.rows[0];
    const cfg = org.config_empresa || {};
    datos.empresa_nombre = org.name || datos.empresa_nombre;
    if (cfg.nit) datos.empresa_nit = cfg.nit;
    if (cfg.representante_legal) datos.empresa_representante = cfg.representante_legal;
    if (cfg.direccion) datos.empresa_direccion = cfg.direccion;
    if (cfg.ciudad) datos.ciudad_contrato = cfg.ciudad;
  }

  let template = '';
  if (contrato.plantilla_id) {
    const tplResult = await pool.query<PlantillaContrato>(
      'SELECT contenido_html FROM plantillas_contrato WHERE id = $1 AND organization_id = $2',
      [contrato.plantilla_id, orgId]
    );
    if (tplResult.rows.length > 0) {
      template = tplResult.rows[0].contenido_html;
    }
  }
  if (!template) {
    const defaultTpl = PLANTILLAS_CONTRATO_DEFAULT[contrato.tipo as TipoContrato];
    if (defaultTpl) template = defaultTpl.contenido_html;
  }

  const htmlContent = template ? renderPlantillaContrato(template, datos as Record<string, unknown>) : '';

  return updateContrato(orgId, contratoId, userId, {
    datos: datos as Partial<DatosContrato>,
    contenido_html: htmlContent,
    nota_cambio: 'HTML regenerado desde plantilla',
  });
}

// ─── VERSIONS ────────────────────────────────────

export async function getVersiones(orgId: UUID, contratoId: UUID): Promise<ContratoVersion[]> {
  // Verify access
  const check = await pool.query(
    'SELECT id FROM contratos WHERE id = $1 AND organization_id = $2',
    [contratoId, orgId]
  );
  if (check.rows.length === 0) throw new NotFoundError('Contrato', contratoId);

  const result = await pool.query<ContratoVersion>(
    `SELECT cv.*, u.name as editado_por_nombre
    FROM contrato_versiones cv
    LEFT JOIN users u ON cv.editado_por = u.id
    WHERE cv.contrato_id = $1
    ORDER BY cv.version DESC`,
    [contratoId]
  );
  return result.rows;
}

// ─── PLANTILLAS CRUD ─────────────────────────────

export async function listPlantillas(orgId: UUID): Promise<PlantillaContrato[]> {
  const result = await pool.query<PlantillaContrato>(
    'SELECT * FROM plantillas_contrato WHERE organization_id = $1 AND is_active = true ORDER BY nombre',
    [orgId]
  );
  return result.rows;
}

export async function getPlantilla(orgId: UUID, plantillaId: UUID): Promise<PlantillaContrato> {
  const result = await pool.query<PlantillaContrato>(
    'SELECT * FROM plantillas_contrato WHERE id = $1 AND organization_id = $2',
    [plantillaId, orgId]
  );
  if (result.rows.length === 0) throw new NotFoundError('Plantilla', plantillaId);
  return result.rows[0];
}

export async function createPlantilla(
  orgId: UUID,
  data: { nombre: string; tipo: string; contenido_html: string; variables?: unknown[] }
): Promise<PlantillaContrato> {
  const result = await pool.query<PlantillaContrato>(
    `INSERT INTO plantillas_contrato (organization_id, nombre, tipo, contenido_html, variables)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [orgId, data.nombre, data.tipo, data.contenido_html, JSON.stringify(data.variables || [])]
  );
  return result.rows[0];
}

export async function updatePlantilla(
  orgId: UUID,
  plantillaId: UUID,
  data: { nombre?: string; contenido_html?: string; variables?: unknown[]; is_active?: boolean }
): Promise<PlantillaContrato> {
  const fields: string[] = [];
  const params: unknown[] = [plantillaId, orgId];
  let idx = 3;

  if (data.nombre !== undefined) { fields.push(`nombre = $${idx++}`); params.push(data.nombre); }
  if (data.contenido_html !== undefined) { fields.push(`contenido_html = $${idx++}`); params.push(data.contenido_html); }
  if (data.variables !== undefined) { fields.push(`variables = $${idx++}`); params.push(JSON.stringify(data.variables)); }
  if (data.is_active !== undefined) { fields.push(`is_active = $${idx++}`); params.push(data.is_active); }

  if (fields.length === 0) return getPlantilla(orgId, plantillaId);
  fields.push('updated_at = NOW()');

  const result = await pool.query<PlantillaContrato>(
    `UPDATE plantillas_contrato SET ${fields.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`,
    params
  );
  if (result.rows.length === 0) throw new NotFoundError('Plantilla', plantillaId);
  return result.rows[0];
}

export async function deletePlantilla(orgId: UUID, plantillaId: UUID): Promise<void> {
  await pool.query(
    'UPDATE plantillas_contrato SET is_active = false, updated_at = NOW() WHERE id = $1 AND organization_id = $2',
    [plantillaId, orgId]
  );
}

// ─── LEGACY COMPAT ───────────────────────────────
// generateContratoHtml kept for backward compatibility
export async function generateContratoHtml(
  orgId: UUID,
  datos: DatosContrato,
  plantillaId: UUID | null
): Promise<string> {
  let template = '';

  if (plantillaId) {
    const result = await pool.query<PlantillaContrato>(
      'SELECT * FROM plantillas_contrato WHERE id = $1 AND organization_id = $2',
      [plantillaId, orgId]
    );
    if (result.rows.length > 0) {
      template = result.rows[0].contenido_html;
    }
  }

  if (!template) {
    const defaultTpl = PLANTILLAS_CONTRATO_DEFAULT.laboral;
    template = defaultTpl.contenido_html;
  }

  return renderPlantillaContrato(template, datos as Record<string, unknown>);
}
