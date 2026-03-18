import { Pool } from 'pg';

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://hirely_user:hirely_dev_2026@localhost:5434/hirely',
  });

  console.log('Seeding database...');

  // Organization
  const orgResult = await pool.query(`
    INSERT INTO organizations (id, name, slug, plan)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Hirely Demo', 'hirely-demo', 'professional')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const orgId = orgResult.rows[0].id;
  console.log('  ✓ Organization created');

  // Admin user (password: admin123)
  await pool.query(`
    INSERT INTO users (id, organization_id, email, name, role, password_hash)
    VALUES (
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      $1,
      'admin@hirely.app',
      'Admin Hirely',
      'admin',
      '$2b$10$placeholder_hash_for_dev'
    )
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
  `, [orgId]);
  console.log('  ✓ Admin user created');

  // Recruiter user
  await pool.query(`
    INSERT INTO users (id, organization_id, email, name, role, password_hash)
    VALUES (
      'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      $1,
      'recruiter@hirely.app',
      'Maria Garcia',
      'recruiter',
      '$2b$10$placeholder_hash_for_dev'
    )
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
  `, [orgId]);
  console.log('  ✓ Recruiter user created');

  // Vacantes
  await pool.query(`
    INSERT INTO vacantes (id, organization_id, created_by, titulo, descripcion, habilidades_requeridas, experiencia_minima, nivel_estudios, rango_salarial_min, rango_salarial_max, moneda, modalidad, tipo_contrato, ubicacion, estado, criterios_evaluacion, score_minimo)
    VALUES
    (
      'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
      $1,
      'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      'Senior Full Stack Developer',
      'Buscamos un desarrollador Full Stack senior con experiencia en React, Node.js y PostgreSQL para liderar el desarrollo de nuestra plataforma SaaS. El candidato ideal debe tener experiencia en arquitectura de microservicios y metodologias agiles.',
      '["React", "Node.js", "TypeScript", "PostgreSQL", "Docker", "AWS"]',
      5,
      'Profesional',
      8000000,
      12000000,
      'COP',
      'remoto',
      'laboral',
      'Bogota, Colombia',
      'publicada',
      '{"experiencia": 0.30, "habilidades": 0.25, "educacion": 0.15, "idiomas": 0.15, "certificaciones": 0.10, "keywords": 0.05}',
      75
    ),
    (
      'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55',
      $1,
      'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
      'Product Designer UX/UI',
      'Estamos en busqueda de un Product Designer con experiencia en diseno de interfaces para productos digitales B2B. Debe dominar Figma, tener experiencia en Design Systems y metodologias de User Research.',
      '["Figma", "Design Systems", "User Research", "Prototyping", "UI Design"]',
      3,
      'Profesional',
      6000000,
      9000000,
      'COP',
      'hibrido',
      'laboral',
      'Medellin, Colombia',
      'publicada',
      '{"experiencia": 0.25, "habilidades": 0.30, "educacion": 0.15, "idiomas": 0.15, "certificaciones": 0.10, "keywords": 0.05}',
      70
    )
    ON CONFLICT DO NOTHING
  `, [orgId]);
  console.log('  ✓ 2 vacantes created');

  // Candidatos
  const candidatos = [
    { id: 'f0eebc99-0001-4ef8-bb6d-6bb9bd380001', nombre: 'Carlos Rodriguez', email: 'carlos.rodriguez@email.com', telefono: '+57 300 123 4567', habilidades: '["React", "Node.js", "TypeScript", "PostgreSQL", "Docker"]', experiencia: 6, nivel: 'Maestria', ubicacion: 'Bogota', fuente: 'linkedin' },
    { id: 'f0eebc99-0002-4ef8-bb6d-6bb9bd380002', nombre: 'Ana Martinez', email: 'ana.martinez@email.com', telefono: '+57 301 234 5678', habilidades: '["React", "Python", "AWS", "MongoDB"]', experiencia: 4, nivel: 'Profesional', ubicacion: 'Medellin', fuente: 'linkedin' },
    { id: 'f0eebc99-0003-4ef8-bb6d-6bb9bd380003', nombre: 'Luis Hernandez', email: 'luis.hernandez@email.com', telefono: '+57 302 345 6789', habilidades: '["Angular", "Java", "Spring Boot", "MySQL"]', experiencia: 7, nivel: 'Profesional', ubicacion: 'Cali', fuente: 'referido' },
    { id: 'f0eebc99-0004-4ef8-bb6d-6bb9bd380004', nombre: 'Sofia Gutierrez', email: 'sofia.gutierrez@email.com', telefono: '+57 303 456 7890', habilidades: '["Figma", "Sketch", "User Research", "Design Systems", "Prototyping"]', experiencia: 5, nivel: 'Profesional', ubicacion: 'Bogota', fuente: 'linkedin' },
    { id: 'f0eebc99-0005-4ef8-bb6d-6bb9bd380005', nombre: 'Diego Lopez', email: 'diego.lopez@email.com', telefono: '+57 304 567 8901', habilidades: '["React", "TypeScript", "Node.js", "GraphQL", "Docker", "Kubernetes"]', experiencia: 8, nivel: 'Maestria', ubicacion: 'Bogota', fuente: 'linkedin' },
    { id: 'f0eebc99-0006-4ef8-bb6d-6bb9bd380006', nombre: 'Valentina Torres', email: 'valentina.torres@email.com', telefono: '+57 305 678 9012', habilidades: '["UI Design", "Figma", "Adobe XD", "CSS", "HTML"]', experiencia: 3, nivel: 'Profesional', ubicacion: 'Barranquilla', fuente: 'manual' },
    { id: 'f0eebc99-0007-4ef8-bb6d-6bb9bd380007', nombre: 'Andres Moreno', email: 'andres.moreno@email.com', telefono: '+57 306 789 0123', habilidades: '["Vue.js", "Node.js", "PostgreSQL", "Redis", "AWS"]', experiencia: 4, nivel: 'Profesional', ubicacion: 'Bucaramanga', fuente: 'linkedin' },
    { id: 'f0eebc99-0008-4ef8-bb6d-6bb9bd380008', nombre: 'Camila Ruiz', email: 'camila.ruiz@email.com', telefono: '+57 307 890 1234', habilidades: '["React", "Next.js", "TypeScript", "Tailwind", "PostgreSQL"]', experiencia: 3, nivel: 'Profesional', ubicacion: 'Medellin', fuente: 'referido' },
    { id: 'f0eebc99-0009-4ef8-bb6d-6bb9bd380009', nombre: 'Juan Ramirez', email: 'juan.ramirez@email.com', telefono: '+57 308 901 2345', habilidades: '["Product Design", "Figma", "User Research", "Wireframing"]', experiencia: 2, nivel: 'Profesional', ubicacion: 'Pereira', fuente: 'linkedin' },
    { id: 'f0eebc99-0010-4ef8-bb6d-6bb9bd380010', nombre: 'Isabella Castro', email: 'isabella.castro@email.com', telefono: '+57 309 012 3456', habilidades: '["React", "Node.js", "TypeScript", "MongoDB", "Firebase"]', experiencia: 5, nivel: 'Maestria', ubicacion: 'Bogota', fuente: 'linkedin' },
  ];

  for (const c of candidatos) {
    await pool.query(`
      INSERT INTO candidatos (id, organization_id, nombre, email, telefono, habilidades, experiencia_anos, nivel_educativo, ubicacion, fuente)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
      ON CONFLICT (organization_id, email) DO NOTHING
    `, [c.id, orgId, c.nombre, c.email, c.telefono, c.habilidades, c.experiencia, c.nivel, c.ubicacion, c.fuente]);
  }
  console.log('  ✓ 10 candidatos created');

  // Aplicaciones (pipeline)
  const aplicaciones = [
    { vacante: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', candidato: 'f0eebc99-0001-4ef8-bb6d-6bb9bd380001', estado: 'entrevista_humana', score_ats: 92.5, score_ia: 88.0 },
    { vacante: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', candidato: 'f0eebc99-0002-4ef8-bb6d-6bb9bd380002', estado: 'entrevista_ia', score_ats: 78.3 },
    { vacante: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', candidato: 'f0eebc99-0005-4ef8-bb6d-6bb9bd380005', estado: 'seleccionado', score_ats: 95.0, score_ia: 91.0, score_humano: 88.0, score_final: 89.5 },
    { vacante: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', candidato: 'f0eebc99-0007-4ef8-bb6d-6bb9bd380007', estado: 'preseleccionado', score_ats: 72.0 },
    { vacante: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', candidato: 'f0eebc99-0008-4ef8-bb6d-6bb9bd380008', estado: 'nuevo', score_ats: 85.0 },
    { vacante: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', candidato: 'f0eebc99-0010-4ef8-bb6d-6bb9bd380010', estado: 'en_revision', score_ats: 81.5 },
    { vacante: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', candidato: 'f0eebc99-0004-4ef8-bb6d-6bb9bd380004', estado: 'entrevista_humana', score_ats: 90.0, score_ia: 85.0 },
    { vacante: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', candidato: 'f0eebc99-0006-4ef8-bb6d-6bb9bd380006', estado: 'preseleccionado', score_ats: 75.5 },
    { vacante: 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', candidato: 'f0eebc99-0009-4ef8-bb6d-6bb9bd380009', estado: 'nuevo', score_ats: 68.0 },
  ];

  for (const a of aplicaciones) {
    await pool.query(`
      INSERT INTO aplicaciones (vacante_id, candidato_id, estado, score_ats, score_ia, score_humano, score_final)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (vacante_id, candidato_id) DO NOTHING
    `, [a.vacante, a.candidato, a.estado, a.score_ats || null, a.score_ia || null, (a as Record<string, unknown>).score_humano || null, (a as Record<string, unknown>).score_final || null]);
  }
  console.log('  ✓ 9 aplicaciones created');

  // Org settings
  await pool.query(`
    INSERT INTO org_settings (organization_id, email_remitente, scoring_pesos_default)
    VALUES ($1, 'reclutamiento@hirely.app', '{"experiencia": 0.30, "habilidades": 0.25, "educacion": 0.15, "idiomas": 0.15, "certificaciones": 0.10, "keywords": 0.05}')
    ON CONFLICT (organization_id) DO NOTHING
  `, [orgId]);
  console.log('  ✓ Org settings created');

  console.log('\nSeed completed successfully!');
  await pool.end();
}

seed().catch(console.error);
