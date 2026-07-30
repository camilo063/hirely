import { z } from 'zod';
import type { Rol } from '@/lib/auth/authorization';

const ROLES: [Rol, ...Rol[]] = ['admin', 'recruiter', 'viewer'];

export const usuarioCreateSchema = z.object({
  email: z.string().email('Email invalido'),
  name: z.string().min(1, 'Nombre requerido').max(255),
  role: z.enum(ROLES),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
});

export const usuarioUpdateSchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(255).optional(),
  role: z.enum(ROLES).optional(),
  is_active: z.boolean().optional(),
});

export const usuarioResetPasswordSchema = z.object({
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres').optional(),
});

export type UsuarioCreateInput = z.infer<typeof usuarioCreateSchema>;
export type UsuarioUpdateInput = z.infer<typeof usuarioUpdateSchema>;
export type UsuarioResetPasswordInput = z.infer<typeof usuarioResetPasswordSchema>;
