/**
 * Seed completo para testing integral de Hirely.
 *
 * Ejecutar: npx tsx src/lib/db/seed.ts
 *
 * DATOS QUE GENERA:
 * - 1 organización (Nivelics)
 * - 3 usuarios (admin, recruiter, interviewer)
 * - 3 vacantes (publicada con pipeline, publicada nueva, borrador)
 * - 8 candidatos con CVs parseados
 * - 8 aplicaciones en diferentes estados del pipeline
 * - 1 plantilla de contrato
 * - Org settings con checklist de documentos
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local for standalone execution
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.substring(0, eqIdx);
        const value = trimmed.substring(eqIdx + 1);
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
} catch { /* .env.local may not exist */ }

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  console.log('🌱 Iniciando seed de datos de prueba...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ══════════════════════════════════════════
    // 1. ORGANIZACIÓN
    // ══════════════════════════════════════════
    console.log('📦 Creando organización...');
    const org = await client.query(`
      INSERT INTO organizations (name, slug, plan)
      VALUES ('Nivelics', 'nivelics', 'pro')
      ON CONFLICT (slug) DO UPDATE SET name = 'Nivelics'
      RETURNING id
    `);
    const orgId = org.rows[0].id;

    // ══════════════════════════════════════════
    // 2. USUARIOS
    // ══════════════════════════════════════════
    console.log('👥 Creando usuarios...');

    const admin = await client.query(`
      INSERT INTO users (organization_id, email, name, role, password_hash, is_active)
      VALUES ($1, 'camilo@nivelics.com', 'Camilo García', 'admin', '$2b$10$dummyhash', true)
      ON CONFLICT (email) DO UPDATE SET name = 'Camilo García', organization_id = $1
      RETURNING id
    `, [orgId]);
    const adminId = admin.rows[0].id;

    const recruiter = await client.query(`
      INSERT INTO users (organization_id, email, name, role, password_hash, is_active)
      VALUES ($1, 'ana@nivelics.com', 'Ana Martínez', 'recruiter', '$2b$10$dummyhash', true)
      ON CONFLICT (email) DO UPDATE SET name = 'Ana Martínez', organization_id = $1
      RETURNING id
    `, [orgId]);
    const recruiterId = recruiter.rows[0].id;

    await client.query(`
      INSERT INTO users (organization_id, email, name, role, password_hash, is_active)
      VALUES ($1, 'david@nivelics.com', 'David López', 'interviewer', '$2b$10$dummyhash', true)
      ON CONFLICT (email) DO UPDATE SET name = 'David López', organization_id = $1
      RETURNING id
    `, [orgId]);

    // ══════════════════════════════════════════
    // 3. ORG SETTINGS
    // ══════════════════════════════════════════
    console.log('⚙️  Configurando organización...');
    await client.query(`
      INSERT INTO org_settings (organization_id, email_remitente, checklist_documentos,
        portal_descripcion, portal_color_primario, portal_website)
      VALUES ($1, 'rrhh@nivelics.com', $2,
        'Empresa de tecnología enfocada en soluciones digitales innovadoras.',
        '#00BCD4', 'https://nivelics.com')
      ON CONFLICT (organization_id) DO UPDATE SET
        email_remitente = 'rrhh@nivelics.com',
        checklist_documentos = $2,
        portal_descripcion = 'Empresa de tecnología enfocada en soluciones digitales innovadoras.',
        portal_website = 'https://nivelics.com'
    `, [orgId, JSON.stringify([
      { tipo: 'cedula', label: 'Cédula de ciudadanía', requerido: true },
      { tipo: 'certificados_estudio', label: 'Certificados de estudio', requerido: true },
      { tipo: 'antecedentes_disciplinarios', label: 'Antecedentes disciplinarios', requerido: true },
      { tipo: 'certificacion_bancaria', label: 'Certificación bancaria', requerido: true },
      { tipo: 'certificados_laborales', label: 'Certificados laborales', requerido: false },
    ])]);

    // ══════════════════════════════════════════
    // 4. VACANTES
    // ══════════════════════════════════════════
    console.log('💼 Creando vacantes...');

    // Vacante 1: Publicada, con candidatos en todo el pipeline
    const v1 = await client.query(`
      INSERT INTO vacantes (
        organization_id, created_by, titulo, descripcion,
        habilidades_requeridas, experiencia_minima, nivel_estudios,
        rango_salarial_min, rango_salarial_max, moneda,
        modalidad, tipo_contrato, ubicacion, departamento, estado,
        criterios_evaluacion, score_minimo,
        slug, is_published, published_at, views_count, applications_count
      ) VALUES (
        $1, $2,
        'Desarrollador Full Stack Senior',
        'Buscamos un desarrollador Full Stack con experiencia en React, Node.js y PostgreSQL para liderar proyectos de desarrollo web. El candidato ideal tiene experiencia en arquitectura de microservicios, CI/CD y metodologías ágiles. Responsabilidades: diseñar y desarrollar APIs RESTful, implementar interfaces de usuario con React/TypeScript, optimizar rendimiento de bases de datos, mentorear desarrolladores junior.',
        $3, 3, 'Profesional',
        6000000, 10000000, 'COP',
        'remoto', 'laboral', 'Bogotá, Colombia', 'Tecnología', 'publicada',
        $4, 70,
        'desarrollador-full-stack-senior-nivelics-test01',
        true, NOW() - interval '7 days', 150, 0
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      orgId, adminId,
      JSON.stringify(['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL', 'REST API']),
      JSON.stringify({
        experiencia: 0.30,
        habilidades: 0.25,
        educacion: 0.15,
        idiomas: 0.15,
        certificaciones: 0.10,
        keywords: 0.05,
      })
    ]);

    let vacanteId1 = v1.rows[0]?.id;
    if (!vacanteId1) {
      const existing = await client.query(
        "SELECT id FROM vacantes WHERE slug = 'desarrollador-full-stack-senior-nivelics-test01'"
      );
      vacanteId1 = existing.rows[0]?.id;
    }

    // Vacante 2: Publicada, pocos candidatos
    const v2 = await client.query(`
      INSERT INTO vacantes (
        organization_id, created_by, titulo, descripcion,
        habilidades_requeridas, experiencia_minima, nivel_estudios,
        rango_salarial_min, rango_salarial_max, moneda,
        modalidad, tipo_contrato, ubicacion, departamento, estado,
        score_minimo, slug, is_published, published_at
      ) VALUES (
        $1, $2,
        'Diseñador UX/UI',
        'Buscamos un diseñador UX/UI con experiencia en Figma, Design Systems y research de usuarios para crear interfaces intuitivas y atractivas.',
        $3, 2, 'Profesional',
        4000000, 7000000, 'COP',
        'hibrido', 'laboral', 'Bogotá, Colombia', 'Diseño', 'publicada',
        65,
        'disenador-ux-ui-nivelics-test02',
        true, NOW() - interval '3 days'
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      orgId, adminId,
      JSON.stringify(['Figma', 'Design Systems', 'User Research', 'Prototyping', 'Adobe Creative Suite'])
    ]);

    let vacanteId2 = v2.rows[0]?.id;
    if (!vacanteId2) {
      const existing = await client.query(
        "SELECT id FROM vacantes WHERE slug = 'disenador-ux-ui-nivelics-test02'"
      );
      vacanteId2 = existing.rows[0]?.id;
    }

    // Vacante 3: Borrador
    await client.query(`
      INSERT INTO vacantes (
        organization_id, created_by, titulo, descripcion,
        habilidades_requeridas, experiencia_minima,
        modalidad, tipo_contrato, ubicacion, departamento, estado
      ) VALUES (
        $1, $2,
        'DevOps Engineer',
        'Ingeniero DevOps con experiencia en Kubernetes, Terraform y pipelines CI/CD.',
        $3, 4,
        'remoto', 'prestacion_servicios', 'Remoto', 'Infraestructura', 'borrador'
      )
      ON CONFLICT DO NOTHING
    `, [
      orgId, adminId,
      JSON.stringify(['Kubernetes', 'Terraform', 'Docker', 'AWS', 'CI/CD', 'Linux'])
    ]);

    // ══════════════════════════════════════════
    // 5. CANDIDATOS (8 candidatos con diferentes perfiles)
    // ══════════════════════════════════════════
    console.log('🧑‍💼 Creando candidatos...');

    const candidatos = [
      {
        nombre: 'Carlos', apellido: 'Méndez',
        email: 'carlos.mendez@gmail.com', telefono: '+57 300 123 4567',
        linkedin_url: 'https://linkedin.com/in/carlosmendez',
        ubicacion: 'Bogotá, Colombia', experiencia_anos: 5, nivel_educativo: 'Profesional',
        habilidades: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'Avanzado' }],
        certificaciones: [{ nombre: 'AWS Solutions Architect', institucion: 'Amazon', anio: 2023 }],
        fuente: 'portal',
        cv_parsed: {
          nombre: 'Carlos Méndez', email: 'carlos.mendez@gmail.com',
          experiencia: [
            { cargo: 'Full Stack Developer', empresa: 'TechCo', duracion_meses: 36, tecnologias: ['React', 'Node.js', 'PostgreSQL'] },
            { cargo: 'Frontend Developer', empresa: 'StartupX', duracion_meses: 24, tecnologias: ['React', 'TypeScript', 'GraphQL'] },
          ],
          educacion: [{ titulo: 'Ingeniería de Sistemas', institucion: 'Universidad Nacional', nivel: 'profesional' }],
          habilidades_tecnicas: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL'],
          idiomas: [{ idioma: 'Español', nivel: 'nativo' }, { idioma: 'Inglés', nivel: 'avanzado' }],
          certificaciones: [{ nombre: 'AWS Solutions Architect', institucion: 'Amazon' }],
          parsed_at: new Date().toISOString(),
        },
      },
      {
        nombre: 'María Fernanda', apellido: 'López',
        email: 'maria.lopez@outlook.com', telefono: '+57 310 987 6543',
        ubicacion: 'Medellín, Colombia', experiencia_anos: 7, nivel_educativo: 'Maestría',
        habilidades: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Kubernetes', 'AWS', 'Terraform'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'Avanzado' }, { idioma: 'Portugués', nivel: 'Intermedio' }],
        certificaciones: [{ nombre: 'AWS DevOps Professional', institucion: 'Amazon', anio: 2024 }],
        fuente: 'linkedin',
        cv_parsed: {
          nombre: 'María Fernanda López',
          experiencia: [
            { cargo: 'Tech Lead', empresa: 'MegaCorp', duracion_meses: 48, tecnologias: ['React', 'Node.js', 'AWS', 'Kubernetes'] },
            { cargo: 'Senior Developer', empresa: 'DigitalAgency', duracion_meses: 36, tecnologias: ['React', 'TypeScript', 'PostgreSQL'] },
          ],
          educacion: [
            { titulo: 'Maestría en Ingeniería de Software', institucion: 'Universidad de los Andes', nivel: 'maestria' },
            { titulo: 'Ingeniería de Sistemas', institucion: 'Universidad de Antioquia', nivel: 'profesional' },
          ],
          habilidades_tecnicas: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Kubernetes', 'AWS', 'Terraform', 'CI/CD'],
          idiomas: [{ idioma: 'Español', nivel: 'nativo' }, { idioma: 'Inglés', nivel: 'avanzado' }, { idioma: 'Portugués', nivel: 'intermedio' }],
          certificaciones: [{ nombre: 'AWS DevOps Professional', institucion: 'Amazon' }],
          parsed_at: new Date().toISOString(),
        },
      },
      {
        nombre: 'Andrés', apellido: 'Rodríguez',
        email: 'andres.rodriguez@hotmail.com', telefono: '+57 315 456 7890',
        ubicacion: 'Cali, Colombia', experiencia_anos: 2, nivel_educativo: 'Profesional',
        habilidades: ['JavaScript', 'React', 'CSS', 'HTML'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }],
        certificaciones: [], fuente: 'portal',
        cv_parsed: {
          nombre: 'Andrés Rodríguez',
          experiencia: [{ cargo: 'Junior Frontend Developer', empresa: 'SmallShop', duracion_meses: 24, tecnologias: ['React', 'JavaScript'] }],
          educacion: [{ titulo: 'Ingeniería de Sistemas', institucion: 'Universidad del Valle', nivel: 'profesional' }],
          habilidades_tecnicas: ['JavaScript', 'React', 'CSS', 'HTML'],
          idiomas: [{ idioma: 'Español', nivel: 'nativo' }],
          certificaciones: [],
          parsed_at: new Date().toISOString(),
        },
      },
      {
        nombre: 'Laura', apellido: 'Gutiérrez',
        email: 'laura.gutierrez@gmail.com', telefono: '+57 320 111 2233',
        ubicacion: 'Bogotá, Colombia', experiencia_anos: 4, nivel_educativo: 'Profesional',
        habilidades: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Docker'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'Intermedio' }],
        certificaciones: [], fuente: 'portal',
        cv_parsed: {
          nombre: 'Laura Gutiérrez',
          experiencia: [
            { cargo: 'Backend Developer', empresa: 'DataCorp', duracion_meses: 30, tecnologias: ['Node.js', 'MongoDB', 'Docker'] },
            { cargo: 'Full Stack Developer', empresa: 'WebStudio', duracion_meses: 18, tecnologias: ['React', 'Node.js'] },
          ],
          educacion: [{ titulo: 'Ingeniería de Software', institucion: 'Pontificia Javeriana', nivel: 'profesional' }],
          habilidades_tecnicas: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'Docker'],
          idiomas: [{ idioma: 'Español', nivel: 'nativo' }, { idioma: 'Inglés', nivel: 'intermedio' }],
          certificaciones: [],
          parsed_at: new Date().toISOString(),
        },
      },
      {
        nombre: 'Santiago', apellido: 'Herrera',
        email: 'santiago.herrera@gmail.com', telefono: '+57 312 555 6677',
        ubicacion: 'Barranquilla, Colombia', experiencia_anos: 6, nivel_educativo: 'Especialización',
        habilidades: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'GraphQL', 'Microservices'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'Avanzado' }],
        certificaciones: [{ nombre: 'AWS Cloud Practitioner', institucion: 'Amazon', anio: 2022 }],
        fuente: 'referido',
        cv_parsed: {
          nombre: 'Santiago Herrera',
          experiencia: [
            { cargo: 'Senior Full Stack Developer', empresa: 'CloudFirst', duracion_meses: 36, tecnologias: ['React', 'Node.js', 'AWS', 'GraphQL'] },
            { cargo: 'Full Stack Developer', empresa: 'InnoTech', duracion_meses: 36, tecnologias: ['React', 'TypeScript', 'PostgreSQL'] },
          ],
          educacion: [
            { titulo: 'Especialización en Arquitectura de Software', institucion: 'Universidad del Norte', nivel: 'especializacion' },
            { titulo: 'Ingeniería de Sistemas', institucion: 'Universidad del Norte', nivel: 'profesional' },
          ],
          habilidades_tecnicas: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS', 'GraphQL', 'Microservices', 'CI/CD'],
          idiomas: [{ idioma: 'Español', nivel: 'nativo' }, { idioma: 'Inglés', nivel: 'avanzado' }],
          certificaciones: [{ nombre: 'AWS Cloud Practitioner', institucion: 'Amazon' }],
          parsed_at: new Date().toISOString(),
        },
      },
      {
        nombre: 'Valentina', apellido: 'Castro',
        email: 'valentina.castro@gmail.com', telefono: '+57 300 888 9999',
        ubicacion: 'Bogotá, Colombia', experiencia_anos: 1, nivel_educativo: 'Tecnólogo',
        habilidades: ['HTML', 'CSS', 'JavaScript', 'Figma'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }],
        certificaciones: [], fuente: 'portal',
        cv_parsed: { parsed_at: new Date().toISOString() },
      },
      {
        nombre: 'Diego', apellido: 'Ramírez',
        email: 'diego.ramirez@gmail.com', telefono: '+57 318 222 3344',
        ubicacion: 'Pereira, Colombia', experiencia_anos: 3, nivel_educativo: 'Profesional',
        habilidades: ['Python', 'Django', 'PostgreSQL', 'Docker'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'Básico' }],
        certificaciones: [], fuente: 'portal',
        cv_parsed: { parsed_at: new Date().toISOString() },
      },
      {
        nombre: 'Camila', apellido: 'Vargas',
        email: 'camila.vargas@gmail.com', telefono: '+57 305 444 5566',
        ubicacion: 'Bucaramanga, Colombia', experiencia_anos: 8, nivel_educativo: 'Maestría',
        habilidades: ['React', 'Angular', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL', 'MongoDB'],
        idiomas: [{ idioma: 'Español', nivel: 'Nativo' }, { idioma: 'Inglés', nivel: 'Avanzado' }, { idioma: 'Francés', nivel: 'Intermedio' }],
        certificaciones: [{ nombre: 'AWS Solutions Architect', institucion: 'Amazon', anio: 2024 }, { nombre: 'GCP Professional', institucion: 'Google', anio: 2023 }],
        fuente: 'linkedin',
        cv_parsed: {
          nombre: 'Camila Vargas',
          experiencia: [
            { cargo: 'Engineering Manager', empresa: 'BigTech', duracion_meses: 48, tecnologias: ['React', 'Node.js', 'AWS'] },
            { cargo: 'Senior Developer', empresa: 'Consulting Co', duracion_meses: 48, tecnologias: ['Angular', 'TypeScript', 'PostgreSQL'] },
          ],
          educacion: [{ titulo: 'Maestría en Ciencias de la Computación', institucion: 'Universidad de los Andes', nivel: 'maestria' }],
          habilidades_tecnicas: ['React', 'Angular', 'Node.js', 'TypeScript', 'AWS', 'PostgreSQL', 'MongoDB'],
          idiomas: [{ idioma: 'Español', nivel: 'nativo' }, { idioma: 'Inglés', nivel: 'avanzado' }, { idioma: 'Francés', nivel: 'intermedio' }],
          certificaciones: [{ nombre: 'AWS Solutions Architect' }, { nombre: 'GCP Professional' }],
          parsed_at: new Date().toISOString(),
        },
      },
    ];

    const candidatoIds: string[] = [];
    for (const c of candidatos) {
      const result = await client.query(`
        INSERT INTO candidatos (
          organization_id, nombre, apellido, email, telefono, linkedin_url, ubicacion,
          experiencia_anos, nivel_educativo, habilidades, idiomas, certificaciones,
          fuente, cv_parsed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (organization_id, email) DO UPDATE SET
          nombre = $2, apellido = $3, telefono = $5, ubicacion = $7,
          habilidades = $10, cv_parsed = $14
        RETURNING id
      `, [
        orgId, c.nombre, c.apellido, c.email, c.telefono,
        c.linkedin_url || null, c.ubicacion,
        c.experiencia_anos, c.nivel_educativo,
        JSON.stringify(c.habilidades), JSON.stringify(c.idiomas),
        JSON.stringify(c.certificaciones), c.fuente,
        JSON.stringify(c.cv_parsed),
      ]);
      candidatoIds.push(result.rows[0].id);
    }

    // ══════════════════════════════════════════
    // 6. APLICACIONES
    // ══════════════════════════════════════════
    console.log('📋 Creando aplicaciones con scores...');

    if (vacanteId1) {
      const apps = [
        // Carlos — Contratado (flujo completo)
        { idx: 0, estado: 'contratado', score_ats: 85.5, score_ia: 78, score_humano: 88, score_final: 83, origen: 'portal' },
        // María — Seleccionada
        { idx: 1, estado: 'seleccionado', score_ats: 92, score_ia: 85, score_humano: 90, score_final: 87.5, origen: 'linkedin' },
        // Andrés — Descartado (score bajo)
        { idx: 2, estado: 'descartado', score_ats: 35, score_ia: null, score_humano: null, score_final: null, origen: 'portal' },
        // Laura — Entrevista humana
        { idx: 3, estado: 'entrevista_humana', score_ats: 72, score_ia: 70, score_humano: null, score_final: null, origen: 'portal' },
        // Santiago — Entrevista IA
        { idx: 4, estado: 'entrevista_ia', score_ats: 80, score_ia: null, score_humano: null, score_final: null, origen: 'referido' },
        // Valentina — Descartada
        { idx: 5, estado: 'descartado', score_ats: 28, score_ia: null, score_humano: null, score_final: null, origen: 'portal' },
        // Diego — En revisión
        { idx: 6, estado: 'en_revision', score_ats: 55, score_ia: null, score_humano: null, score_final: null, origen: 'portal' },
        // Camila — Preseleccionada
        { idx: 7, estado: 'preseleccionado', score_ats: 90, score_ia: null, score_humano: null, score_final: null, origen: 'linkedin' },
      ];

      for (const app of apps) {
        await client.query(`
          INSERT INTO aplicaciones (organization_id, vacante_id, candidato_id, estado, score_ats, score_ia, score_humano, score_final, peso_ia, peso_humano, origen)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.50, 0.50, $9)
          ON CONFLICT (vacante_id, candidato_id) DO UPDATE SET
            estado = $4, score_ats = $5, score_ia = $6, score_humano = $7, score_final = $8, origen = $9
        `, [
          orgId, vacanteId1, candidatoIds[app.idx],
          app.estado, app.score_ats, app.score_ia, app.score_humano, app.score_final, app.origen,
        ]);
      }

      // Update applications_count
      await client.query(
        'UPDATE vacantes SET applications_count = 8 WHERE id = $1',
        [vacanteId1]
      );
    }

    // ══════════════════════════════════════════
    // 7. PLANTILLA DE CONTRATO
    // ══════════════════════════════════════════
    console.log('📝 Creando plantilla de contrato...');
    await client.query(`
      INSERT INTO plantillas_contrato (organization_id, nombre, tipo, contenido_html, variables, is_active)
      VALUES ($1, 'Contrato Laboral Estándar', 'laboral',
        '<h1>CONTRATO DE TRABAJO</h1><p>Entre <strong>{{empresa_nombre}}</strong> (NIT: {{empresa_nit}}) y <strong>{{candidato_nombre}}</strong> (CC: {{candidato_cedula}}), se celebra el presente contrato de trabajo a término {{tipo_termino}} con las siguientes condiciones:</p><h2>1. CARGO</h2><p>{{cargo}}</p><h2>2. SALARIO</h2><p>{{salario}} {{moneda}} mensuales</p><h2>3. FECHA DE INICIO</h2><p>{{fecha_inicio}}</p><h2>4. LUGAR DE TRABAJO</h2><p>{{ubicacion}}</p>',
        $2, true)
      ON CONFLICT DO NOTHING
    `, [
      orgId,
      JSON.stringify(['empresa_nombre', 'empresa_nit', 'candidato_nombre', 'candidato_cedula', 'cargo', 'salario', 'moneda', 'fecha_inicio', 'tipo_termino', 'ubicacion']),
    ]);

    await client.query('COMMIT');

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('✅ Seed completado exitosamente');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('📊 Resumen:');
    console.log('   🏢 1 organización: Nivelics');
    console.log('   👥 3 usuarios: admin, recruiter, interviewer');
    console.log('   💼 3 vacantes: 1 publicada con candidatos, 1 publicada nueva, 1 borrador');
    console.log('   🧑‍💼 8 candidatos con CVs parseados');
    console.log('   📋 8 aplicaciones en diferentes estados del pipeline');
    console.log('   📝 1 plantilla de contrato');
    console.log('');
    console.log('🔑 Credenciales de prueba:');
    console.log('   Email: camilo@nivelics.com (admin)');
    console.log('   Email: ana@nivelics.com (recruiter)');
    console.log('   Email: david@nivelics.com (interviewer)');
    console.log('');
    console.log('🌐 URLs de prueba:');
    console.log('   Portal: http://localhost:3500/empleo/desarrollador-full-stack-senior-nivelics-test01');
    console.log('   Portal: http://localhost:3500/empleo/disenador-ux-ui-nivelics-test02');
    console.log('');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en seed:', error);
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => { console.error('Fatal:', e); process.exit(1); });
