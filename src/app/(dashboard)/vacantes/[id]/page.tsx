'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin, Users, Calendar, Trash2, Globe, Eye, Loader2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import { LinkedInPublishButton } from '@/components/vacantes/linkedin-publish-button';
import { CompartirVacante } from '@/components/vacantes/compartir-vacante';
import { VacancyStatusSelector } from '@/components/vacantes/vacancy-status-selector';
import { PipelineCompleto } from '@/components/candidatos/pipeline-completo';
import { VacanteWithStats } from '@/lib/types/vacante.types';
import type { VacancyEstado } from '@/lib/services/vacancy-state-machine';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function VacanteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [vacante, setVacante] = useState<VacanteWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  async function fetchData() {
    try {
      const res = await fetch(`/api/vacantes/${params.id}`);
      const data = await res.json();
      if (data.success) setVacante(data.data);
    } catch {
      toast.error('Error cargando vacante');
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const res = await fetch(`/api/vacantes/${params.id}/publicar`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Vacante publicada en el portal');
        setVacante(prev => prev ? {
          ...prev,
          estado: 'publicada' as typeof prev.estado,
          slug: data.data.vacante.slug,
          is_published: true,
        } : prev);
      } else {
        toast.error(data.error || 'Error al publicar');
      }
    } catch {
      toast.error('Error al publicar la vacante');
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/vacantes/${params.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Vacante eliminada');
        router.push('/vacantes');
      }
    } catch {
      toast.error('Error eliminando vacante');
    }
  }

  if (loading) return <TableSkeleton />;
  if (!vacante) return <p>Vacante no encontrada</p>;

  return (
    <div className="animate-fade-in">
      <Breadcrumbs overrides={vacante ? { [params.id as string]: vacante.titulo } : undefined} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-navy">{vacante.titulo}</h1>
            <VacancyStatusSelector
              vacanteId={vacante.id}
              currentEstado={vacante.estado as VacancyEstado}
              onEstadoChange={(newEstado) => {
                setVacante((prev) => prev ? { ...prev, estado: newEstado as unknown as typeof prev.estado } : prev);
              }}
            />
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{vacante.ubicacion}</span>
            <span>{vacante.departamento}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDistanceToNow(new Date(vacante.created_at), { addSuffix: true, locale: es })}
            </span>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {/* Publish to portal — show for any non-published, non-closed state */}
          {vacante.estado !== 'publicada' && vacante.estado !== 'cerrada' && (
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="bg-teal hover:bg-teal/90 text-white gap-2"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              {publishing ? 'Publicando...' : vacante.slug ? 'Republicar vacante' : 'Publicar vacante'}
            </Button>
          )}

          {/* Share panel — only when actively published with a slug */}
          {vacante.estado === 'publicada' && vacante.slug && (
            <CompartirVacante
              slug={vacante.slug}
              vacanteTitulo={vacante.titulo}
              empresaNombre=""
            />
          )}

          {/* LinkedIn publish — only when actively published */}
          {vacante.estado === 'publicada' && (
            <LinkedInPublishButton
              vacanteId={vacante.id}
              vacanteEstado={vacante.estado}
              isPublishedOnLinkedIn={!!vacante.linkedin_job_id}
              linkedinJobId={vacante.linkedin_job_id}
            />
          )}

          <Link href={`/vacantes/${params.id}/editar`}>
            <Button variant="outline" className="gap-2">
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Button variant="outline" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="detalles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detalles">Detalles</TabsTrigger>
          <TabsTrigger value="candidatos">
            Candidatos ({vacante.total_aplicaciones})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detalles" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Descripcion</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{vacante.descripcion}</p>
            </CardContent>
          </Card>

          {vacante.rango_salarial_min && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Rango salarial</p>
                <p className="text-lg font-semibold text-navy">
                  {vacante.moneda} {new Intl.NumberFormat('es-CO').format(vacante.rango_salarial_min)}
                  {vacante.rango_salarial_max && ` - ${new Intl.NumberFormat('es-CO').format(vacante.rango_salarial_max)}`}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Criterios de evaluacion</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {Array.isArray(vacante.criterios_evaluacion)
                ? vacante.criterios_evaluacion.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{c.nombre}</span>
                      <span className="font-medium text-teal">{c.peso}%</span>
                    </div>
                  ))
                : Object.entries(vacante.criterios_evaluacion || {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{key}</span>
                      <span className="font-medium text-teal">{Math.round(Number(value) * 100)}%</span>
                    </div>
                  ))
              }
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Habilidades requeridas</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(vacante.habilidades_requeridas || []).map((h) => (
                  <span key={h} className="bg-teal/10 text-teal px-2 py-1 rounded-full text-sm">{h}</span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Portal stats */}
          {vacante.slug && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-teal" /> Portal publico</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{vacante.views_count || 0}</span>
                    <span className="text-muted-foreground">visitas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{vacante.applications_count || 0}</span>
                    <span className="text-muted-foreground">postulaciones</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="candidatos">
          <PipelineCompleto
            vacanteId={params.id as string}
            vacanteTitulo={vacante.titulo}
            scoreMinimo={vacante.score_minimo || 70}
            linkedinJobId={vacante.linkedin_job_id ?? null}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar vacante"
        description="Esta accion no se puede deshacer. Se eliminaran todas las aplicaciones asociadas."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        destructive
      />

    </div>
  );
}
