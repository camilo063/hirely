/**
 * Test E2E del flujo completo del portal:
 * 1. Genera un PDF de CV de prueba
 * 2. Lo envia al portal via /api/portal/aplicar/[slug]
 * 3. Verifica en BD: candidato creado, CV parseado por Claude, score ATS calculado
 *
 * Ejecutar: npx tsx src/lib/tests/test-flujo-portal.ts
 * Prerequisito: servidor corriendo en localhost:3500
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) { const i = t.indexOf('='); if (i > 0 && !process.env[t.substring(0, i)]) process.env[t.substring(0, i)] = t.substring(i + 1); }
  }
} catch { /* */ }

import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = process.env.NEXTAUTH_URL || 'http://localhost:3500';

/**
 * Genera un PDF minimo valido con texto de CV.
 * Usa la especificacion PDF 1.0 para crear un documento con texto embebido.
 */
function generateTestCVPdf(): Buffer {
  const cvText = [
    'MARIA FERNANDA LOPEZ GUTIERREZ',
    'Ingeniera de Software Senior',
    'Email: maria.lopez.test@gmail.com',
    'Telefono: +57 310 555 7890',
    'LinkedIn: linkedin.com/in/marialopezdev',
    'Ubicacion: Bogota, Colombia',
    '',
    'RESUMEN PROFESIONAL',
    'Ingeniera de software con 7 anos de experiencia en desarrollo full stack.',
    'Especializada en React, Node.js, TypeScript y arquitecturas cloud con AWS.',
    'Lider tecnica con experiencia gestionando equipos de 5-8 personas.',
    '',
    'EXPERIENCIA PROFESIONAL',
    '',
    'Senior Software Engineer - MercadoLibre (Ene 2021 - Presente)',
    '- Lider tecnica del equipo de checkout (5 personas)',
    '- Migracion de monolito Java a microservicios Node.js/TypeScript',
    '- Implementacion de CI/CD con GitHub Actions y Docker',
    '- Reduccion de latencia de APIs en 40% con caching Redis',
    '- Stack: React, Node.js, TypeScript, PostgreSQL, Redis, AWS, Docker, K8s',
    '',
    'Full Stack Developer - Rappi (Mar 2019 - Dic 2020)',
    '- Desarrollo de features para app de delivery (React Native + Node.js)',
    '- Integracion con pasarelas de pago (Stripe, PayU)',
    '- Implementacion de sistema de notificaciones push',
    '- Stack: React Native, React, Express, MongoDB, Firebase',
    '',
    'Junior Developer - Globant (Jun 2017 - Feb 2019)',
    '- Desarrollo frontend con Angular y React',
    '- APIs REST con Spring Boot y Express',
    '- Testing con Jest y Cypress',
    '- Stack: Angular, React, Java, Spring Boot, MySQL',
    '',
    'EDUCACION',
    'Ingenieria de Sistemas - Universidad de los Andes (2017)',
    'Especializacion en Cloud Computing - Universidad Javeriana (2022)',
    '',
    'HABILIDADES TECNICAS',
    'Frontend: React, Next.js, TypeScript, Angular, React Native, Tailwind CSS',
    'Backend: Node.js, Express, NestJS, Java, Spring Boot, Python',
    'Bases de datos: PostgreSQL, MongoDB, Redis, DynamoDB',
    'Cloud/DevOps: AWS (EC2, S3, Lambda, RDS), Docker, Kubernetes, GitHub Actions',
    'Otros: GraphQL, REST APIs, Microservicios, TDD, Scrum',
    '',
    'IDIOMAS',
    'Espanol: Nativo',
    'Ingles: Avanzado (C1 - IELTS 7.5)',
    'Portugues: Intermedio (B1)',
    '',
    'CERTIFICACIONES',
    'AWS Solutions Architect Associate (2023)',
    'Google Cloud Professional Developer (2022)',
    'Scrum Master Certified - CSM (2021)',
  ].join('\n');

  // Build a minimal valid PDF with the CV text
  // Using PDF 1.4 with basic text content stream
  const lines = cvText.split('\n');
  let contentStream = 'BT\n/F1 11 Tf\n';
  let y = 750;
  for (const line of lines) {
    // Escape special PDF characters
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    contentStream += `1 0 0 1 50 ${y} Tm\n(${escaped}) Tj\n`;
    y -= 14;
    if (y < 50) break;
  }
  contentStream += 'ET';

  const streamBytes = Buffer.from(contentStream, 'utf-8');

  const objects: string[] = [];

  // 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');
  // 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');
  // 3: Page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`);
  // 4: Content stream
  objects.push(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${contentStream}\nendstream\nendobj`);
  // 5: Font
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf-8'));
    pdf += obj + '\n';
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf-8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf-8');
}

async function testFlujoPortal() {
  console.log('\n🚀 TEST FLUJO COMPLETO: PORTAL → CV PARSING → SCORING ATS\n');
  console.log('═'.repeat(60));

  // 1. Find a published vacancy
  console.log('\n📦 Paso 1: Buscar vacante publicada...\n');
  const vacResult = await pool.query(
    "SELECT slug, titulo, id, organization_id FROM vacantes WHERE is_published = true AND estado = 'publicada' AND slug IS NOT NULL ORDER BY titulo LIKE '%Full Stack%' DESC, titulo LIKE '%Developer%' DESC LIMIT 1"
  );
  if (vacResult.rows.length === 0) {
    console.error('  ❌ No hay vacantes publicadas. Ejecuta npm run seed primero.');
    process.exit(1);
  }
  const vacante = vacResult.rows[0];
  console.log(`  ✅ Vacante: "${vacante.titulo}" (${vacante.slug})`);

  // 2. Generate test CV PDF
  console.log('\n📄 Paso 2: Generar CV PDF de prueba...\n');
  const pdfBuffer = generateTestCVPdf();
  console.log(`  ✅ PDF generado: ${pdfBuffer.length} bytes`);

  // 3. Build multipart form data
  console.log('\n📤 Paso 3: Enviar aplicacion al portal...\n');
  const testEmail = `maria.lopez.test.${Date.now()}@gmail.com`;

  const formData = new FormData();
  formData.append('nombre', 'Maria Fernanda Lopez Gutierrez');
  formData.append('email', testEmail);
  formData.append('telefono', '+57 310 555 7890');
  formData.append('linkedinUrl', 'https://linkedin.com/in/marialopezdev');
  formData.append('ubicacion', 'Bogota, Colombia');
  formData.append('experienciaAnos', '7');
  formData.append('nivelEducativo', 'especializacion');
  formData.append('habilidades', JSON.stringify(['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS', 'Kubernetes']));
  formData.append('comoSeEntero', 'test');
  formData.append('cartaPresentacion', 'Soy una ingeniera apasionada por la tecnologia con 7 anos de experiencia en desarrollo full stack.');

  // Append PDF as file
  const pdfBlob = new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' });
  formData.append('cv', pdfBlob, 'cv-maria-lopez.pdf');

  const url = `${BASE}/api/portal/aplicar/${vacante.slug}`;
  console.log(`  URL: ${url}`);
  console.log(`  Email: ${testEmail}`);

  let aplicacionId: string | null = null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    console.log(`  HTTP ${response.status}: ${JSON.stringify(data).substring(0, 200)}`);

    if (data.success) {
      aplicacionId = data.aplicacionId || data.data?.aplicacionId;
      console.log(`  ✅ Aplicacion creada: ${aplicacionId}`);
    } else {
      console.error(`  ❌ Error: ${data.error}`);
      // Continue to check DB anyway
    }
  } catch (error: any) {
    console.error(`  ❌ Error HTTP: ${error.message}`);
    console.log('  💡 Asegurate de que el servidor este corriendo (npm run dev)');
  }

  // 4. Wait a bit for async scoring pipeline
  console.log('\n⏳ Paso 4: Esperando pipeline de scoring (5 segundos)...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 5. Verify results in DB
  console.log('🔍 Paso 5: Verificar resultados en BD...\n');

  // Check candidato
  const candidatoResult = await pool.query(
    `SELECT id, nombre, apellido, email, telefono, cv_url, cv_parsed, habilidades,
            experiencia_anos, nivel_educativo, ubicacion
     FROM candidatos WHERE email = $1 AND organization_id = $2`,
    [testEmail, vacante.organization_id]
  );

  if (candidatoResult.rows.length === 0) {
    console.log('  ❌ Candidato no encontrado en BD');
  } else {
    const c = candidatoResult.rows[0];
    console.log('  📋 CANDIDATO:');
    console.log(`     Nombre: ${c.nombre} ${c.apellido || ''}`);
    console.log(`     Email: ${c.email}`);
    console.log(`     Telefono: ${c.telefono}`);
    console.log(`     CV URL: ${c.cv_url ? '✅ Guardado' : '⚠️ No guardado'}`);
    console.log(`     Ubicacion: ${c.ubicacion}`);
    console.log(`     Exp. anos: ${c.experiencia_anos}`);
    console.log(`     Nivel educativo: ${c.nivel_educativo}`);
    console.log(`     Habilidades: ${JSON.stringify(c.habilidades)}`);

    const cvParsed = c.cv_parsed;
    if (cvParsed && cvParsed.parsed_at) {
      console.log('\n  🧠 CV PARSEADO POR CLAUDE:');
      console.log(`     Parser version: ${cvParsed.parser_version}`);
      console.log(`     Fuente: ${cvParsed.fuente}`);
      console.log(`     Confianza: ${cvParsed.confianza}`);
      console.log(`     Nombre extraido: ${cvParsed.nombre}`);
      console.log(`     Habilidades tecnicas: ${(cvParsed.habilidades_tecnicas || []).length} → ${(cvParsed.habilidades_tecnicas || []).slice(0, 5).join(', ')}...`);
      console.log(`     Experiencia total: ${cvParsed.experiencia_total_anos} anos`);
      console.log(`     Experiencias: ${(cvParsed.experiencia || []).length} registros`);
      console.log(`     Educacion: ${(cvParsed.educacion || []).length} registros`);
      console.log(`     Nivel educativo max: ${cvParsed.nivel_educativo_max}`);
      console.log(`     Idiomas: ${(cvParsed.idiomas || []).length}`);
      console.log(`     Certificaciones: ${(cvParsed.certificaciones || []).length}`);
      console.log(`     Keywords: ${(cvParsed.keywords || []).length}`);
      if (cvParsed.resumen_profesional) {
        console.log(`     Resumen: ${cvParsed.resumen_profesional.substring(0, 100)}...`);
      }
    } else {
      console.log('\n  ⚠️ CV NO parseado por Claude (cv_parsed vacio o sin parsed_at)');
      if (cvParsed) console.log(`     cv_parsed keys: ${Object.keys(cvParsed).join(', ')}`);
    }

    // Check aplicacion
    const appResult = await pool.query(
      `SELECT id, estado, score_ats, score_ats_resumen, scored_at, notas, origen, created_at
       FROM aplicaciones WHERE candidato_id = $1 AND vacante_id = $2`,
      [c.id, vacante.id]
    );

    if (appResult.rows.length === 0) {
      console.log('\n  ❌ Aplicacion no encontrada en BD');
    } else {
      const app = appResult.rows[0];
      console.log('\n  📊 APLICACION:');
      console.log(`     ID: ${app.id}`);
      console.log(`     Estado: ${app.estado}`);
      console.log(`     Origen: ${app.origen}`);
      console.log(`     Score ATS: ${app.score_ats !== null ? `${app.score_ats}/100 ✅` : '⚠️ No calculado'}`);
      if (app.score_ats_resumen) {
        console.log(`     Resumen ATS: ${app.score_ats_resumen.substring(0, 120)}...`);
      }
      if (app.scored_at) {
        console.log(`     Scored at: ${app.scored_at}`);
      }
      if (app.notas) {
        console.log(`     Notas: ${app.notas.substring(0, 150)}`);
      }
    }
  }

  // 6. Activity log
  const logResult = await pool.query(
    `SELECT action, details, created_at FROM activity_log
     WHERE organization_id = $1 AND action IN ('created_from_portal', 'ats_scored')
     ORDER BY created_at DESC LIMIT 5`,
    [vacante.organization_id]
  );
  if (logResult.rows.length > 0) {
    console.log('\n  📝 ACTIVITY LOG (ultimos 5):');
    for (const log of logResult.rows) {
      const d = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
      console.log(`     ${log.action}: ${JSON.stringify(d).substring(0, 100)}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test de flujo portal completado.\n');
}

testFlujoPortal()
  .then(() => { pool.end(); process.exit(0); })
  .catch(e => { console.error('Fatal:', e); pool.end(); process.exit(1); });
