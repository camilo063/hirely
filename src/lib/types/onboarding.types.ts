/**
 * Tipos para el módulo de Onboarding y Bienvenida (Módulo 8).
 */

// ─── CONFIGURACIÓN DE ONBOARDING ──────────────

export interface OnboardingConfig {
  plantilla_bienvenida: string;
  email_remitente: string;
  nombre_remitente: string;
  documentos_onboarding: DocumentoOnboarding[];
  asunto_bienvenida: string;
}

export interface DocumentoOnboarding {
  id: string;
  nombre: string;
  url: string;
  tipo: 'pdf' | 'doc' | 'link';
  descripcion?: string;
}

// ─── VARIABLES DINÁMICAS ──────────────────────

export interface VariablesBienvenida {
  nombre_empleado: string;
  cargo: string;
  empresa: string;
  fecha_inicio: string;
  area: string;
  nombre_lider: string;
  email_lider: string;
  tipo_contrato: string;
  salario: string;
  modalidad: string;
  ubicacion: string;
}

export const VARIABLES_DISPONIBLES: { key: keyof VariablesBienvenida; label: string; ejemplo: string }[] = [
  { key: 'nombre_empleado', label: 'Nombre del empleado', ejemplo: 'Carlos Méndez' },
  { key: 'cargo', label: 'Cargo', ejemplo: 'Desarrollador Full Stack' },
  { key: 'empresa', label: 'Nombre de la empresa', ejemplo: 'Nivelics' },
  { key: 'fecha_inicio', label: 'Fecha de inicio', ejemplo: '3 de marzo de 2026' },
  { key: 'area', label: 'Área / Departamento', ejemplo: 'Tecnología' },
  { key: 'nombre_lider', label: 'Nombre del líder directo', ejemplo: 'Ana García' },
  { key: 'email_lider', label: 'Email del líder', ejemplo: 'ana@nivelics.com' },
  { key: 'tipo_contrato', label: 'Tipo de contrato', ejemplo: 'Prestación de servicios' },
  { key: 'salario', label: 'Salario', ejemplo: 'COP 8.000.000' },
  { key: 'modalidad', label: 'Modalidad', ejemplo: 'Remoto' },
  { key: 'ubicacion', label: 'Ubicación', ejemplo: 'Bogotá, Colombia' },
];

// ─── ONBOARDING DE UN CANDIDATO ───────────────

export interface OnboardingCandidato {
  id: string;
  aplicacion_id: string;
  candidato_id: string;
  organization_id: string;
  fecha_inicio: string;
  email_bienvenida_estado: 'pendiente' | 'programado' | 'enviado' | 'error';
  email_bienvenida_programado_at: string | null;
  email_bienvenida_enviado_at: string | null;
  variables_custom: Partial<VariablesBienvenida>;
  notas_onboarding: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  candidato_nombre?: string;
  candidato_apellido?: string;
  candidato_email?: string;
  vacante_titulo?: string;
  vacante_id?: string;
}

// ─── PLANTILLA DEFAULT ────────────────────────

export const PLANTILLA_BIENVENIDA_DEFAULT = `
<div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #0A1F3F; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">¡Bienvenido(a) a {{empresa}}!</h1>
  </div>
  <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #0A1F3F; margin-top: 0;">Hola {{nombre_empleado}},</h2>
    <p style="color: #374151; line-height: 1.7; font-size: 16px;">
      Estamos muy emocionados de que te unas a nuestro equipo como
      <strong>{{cargo}}</strong> en el área de <strong>{{area}}</strong>.
    </p>
    <p style="color: #374151; line-height: 1.7; font-size: 16px;">
      Tu fecha de inicio es el <strong>{{fecha_inicio}}</strong>.
      Tu líder directo será <strong>{{nombre_lider}}</strong>
      (<a href="mailto:{{email_lider}}" style="color: #00BCD4;">{{email_lider}}</a>),
      quien te acompañará en tu proceso de integración.
    </p>

    <div style="background: #F0F9FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="color: #0A1F3F; margin-top: 0; font-size: 16px;">Detalles de tu vinculación</h3>
      <table style="width: 100%; font-size: 14px; color: #374151;">
        <tr><td style="padding: 4px 0; font-weight: 600;">Cargo:</td><td>{{cargo}}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Modalidad:</td><td>{{modalidad}}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Ubicación:</td><td>{{ubicacion}}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Tipo de contrato:</td><td>{{tipo_contrato}}</td></tr>
        <tr><td style="padding: 4px 0; font-weight: 600;">Fecha de inicio:</td><td>{{fecha_inicio}}</td></tr>
      </table>
    </div>

    <p style="color: #374151; line-height: 1.7; font-size: 16px;">
      A continuación encontrarás documentos importantes para tu proceso de onboarding.
      Te recomendamos revisarlos antes de tu primer día.
    </p>

    <p style="color: #374151; line-height: 1.7; font-size: 16px;">
      Si tienes alguna pregunta, no dudes en contactar a {{nombre_lider}} o al equipo de Recursos Humanos.
    </p>

    <p style="color: #374151; line-height: 1.7; font-size: 16px;">
      ¡Te esperamos con mucho entusiasmo!
    </p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Con cariño,<br>
      <strong>El equipo de {{empresa}}</strong>
    </p>
  </div>
  <div style="background: #F5F7FA; padding: 15px; border-radius: 0 0 12px 12px; text-align: center; border: 1px solid #e5e7eb; border-top: none;">
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">
      Este correo fue enviado por {{empresa}} a través de Hirely.
    </p>
  </div>
</div>
`;

export const ASUNTO_BIENVENIDA_DEFAULT = '¡Bienvenido(a) a {{empresa}}, {{nombre_empleado}}!';
