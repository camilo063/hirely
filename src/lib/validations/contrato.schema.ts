import { z } from 'zod';

const datosContratoSchema = z.object({
  nombre_completo: z.string().min(1, 'Nombre completo requerido'),
  cedula: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  correo: z.string().optional(),
  ciudad: z.string().optional(),
  empresa_nombre: z.string().optional(),
  empresa_nit: z.string().optional(),
  empresa_representante: z.string().optional(),
  empresa_direccion: z.string().optional(),
  cargo: z.string().min(1, 'Cargo requerido'),
  fecha_inicio: z.string().min(1, 'Fecha de inicio requerida'),
  fecha_fin: z.string().optional(),
  salario: z.union([z.string(), z.number()]),
  salario_letras: z.string().optional(),
  moneda: z.string().optional(),
  jornada: z.string().optional(),
  horario: z.string().optional(),
  modalidad: z.string().optional(),
  ubicacion_trabajo: z.string().optional(),
  objeto_contrato: z.string().optional(),
  obligaciones: z.string().optional(),
  duracion: z.string().optional(),
  periodo_prueba: z.string().optional(),
  clausulas_adicionales: z.string().optional(),
  fecha_contrato: z.string().optional(),
  ciudad_contrato: z.string().optional(),
  // Legacy compat
  documento_identidad: z.string().optional(),
  departamento: z.string().optional(),
  tipo_contrato: z.string().optional(),
  beneficios: z.array(z.string()).optional(),
}).passthrough();

export const contratoCreateSchema = z.object({
  aplicacion_id: z.string().uuid('ID de aplicacion invalido'),
  candidato_id: z.string().uuid('ID de candidato invalido').optional(),
  vacante_id: z.string().uuid('ID de vacante invalido').optional(),
  plantilla_id: z.string().uuid().nullable().optional(),
  tipo: z.string().min(1).optional(),
  datos: datosContratoSchema,
});

export const contratoUpdateSchema = z.object({
  datos: datosContratoSchema.partial().optional(),
  contenido_html: z.string().optional(),
  html_content: z.string().optional(),
  estado: z.enum(['borrador', 'generado', 'enviado', 'firmado', 'rechazado']).optional(),
  nota_cambio: z.string().optional(),
});

export type ContratoCreateInput = z.infer<typeof contratoCreateSchema>;
export type ContratoUpdateInput = z.infer<typeof contratoUpdateSchema>;
