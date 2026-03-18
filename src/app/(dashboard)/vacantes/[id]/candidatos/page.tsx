'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { PipelineCompleto } from '@/components/candidatos/pipeline-completo';
import { TableSkeleton } from '@/components/shared/loading-skeleton';
import type { Vacante } from '@/lib/types/vacante.types';
import { toast } from 'sonner';

export default function VacantePipelinePage() {
  const params = useParams();
  const [vacante, setVacante] = useState<Vacante | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVacante() {
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
    fetchVacante();
  }, [params.id]);

  if (loading) return <TableSkeleton />;
  if (!vacante) return <p>Vacante no encontrada</p>;

  return (
    <div>
      <Breadcrumbs overrides={{ [params.id as string]: vacante.titulo }} />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Pipeline de candidatos</h1>
        <p className="text-sm text-muted-foreground">{vacante.titulo}</p>
      </div>
      <PipelineCompleto
        vacanteId={params.id as string}
        vacanteTitulo={vacante.titulo}
        scoreMinimo={vacante.score_minimo || 70}
        linkedinJobId={vacante.linkedin_job_id ?? null}
      />
    </div>
  );
}
