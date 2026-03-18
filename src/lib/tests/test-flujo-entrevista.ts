/**
 * Simula el flujo completo de entrevista IA sin necesitar Dapta.
 *
 * 1. Toma un candidato en estado 'preseleccionado' (o similar)
 * 2. Crea una entrevista IA
 * 3. Simula el webhook de Dapta con una transcripción de prueba
 * 4. Verifica que Claude analizó la transcripción
 * 5. Verifica que el score IA se guardó
 * 6. Verifica que el estado cambió a 'entrevista_humana'
 *
 * Ejecutar: npx tsx src/lib/tests/test-flujo-entrevista.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.substring(0, i)]) {
        process.env[t.substring(0, i)] = t.substring(i + 1);
      }
    }
  }
} catch { /* */ }

const TRANSCRIPCION_PRUEBA = `
Agente: Hola, buenos días. Soy el asistente de entrevistas de Nivelics. ¿Hablo con Carlos Rodríguez?
Carlos: Sí, hola, buenos días. Soy yo.
Agente: Perfecto Carlos. Gracias por tu tiempo. Vamos a conversar sobre la posición de Senior Full Stack Developer. ¿Estás listo?
Carlos: Sí, claro. Adelante.
Agente: Cuéntame sobre tu experiencia como desarrollador full stack.
Carlos: Tengo 5 años de experiencia. Los últimos 3 años he trabajado con React y Node.js en producción. En mi empresa actual, TechCorp, lideré la migración de una aplicación monolítica a microservicios usando Docker y Kubernetes. El equipo pasó de 2 a 8 desarrolladores y mejoré la cobertura de tests del 20% al 85%.
Agente: Muy interesante. ¿Qué tecnologías dominas más?
Carlos: Mi stack principal es React con TypeScript en el frontend, Node.js con Express o NestJS en el backend, y PostgreSQL como base de datos. También tengo experiencia con AWS, Docker, CI/CD con GitHub Actions, y he trabajado con GraphQL.
Agente: ¿Por qué te interesa trabajar en Nivelics?
Carlos: He seguido a Nivelics por LinkedIn y me gusta mucho su enfoque en innovación y tecnología. Además el modelo de trabajo remoto me parece ideal. Quiero trabajar en una empresa donde pueda seguir creciendo técnicamente y aportar mi experiencia en arquitectura de software.
Agente: ¿Cómo manejas los conflictos en un equipo de trabajo?
Carlos: Creo mucho en la comunicación directa. Cuando hay un desacuerdo técnico, prefiero hacer una sesión de pair programming o un design review donde todos puedan opinar. En mi experiencia, los mejores resultados vienen cuando el equipo toma decisiones basadas en datos y no en opiniones. Si hay un conflicto personal, prefiero hablarlo directamente con la persona en privado.
Agente: Última pregunta. Si tuvieras que aprender una tecnología completamente nueva en 2 semanas, ¿cómo lo abordarías?
Carlos: Primero leería la documentación oficial y haría el tutorial básico. Luego buscaría un proyecto pequeño pero real para aplicar lo aprendido, porque aprendo mejor haciendo. También buscaría videos o cursos cortos, y si es posible, hablaría con alguien que ya use esa tecnología para entender los gotchas comunes.
Agente: Excelente Carlos. Muchas gracias por tu tiempo. Te contactaremos pronto con los siguientes pasos.
Carlos: Gracias a ustedes. Quedo atento.
`;

async function testFlujoEntrevista() {
  // Dynamic import so env vars are loaded first
  const { pool } = await import('../db');

  console.log('\n🧪 Simulando flujo completo de entrevista IA...\n');

  const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3500';

  // 1. Find a candidate available for interview
  const aplicacion = await pool.query(`
    SELECT a.id as aplicacion_id, a.candidato_id, a.vacante_id, a.estado,
           c.nombre as candidato_nombre, v.titulo as vacante_titulo
    FROM aplicaciones a
    JOIN candidatos c ON c.id = a.candidato_id
    JOIN vacantes v ON v.id = a.vacante_id
    WHERE a.estado IN ('preseleccionado', 'entrevista_ia', 'revisado', 'nuevo')
    ORDER BY
      CASE a.estado
        WHEN 'preseleccionado' THEN 1
        WHEN 'entrevista_ia' THEN 2
        WHEN 'revisado' THEN 3
        WHEN 'nuevo' THEN 4
      END,
      a.score_ats DESC NULLS LAST
    LIMIT 1
  `);

  if (aplicacion.rows.length === 0) {
    console.error('❌ No hay candidatos disponibles para entrevistar.');
    console.log('   Necesitas al menos un candidato en estado preseleccionado, entrevista_ia, revisado o nuevo.');
    await pool.end();
    process.exit(1);
  }

  const app = aplicacion.rows[0];
  console.log(`📋 Candidato: ${app.candidato_nombre}`);
  console.log(`💼 Vacante: ${app.vacante_titulo}`);
  console.log(`📊 Estado actual: ${app.estado}`);
  console.log(`🆔 Aplicación ID: ${app.aplicacion_id}\n`);

  // 2. Check for existing entrevista, delete if test
  const existing = await pool.query(
    `SELECT id FROM entrevistas_ia WHERE aplicacion_id = $1 AND estado IN ('pendiente', 'fallida', 'cancelada')`,
    [app.aplicacion_id]
  );
  if (existing.rows.length > 0) {
    console.log(`  🗑️ Eliminando entrevista previa en estado inactivo...`);
    await pool.query('DELETE FROM entrevistas_ia WHERE id = $1', [existing.rows[0].id]);
  }

  // 3. Create entrevista IA
  console.log('📞 Paso 1: Creando entrevista IA...');

  const entrevista = await pool.query(`
    INSERT INTO entrevistas_ia (aplicacion_id, estado, preguntas_usadas, fecha_llamada)
    VALUES ($1, 'completada', $2, NOW())
    RETURNING id
  `, [
    app.aplicacion_id,
    JSON.stringify([
      'Cuéntame sobre tu experiencia como desarrollador full stack.',
      '¿Qué tecnologías dominas más?',
      '¿Por qué te interesa trabajar en Nivelics?',
      '¿Cómo manejas los conflictos en un equipo de trabajo?',
      'Si tuvieras que aprender una tecnología nueva en 2 semanas, ¿cómo lo abordarías?'
    ])
  ]);
  const entrevistaId = entrevista.rows[0].id;
  console.log(`  ✅ Entrevista creada: ${entrevistaId}`);

  // Update application state
  await pool.query(
    "UPDATE aplicaciones SET estado = 'entrevista_ia' WHERE id = $1",
    [app.aplicacion_id]
  );

  // 4. Try webhook first (requires running server)
  console.log('\n📞 Paso 2: Simulando webhook de Dapta (enviando transcripción)...');

  let webhookWorked = false;
  try {
    const webhookResponse = await fetch(`${BASE_URL}/api/webhooks/dapta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_id: `test-call-${Date.now()}`,
        status: 'completed',
        transcript: TRANSCRIPCION_PRUEBA,
        duration_seconds: 420,
        from_number: '+573001234567',
        to_number: '+573009876543',
        started_at: new Date(Date.now() - 420000).toISOString(),
        ended_at: new Date().toISOString(),
        metadata: {
          entrevista_id: entrevistaId,
          aplicacion_id: app.aplicacion_id,
        },
      }),
    });

    const webhookResult = await webhookResponse.text();
    console.log(`  HTTP ${webhookResponse.status}: ${webhookResult.substring(0, 200)}`);

    if (webhookResponse.ok) {
      console.log('  ✅ Webhook procesado correctamente');
      webhookWorked = true;
    } else {
      console.log('  ⚠️ Webhook respondió con error — intentando ruta directa');
    }
  } catch (error: any) {
    console.log(`  ❌ Error enviando webhook: ${error.message}`);
    console.log('  💡 ¿El servidor está corriendo? (npm run dev)');
  }

  // 5. If webhook didn't work, try direct DB + Claude analysis
  if (!webhookWorked) {
    console.log('\n📝 Simulando resultado directamente en BD...');

    // Save transcript
    await pool.query(`
      UPDATE entrevistas_ia
      SET transcripcion = $1, estado = 'completada', duracion_segundos = 420
      WHERE id = $2
    `, [TRANSCRIPCION_PRUEBA, entrevistaId]);

    // Try Claude analysis
    try {
      const { AnthropicClient } = await import('../integrations/anthropic.client');
      const client = new AnthropicClient();

      if (client.isConfigured()) {
        console.log('🧠 Analizando transcripción con Claude...');
        const analysis = await client.complete(
          `Eres un evaluador experto en entrevistas de RRHH. Evalúa esta transcripción para el cargo de "${app.vacante_titulo}".

Evalúa en estas 5 dimensiones (0-100 cada una):
1. Competencia Técnica (peso 35%)
2. Motivación (peso 20%)
3. Conexión Cultural (peso 20%)
4. Comunicación (peso 15%)
5. Tono Emocional (peso 10%)

Responde SOLO con JSON válido:
{
  "competencia_tecnica": { "score": N, "justificacion": "..." },
  "motivacion": { "score": N, "justificacion": "..." },
  "conexion_cultural": { "score": N, "justificacion": "..." },
  "comunicacion": { "score": N, "justificacion": "..." },
  "tono_emocional": { "score": N, "justificacion": "..." },
  "score_total": N,
  "fortalezas": ["..."],
  "areas_mejora": ["..."],
  "recomendacion": "avanzar|considerar|no_avanzar",
  "resumen": "..."
}`,
          [{ role: 'user', content: `Transcripción:\n\n${TRANSCRIPCION_PRUEBA}` }],
          { maxTokens: 2000 }
        );

        const cleaned = analysis.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleaned);

        console.log(`  ✅ Score IA: ${parsed.score_total}/100`);
        console.log(`  📊 Recomendación: ${parsed.recomendacion}`);
        console.log(`  💡 Resumen: ${parsed.resumen?.substring(0, 150)}...`);

        // Save to DB
        await pool.query(`
          UPDATE entrevistas_ia
          SET analisis = $1, score_total = $2
          WHERE id = $3
        `, [JSON.stringify(parsed), parsed.score_total, entrevistaId]);

        await pool.query(`
          UPDATE aplicaciones
          SET score_ia = $1, estado = 'entrevista_humana'
          WHERE id = $2
        `, [parsed.score_total, app.aplicacion_id]);

        console.log('  ✅ Score IA guardado en BD');
        console.log('  ✅ Estado cambiado a entrevista_humana');
      } else {
        console.log('  ⚠️ ANTHROPIC_API_KEY no configurada — análisis pendiente');
        console.log('  💡 La transcripción fue guardada. Puede re-analizarse desde /entrevistas/[id]');
      }
    } catch (e: any) {
      console.log(`  ⚠️ Error en análisis: ${e.message}`);
    }
  }

  // 6. Final verification
  console.log('\n═══════════════════════════════════════');
  console.log('📊 VERIFICACIÓN FINAL\n');

  const entrevistaFinal = await pool.query(
    'SELECT * FROM entrevistas_ia WHERE id = $1', [entrevistaId]
  );
  const appFinal = await pool.query(
    'SELECT * FROM aplicaciones WHERE id = $1', [app.aplicacion_id]
  );

  if (entrevistaFinal.rows.length > 0) {
    const e = entrevistaFinal.rows[0];
    console.log(`  Entrevista IA estado: ${e.estado}`);
    console.log(`  Transcripción: ${e.transcripcion ? '✅ Guardada' : '❌ Falta'} (${(e.transcripcion || '').length} chars)`);
    console.log(`  Análisis: ${e.analisis ? '✅ Guardado' : '⏳ Pendiente'}`);
    console.log(`  Score IA: ${e.score_total || 'N/A'}`);
    console.log(`  Duración: ${e.duracion_segundos}s`);
  }

  if (appFinal.rows.length > 0) {
    const a = appFinal.rows[0];
    console.log(`\n  Aplicación estado: ${a.estado}`);
    console.log(`  Score ATS: ${a.score_ats || 'N/A'}`);
    console.log(`  Score IA: ${a.score_ia || 'N/A'}`);
    console.log(`  Score Humano: ${a.score_humano || 'N/A'}`);
    console.log(`  Score Final: ${a.score_final || 'N/A'}`);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('✅ Flujo de entrevista simulado.');
  console.log('\n📌 Próximos pasos:');
  console.log('  1. Abrir /entrevistas en el dashboard → debería aparecer esta entrevista');
  console.log('  2. Abrir el detalle → debería mostrar transcripción + scores');
  console.log('  3. El candidato ahora está en "entrevista_humana" → evaluar manualmente');
  console.log('  4. Para probar con Dapta real: npx tsx src/lib/tests/test-dapta-call.ts +57XXXXXXXXXX');

  await pool.end();
}

testFlujoEntrevista().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
