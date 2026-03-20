import { z } from 'zod';

export const candidatoCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  apellido: z.string().min(1, 'Apellido requerido').max(100),
  email: z.string().email('Email invalido'),
  telefono: z.string().nullable().optional(),
  linkedin_url: z.string().url('URL de LinkedIn invalida').nullable().optional(),
  habilidades: z.array(z.string()).default([]),
  experiencia_anos: z.number().min(0).default(0),
  ubicacion: z.string().nullable().optional(),
  nivel_educativo: z.string().nullable().optional(),
  salario_esperado: z.number().positive().nullable().optional(),
  fuente: z.string().default('Sitio web'),
  notas: z.string().nullable().optional(),
});

export const candidatoUpdateSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  apellido: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  telefono: z.string().nullable().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  habilidades: z.array(z.string()).optional(),
  experiencia_anos: z.number().min(0).optional(),
  ubicacion: z.string().nullable().optional(),
  nivel_educativo: z.string().nullable().optional(),
  salario_esperado: z.number().positive().nullable().optional(),
  fuente: z.string().optional(),
  notas: z.string().nullable().optional(),
});

export const aplicacionCreateSchema = z.object({
  vacante_id: z.string().uuid('ID de vacante invalido'),
  candidato_id: z.string().uuid('ID de candidato invalido'),
  notas_internas: z.string().nullable().optional(),
});

export const aplicacionUpdateEstadoSchema = z.object({
  estado: z.enum([
    'nuevo', 'en_revision', 'revisado', 'preseleccionado', 'entrevista_ia',
    'entrevista_humana', 'evaluado', 'seleccionado',
    'documentos_pendientes', 'documentos_completos',
    'contratado', 'contrato_terminado', 'descartado',
  ]),
  motivo_descarte: z.string().optional(),
  motivo: z.string().optional(),
  motivo_detalle: z.string().optional(),
  fecha_terminacion: z.string().optional(),
  notas: z.string().optional(),
  forzar_auto: z.boolean().optional(),
});

export type CandidatoCreateInput = z.infer<typeof candidatoCreateSchema>;
export type CandidatoUpdateInput = z.infer<typeof candidatoUpdateSchema>;
export type AplicacionCreateInput = z.infer<typeof aplicacionCreateSchema>;
