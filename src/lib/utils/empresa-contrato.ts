import type { DatosContrato } from '@/lib/types/contrato.types';

// Respuesta del endpoint GET /api/configuracion/empresa
export interface EmpresaConfigResponse {
  nombre_empresa?: string;
  config?: Record<string, string>;
}

// Etiquetas legibles de los campos de empresa (para banners/avisos).
export const EMPRESA_FIELD_LABELS: Record<string, string> = {
  empresa_nombre: 'Nombre de la empresa',
  empresa_nit: 'NIT',
  empresa_representante: 'Representante legal',
  empresa_cargo_representante: 'Cargo del representante',
  empresa_direccion: 'Dirección',
  empresa_telefono: 'Teléfono',
  empresa_email: 'Correo',
  empresa_departamento: 'Departamento',
  empresa_pais: 'País',
  ciudad_contrato: 'Ciudad del contrato',
};

// Mapea las claves de config_empresa (Configuración › Empresa) a las variables
// de plantilla de contrato. Fuente única de verdad para ese mapeo en el cliente.
export function mapEmpresaConfigToDatos(d: EmpresaConfigResponse): Record<string, string> {
  const cfg = d.config || {};
  return {
    empresa_nombre: d.nombre_empresa || '',
    empresa_nit: cfg.nit || '',
    empresa_representante: cfg.representante_legal || '',
    empresa_cargo_representante: cfg.cargo_representante || '',
    empresa_direccion: cfg.direccion || '',
    empresa_telefono: cfg.telefono_empresa || '',
    empresa_email: cfg.email_empresa || '',
    empresa_departamento: cfg.departamento || '',
    empresa_pais: cfg.pais || '',
    ciudad_contrato: cfg.ciudad || '',
  };
}

// Compara los datos de empresa guardados en el contrato contra la config actual.
// Devuelve las claves cuyos valores difieren. Solo considera campos que la config
// tiene con valor, para evitar falsos positivos cuando la config está incompleta.
export function getStaleEmpresaFields(
  datos: Partial<DatosContrato> | null | undefined,
  empresaDatos: Record<string, string>,
): string[] {
  const stale: string[] = [];
  for (const [key, cfgVal] of Object.entries(empresaDatos)) {
    const trimmed = (cfgVal || '').trim();
    if (!trimmed) continue; // config vacía → no comparar
    const contratoVal = String((datos as Record<string, unknown>)?.[key] ?? '').trim();
    if (contratoVal !== trimmed) stale.push(key);
  }
  return stale;
}
