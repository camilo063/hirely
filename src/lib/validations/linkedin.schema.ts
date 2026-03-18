import { z } from 'zod';

export const linkedInCallbackSchema = z.object({
  code: z.string().min(1, 'Codigo de autorizacion requerido'),
  state: z.string().min(1, 'State requerido'),
});

export const linkedInShareSchema = z.object({
  content: z
    .string()
    .min(10, 'El contenido debe tener al menos 10 caracteres')
    .max(3000, 'El contenido no puede exceder 3000 caracteres'),
  visibility: z.enum(['PUBLIC', 'CONNECTIONS']).default('PUBLIC'),
});

export type LinkedInCallbackInput = z.infer<typeof linkedInCallbackSchema>;
export type LinkedInShareInput = z.infer<typeof linkedInShareSchema>;
