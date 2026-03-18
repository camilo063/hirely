'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { EntrevistaIAReport } from '@/components/entrevistas/entrevista-ia-report';
import { EvaluacionHumanaForm } from '@/components/entrevistas/evaluacion-humana-form';
import { AgendamientoPanel } from '@/components/entrevistas/agendamiento-panel';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EntrevistaIA, EntrevistaHumanaConDetalles } from '@/lib/types/entrevista.types';

export default function EntrevistaDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tipo = searchParams.get('tipo') || 'ia';
  const [entrevistaIA, setEntrevistaIA] = useState<EntrevistaIA | null>(null);
  const [entrevistaHumana, setEntrevistaHumana] = useState<EntrevistaHumanaConDetalles | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    fetchEntrevista();
  }, [params.id, tipo]);

  async function fetchEntrevista() {
    try {
      const res = await fetch(`/api/entrevistas/${params.id}?tipo=${tipo}`);
      const data = await res.json();
      if (data.success) {
        if (tipo === 'ia') {
          setEntrevistaIA(data.data);
        } else {
          setEntrevistaHumana(data.data);
        }
      }
    } catch {
      toast.error('Error cargando entrevista');
    } finally {
      setLoading(false);
    }
  }

  const handleReanalyze = async () => {
    if (!entrevistaIA?.transcripcion) return;
    setReanalyzing(true);
    try {
      // Re-process the existing transcript through the analysis pipeline
      const res = await fetch('/api/webhooks/dapta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: entrevistaIA.dapta_call_id || `reanalyze-${entrevistaIA.id}`,
          status: 'completed',
          transcript: entrevistaIA.transcripcion,
          duration_seconds: entrevistaIA.duracion_segundos || 0,
          from_number: 'reanalyze',
          to_number: 'reanalyze',
          started_at: entrevistaIA.fecha_llamada || new Date().toISOString(),
          ended_at: new Date().toISOString(),
          metadata: { entrevista_id: entrevistaIA.id },
        }),
      });
      if (res.ok) {
        toast.success('Re-analisis completado');
        fetchEntrevista();
      } else {
        toast.error('Error en re-analisis');
      }
    } catch {
      toast.error('Error de conexion');
    } finally {
      setReanalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-teal" />
      </div>
    );
  }

  // ─── IA Interview ───
  if (tipo === 'ia' && entrevistaIA) {
    return (
      <div>
        <Breadcrumbs />
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-navy">Detalle Entrevista IA</h1>
            <p className="text-muted-foreground text-sm">
              {entrevistaIA.candidato?.nombre} — {entrevistaIA.vacante?.titulo}
            </p>
          </div>
          {entrevistaIA.transcripcion && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="gap-2"
            >
              {reanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Re-analizar
            </Button>
          )}
        </div>
        <EntrevistaIAReport entrevista={entrevistaIA} />
      </div>
    );
  }

  // ─── Human Interview ───
  if (tipo === 'humana' && entrevistaHumana) {
    const hasEvaluacion = entrevistaHumana.evaluacion && entrevistaHumana.estado === 'realizada';

    return (
      <div>
        <Breadcrumbs />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Detalle Entrevista Humana</h1>
          <p className="text-muted-foreground text-sm">
            {entrevistaHumana.candidato_nombre} {entrevistaHumana.candidato_apellido} — {entrevistaHumana.vacante_titulo}
          </p>
        </div>

        {/* Info card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Informacion</CardTitle>
              <Badge variant="outline" className="capitalize">
                {entrevistaHumana.estado?.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Candidato</p>
                <p className="font-medium">{entrevistaHumana.candidato_nombre} {entrevistaHumana.candidato_apellido}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vacante</p>
                <p className="font-medium">{entrevistaHumana.vacante_titulo}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Entrevistador</p>
                <p className="font-medium">{entrevistaHumana.entrevistador_nombre}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Fecha</p>
                <p className="font-medium">
                  {entrevistaHumana.fecha_programada
                    ? format(new Date(entrevistaHumana.fecha_programada), 'PPp', { locale: es })
                    : 'No programada'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Agendamiento panel */}
          <AgendamientoPanel
            entrevistaHumanaId={entrevistaHumana.id}
            candidatoNombre={`${entrevistaHumana.candidato_nombre} ${entrevistaHumana.candidato_apellido}`}
            candidatoEmail={entrevistaHumana.candidato_email || ''}
            vacanteTitulo={entrevistaHumana.vacante_titulo}
            emailEnviado={entrevistaHumana.email_invitacion_enviado}
            agendamientoUrl={entrevistaHumana.agendamiento_url}
          />

          {/* Evaluacion */}
          {hasEvaluacion ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Evaluacion completada</CardTitle></CardHeader>
              <CardContent>
                <p className="text-lg font-bold text-navy mb-2">Score: {entrevistaHumana.score_total}/100</p>
                <Badge className={
                  (entrevistaHumana.evaluacion as any)?.recomendacion === 'contratar' ? 'bg-success/15 text-success' :
                  (entrevistaHumana.evaluacion as any)?.recomendacion === 'considerar' ? 'bg-orange/15 text-orange' :
                  'bg-destructive/15 text-destructive'
                }>
                  {(entrevistaHumana.evaluacion as any)?.recomendacion || 'Sin recomendacion'}
                </Badge>
              </CardContent>
            </Card>
          ) : (
            <EvaluacionHumanaForm
              entrevistaHumanaId={entrevistaHumana.id}
              candidatoNombre={`${entrevistaHumana.candidato_nombre} ${entrevistaHumana.candidato_apellido}`}
              vacanteTitulo={entrevistaHumana.vacante_titulo}
              onSaved={() => fetchEntrevista()}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center py-20 text-muted-foreground">
      <p>Entrevista no encontrada</p>
    </div>
  );
}
