import { NextRequest } from 'next/server';
import { requireAuth, getOrgId } from '@/lib/auth/middleware';
import {
  obtenerKPIsGenerales,
  obtenerFunnelConversion,
  obtenerTopVacantes,
} from '@/lib/services/reportes.service';
import { apiError } from '@/lib/utils/api-response';
import type { FiltrosReporte } from '@/lib/types/reportes.types';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const orgId = await getOrgId();
    const { searchParams } = new URL(request.url);

    const filtros: FiltrosReporte = {
      vacanteId: searchParams.get('vacanteId') || undefined,
      desde: searchParams.get('desde') || undefined,
      hasta: searchParams.get('hasta') || undefined,
      periodo: (searchParams.get('periodo') as FiltrosReporte['periodo']) || undefined,
    };

    const [kpis, funnel, topVacantes] = await Promise.all([
      obtenerKPIsGenerales(orgId),
      obtenerFunnelConversion(orgId, filtros),
      obtenerTopVacantes(orgId),
    ]);

    const lines: string[] = [];

    // KPIs section
    lines.push('=== KPIs Generales ===');
    lines.push('Metrica,Valor');
    lines.push(`Vacantes Activas,${kpis.vacantesActivas}`);
    lines.push(`Total Candidatos,${kpis.totalCandidatos}`);
    lines.push(`Total Aplicaciones,${kpis.totalAplicaciones}`);
    lines.push(`Total Contratados,${kpis.totalContratados}`);
    lines.push(`Aplicaciones (90d),${kpis.aplicaciones90d}`);
    lines.push(`Contratados (90d),${kpis.contratados90d}`);
    lines.push(`Tasa Conversion Global (%),${kpis.tasaConversionGlobal}`);
    lines.push(`Score ATS Promedio,${kpis.scoreAtsPromedio ?? ''}`);
    lines.push(`Score IA Promedio,${kpis.scoreIaPromedio ?? ''}`);
    lines.push(`Score Humano Promedio,${kpis.scoreHumanoPromedio ?? ''}`);
    lines.push(`Score Tecnico Promedio,${kpis.scoreTecnicoPromedio ?? ''}`);
    lines.push(`Score Final Promedio,${kpis.scoreFinalPromedio ?? ''}`);
    lines.push(`Entrevistas IA Completadas,${kpis.entrevistasIaCompletadas}`);
    lines.push(`Entrevistas Humanas Completadas,${kpis.entrevistasHumanasCompletadas}`);
    lines.push(`Contratos Firmados,${kpis.contratosFirmados}`);
    lines.push('');

    // Funnel section
    lines.push('=== Funnel de Conversion ===');
    lines.push('Etapa,Cantidad,Porcentaje (%)');
    for (const etapa of funnel.etapas) {
      lines.push(`${etapa.etapa},${etapa.cantidad},${etapa.porcentaje}`);
    }
    lines.push(`Total,${funnel.totalAplicaciones},100`);
    lines.push('');

    // Top Vacantes section
    lines.push('=== Top Vacantes ===');
    lines.push('Vacante,Aplicaciones,Contratados,Conversion (%),Score Promedio,Dias Abierta');
    for (const v of topVacantes) {
      lines.push(
        `"${v.titulo}",${v.totalAplicaciones},${v.contratados},${v.tasaConversion},${v.scorePromedio ?? ''},${v.diasAbierta}`
      );
    }

    const csv = lines.join('\n');
    const fecha = new Date().toISOString().split('T')[0];

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="hirely-reporte-${fecha}.csv"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
