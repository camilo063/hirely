import { z } from 'zod';

// ─── Pregunta Banco ───

const opcionSchema = z.object({
  id: z.string().min(1),
  texto: z.string().min(1, 'Texto de opción requerido'),
  es_correcta: z.boolean(),
});

export const preguntaCreateSchema = z.object({
  categoria: z.string().min(1, 'Categoría requerida').max(100),
  subcategoria: z.string().max(100).nullable().optional(),
  tipo: z.enum(['opcion_multiple', 'verdadero_falso', 'respuesta_abierta', 'codigo']),
  dificultad: z.enum(['basico', 'intermedio', 'avanzado', 'experto']),
  enunciado: z.string().min(1, 'Enunciado requerido'),
  opciones: z.array(opcionSchema).nullable().optional(),
  respuesta_correcta: z.string().nullable().optional(),
  explicacion: z.string().nullable().optional(),
  puntos: z.number().int().min(1).max(100).default(10),
  tiempo_estimado_segundos: z.number().int().min(10).max(3600).default(120),
  tags: z.array(z.string()).default([]),
  es_estandar: z.boolean().default(false),
  cargos_aplicables: z.array(z.string()).default([]),
  idioma: z.string().max(10).default('es'),
  estado: z.enum(['activa', 'borrador', 'archivada']).default('activa'),
}).refine((data) => {
  if (data.tipo === 'opcion_multiple') {
    return data.opciones && data.opciones.length >= 2 && data.opciones.some(o => o.es_correcta);
  }
  return true;
}, { message: 'Opción múltiple requiere al menos 2 opciones con una correcta' })
.refine((data) => {
  if (data.tipo === 'verdadero_falso') {
    return data.respuesta_correcta === 'verdadero' || data.respuesta_correcta === 'falso';
  }
  return true;
}, { message: 'Verdadero/Falso requiere respuesta_correcta: "verdadero" o "falso"' });

export const preguntaUpdateSchema = z.object({
  categoria: z.string().min(1).max(100).optional(),
  subcategoria: z.string().max(100).nullable().optional(),
  tipo: z.enum(['opcion_multiple', 'verdadero_falso', 'respuesta_abierta', 'codigo']).optional(),
  dificultad: z.enum(['basico', 'intermedio', 'avanzado', 'experto']).optional(),
  enunciado: z.string().min(1).optional(),
  opciones: z.array(opcionSchema).nullable().optional(),
  respuesta_correcta: z.string().nullable().optional(),
  explicacion: z.string().nullable().optional(),
  puntos: z.number().int().min(1).max(100).optional(),
  tiempo_estimado_segundos: z.number().int().min(10).max(3600).optional(),
  tags: z.array(z.string()).optional(),
  es_estandar: z.boolean().optional(),
  cargos_aplicables: z.array(z.string()).optional(),
  idioma: z.string().max(10).optional(),
  estado: z.enum(['activa', 'borrador', 'archivada']).optional(),
});

// ─── Plantilla ───

const estructuraItemSchema = z.object({
  categoria: z.string().min(1),
  cantidad: z.number().int().min(1),
  dificultad: z.enum(['basico', 'intermedio', 'avanzado', 'experto', 'mixta']),
  puntos_por_pregunta: z.number().int().min(1),
});

export const plantillaCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  descripcion: z.string().nullable().optional(),
  duracion_minutos: z.number().int().min(5).max(480).default(60),
  puntaje_total: z.number().int().min(10).max(1000).default(100),
  puntaje_aprobatorio: z.number().int().min(1).max(1000).default(70),
  aleatorizar_preguntas: z.boolean().default(true),
  mostrar_resultados_al_candidato: z.boolean().default(false),
  estructura: z.array(estructuraItemSchema).min(1, 'Al menos una categoría requerida'),
  cargos_sugeridos: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  estado: z.enum(['activa', 'borrador', 'archivada']).default('activa'),
});

export const plantillaUpdateSchema = plantillaCreateSchema.partial();

// ─── Evaluación ───

export const evaluacionCreateSchema = z.object({
  aplicacion_id: z.string().uuid(),
  candidato_id: z.string().uuid(),
  vacante_id: z.string().uuid(),
  plantilla_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(1, 'Título requerido').max(200),
  duracion_minutos: z.number().int().min(5).max(480).default(60),
  puntaje_aprobatorio: z.number().int().min(1).max(100).default(70),
  estructura: z.array(estructuraItemSchema).optional(),
});

// ─── Respuestas del candidato ───

const respuestaSchema = z.object({
  pregunta_id: z.string().uuid(),
  respuesta: z.string(),
  tiempo_segundos: z.number().int().min(0),
  respondida_at: z.string(),
});

export const respuestasSubmitSchema = z.object({
  respuestas: z.array(respuestaSchema).min(1),
});

// ─── Importar preguntas ───

export const importarPreguntasSchema = z.object({
  preguntas: z.array(z.object({
    categoria: z.string().min(1),
    tipo: z.enum(['opcion_multiple', 'verdadero_falso', 'respuesta_abierta', 'codigo']),
    dificultad: z.enum(['basico', 'intermedio', 'avanzado', 'experto']),
    enunciado: z.string().min(1),
    opciones: z.array(opcionSchema).nullable().optional(),
    respuesta_correcta: z.string().nullable().optional(),
    explicacion: z.string().nullable().optional(),
    puntos: z.number().int().min(1).default(10),
    tags: z.array(z.string()).default([]),
    es_estandar: z.boolean().default(true),
  })),
});

export type PreguntaCreateInput = z.infer<typeof preguntaCreateSchema>;
export type PreguntaUpdateInput = z.infer<typeof preguntaUpdateSchema>;
export type PlantillaCreateInput = z.infer<typeof plantillaCreateSchema>;
export type PlantillaUpdateInput = z.infer<typeof plantillaUpdateSchema>;
export type EvaluacionCreateInput = z.infer<typeof evaluacionCreateSchema>;
export type RespuestasSubmitInput = z.infer<typeof respuestasSubmitSchema>;
