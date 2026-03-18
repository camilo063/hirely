import { z } from 'zod';

export const entrevistaIACreateSchema = z.object({
  aplicacion_id: z.string().uuid('ID de aplicacion invalido'),
  candidato_id: z.string().uuid('ID de candidato invalido'),
  vacante_id: z.string().uuid('ID de vacante invalido'),
});

export const entrevistaHumanaCreateSchema = z.object({
  aplicacion_id: z.string().uuid('ID de aplicacion invalido'),
  candidato_id: z.string().uuid('ID de candidato invalido'),
  vacante_id: z.string().uuid('ID de vacante invalido'),
  entrevistador_id: z.string().uuid('ID de entrevistador invalido'),
  fecha_programada: z.string().datetime('Fecha invalida'),
  notas: z.string().optional(),
});

const criterioHumanoSchema = z.object({
  score: z.number().min(1).max(10),
  observacion: z.string(),
});

export const evaluacionHumanaSchema = z.object({
  competencia_tecnica: criterioHumanoSchema,
  habilidades_blandas: criterioHumanoSchema,
  fit_cultural: criterioHumanoSchema,
  potencial_crecimiento: criterioHumanoSchema,
  presentacion_personal: criterioHumanoSchema,
  observaciones_generales: z.string(),
  recomendacion: z.enum(['contratar', 'considerar', 'no_contratar']),
  evaluated_at: z.string().optional(),
});

export type EntrevistaIACreateInput = z.infer<typeof entrevistaIACreateSchema>;
export type EntrevistaHumanaCreateInput = z.infer<typeof entrevistaHumanaCreateSchema>;
export type EvaluacionHumanaInput = z.infer<typeof evaluacionHumanaSchema>;
