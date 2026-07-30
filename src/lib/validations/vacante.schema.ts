import { z } from 'zod';

// Legacy format: array of {nombre, peso, descripcion}
const criterioArraySchema = z.array(z.object({
  nombre: z.string().min(1),
  peso: z.number().min(0).max(100),
  descripcion: z.string().optional(),
})).min(1);

// Current format: flat object with dimension weights (0-1)
const criterioObjectSchema = z.object({
  experiencia: z.number().min(0).max(1),
  habilidades: z.number().min(0).max(1),
  educacion: z.number().min(0).max(1),
  idiomas: z.number().min(0).max(1),
  certificaciones: z.number().min(0).max(1),
  keywords: z.number().min(0).max(1),
}).passthrough();

// Accept both formats
const criteriosEvaluacionSchema = z.union([criterioArraySchema, criterioObjectSchema]);

/**
 * Un <Select> de Radix sin opcion seleccionada NO aporta entrada a FormData, asi
 * que el campo llega al API como `null`, no como cadena vacia. `.optional()`
 * solo admite `undefined`, de modo que crear una vacante sin elegir
 * departamento ni tipo de contrato fallaba con un "Error de validacion" que
 * ademas no decia que campo estaba mal.
 */
const textoOpcional = z.string().nullish();

export const vacanteCreateSchema = z.object({
  titulo: z.string().min(3, 'Titulo debe tener al menos 3 caracteres').max(200),
  descripcion: z.string().min(10, 'Descripcion debe tener al menos 10 caracteres'),
  departamento: textoOpcional,
  ubicacion: z.string().min(1, 'Ubicacion requerida'),
  tipo_contrato: textoOpcional.transform((v) => v ?? ''),
  modalidad: textoOpcional,
  rango_salarial_min: z.number().positive().nullable().optional(),
  rango_salarial_max: z.number().positive().nullable().optional(),
  moneda: textoOpcional.transform((v) => v || 'COP'),
  criterios_evaluacion: criteriosEvaluacionSchema,
  habilidades_requeridas: z.array(z.string()).min(1, 'Al menos una habilidad requerida'),
  experiencia_minima: z.number().min(0).default(0),
  score_minimo: z.number().min(0).max(100).nullable().optional(),
}).refine(
  (data) => {
    if (data.rango_salarial_min && data.rango_salarial_max) {
      return data.rango_salarial_max >= data.rango_salarial_min;
    }
    return true;
  },
  { message: 'Salario maximo debe ser mayor o igual al minimo', path: ['rango_salarial_max'] }
);

export const vacanteUpdateSchema = z.object({
  titulo: z.string().min(3).max(200).optional(),
  descripcion: z.string().min(10).optional(),
  departamento: textoOpcional,
  ubicacion: z.string().min(1).optional(),
  tipo_contrato: textoOpcional,
  modalidad: textoOpcional,
  rango_salarial_min: z.number().positive().nullable().optional(),
  rango_salarial_max: z.number().positive().nullable().optional(),
  moneda: textoOpcional,
  estado: z.enum(['borrador', 'publicada', 'pausada', 'cerrada', 'archivada']).optional(),
  criterios_evaluacion: criteriosEvaluacionSchema.optional(),
  habilidades_requeridas: z.array(z.string()).optional(),
  experiencia_minima: z.number().min(0).optional(),
  score_minimo: z.number().min(0).max(100).nullable().optional(),
});

export type VacanteCreateInput = z.infer<typeof vacanteCreateSchema>;
export type VacanteUpdateInput = z.infer<typeof vacanteUpdateSchema>;
