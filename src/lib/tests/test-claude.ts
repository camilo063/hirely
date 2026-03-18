/**
 * Test de conexion con Claude API.
 * Ejecutar: npx tsx src/lib/tests/test-claude.ts
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

async function testClaude() {
  console.log('\n🧠 PRUEBA DE CONEXION CON CLAUDE API\n');
  console.log('═'.repeat(50));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(`\nANTHROPIC_API_KEY: ${apiKey ? `✅ Configurada (${apiKey.substring(0, 12)}...)` : '❌ NO configurada'}`);

  if (!apiKey) {
    console.error('\n❌ Agrega ANTHROPIC_API_KEY a .env.local para continuar.');
    process.exit(1);
  }

  const models = ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];
  let workingModel: string | null = null;

  // Test 1: Conexion basica
  console.log('\n📡 Test 1: Conexion basica con Claude API\n');

  for (const model of models) {
    try {
      console.log(`  Probando modelo: ${model}...`);
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Responde SOLO con la palabra "OK".' }],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.content?.[0]?.text || '';
        console.log(`  ✅ ${model} → "${text.trim()}" (tokens: ${data.usage?.input_tokens}/${data.usage?.output_tokens})`);
        workingModel = model;
        break;
      } else {
        const error = await response.text();
        console.log(`  ❌ ${model} → HTTP ${response.status}: ${error.substring(0, 100)}`);
      }
    } catch (error: any) {
      console.log(`  ❌ ${model} → Error: ${error.message}`);
    }
  }

  if (!workingModel) {
    console.error('\n❌ No se pudo conectar con ningun modelo de Claude.');
    process.exit(1);
  }

  console.log(`\n✅ Modelo activo: ${workingModel}`);

  // Test 2: Analisis de CV (texto)
  console.log('\n📄 Test 2: Analisis de CV (texto plano)\n');
  try {
    const cvText = `
Juan Perez - Desarrollador Full Stack Senior
Email: juan.perez@email.com | Tel: +57 300 111 2222
LinkedIn: linkedin.com/in/juanperez

EXPERIENCIA PROFESIONAL:
- Senior Developer en TechCorp (Ene 2020 - Presente): Liderazgo tecnico de equipo de 6 personas. Stack: React, Node.js, PostgreSQL, AWS. Implementacion de microservicios y CI/CD.
- Full Stack Developer en StartupXYZ (Mar 2018 - Dic 2019): Desarrollo de plataforma SaaS. Angular, Express, MongoDB.
- Junior Developer en AgencyABC (Ene 2016 - Feb 2018): Desarrollo web con PHP, jQuery, MySQL.

EDUCACION:
- Ingeniero de Sistemas, Universidad Nacional de Colombia (2015)
- Especializacion en Cloud Computing, Universidad de los Andes (2021)

HABILIDADES: React, Node.js, TypeScript, PostgreSQL, Docker, AWS, Kubernetes, GraphQL, REST APIs
IDIOMAS: Espanol (Nativo), Ingles (Avanzado C1), Portugues (Basico)
CERTIFICACIONES: AWS Solutions Architect Associate (2023), Scrum Master (2022)
    `;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: workingModel,
        max_tokens: 3000,
        temperature: 0,
        system: 'Eres un experto en RRHH. Extrae datos estructurados de este CV. Responde SOLO con JSON valido, sin markdown.',
        messages: [{
          role: 'user',
          content: `Analiza este CV y extrae los datos en formato JSON con campos: nombre, email, telefono, experiencia (array), experiencia_total_anos, educacion (array), habilidades_tecnicas (array), idiomas (array con nivel), certificaciones (array).\n\n${cvText}`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Try to parse
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
    if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
    if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    console.log(`  ✅ CV parseado exitosamente`);
    console.log(`  📊 Nombre: ${parsed.nombre || 'N/A'}`);
    console.log(`  📊 Habilidades: ${(parsed.habilidades_tecnicas || []).length} encontradas`);
    console.log(`  📊 Experiencia: ${parsed.experiencia_total_anos || '?'} anos`);
    console.log(`  📊 Certificaciones: ${(parsed.certificaciones || []).length}`);
    console.log(`  📊 Tokens: ${data.usage?.input_tokens}/${data.usage?.output_tokens}`);
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }

  // Test 3: Analisis de transcripcion
  console.log('\n🎙️ Test 3: Analisis de transcripcion de entrevista\n');
  try {
    const transcript = `
Agente: Hola Carlos, soy el asistente de entrevistas de Nivelics. ¿Como estas?
Carlos: Hola, muy bien gracias. Estoy emocionado por esta oportunidad.
Agente: Cuentame sobre tu experiencia como desarrollador.
Carlos: Llevo 5 anos desarrollando con React y Node.js. En mi ultimo trabajo lidere un equipo de 4 personas donde migramos una aplicacion monolitica a microservicios con Docker y Kubernetes.
Agente: ¿Por que te interesa trabajar en Nivelics?
Carlos: Me apasiona la tecnologia y Nivelics tiene una cultura de innovacion que me atrae mucho. Ademas me gusta el modelo de trabajo remoto y el enfoque en producto.
Agente: ¿Como manejas los conflictos en equipo?
Carlos: Creo en la comunicacion directa pero respetuosa. Siempre busco entender la perspectiva del otro antes de proponer soluciones. En mi ultimo equipo implementamos retrospectivas semanales que ayudaron mucho.
Agente: ¿Cual ha sido tu mayor desafio tecnico?
Carlos: Migrar un monolito legacy de PHP a Node.js con microservicios. Tuvimos que hacerlo gradualmente sin downtime, usando el patron Strangler Fig. Fue complejo pero lo logramos en 6 meses.
    `;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: workingModel,
        max_tokens: 3000,
        temperature: 0.1,
        system: `Evalua esta transcripcion para el cargo "Desarrollador Full Stack" en "Nivelics". Responde SOLO con JSON.`,
        messages: [{
          role: 'user',
          content: `Evalua en 5 dimensiones (0-100):
1. competencia_tecnica (peso 0.35)
2. motivacion (peso 0.20)
3. conexion_cultural (peso 0.20)
4. comunicacion (peso 0.15)
5. tono_emocional (peso 0.10)

Formato: {"competencia_tecnica":{"score":N,"justificacion":"..."},"motivacion":{"score":N,"justificacion":"..."},"conexion_cultural":{"score":N,"justificacion":"..."},"comunicacion":{"score":N,"justificacion":"..."},"tono_emocional":{"score":N,"justificacion":"..."},"score_total":N,"recomendacion":"avanzar|considerar|no_avanzar","resumen":"...","fortalezas":["..."],"areas_mejora":["..."]}

Transcripcion:\n${transcript}`,
        }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    let cleaned = text.trim();
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) cleaned = cleaned.substring(firstBrace);
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0) cleaned = cleaned.substring(0, lastBrace + 1);

    const parsed = JSON.parse(cleaned);
    console.log(`  ✅ Analisis completado`);
    console.log(`  📊 Score total: ${parsed.score_total}/100`);
    console.log(`  📊 Recomendacion: ${parsed.recomendacion}`);
    console.log(`  📊 Comp. Tecnica: ${parsed.competencia_tecnica?.score}`);
    console.log(`  📊 Motivacion: ${parsed.motivacion?.score}`);
    console.log(`  📊 Conexion Cultural: ${parsed.conexion_cultural?.score}`);
    console.log(`  📊 Comunicacion: ${parsed.comunicacion?.score}`);
    console.log(`  📊 Tono Emocional: ${parsed.tono_emocional?.score}`);
    console.log(`  📊 Fortalezas: ${(parsed.fortalezas || []).length}`);
    console.log(`  📊 Areas mejora: ${(parsed.areas_mejora || []).length}`);
    console.log(`  📊 Tokens: ${data.usage?.input_tokens}/${data.usage?.output_tokens}`);
    if (parsed.resumen) console.log(`  💡 Resumen: ${parsed.resumen.substring(0, 120)}...`);
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
  }

  console.log('\n' + '═'.repeat(50));
  console.log('✅ Tests de Claude completados.\n');
}

testClaude().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e); process.exit(1); });
