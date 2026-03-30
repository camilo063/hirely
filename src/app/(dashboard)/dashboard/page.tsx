'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Users, ClipboardCheck, UserCheck, ArrowRight, Plus, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { EstadoBadge } from '@/components/ui/estado-badge';
import { getGreeting } from '@/lib/utils/design-tokens';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useSession } from 'next-auth/react';
import { OnboardingChecklist } from '@/components/dashboard/OnboardingChecklist';

interface DashboardData {
  stats: {
    vacantes_activas: number;
    total_candidatos: number;
    en_proceso: number;
    contratados: number;
    entrevistas_pendientes: number;
  };
  pipeline: { estado: string; count: number }[];
  recentVacantes: {
    id: string;
    titulo: string;
    estado: string;
    departamento: string;
    ubicacion: string;
    created_at: string;
    total_aplicaciones: number;
    en_proceso: number;
  }[];
  activity: {
    tipo: string;
    descripcion: string;
    detalle: string;
    created_at: string;
  }[];
}

const PIPELINE_STAGES = [
  { key: 'nuevo', label: 'Nuevo', color: 'bg-gray-400' },
  { key: 'en_revision', label: 'Revision', color: 'bg-blue-400' },
  { key: 'preseleccionado', label: 'Preselec.', color: 'bg-purple-400' },
  { key: 'entrevista_ia', label: 'Entrev. IA', color: 'bg-indigo-400' },
  { key: 'entrevista_humana', label: 'Entrev. H', color: 'bg-amber-400' },
  { key: 'seleccionado', label: 'Seleccion', color: 'bg-green-400' },
  { key: 'contratado', label: 'Contratado', color: 'bg-emerald-500' },
];

export default function DashboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/dashboard');
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        }
      } catch {
        console.error('Error fetching dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const pipelineMap = new Map((data?.pipeline || []).map(p => [p.estado, p.count]));
  const totalPipeline = (data?.pipeline || []).reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="animate-fade-in">
      {/* Onboarding checklist — disappears when all steps complete or dismissed */}
      <OnboardingChecklist />

      {/* Greeting */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            {getGreeting()}, {session?.user?.name?.split(' ')[0] || 'Usuario'}
          </h1>
          <p className="text-muted-foreground mt-0.5">Aqui tienes un resumen de tu reclutamiento</p>
        </div>
        <Link href="/vacantes/nueva">
          <Button className="bg-teal hover:bg-teal/90 text-white gap-2">
            <Plus className="h-4 w-4" />
            Nueva vacante
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-16" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              title="Vacantes activas"
              value={data?.stats.vacantes_activas ?? 0}
              icon={Briefcase}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
            <StatCard
              title="Total candidatos"
              value={data?.stats.total_candidatos ?? 0}
              icon={Users}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              title="En proceso"
              value={data?.stats.en_proceso ?? 0}
              icon={TrendingUp}
              iconBg="bg-purple-50"
              iconColor="text-purple-600"
            />
            <StatCard
              title="Contratados"
              value={data?.stats.contratados ?? 0}
              icon={UserCheck}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
          </>
        )}
      </div>

      {/* Pipeline Visual */}
      {!loading && totalPipeline > 0 && (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Pipeline de candidatos</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Bar */}
            <div className="flex h-3 rounded-full overflow-hidden bg-gray-100 mb-4">
              {PIPELINE_STAGES.map((stage) => {
                const count = pipelineMap.get(stage.key) || 0;
                if (count === 0) return null;
                const pct = (count / totalPipeline) * 100;
                return (
                  <div
                    key={stage.key}
                    className={`${stage.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                    title={`${stage.label}: ${count}`}
                  />
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {PIPELINE_STAGES.map((stage) => {
                const count = pipelineMap.get(stage.key) || 0;
                return (
                  <div key={stage.key} className="flex items-center gap-1.5 text-xs">
                    <div className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                    <span className="text-muted-foreground">{stage.label}</span>
                    <span className="font-semibold text-navy">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Vacantes - takes 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Vacantes recientes</CardTitle>
              <Link href="/vacantes" className="text-xs text-teal hover:underline font-medium">
                Ver todas
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!loading && data?.recentVacantes && data.recentVacantes.length > 0 ? (
              <div className="space-y-1">
                {data.recentVacantes.map((v) => (
                  <Link key={v.id} href={`/vacantes/${v.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-soft-gray transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-teal/10 flex items-center justify-center shrink-0">
                          <Briefcase className="h-4 w-4 text-teal" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-navy truncate">{v.titulo}</p>
                          <p className="text-xs text-muted-foreground">{v.departamento} &middot; {v.ubicacion}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-muted-foreground">{v.total_aplicaciones} candidatos</span>
                        <EstadoBadge estado={v.estado} variant="vacante" size="sm" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : !loading ? (
              <p className="text-center text-muted-foreground py-6 text-sm">No hay vacantes aun</p>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actividad reciente</CardTitle>
          </CardHeader>
          <CardContent>
            {!loading && data?.activity && data.activity.length > 0 ? (
              <div className="space-y-4">
                {data.activity.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                        a.tipo === 'aplicacion' ? 'bg-teal' : 'bg-indigo-400'
                      }`} />
                      {i < data.activity.length - 1 && (
                        <div className="w-px flex-1 bg-gray-200 mt-1" />
                      )}
                    </div>
                    <div className="pb-3 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{a.descripcion.trim()}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.detalle}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : !loading ? (
              <p className="text-center text-muted-foreground py-6 text-sm">Sin actividad reciente</p>
            ) : (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-3 justify-center">
            {[
              { label: 'Crear vacante', href: '/vacantes/nueva', icon: Briefcase },
              { label: 'Ver candidatos', href: '/candidatos', icon: Users },
              { label: 'Entrevistas', href: '/entrevistas', icon: ClipboardCheck },
              { label: 'Contratos', href: '/contratos', icon: UserCheck },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <Button variant="outline" size="sm" className="gap-2 text-xs h-8">
                  <action.icon className="h-3.5 w-3.5 text-teal" />
                  {action.label}
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
