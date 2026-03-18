import { z } from 'zod';

const criterioSchema = z.object({
  nombre: z.string().min(1, 'Nombre del criterio requerido'),
  peso: z.number().min(0).max(100),
  descripcion: z.string().optional(),
});

export const vacanteCreateSchema = z.object({
  titulo: z.string().min(3, 'Titulo debe tener al menos 3 caracteres').max(200),
  descripcion: z.string().min(10, 'Descripcion debe tener al menos 10 caracteres'),
  departamento: z.string().optional(),
  ubicacion: z.string().min(1, 'Ubicacion requerida'),
  tipo_contrato: z.string().min(1, 'Tipo de contrato requerido'),
  modalidad: z.string().optional(),
  rango_salarial_min: z.number().positive().nullable().optional(),
  rango_salarial_max: z.number().positive().nullable().optional(),
  moneda: z.string().default('COP'),
  criterios_evaluacion: z.array(criterioSchema).min(1, 'Al menos un criterio de evaluacion'),
  habilidades_requeridas: z.array(z.string()).min(1, 'Al menos una habilidad requerida'),
  experiencia_minima: z.number().min(0).default(0),
  score_minimo: z.number().min(0).max(100).optional(),
}).refine(
  (data) => {
    if (data.rango_salarial_min && data.rango_salarial_max) {
      return data.rango_salarial_max >= data.rango_salarial_min;
    }
    return true;
  },
  { message: 'Salario maximo debe ser mayor o igual al minimo', path: ['rango_salarial_max'] }
).refine(
  (data) => {
    const totalPeso = data.criterios_evaluacion.reduce((sum, c) => sum + c.peso, 0);
    return totalPeso === 100;
  },
  { message: 'Los pesos de los criterios deben sumar 100', path: ['criterios_evaluacion'] }
);

export const vacanteUpdateSchema = z.object({
  titulo: z.string().min(3).max(200).optional(),
  descripcion: z.string().min(10).optional(),
  departamento: z.string().min(1).optional(),
  ubicacion: z.string().min(1).optional(),
  tipo_contrato: z.string().min(1).optional(),
  modalidad: z.string().optional(),
  rango_salarial_min: z.number().positive().nullable().optional(),
  rango_salarial_max: z.number().positive().nullable().optional(),
  moneda: z.string().optional(),
  estado: z.enum(['borrador', 'publicada', 'pausada', 'cerrada', 'archivada']).optional(),
  criterios_evaluacion: z.array(criterioSchema).optional(),
  habilidades_requeridas: z.array(z.string()).optional(),
  experiencia_minima: z.number().min(0).optional(),
  score_minimo: z.number().min(0).max(100).optional(),
});

export type VacanteCreateInput = z.infer<typeof vacanteCreateSchema>;
export type VacanteUpdateInput = z.infer<typeof vacanteUpdateSchema>;
