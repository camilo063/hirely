'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Users, UserCheck, TrendingUp, BarChart2 } from 'lucide-react';
import { useReportes } from '@/hooks/useReportes';
import { KPICard } from '@/components/reportes/kpi-card';
import { FunnelChart } from '@/components/reportes/funnel-chart';
import { TimeMetrics } from '@/components/reportes/time-metrics';
import { VolumeChart } from '@/components/reportes/volume-chart';
import { TopVacantesTable } from '@/components/reportes/top-vacantes-table';
import { ScoresChart } from '@/components/reportes/scores-chart';
import { FiltrosPanel } from '@/components/reportes/filtros-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[380px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[380px] rounded-xl" />
      </div>
      <Skeleton className="h-[320px] rounded-xl" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <BarChart2 className="h-8 w-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-navy mb-2">Aun no hay datos para mostrar</h3>
      <p className="text-muted-foreground max-w-md mb-6">
        Cuando tengas candidatos en tu pipeline, aqui veras:
      </p>
      <ul className="text-sm text-muted-foreground text-left space-y-1.5 mb-8">
        <li>&#8226; Funnel de conversion por etapas</li>
        <li>&#8226; Tiempo promedio de contratacion</li>
        <li>&#8226; Volumen de aplicaciones por semana</li>
        <li>&#8226; Top vacantes por tasa de conversion</li>
      </ul>
      <Link href="/vacantes">
        <Button variant="outline">Ver vacantes activas &rarr;</Button>
      </Link>
    </div>
  );
}

export default function ReportesPage() {
  const { kpis, funnel, tiempos, volumen, topVacantes, scores, loading, error, filtros, setFiltros } = useReportes();
  const [vacantes, setVacantes] = useState<{ id: string; titulo: string }[]>([]);

  useEffect(() => {
    fetch('/api/reportes/top-vacantes?limite=50')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setVacantes(d.data.map((v: { vacanteId: string; titulo: string }) => ({ id: v.vacanteId, titulo: v.titulo })));
        }
      })
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Reportes y Analytics</h1>
          <p className="text-muted-foreground">Metricas de tu pipeline de contratacion</p>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Reportes y Analytics</h1>
        </div>
        <div className="text-center py-20 text-red-500">{error}</div>
      </div>
    );
  }

  const isEmptyState = (kpis?.totalAplicaciones || 0) < 5;

  if (isEmptyState) {
    return (
      <div className="animate-fade-in">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Reportes y Analytics</h1>
          <p className="text-muted-foreground">Metricas de tu pipeline de contratacion</p>
        </div>
        <EmptyState />
      </div>
    );
  }

  const conversionColor = (kpis?.tasaConversionGlobal || 0) >= 10
    ? 'success' as const
    : (kpis?.tasaConversionGlobal || 0) >= 5
      ? 'warning' as const
      : 'danger' as const;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Reportes y Analytics</h1>
          <p className="text-muted-foreground">Metricas de tu pipeline de contratacion</p>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosPanel filtros={filtros} onChange={setFiltros} vacantes={vacantes} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Vacantes Activas"
          valor={kpis?.vacantesActivas || 0}
          icono={<Briefcase className="h-5 w-5" />}
        />
        <KPICard
          titulo="Total Candidatos"
          valor={kpis?.totalCandidatos || 0}
          icono={<Users className="h-5 w-5" />}
        />
        <KPICard
          titulo="Contratados (90d)"
          valor={kpis?.contratados90d || 0}
          icono={<UserCheck className="h-5 w-5" />}
          color="success"
        />
        <KPICard
          titulo="Tasa de Conversion"
          valor={`${kpis?.tasaConversionGlobal || 0}%`}
          subtitulo="Ultimos 90 dias"
          icono={<TrendingUp className="h-5 w-5" />}
          color={conversionColor}
        />
      </div>

      {/* Funnel + Tiempos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-navy mb-4">
            Funnel de Conversion
            {funnel?.porVacante && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                — {funnel.porVacante.vacanteTitulo}
              </span>
            )}
          </h2>
          {funnel && <FunnelChart data={funnel} />}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Dias promedio por etapa</h2>
          {tiempos && <TimeMetrics tiempos={tiempos} />}
        </div>
      </div>

      {/* Volumen */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-navy mb-4">Volumen de Aplicaciones</h2>
        <VolumeChart data={volumen} />
      </div>

      {/* Top Vacantes + Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Top Vacantes por Conversion</h2>
          <TopVacantesTable data={topVacantes} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-navy mb-4">Distribucion de Scores</h2>
          <ScoresChart data={scores} />
        </div>
      </div>
    </div>
  );
}
