import { Resend } from 'resend';

/**
 * Resend Client — Proyecto independiente para Hirely.
 *
 * Separación por API key: Hirely y NivelLeads usan sus propias
 * RESEND_API_KEY apuntando a proyectos/dominios distintos en Resend.
 *
 * Configurar en .env:
 *   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
 *   RESEND_FROM_EMAIL=noreply@hirely.app
 */

const apiKey = process.env.RESEND_API_KEY;

export const resendClient: Resend | null = apiKey ? new Resend(apiKey) : null;

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL ?? 'noreply@hirely.app';
